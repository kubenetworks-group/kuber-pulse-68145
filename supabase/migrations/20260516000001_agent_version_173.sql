-- Register agent v0.1.73 as the latest version
INSERT INTO agent_versions (version, release_notes, release_type, is_latest, is_required, min_compatible_version)
VALUES (
  'v0.1.73',
  'Correções de migração: recuperação de PVCs em estado Lost, skip de namespaces de infraestrutura, panic recovery nos comandos, truncamento de payload de resultado, comando send_metrics para refresh imediato',
  'minor',
  true,
  false,
  'v0.0.50'
)
ON CONFLICT (version) DO UPDATE SET
  is_latest = true,
  release_notes = EXCLUDED.release_notes;

-- Ensure only v0.1.73 is marked as latest
UPDATE agent_versions SET is_latest = false WHERE version != 'v0.1.73';
