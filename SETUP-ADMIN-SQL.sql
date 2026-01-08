-- ============================================
-- SETUP COMPLETO ADMIN - NETIPFLIX
-- Execute no SQL Editor do Supabase:
-- https://supabase.com/dashboard/project/kwhusiffihtdmmvaqgxx/sql/new
-- ============================================

-- 1. Promover john89010130@gmail.com a ADMIN_MASTER
DO $$
DECLARE
  user_uuid UUID;
BEGIN
  SELECT id INTO user_uuid FROM auth.users WHERE email = 'john89010130@gmail.com';
  
  DELETE FROM user_roles WHERE user_id = user_uuid;
  INSERT INTO user_roles (user_id, role) VALUES (user_uuid, 'ADMIN_MASTER');
END $$;

-- 2. Garantir permissões completas
DO $$
DECLARE
  user_uuid UUID;
BEGIN
  SELECT id INTO user_uuid FROM auth.users WHERE email = 'john89010130@gmail.com';
  
  DELETE FROM permissions WHERE user_id = user_uuid;
  INSERT INTO permissions (user_id, can_tv, can_movies, allowed_categories)
  VALUES (user_uuid, true, true, '{}');
END $$;

-- 3. Políticas RLS para user_roles
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS select_own_role ON user_roles;
CREATE POLICY select_own_role ON user_roles
  FOR SELECT USING (auth.uid() = user_id);

-- 4. Políticas RLS para permissions
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS select_own_permissions ON permissions;
CREATE POLICY select_own_permissions ON permissions
  FOR SELECT USING (auth.uid() = user_id);

-- 5. Políticas RLS para profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS select_own_profile ON profiles;
CREATE POLICY select_own_profile ON profiles
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS update_own_profile ON profiles;
CREATE POLICY update_own_profile ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- 6. Verificar resultado
SELECT 
  p.id,
  p.email,
  p.name,
  ur.role,
  perm.can_tv,
  perm.can_movies
FROM profiles p
LEFT JOIN user_roles ur ON ur.user_id = p.id
LEFT JOIN permissions perm ON perm.user_id = p.id
WHERE p.email = 'john89010130@gmail.com';
