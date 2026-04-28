-- Register agent v0.0.56 as the latest version
-- Changes: heartbeat fix (agent-get-commands), self-update namespace auto-detection, collectPreviousLogs

INSERT INTO agent_versions (version, release_notes, release_type, is_latest, is_required, min_compatible_version)
VALUES (
  'v0.0.56',
  'Corrige problema de agentes aparecendo como offline; auto-update agora detecta o namespace correto automaticamente; coleta logs de containers crashados para diagnóstico de IA',
  'minor',
  true,
  false,
  'v0.0.50'
)
ON CONFLICT (version) DO UPDATE SET
  is_latest = true,
  release_notes = EXCLUDED.release_notes;

-- Ensure only v0.0.56 is marked as latest
UPDATE agent_versions SET is_latest = false WHERE version != 'v0.0.56';
