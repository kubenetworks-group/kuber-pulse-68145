-- Migration: Proteger API keys - remover texto plano e manter apenas hash

-- 1. Atualizar todas as API keys existentes que têm api_key mas não têm hash
-- Primeiro, limpar as API keys em texto plano, mantendo apenas o hash
UPDATE agent_api_keys 
SET api_key = 'REDACTED_' || SUBSTRING(api_key, 1, 8)
WHERE api_key IS NOT NULL 
  AND api_key NOT LIKE 'REDACTED_%'
  AND api_key_hash IS NOT NULL;

-- 2. Para keys antigas sem hash, gerar um placeholder (precisarão ser regeneradas)
UPDATE agent_api_keys 
SET 
  api_key = 'LEGACY_KEY_NEEDS_REGENERATION',
  api_key_prefix = COALESCE(api_key_prefix, 'kp_legacy...')
WHERE api_key_hash IS NULL;

-- 3. Adicionar comentário de segurança na coluna
COMMENT ON COLUMN agent_api_keys.api_key IS 'DEPRECATED: This column no longer stores plaintext API keys. Only the hash is used for authentication.';