import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { corsHeaders } from "../_shared/cors.ts";

// ── RBAC rules per role ───────────────────────────────────────────────────────

const ROLE_RULES: Record<string, { apiGroups: string[]; resources: string[]; verbs: string[] }[]> = {
  viewer: [
    { apiGroups: [""], resources: ["pods", "pods/log", "services", "endpoints", "configmaps", "events", "persistentvolumeclaims", "namespaces", "nodes"], verbs: ["get", "list", "watch"] },
    { apiGroups: ["apps"], resources: ["deployments", "replicasets", "daemonsets", "statefulsets"], verbs: ["get", "list", "watch"] },
    { apiGroups: ["networking.k8s.io"], resources: ["ingresses", "networkpolicies"], verbs: ["get", "list", "watch"] },
    { apiGroups: ["batch"], resources: ["jobs", "cronjobs"], verbs: ["get", "list", "watch"] },
  ],
  developer: [
    { apiGroups: [""], resources: ["pods", "pods/log", "pods/exec", "services", "endpoints", "configmaps", "events", "persistentvolumeclaims", "namespaces"], verbs: ["get", "list", "watch", "create", "update", "patch", "delete"] },
    { apiGroups: [""], resources: ["secrets"], verbs: ["get", "list"] },
    { apiGroups: [""], resources: ["nodes"], verbs: ["get", "list", "watch"] },
    { apiGroups: ["apps"], resources: ["deployments", "replicasets", "daemonsets", "statefulsets"], verbs: ["get", "list", "watch", "create", "update", "patch", "delete"] },
    { apiGroups: ["networking.k8s.io"], resources: ["ingresses", "networkpolicies"], verbs: ["get", "list", "watch", "create", "update", "patch", "delete"] },
    { apiGroups: ["batch"], resources: ["jobs", "cronjobs"], verbs: ["get", "list", "watch", "create", "update", "patch", "delete"] },
  ],
  operator: [
    { apiGroups: ["*"], resources: ["*"], verbs: ["get", "list", "watch", "create", "update", "patch", "delete"] },
  ],
};

const ROLE_LABELS: Record<string, string> = {
  viewer:    "Somente Leitura",
  developer: "Desenvolvedor",
  operator:  "Operador",
};

// ── Slug helper ───────────────────────────────────────────────────────────────

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 20);
}

// ── YAML rule serializer ──────────────────────────────────────────────────────

function rulesYaml(rules: { apiGroups: string[]; resources: string[]; verbs: string[] }[]): string {
  return rules.map((r) => [
    `- apiGroups: [${r.apiGroups.map((g) => JSON.stringify(g)).join(", ")}]`,
    `  resources: [${r.resources.map((x) => JSON.stringify(x)).join(", ")}]`,
    `  verbs: [${r.verbs.map((v) => JSON.stringify(v)).join(", ")}]`,
  ].join("\n")).join("\n");
}

// ── Setup script builder ──────────────────────────────────────────────────────

