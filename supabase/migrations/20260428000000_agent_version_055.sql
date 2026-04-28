-- Update agent_versions to set v0.0.55 as the latest version
-- The trigger ensure_single_latest_version will automatically set previous versions to is_latest = false

INSERT INTO public.agent_versions (version, release_notes, release_type, is_latest, is_required)
VALUES (
  'v0.0.55',
  E'Melhorias e correções:\n- Suporte a visualização de logs de containers (get_pod_logs)\n- Auto-update automático via métricas (clusters offline atualizam ao voltar online)\n- Detecção de restart do agente com histórico de causa e solução aplicada\n- Fix: agent-check-update agora lê versão do banco em vez de valor hardcoded',
  'patch',
  true,
  false
)
ON CONFLICT (version) DO UPDATE SET
  is_latest = true,
  release_notes = EXCLUDED.release_notes;
