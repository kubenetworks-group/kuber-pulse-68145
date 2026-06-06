-- Cluster Access Manager: tabelas para grants de acesso e audit trail
-- Permite ao dono do cluster criar kubeconfigs restritos para colaboradores,
-- rastrear atividade e revogar acessos individualmente.

-- ── Tabela principal de grants ────────────────────────────────────────────────
CREATE TABLE public.cluster_access_grants (
  id                       uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cluster_id               uuid        NOT NULL REFERENCES public.clusters(id) ON DELETE CASCADE,
  grantee_name             text        NOT NULL,
  grantee_email            text,
  access_role              text        NOT NULL DEFAULT 'viewer'
                           CHECK (access_role IN ('viewer', 'developer', 'operator')),
  namespace                text        DEFAULT NULL,   -- NULL = cluster-wide (ClusterRole)
  serviceaccount_name      text        NOT NULL,
  serviceaccount_namespace text        NOT NULL DEFAULT 'kodo-access',
  status                   text        NOT NULL DEFAULT 'active'
                           CHECK (status IN ('active', 'revoked', 'expired')),
  notes                    text,
  kubeconfig_yaml          text,                       -- kubeconfig gerado para download
  expires_at               timestamptz DEFAULT NULL,
  revoked_at               timestamptz DEFAULT NULL,
  revoked_by               uuid        REFERENCES auth.users(id),
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);

-- ── Tabela de audit trail por grant ──────────────────────────────────────────
CREATE TABLE public.cluster_access_audit_logs (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  access_grant_id    uuid        NOT NULL REFERENCES public.cluster_access_grants(id) ON DELETE CASCADE,
  cluster_id         uuid        NOT NULL REFERENCES public.clusters(id) ON DELETE CASCADE,
  event_type         text        NOT NULL,
  -- grant_created | kubeconfig_downloaded | access_revoked | access_expired
  -- k8s_get | k8s_list | k8s_create | k8s_update | k8s_delete | k8s_exec | k8s_logs | k8s_patch
  resource_type      text,       -- pods, secrets, deployments, configmaps, etc.
  resource_name      text,
  resource_namespace text,
  details            jsonb       NOT NULL DEFAULT '{}',
  created_at         timestamptz NOT NULL DEFAULT now()
);

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE public.cluster_access_grants    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cluster_access_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own grants"
  ON public.cluster_access_grants FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins view all grants"
  ON public.cluster_access_grants FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users view own audit logs"
  ON public.cluster_access_audit_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.cluster_access_grants g
      WHERE g.id = access_grant_id AND g.user_id = auth.uid()
    )
  );

CREATE POLICY "System inserts audit logs"
  ON public.cluster_access_audit_logs FOR INSERT
  WITH CHECK (true);

-- ── Índices ───────────────────────────────────────────────────────────────────
CREATE INDEX idx_access_grants_user_id   ON public.cluster_access_grants(user_id);
CREATE INDEX idx_access_grants_cluster   ON public.cluster_access_grants(cluster_id);
CREATE INDEX idx_access_grants_status    ON public.cluster_access_grants(status);
CREATE INDEX idx_access_grants_expires   ON public.cluster_access_grants(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX idx_access_audit_grant      ON public.cluster_access_audit_logs(access_grant_id);
CREATE INDEX idx_access_audit_cluster    ON public.cluster_access_audit_logs(cluster_id);
CREATE INDEX idx_access_audit_created    ON public.cluster_access_audit_logs(created_at DESC);

-- ── Trigger updated_at ────────────────────────────────────────────────────────
CREATE TRIGGER set_access_grants_updated_at
  BEFORE UPDATE ON public.cluster_access_grants
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── Realtime ─────────────────────────────────────────────────────────────────
ALTER TABLE public.cluster_access_grants     REPLICA IDENTITY FULL;
ALTER TABLE public.cluster_access_audit_logs REPLICA IDENTITY FULL;
