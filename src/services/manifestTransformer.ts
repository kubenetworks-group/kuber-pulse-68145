// manifestTransformer.ts
// Transforms K8s manifests from a source cluster to be compatible with a target cluster.
// Handles StorageClass remapping, AccessMode downgrade, and cloud-provider annotation stripping.

export interface TransformationRule {
  resource: string;
  kind: string;
  namespace?: string;
  change: string;
  reason: string;
}

export interface TransformationResult {
  manifests: Record<string, unknown[]>;
  log: TransformationRule[];
  issuesFound: number;
  issuesFixed: number;
}

export interface CompatibilityIssue {
  severity: "critical" | "warning" | "info";
  resource: string;
  kind: string;
  namespace?: string;
  issue: string;
  suggestion: string;
  autoFixable: boolean;
}

// Cloud-provider-specific StorageClasses that MUST be remapped when moving to a
// different cloud/provider. Classes NOT in this map are treated as potentially
// portable (e.g. microk8s-hostpath, longhorn, rook-ceph-block) and are left
// unchanged so the agent can validate against what the target cluster actually has.
const STORAGE_CLASS_MAP: Record<string, string> = {
  // Azure
  "managed-premium": "standard",
  "managed-standard": "standard",
  "azurefile": "standard",
  "azurefile-premium": "standard",
  "azurefile-csi": "standard",
  "managed-csi": "standard",
  "managed-csi-premium": "standard",
  // AWS
  "gp2": "standard",
  "gp3": "standard",
  "io1": "standard",
  "io2": "standard",
  "ebs-sc": "standard",
  "efs-sc": "standard",
  // GCP
  "standard-rwo": "standard",
  "premium-rwo": "standard",
  "pd-standard": "standard",
  "pd-ssd": "standard",
  // Oracle
  "oci": "standard",
  "oci-bv": "standard",
  // Default literal
  "default": "standard",
  // NOTE: microk8s-hostpath, longhorn, rook-ceph-block, cinder, local-path, etc.
  // are intentionally NOT listed here — they may exist with the same name on the
  // target cluster and the agent will handle any actual mismatch at apply time.
};

// Cloud-provider specific annotations to strip
const CLOUD_ANNOTATIONS_TO_STRIP = [
  "service.beta.kubernetes.io/aws-load-balancer",
  "service.beta.kubernetes.io/azure-load-balancer",
  "cloud.google.com/",
  "networking.gke.io/",
  "azure.com/",
  "eks.amazonaws.com/",
  "oci.oraclecloud.com/",
  "cloud-provider-",
  "volume.beta.kubernetes.io/storage-class",
  "volume.beta.kubernetes.io/storage-provisioner",
  "pv.kubernetes.io/provisioned-by",
  "pv.kubernetes.io/bound-by-controller",
];

// AccessModes that need downgrade (multi-node → single-node)
const ACCESS_MODE_DOWNGRADE: Record<string, string> = {
  "ReadWriteMany": "ReadWriteOnce",
};

