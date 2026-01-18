-- Remover foreign key que está bloqueando o UPDATE
ALTER TABLE IF EXISTS public.qr_login_tokens 
DROP CONSTRAINT IF EXISTS qr_login_tokens_user_id_fkey;

-- Verificar se foi removida
SELECT 
  conname AS constraint_name,
  contype AS constraint_type
FROM pg_constraint 
WHERE conrelid = 'public.qr_login_tokens'::regclass;
