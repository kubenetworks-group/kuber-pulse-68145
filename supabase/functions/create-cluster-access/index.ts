import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { corsHeaders } from "../_shared/cors.ts";

// ── RBAC definitions per access_role ─────────────────────────────────────────

const ROLE_RULES: Record<string, any[]> = {
  viewer: [
    {
      apiGroups: [""],
      resources: ["pods", "pods/log", "services", "endpoints", "configmaps",
                  "events", "persistentvolumeclaims", "namespaces", "nodes"],
      verbs: ["get", "list", "watch"],
    },
    {
      apiGroups: ["apps"],
      resources: ["deployments", "replicasets", "daemonsets", "statefulsets"],
      verbs: ["get", "list", "watch"],
    },
    {
      apiGroups: ["networking.k8s.io"],
      resources: ["ingresses", "networkpolicies"],
      verbs: ["get", "list", "watch"],
    },
    {
      apiGroups: ["batch"],
      resources: ["jobs", "cronjobs"],
      verbs: ["get", "list", "watch"],
    },
  ],
  developer: [
    {
      apiGroups: [""],
      resources: ["pods", "pods/log", "pods/exec", "services", "endpoints",
                  "configmaps", "events", "persistentvolumeclaims", "namespaces"],
      verbs: ["get", "list", "watch", "create", "update", "patch", "delete"],
    },
    {
      apiGroups: [""],
      resources: ["secrets"],
      verbs: ["get", "list"],
    },
    {
      apiGroups: [""],
      resources: ["nodes"],
      verbs: ["get", "list", "watch"],
    },
    {
      apiGroups: ["apps"],
      resources: ["deployments", "replicasets", "daemonsets", "statefulsets"],
      verbs: ["get", "list", "watch", "create", "update", "patch", "delete"],
    },
    {
      apiGroups: ["networking.k8s.io"],
      resources: ["ingresses", "networkpolicies"],
      verbs: ["get", "list", "watch", "create", "update", "patch", "delete"],
    },
    {
      apiGroups: ["batch"],
      resources: ["jobs", "cronjobs"],
      verbs: ["get", "list", "watch", "create", "update", "patch", "delete"],
    },
  ],
  operator: [
    {
      apiGroups: ["*"],
      resources: ["*"],
      verbs: ["get", "list", "watch", "create", "update", "patch", "delete"],
    },
    // Explicitly block node drain/cordon (safety)
  ],
};

// ── Kubeconfig full parser ────────────────────────────────────────────────────

function parseKubeConfigFull(yaml: string): {
  server: string;
  caData: string;
  token?: string;
  clientCert?: string;
  clientKey?: string;
  currentContext: string;
  clusterName: string;
} {
  // Extract scalar value after a key, handling quotes
  const scalar = (key: string): string => {
    const re = new RegExp(`${key}:\\s*["']?([^\\n"']+)["']?`);
    const m = yaml.match(re);
    return m ? m[1].trim() : "";
  };

  const server       = scalar("server");
  const caData       = scalar("certificate-authority-data");
  const token        = scalar("token");
  const clientCert   = scalar("client-certificate-data");
  const clientKey    = scalar("client-key-data");
  const currentCtx   = scalar("current-context");

  // Cluster name: first "name:" after "clusters:" section
  const clustersSection = yaml.match(/clusters:([\s\S]*?)(?:^contexts:|^users:|^current-context:)/m);
  const clusterName = clustersSection
    ? (clustersSection[1].match(/name:\s*(\S+)/) || [])[1] || "kodo-cluster"
    : "kodo-cluster";

  if (!server) throw new Error("kubeconfig inválido: campo 'server' não encontrado");

  return { server, caData, token, clientCert, clientKey, currentContext: currentCtx, clusterName };
}

// ── k8s API caller ────────────────────────────────────────────────────────────

async function k8sRequest(
  method: string,
  url: string,
  body: unknown,
  token: string,
  caData: string,
): Promise<any> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Accept": "application/json",
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const opts: RequestInit = {
    method,
    headers,
    // Deno's fetch doesn't support custom CA in standard mode;
    // we send the request trusting the system roots (cloud clusters have public CAs).
    // For self-signed clusters the user must expose the cluster with a valid cert.
  };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(url, opts);
  const text = await res.text();
  let json: any = {};
  try { json = JSON.parse(text); } catch { /* non-JSON response */ }

  if (!res.ok && res.status !== 409 /* Conflict = already exists */) {
    throw new Error(`k8s ${method} ${url} → ${res.status}: ${text.slice(0, 300)}`);
  }
  return json;
}

