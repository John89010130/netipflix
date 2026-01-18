-- Remove foreign key constraint que está bloqueando UPDATE
ALTER TABLE IF EXISTS public.qr_login_tokens 
DROP CONSTRAINT IF EXISTS qr_login_tokens_user_id_fkey;

-- Comentário explicativo
COMMENT ON COLUMN public.qr_login_tokens.user_id IS 'UUID do usuário do auth.users (sem foreign key para permitir update)';