export function analyzeCompatibility(
  manifests: Record<string, unknown[]>,
  targetStorageClass: string = "standard"
): CompatibilityIssue[] {
  const issues: CompatibilityIssue[] = [];

  // Analyze PVCs
  const pvcs = (manifests["pvcs"] ?? []) as Record<string, unknown>[];
  for (const pvc of pvcs) {
    const meta = pvc["metadata"] as Record<string, unknown>;
    const spec = pvc["spec"] as Record<string, unknown>;
    const name = meta?.["name"] as string;
    const ns = meta?.["namespace"] as string;
    const sc = spec?.["storageClassName"] as string;
    const accessModes = (spec?.["accessModes"] as string[]) ?? [];

    if (sc && sc !== targetStorageClass && sc in STORAGE_CLASS_MAP) {
      issues.push({
        severity: "warning",
        kind: "PersistentVolumeClaim",
        resource: name,
        namespace: ns,
        issue: `StorageClass "${sc}" é específica de provedor de nuvem e pode não existir no cluster destino`,
        suggestion: `Será substituída por "${targetStorageClass}" — o agente validará no momento de aplicar`,
        autoFixable: true,
      });
    } else if (sc && sc !== targetStorageClass && !(sc in STORAGE_CLASS_MAP)) {
      issues.push({
        severity: "info",
        kind: "PersistentVolumeClaim",
        resource: name,
        namespace: ns,
        issue: `StorageClass "${sc}" não é uma classe de provedor conhecida — será mantida`,
        suggestion: `O agente verificará se "${sc}" existe no cluster destino e usará o default caso contrário`,
        autoFixable: true,
      });
    }

    for (const mode of accessModes) {
      if (mode in ACCESS_MODE_DOWNGRADE) {
        issues.push({
          severity: "critical",
          kind: "PersistentVolumeClaim",
          resource: name,
          namespace: ns,
          issue: `AccessMode "${mode}" may not be supported on the target cluster (requires multi-node shared storage)`,
          suggestion: `Downgrade to "${ACCESS_MODE_DOWNGRADE[mode]}" — verify your app supports single-writer mode`,
          autoFixable: true,
        });
      }
    }
  }

  // Analyze Services for cloud-specific LB annotations
  const services = (manifests["services"] ?? []) as Record<string, unknown>[];
  for (const svc of services) {
    const meta = svc["metadata"] as Record<string, unknown>;
    const annotations = (meta?.["annotations"] as Record<string, string>) ?? {};
    const name = meta?.["name"] as string;
    const ns = meta?.["namespace"] as string;

    for (const annotation of Object.keys(annotations)) {
      if (CLOUD_ANNOTATIONS_TO_STRIP.some((prefix) => annotation.startsWith(prefix))) {
        issues.push({
          severity: "warning",
          kind: "Service",
          resource: name,
          namespace: ns,
          issue: `Cloud-provider annotation "${annotation}" will not work on the target cluster`,
          suggestion: "Strip provider-specific annotations before applying",
          autoFixable: true,
        });
        break; // one issue per service is enough
      }
    }
  }

  // Analyze Deployments for cloud-specific node selectors / tolerations
  const deployments = (manifests["deployments"] ?? []) as Record<string, unknown>[];
  for (const depl of deployments) {
    const meta = depl["metadata"] as Record<string, unknown>;
    const spec = depl["spec"] as Record<string, unknown>;
    const template = spec?.["template"] as Record<string, unknown>;
    const podSpec = (template?.["spec"] as Record<string, unknown>) ?? {};
    const name = meta?.["name"] as string;
    const ns = meta?.["namespace"] as string;
    const nodeSelector = (podSpec["nodeSelector"] as Record<string, string>) ?? {};

    for (const key of Object.keys(nodeSelector)) {
      if (
        key.includes("kubernetes.azure.com") ||
        key.includes("eks.amazonaws.com") ||
        key.includes("cloud.google.com") ||
        key.includes("node.kubernetes.io/instance-type")
      ) {
        issues.push({
          severity: "warning",
          kind: "Deployment",
          resource: name,
          namespace: ns,
          issue: `Cloud-specific nodeSelector "${key}" may not match nodes on the target cluster`,
          suggestion: "Remove or replace with target-compatible node labels",
          autoFixable: true,
        });
        break;
      }
    }
  }

  return issues;
}

