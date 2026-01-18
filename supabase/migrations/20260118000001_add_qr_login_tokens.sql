-- Tabela para armazenar tokens temporários de QR Code Login
CREATE TABLE IF NOT EXISTS public.qr_login_tokens (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  token text NOT NULL UNIQUE,
  used boolean DEFAULT false,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  temp_password text,
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now(),
  used_at timestamptz,
  CONSTRAINT token_expires_check CHECK (expires_at > created_at)
);

-- Índices para melhorar performance
CREATE INDEX idx_qr_tokens_token ON public.qr_login_tokens(token);
CREATE INDEX idx_qr_tokens_used ON public.qr_login_tokens(used);
CREATE INDEX idx_qr_tokens_expires_at ON public.qr_login_tokens(expires_at);

-- Política RLS - permitir inserção sem autenticação (para gerar tokens)
ALTER TABLE public.qr_login_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir criação de tokens" ON public.qr_login_tokens
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Permitir leitura de tokens" ON public.qr_login_tokens
  FOR SELECT
  USING (true);

CREATE POLICY "Permitir atualização de tokens" ON public.qr_login_tokens
  FOR UPDATE
  USING (true);

-- Função para limpar tokens expirados automaticamente (executar periodicamente)
CREATE OR REPLACE FUNCTION clean_expired_qr_tokens()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM public.qr_login_tokens
  WHERE expires_at < NOW() - INTERVAL '1 hour';
END;
$$;

-- Comentários
COMMENT ON TABLE public.qr_login_tokens IS 'Armazena tokens temporários para autenticação via QR Code';
COMMENT ON COLUMN public.qr_login_tokens.token IS 'Token único gerado para o QR Code';
COMMENT ON COLUMN public.qr_login_tokens.used IS 'Indica se o token já foi utilizado';
COMMENT ON COLUMN public.qr_login_tokens.temp_password IS 'Senha temporária para transferir autenticação (usada uma vez)';
COMMENT ON COLUMN public.qr_login_tokens.expires_at IS 'Data e hora de expiração do token (5 minutos)';
