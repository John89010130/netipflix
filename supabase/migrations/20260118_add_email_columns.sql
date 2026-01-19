-- Adicionar coluna email nas tabelas de histórico e favoritos
-- Para permitir sincronização entre dispositivos independente do user_id

-- Watch History
ALTER TABLE watch_history ADD COLUMN IF NOT EXISTS email TEXT;
CREATE INDEX IF NOT EXISTS idx_watch_history_email ON watch_history(email);

-- Favorites
ALTER TABLE favorites ADD COLUMN IF NOT EXISTS email TEXT;
CREATE INDEX IF NOT EXISTS idx_favorites_email ON favorites(email);

-- Copiar emails existentes do auth.users
UPDATE watch_history wh
SET email = u.email
FROM auth.users u
WHERE wh.user_id = u.id AND wh.email IS NULL;

UPDATE favorites f
SET email = u.email
FROM auth.users u
WHERE f.user_id = u.id AND f.email IS NULL;

-- TV Login Codes - já tem email, só garantir index
CREATE INDEX IF NOT EXISTS idx_tv_login_codes_email ON tv_login_codes(email);
