-- Tabela para códigos de login da TV
-- Execute este SQL no Supabase

CREATE TABLE IF NOT EXISTS tv_login_codes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code VARCHAR(6) NOT NULL UNIQUE,
  used BOOLEAN DEFAULT FALSE,
  user_id UUID REFERENCES auth.users(id),
  email VARCHAR(255),
  temp_password VARCHAR(255),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índice para busca rápida
CREATE INDEX IF NOT EXISTS idx_tv_login_codes_code ON tv_login_codes(code);

-- Habilitar RLS
ALTER TABLE tv_login_codes ENABLE ROW LEVEL SECURITY;

-- Políticas permissivas (qualquer um pode criar e ler)
CREATE POLICY "Qualquer um pode criar código" ON tv_login_codes
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Qualquer um pode ler código" ON tv_login_codes
  FOR SELECT USING (true);

CREATE POLICY "Qualquer um pode atualizar código" ON tv_login_codes
  FOR UPDATE USING (true);

-- Limpar códigos expirados automaticamente (opcional)
-- CREATE OR REPLACE FUNCTION cleanup_expired_codes()
-- RETURNS void AS $$
-- BEGIN
--   DELETE FROM tv_login_codes WHERE expires_at < NOW() - INTERVAL '1 hour';
-- END;
-- $$ LANGUAGE plpgsql;
