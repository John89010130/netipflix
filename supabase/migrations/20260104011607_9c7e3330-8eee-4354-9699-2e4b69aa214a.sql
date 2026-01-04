-- Adicionar campos para cache de teste de streams
ALTER TABLE channels 
ADD COLUMN IF NOT EXISTS last_tested_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS last_test_status text;

-- Adicionar senha de conteúdo adulto no perfil
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS adult_password text;