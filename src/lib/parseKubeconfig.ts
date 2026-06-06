// Shared kubeconfig parser — reads users, contexts and auth types
// from a kubeconfig YAML string without an external YAML library.

export type KubeAuthType =
  | "token"
  | "client-certificate"
  | "exec-aws"
  | "exec-gcp"
  | "exec-oidc"
  | "exec"
  | "unknown";

export interface KubeUser {
  name: string;
  authType: KubeAuthType;
  namespace: string | null;
  isCurrentContext: boolean;
}

// ── State-machine line parser ────────────────────────────────────────────────

function getIndent(line: string): number {
  let i = 0;
  while (i < line.length && line[i] === " ") i++;
  return i;
}

/**
 * Parse a kubeconfig YAML string and return the list of users with their
 * auth type and context namespace. Works with all common kubeconfig formats.
 */
export function parseKubeconfigUsers(yaml: string): KubeUser[] {
  if (!yaml?.trim()) return [];

  const lines = yaml.split("\n");

  // ── Pass 1: extract current-context ────────────────────────────────────
  let currentContext = "";
  for (const line of lines) {
    const m = line.match(/^current-context:\s*["']?(.+?)["']?\s*$/);
    if (m) { currentContext = m[1].trim(); break; }
  }

  // ── Pass 2: extract contexts as { contextName → { user, namespace } } ──
  const contextMap: Record<string, { user: string; namespace: string | null }> = {};
  let inContexts = false;
  let inContextBlock = false;
  let ctxName = "";
  let ctxUser = "";
  let ctxNs: string | null = null;

  for (const raw of lines) {
    const trimmed = raw.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const indent = getIndent(raw);

    if (indent === 0) {
      // Flush previous context block
      if (inContextBlock && ctxName && ctxUser) {
        contextMap[ctxName] = { user: ctxUser, namespace: ctxNs };
      }
      inContextBlock = false; ctxName = ""; ctxUser = ""; ctxNs = null;
      inContexts = trimmed.startsWith("contexts:");
      continue;
    }

    if (!inContexts) continue;

    if (trimmed.startsWith("- ")) {
      // Flush previous
      if (inContextBlock && ctxName && ctxUser) {
        contextMap[ctxName] = { user: ctxUser, namespace: ctxNs };
      }
      inContextBlock = true; ctxName = ""; ctxUser = ""; ctxNs = null;
      const inlineNameMatch = trimmed.match(/name:\s*(.+)/);
      if (inlineNameMatch) ctxName = inlineNameMatch[1].trim().replace(/^["']|["']$/g, "");
      continue;
    }

    if (!inContextBlock) continue;

    const nameMatch = trimmed.match(/^name:\s*(.+)/);
    if (nameMatch) { ctxName = nameMatch[1].trim().replace(/^["']|["']$/g, ""); continue; }

    const userMatch = trimmed.match(/^user:\s*(.+)/);
    if (userMatch) { ctxUser = userMatch[1].trim().replace(/^["']|["']$/g, ""); continue; }

    const nsMatch = trimmed.match(/^namespace:\s*(.+)/);
    if (nsMatch) { ctxNs = nsMatch[1].trim().replace(/^["']|["']$/g, ""); continue; }
  }
  // Flush last context
  if (inContextBlock && ctxName && ctxUser) {
    contextMap[ctxName] = { user: ctxUser, namespace: ctxNs };
  }

  // ── Pass 3: extract users with auth type ────────────────────────────────
  const users: KubeUser[] = [];
  let inUsers = false;
  let inUserBlock = false;
  let userName = "";
  const userFlags = { token: false, cert: false, exec: false, execCmd: "" };

  function flushUser() {
    if (!userName) return;
    let authType: KubeAuthType = "unknown";
    if (userFlags.token) authType = "token";
    else if (userFlags.cert) authType = "client-certificate";
    else if (userFlags.exec) {
      const cmd = userFlags.execCmd.toLowerCase();
      if (cmd.includes("aws") || cmd.includes("eks")) authType = "exec-aws";
      else if (cmd.includes("gcloud") || cmd.includes("gke")) authType = "exec-gcp";
      else if (cmd.includes("oidc") || cmd.includes("kubelogin")) authType = "exec-oidc";
      else authType = "exec";
    }

    // Find which contexts reference this user
    const refCtx = Object.entries(contextMap).find(([, v]) => v.user === userName);
    const namespace = refCtx?.[1]?.namespace ?? null;
    const isCurrentContext = Object.entries(contextMap).some(
      ([ctx, v]) => v.user === userName && ctx === currentContext,
    );

    users.push({ name: userName, authType, namespace, isCurrentContext });
    userName = ""; userFlags.token = false; userFlags.cert = false;
    userFlags.exec = false; userFlags.execCmd = "";
  }

  for (const raw of lines) {
    const trimmed = raw.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const indent = getIndent(raw);

    if (indent === 0) {
      if (inUserBlock) flushUser();
      inUserBlock = false;
      inUsers = trimmed.startsWith("users:");
      continue;
    }

    if (!inUsers) continue;

    if (trimmed.startsWith("- ")) {
      if (inUserBlock) flushUser();
      inUserBlock = true;
      const inlineNameMatch = trimmed.match(/name:\s*(.+)/);
      if (inlineNameMatch) userName = inlineNameMatch[1].trim().replace(/^["']|["']$/g, "");
      continue;
    }

    if (!inUserBlock) continue;

    const nameMatch = trimmed.match(/^name:\s*(.+)/);
    if (nameMatch) { userName = nameMatch[1].trim().replace(/^["']|["']$/g, ""); continue; }

    if (/^token:\s*\S/.test(trimmed)) { userFlags.token = true; continue; }
    if (/^client-certificate-data:\s*\S/.test(trimmed)) { userFlags.cert = true; continue; }
    if (/^exec:/.test(trimmed)) { userFlags.exec = true; continue; }
    if (userFlags.exec && /^command:\s*(.+)/.test(trimmed)) {
      userFlags.execCmd = trimmed.replace(/^command:\s*/, "").replace(/^["']|["']$/g, "");
    }
  }
  if (inUserBlock) flushUser();

  return users;
}

// ── Auth type display helpers ────────────────────────────────────────────────

export const AUTH_TYPE_LABELS: Record<KubeAuthType, string> = {
  "token":              "Token",
  "client-certificate": "Certificado de Cliente",
  "exec-aws":           "Plugin AWS (EKS)",
  "exec-gcp":           "Plugin GCP (GKE)",
  "exec-oidc":          "Plugin OIDC",
  "exec":               "Exec Plugin",
  "unknown":            "Desconhecido",
};