function buildSetupScript(opts: {
  granteeName: string;
  accessRole:  string;
  namespace:   string | null;
  saName:      string;
  saNamespace: string;
  secretName:  string;
  roleName:    string;
  bindingName: string;
  rules:       { apiGroups: string[]; resources: string[]; verbs: string[] }[];
  expiresAt:   string | null;
  notes:       string | null;
  generatedAt: string;
}): string {
  const clusterScoped = !opts.namespace;
  const roleKind      = clusterScoped ? "ClusterRole" : "Role";
  const bindingKind   = clusterScoped ? "ClusterRoleBinding" : "RoleBinding";
  const roleUrl       = clusterScoped
    ? `/apis/rbac.authorization.k8s.io/v1/clusterroles`
    : `/apis/rbac.authorization.k8s.io/v1/namespaces/${opts.namespace}/roles`;
  const bindingUrl    = clusterScoped
    ? `/apis/rbac.authorization.k8s.io/v1/clusterrolebindings`
    : `/apis/rbac.authorization.k8s.io/v1/namespaces/${opts.namespace}/rolebindings`;

  const nsMetadata = clusterScoped ? "" : `  namespace: ${opts.namespace}\n`;
  const ctxNamespace = opts.namespace ? `\n    namespace: ${opts.namespace}` : "";

  const namespaceYaml = `apiVersion: v1
kind: Namespace
metadata:
  name: ${opts.saNamespace}
  labels:
    managed-by: kodo`;

  const saYaml = `apiVersion: v1
kind: ServiceAccount
metadata:
  name: ${opts.saName}
  namespace: ${opts.saNamespace}
  annotations:
    kodo.app/grantee-name: "${opts.granteeName}"
    kodo.app/access-role: "${opts.accessRole}"
  labels:
    managed-by: kodo`;

  const roleYaml = `apiVersion: rbac.authorization.k8s.io/v1
kind: ${roleKind}
metadata:
  name: ${opts.roleName}
${nsMetadata}  labels:
    managed-by: kodo
rules:
${rulesYaml(opts.rules)}`;

  const bindingYaml = `apiVersion: rbac.authorization.k8s.io/v1
kind: ${bindingKind}
metadata:
  name: ${opts.bindingName}
${nsMetadata}  labels:
    managed-by: kodo
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ${roleKind}
  name: ${opts.roleName}
subjects:
- kind: ServiceAccount
  name: ${opts.saName}
  namespace: ${opts.saNamespace}`;

  const secretYaml = `apiVersion: v1
kind: Secret
metadata:
  name: ${opts.secretName}
  namespace: ${opts.saNamespace}
  annotations:
    kubernetes.io/service-account.name: ${opts.saName}
  labels:
    managed-by: kodo
type: kubernetes.io/service-account-token`;

  const expLine   = opts.expiresAt ? `# Expira em:   ${opts.expiresAt}` : "";
  const notesLine = opts.notes     ? `# Observações: ${opts.notes}`     : "";

  return `#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# Kodo — Script de Acesso Restrito ao Cluster
# Colaborador:  ${opts.granteeName}
# Perfil:       ${ROLE_LABELS[opts.accessRole] ?? opts.accessRole}
# Namespace:    ${opts.namespace ?? "Todos (ClusterRole)"}
${expLine}
${notesLine}
# Gerado em:   ${opts.generatedAt}
# ─────────────────────────────────────────────────────────────────────────────
#
# COMO USAR:
#   1. Execute este script em uma máquina com kubectl configurado como
#      administrador do cluster de destino.
#
#   bash $(basename "$0")
#
#   2. Copie o kubeconfig impresso ao final e envie para ${opts.granteeName}.
#
#   3. Para revogar o acesso depois, use o botão "Revogar" no painel Kodo.
#      Os recursos criados no cluster serão removidos pelo agente automaticamente.
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

SA_NAME="${opts.saName}"
SA_NS="${opts.saNamespace}"
SECRET_NAME="${opts.secretName}"

echo "→ Criando recursos no cluster..."

kubectl apply -f - <<'YAML'
${namespaceYaml}
---
${saYaml}
---
${roleYaml}
---
${bindingYaml}
---
${secretYaml}
YAML

echo "→ Aguardando geração do token (até 30s)..."
TOKEN=""
for i in $(seq 1 30); do
  TOKEN=$(kubectl get secret "$SECRET_NAME" -n "$SA_NS" \\
    -o jsonpath='{.data.token}' 2>/dev/null | base64 --decode 2>/dev/null || true)
  [ -n "$TOKEN" ] && break
  sleep 1
done

if [ -z "$TOKEN" ]; then
  echo "ERRO: Token não foi gerado. Verifique se o cluster tem o controller de ServiceAccount ativo."
  exit 1
fi

CLUSTER_SERVER=$(kubectl config view --minify -o jsonpath='{.clusters[0].cluster.server}')
CLUSTER_CA=$(kubectl config view --minify --raw -o jsonpath='{.clusters[0].cluster.certificate-authority-data}')
CLUSTER_NAME=$(kubectl config view --minify -o jsonpath='{.clusters[0].name}')
CONTEXT_NAME="${opts.saName}@$CLUSTER_NAME"

echo ""
echo "✓ Acesso criado com sucesso!"
echo ""
echo "══════════════════════════════════════════════════════════════════"
echo " Kubeconfig para: ${opts.granteeName}"
echo "══════════════════════════════════════════════════════════════════"
cat <<KUBECONFIG
apiVersion: v1
kind: Config
clusters:
- cluster:
    server: $CLUSTER_SERVER
    certificate-authority-data: $CLUSTER_CA
  name: $CLUSTER_NAME
contexts:
- context:
    cluster: $CLUSTER_NAME
    user: ${opts.saName}${ctxNamespace}
  name: $CONTEXT_NAME
current-context: $CONTEXT_NAME
users:
- name: ${opts.saName}
  user:
    token: $TOKEN
KUBECONFIG
echo "══════════════════════════════════════════════════════════════════"
echo ""
echo "Salve o conteúdo acima em um arquivo e envie para ${opts.granteeName}."
echo "Exemplo: kubectl --kubeconfig=kodo-${slugify(opts.granteeName)}.yaml get pods"
`;
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
    if (!user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401, headers: corsHeaders });
    }

    const { cluster_id, grantee_name, grantee_email, access_role, namespace, notes, expires_at } = await req.json();

    if (!cluster_id || !grantee_name || !access_role) {
      return new Response(
        JSON.stringify({ error: "Campos obrigatórios: cluster_id, grantee_name, access_role" }),
        { status: 400, headers: corsHeaders },
      );
    }

    // Verify cluster ownership
    const { data: cluster, error: clusterErr } = await supabase
      .from("clusters")
      .select("id, name, user_id")
      .eq("id", cluster_id)
      .eq("user_id", user.id)
      .single();

    if (clusterErr || !cluster) {
      return new Response(
        JSON.stringify({ error: "Cluster não encontrado ou sem permissão" }),
        { status: 404, headers: corsHeaders },
      );
    }

    // Build resource names
    const saNamespace  = "kodo-access";
    const saName       = `kodo-${slugify(grantee_name)}-${crypto.randomUUID().replace(/-/g, "").slice(0, 6)}`;
    const roleName     = `kodo-role-${saName}`;
    const bindingName  = `kodo-rb-${saName}`;
    const secretName   = `kodo-token-${saName}`;
    const rules        = ROLE_RULES[access_role] ?? ROLE_RULES.viewer;
    const generatedAt  = new Date().toISOString();

    // Generate setup script
    const setupScript = buildSetupScript({
      granteeName: grantee_name,
      accessRole:  access_role,
      namespace:   namespace ?? null,
      saName,
      saNamespace,
      secretName,
      roleName,
      bindingName,
      rules,
      expiresAt:  expires_at ?? null,
      notes:      notes ?? null,
      generatedAt,
    });

    // Persist grant record
    const { data: grant, error: grantErr } = await supabase
      .from("cluster_access_grants")
      .insert({
        user_id:                  user.id,
        cluster_id,
        grantee_name,
        grantee_email:            grantee_email ?? null,
        access_role,
        namespace:                namespace ?? null,
        serviceaccount_name:      saName,
        serviceaccount_namespace: saNamespace,
        status:                   "active",
        notes:                    notes ?? null,
        kubeconfig_yaml:          setupScript,
        expires_at:               expires_at ?? null,
      })
      .select("id")
      .single();

    if (grantErr) throw grantErr;

    // Audit log
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
      JSON.stringify({ grant_id: grant.id, setup_script: setupScript, serviceaccount_name: saName }),
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