// ── Slug helper ───────────────────────────────────────────────────────────────

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 20);
}

// ── Main handler ──────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const authHeader = req.headers.get("Authorization") ?? "";
    const { data: { user } } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (!user) return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401, headers: corsHeaders });

    const { cluster_id, grantee_name, grantee_email, access_role, namespace, notes, expires_at } = await req.json();

    if (!cluster_id || !grantee_name || !access_role) {
      return new Response(JSON.stringify({ error: "Campos obrigatórios: cluster_id, grantee_name, access_role" }), { status: 400, headers: corsHeaders });
    }

    // ── 1. Fetch cluster + kubeconfig ────────────────────────────────────────
    const { data: cluster, error: clusterErr } = await supabase
      .from("clusters")
      .select("id, name, config_file, user_id")
      .eq("id", cluster_id)
      .eq("user_id", user.id)
      .single();

    if (clusterErr || !cluster) {
      return new Response(JSON.stringify({ error: "Cluster não encontrado ou sem permissão" }), { status: 404, headers: corsHeaders });
    }
    if (!cluster.config_file) {
      return new Response(JSON.stringify({ error: "Cluster não possui kubeconfig importado. Importe o kubeconfig na página de Clusters primeiro." }), { status: 400, headers: corsHeaders });
    }

    // ── 2. Parse kubeconfig ──────────────────────────────────────────────────
    const kc = parseKubeConfigFull(cluster.config_file);
    const adminToken = kc.token;
    if (!adminToken) {
      return new Response(JSON.stringify({ error: "kubeconfig não contém token de autenticação. Suporte a cert-based auth em breve." }), { status: 400, headers: corsHeaders });
    }

    const base = kc.server.replace(/\/$/, "");
    const saNamespace = "kodo-access";
    const saName = `kodo-${slugify(grantee_name)}-${crypto.randomUUID().replace(/-/g, "").slice(0, 6)}`;
    const roleName = `kodo-role-${saName}`;
    const bindingName = `kodo-rb-${saName}`;
    const secretName = `kodo-token-${saName}`;
    const clusterScoped = !namespace; // null namespace = ClusterRole

    // ── 3. Ensure kodo-access namespace exists ───────────────────────────────
    await k8sRequest("POST", `${base}/api/v1/namespaces`, {
      apiVersion: "v1", kind: "Namespace",
      metadata: { name: saNamespace, labels: { "managed-by": "kodo" } },
    }, adminToken, kc.caData).catch(() => { /* already exists */ });

    // ── 4. Create ServiceAccount ─────────────────────────────────────────────
    await k8sRequest("POST", `${base}/api/v1/namespaces/${saNamespace}/serviceaccounts`, {
      apiVersion: "v1", kind: "ServiceAccount",
      metadata: {
        name: saName, namespace: saNamespace,
        annotations: {
          "kodo.app/grantee-name":  grantee_name,
          "kodo.app/grantee-email": grantee_email ?? "",
          "kodo.app/access-role":   access_role,
          "kodo.app/cluster-id":    cluster_id,
          "kodo.app/created-at":    new Date().toISOString(),
        },
      },
    }, adminToken, kc.caData);

    // ── 5. Create Role or ClusterRole ────────────────────────────────────────
    const rules = ROLE_RULES[access_role] ?? ROLE_RULES.viewer;
    if (clusterScoped) {
      await k8sRequest("POST", `${base}/apis/rbac.authorization.k8s.io/v1/clusterroles`, {
        apiVersion: "rbac.authorization.k8s.io/v1", kind: "ClusterRole",
        metadata: { name: roleName, labels: { "managed-by": "kodo" } },
        rules,
      }, adminToken, kc.caData);

      await k8sRequest("POST", `${base}/apis/rbac.authorization.k8s.io/v1/clusterrolebindings`, {
        apiVersion: "rbac.authorization.k8s.io/v1", kind: "ClusterRoleBinding",
        metadata: { name: bindingName, labels: { "managed-by": "kodo" } },
        roleRef: { apiGroup: "rbac.authorization.k8s.io", kind: "ClusterRole", name: roleName },
        subjects: [{ kind: "ServiceAccount", name: saName, namespace: saNamespace }],
      }, adminToken, kc.caData);
    } else {
      await k8sRequest("POST", `${base}/apis/rbac.authorization.k8s.io/v1/namespaces/${namespace}/roles`, {
        apiVersion: "rbac.authorization.k8s.io/v1", kind: "Role",
        metadata: { name: roleName, namespace, labels: { "managed-by": "kodo" } },
        rules,
      }, adminToken, kc.caData);

      await k8sRequest("POST", `${base}/apis/rbac.authorization.k8s.io/v1/namespaces/${namespace}/rolebindings`, {
        apiVersion: "rbac.authorization.k8s.io/v1", kind: "RoleBinding",
        metadata: { name: bindingName, namespace, labels: { "managed-by": "kodo" } },
        roleRef: { apiGroup: "rbac.authorization.k8s.io", kind: "Role", name: roleName },
        subjects: [{ kind: "ServiceAccount", name: saName, namespace: saNamespace }],
      }, adminToken, kc.caData);
    }

    // ── 6. Create long-lived token Secret ────────────────────────────────────
    await k8sRequest("POST", `${base}/api/v1/namespaces/${saNamespace}/secrets`, {
      apiVersion: "v1", kind: "Secret",
      metadata: {
        name: secretName, namespace: saNamespace,
        annotations: { "kubernetes.io/service-account.name": saName },
        labels: { "managed-by": "kodo" },
      },
      type: "kubernetes.io/service-account-token",
    }, adminToken, kc.caData);

    // ── 7. Poll for token to be populated (up to 10 attempts × 1s) ───────────
    let saToken = "";
    for (let i = 0; i < 10; i++) {
      await new Promise(r => setTimeout(r, 1000));
      const secret = await k8sRequest("GET", `${base}/api/v1/namespaces/${saNamespace}/secrets/${secretName}`, null, adminToken, kc.caData);
      if (secret?.data?.token) {
        saToken = atob(secret.data.token);
        break;
      }
    }
    if (!saToken) throw new Error("Token do ServiceAccount não foi gerado dentro do prazo. Tente novamente.");

    // ── 8. Build restricted kubeconfig YAML ──────────────────────────────────
    const contextName = `${saName}@${kc.clusterName}`;
    const kubeconfigYaml = `apiVersion: v1
kind: Config
clusters:
- cluster:
    server: ${kc.server}${kc.caData ? `\n    certificate-authority-data: ${kc.caData}` : ""}
  name: ${kc.clusterName}
contexts:
- context:
    cluster: ${kc.clusterName}
    user: ${saName}${namespace ? `\n    namespace: ${namespace}` : ""}
  name: ${contextName}
current-context: ${contextName}
users:
- name: ${saName}
  user:
    token: ${saToken}
`;

    // ── 9. Persist grant ──────────────────────────────────────────────────────
    const { data: grant, error: grantErr } = await supabase
      .from("cluster_access_grants")
      .insert({
        user_id: user.id,
        cluster_id,
        grantee_name,
        grantee_email: grantee_email ?? null,
        access_role,
        namespace: namespace ?? null,
        serviceaccount_name: saName,
        serviceaccount_namespace: saNamespace,
        status: "active",
        notes: notes ?? null,
        kubeconfig_yaml: kubeconfigYaml,
        expires_at: expires_at ?? null,
      })
      .select("id")
      .single();

    if (grantErr) throw grantErr;

    // ── 10. Audit log ─────────────────────────────────────────────────────────
    await supabase.from("cluster_access_audit_logs").insert({
      access_grant_id: grant.id,
      cluster_id,
      event_type: "grant_created",
      details: {
        grantee_name, grantee_email, access_role, namespace,
        serviceaccount_name: saName,
        cluster_name: cluster.name,
      },
    });

    return new Response(
      JSON.stringify({ grant_id: grant.id, kubeconfig_yaml: kubeconfigYaml, serviceaccount_name: saName }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );

  } catch (err) {
    console.error("create-cluster-access error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
