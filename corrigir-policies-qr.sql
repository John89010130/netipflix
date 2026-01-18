-- Remover políticas antigas
DROP POLICY IF EXISTS "Permitir criação de tokens" ON public.qr_login_tokens;
DROP POLICY IF EXISTS "Permitir leitura de tokens" ON public.qr_login_tokens;
DROP POLICY IF EXISTS "Permitir atualização de tokens" ON public.qr_login_tokens;

-- Recriar políticas mais permissivas
CREATE POLICY "Permitir todas operações nos tokens QR"
  ON public.qr_login_tokens
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Verificar se RLS está ativado
ALTER TABLE public.qr_login_tokens ENABLE ROW LEVEL SECURITY;

-- Ver políticas atuais
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'qr_login_tokens';