export function transformManifests(
  manifests: Record<string, unknown[]>,
  targetStorageClass: string = "standard"
): TransformationResult {
  const log: TransformationRule[] = [];
  let issuesFound = 0;
  let issuesFixed = 0;

  const transformed: Record<string, unknown[]> = {};

  // --- PVCs ---
  transformed["pvcs"] = ((manifests["pvcs"] ?? []) as Record<string, unknown>[]).map((pvc) => {
    const pvcClone = JSON.parse(JSON.stringify(pvc)) as Record<string, unknown>;
    const meta = pvcClone["metadata"] as Record<string, unknown>;
    const spec = pvcClone["spec"] as Record<string, unknown>;
    const name = meta?.["name"] as string;
    const ns = meta?.["namespace"] as string;

    // StorageClass remap — only remap known provider-specific classes.
    // Custom/unknown classes (e.g. microk8s-hostpath, longhorn, rook-ceph) are kept
    // as-is so they survive to the agent, which will validate against what actually
    // exists on the target cluster at apply time.
    const sc = spec?.["storageClassName"] as string;
    if (sc && sc !== targetStorageClass && sc in STORAGE_CLASS_MAP) {
      issuesFound++;
      spec["storageClassName"] = targetStorageClass;
      log.push({ resource: name, kind: "PVC", namespace: ns, change: `storageClassName: "${sc}" → "${targetStorageClass}"`, reason: "Provider-specific StorageClass remapped for target cluster" });
      issuesFixed++;
    }

    // AccessMode downgrade
    const accessModes = (spec?.["accessModes"] as string[]) ?? [];
    const newModes = accessModes.map((mode) => {
      if (mode in ACCESS_MODE_DOWNGRADE) {
        issuesFound++;
        const newMode = ACCESS_MODE_DOWNGRADE[mode];
        log.push({ resource: name, kind: "PVC", namespace: ns, change: `accessMode: "${mode}" → "${newMode}"`, reason: "ReadWriteMany requires multi-node shared storage (Ceph/NFS); downgraded for compatibility" });
        issuesFixed++;
        return newMode;
      }
      return mode;
    });
    spec["accessModes"] = newModes;

    // Strip provider annotations from PVC
    const annotations = (meta?.["annotations"] as Record<string, string>) ?? {};
    const cleanAnnotations: Record<string, string> = {};
    for (const [k, v] of Object.entries(annotations)) {
      if (!CLOUD_ANNOTATIONS_TO_STRIP.some((prefix) => k.startsWith(prefix))) {
        cleanAnnotations[k] = v;
      }
    }
    meta["annotations"] = cleanAnnotations;

    // Clear immutable fields
    delete (meta as Record<string, unknown>)["resourceVersion"];
    delete (meta as Record<string, unknown>)["uid"];
    delete (meta as Record<string, unknown>)["creationTimestamp"];
    delete (pvcClone as Record<string, unknown>)["status"];
    if (spec["volumeName"]) {
      spec["volumeName"] = "";
    }

    return pvcClone;
  });

  // --- Services ---
  transformed["services"] = ((manifests["services"] ?? []) as Record<string, unknown>[]).map((svc) => {
    const svcClone = JSON.parse(JSON.stringify(svc)) as Record<string, unknown>;
    const meta = svcClone["metadata"] as Record<string, unknown>;
    const spec = svcClone["spec"] as Record<string, unknown>;
    const name = meta?.["name"] as string;
    const ns = meta?.["namespace"] as string;

    if (name === "kubernetes" && ns === "default") return svcClone;

    // Strip cloud annotations
    const annotations = (meta?.["annotations"] as Record<string, string>) ?? {};
    const cleanAnnotations: Record<string, string> = {};
    let stripped = false;
    for (const [k, v] of Object.entries(annotations)) {
      if (CLOUD_ANNOTATIONS_TO_STRIP.some((prefix) => k.startsWith(prefix))) {
        if (!stripped) {
          issuesFound++;
          log.push({ resource: name, kind: "Service", namespace: ns, change: `Stripped cloud-provider annotations`, reason: "Provider-specific LB annotations incompatible with target" });
          issuesFixed++;
          stripped = true;
        }
      } else {
        cleanAnnotations[k] = v;
      }
    }
    meta["annotations"] = cleanAnnotations;

    // Clear immutable fields
    spec["clusterIP"] = undefined;
    spec["clusterIPs"] = undefined;
    delete (meta as Record<string, unknown>)["resourceVersion"];
    delete (meta as Record<string, unknown>)["uid"];
    delete (meta as Record<string, unknown>)["creationTimestamp"];
    delete (svcClone as Record<string, unknown>)["status"];

    return svcClone;
  });

  // --- Deployments ---
  transformed["deployments"] = ((manifests["deployments"] ?? []) as Record<string, unknown>[]).map((depl) => {
    const deplClone = JSON.parse(JSON.stringify(depl)) as Record<string, unknown>;
    const meta = deplClone["metadata"] as Record<string, unknown>;
    const spec = deplClone["spec"] as Record<string, unknown>;
    const template = spec?.["template"] as Record<string, unknown>;
    const podSpec = (template?.["spec"] as Record<string, unknown>) ?? {};
    const name = meta?.["name"] as string;
    const ns = meta?.["namespace"] as string;

    // Strip cloud-specific nodeSelector keys
    const nodeSelector = (podSpec["nodeSelector"] as Record<string, string>) ?? {};
    const cleanNodeSelector: Record<string, string> = {};
    let selectorStripped = false;
    for (const [k, v] of Object.entries(nodeSelector)) {
      if (
        k.includes("kubernetes.azure.com") ||
        k.includes("eks.amazonaws.com") ||
        k.includes("cloud.google.com") ||
        k.includes("node.kubernetes.io/instance-type")
      ) {
        if (!selectorStripped) {
          issuesFound++;
          log.push({ resource: name, kind: "Deployment", namespace: ns, change: `Stripped cloud-specific nodeSelector keys`, reason: "Target cluster node labels differ from source" });
          issuesFixed++;
          selectorStripped = true;
        }
      } else {
        cleanNodeSelector[k] = v;
      }
    }
    if (Object.keys(cleanNodeSelector).length < Object.keys(nodeSelector).length) {
      podSpec["nodeSelector"] = cleanNodeSelector;
    }

    // Clear immutable fields
    delete (meta as Record<string, unknown>)["resourceVersion"];
    delete (meta as Record<string, unknown>)["uid"];
    delete (meta as Record<string, unknown>)["creationTimestamp"];
    delete (deplClone as Record<string, unknown>)["status"];

    return deplClone;
  });

  // Pass through other resource types (stripped of immutable fields)
  const passthroughKinds = ["statefulsets", "daemonsets", "configmaps", "secrets", "ingresses", "hpas", "namespaces", "storageclasses"];
  for (const kind of passthroughKinds) {
    transformed[kind] = ((manifests[kind] ?? []) as Record<string, unknown>[]).map((item) => {
      const clone = JSON.parse(JSON.stringify(item)) as Record<string, unknown>;
      const meta = clone["metadata"] as Record<string, unknown>;
      if (meta) {
        delete meta["resourceVersion"];
        delete meta["uid"];
        delete meta["creationTimestamp"];
        delete meta["managedFields"];
      }
      delete clone["status"];
      return clone;
    });
  }

  return { manifests: transformed, log, issuesFound, issuesFixed };
}
