-- Add remediation tracking columns to pod_restart_audit
-- remediation_status lifecycle: NULL → 'pending_approval' → 'approved'/'rejected' → 'fixed'/'failed'
ALTER TABLE public.pod_restart_audit
  ADD COLUMN IF NOT EXISTS remediation_status TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS remediation_action TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS remediation_command_id UUID DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS remediation_result JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS remediation_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS remediation_approved_by UUID DEFAULT NULL;

-- When analysis_summary is populated the record is ready for approval
CREATE INDEX IF NOT EXISTS idx_pod_restart_audit_remediation
  ON public.pod_restart_audit(cluster_id, remediation_status, created_at DESC)
  WHERE analysis_summary IS NOT NULL;
