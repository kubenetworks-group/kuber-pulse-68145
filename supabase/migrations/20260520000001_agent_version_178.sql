-- Register agent v0.1.78 as the latest version
INSERT INTO agent_versions (version, release_notes, release_type, is_latest, is_required, min_compatible_version)
VALUES (
  'v0.1.78',
  'Adicionadas coletas de Deployments, Daemon Sets, Stateful Sets, Jobs, Cron Jobs e Network Policies para os submenus do Kubernetes. Correção de Dockerfile para executar como usuário não-root (/app workdir).',
  'minor',
  true,
  false,
  'v0.0.50'
)
ON CONFLICT (version) DO UPDATE SET
  is_latest = true,
  release_notes = EXCLUDED.release_notes;

-- Ensure only v0.1.78 is marked as latest
UPDATE agent_versions SET is_latest = false WHERE version != 'v0.1.78';
