import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://kwhusiffihtdmmvaqgxx.supabase.co';
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt3aHVzaWZmaWh0ZG1tdmFxZ3h4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc0NjA0NzAsImV4cCI6MjA4MzAzNjQ3MH0.02WL74AcUZnR_QJRQ5XrwSQuiKDIgt2cEgLhpfZ94mA';

const supabase = createClient(supabaseUrl, anonKey);

console.log('📋 COPIE E EXECUTE NO SQL EDITOR DO SUPABASE:');
console.log('🔗 https://supabase.com/dashboard/project/kwhusiffihtdmmvaqgxx/sql/new\n');
console.log('━'.repeat(80));

const sql = `-- 1. Promover john89010130@gmail.com a ADMIN_MASTER
WITH target AS (
  SELECT id FROM auth.users WHERE email = 'john89010130@gmail.com'
)
INSERT INTO user_roles (user_id, role)
SELECT id, 'ADMIN_MASTER' FROM target
ON CONFLICT (user_id) DO UPDATE SET role = excluded.role;

-- 2. Garantir permissões completas
WITH target AS (
  SELECT id FROM auth.users WHERE email = 'john89010130@gmail.com'
)
INSERT INTO permissions (user_id, can_tv, can_movies, allowed_categories)
SELECT id, true, true, '{}'::text[] FROM target
ON CONFLICT (user_id) DO UPDATE 
SET can_tv = excluded.can_tv,
    can_movies = excluded.can_movies,
    allowed_categories = excluded.allowed_categories;

-- 3. Políticas RLS para user_roles
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS select_own_role ON user_roles;
CREATE POLICY select_own_role ON user_roles FOR SELECT USING (auth.uid() = user_id);

-- 4. Políticas RLS para permissions
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS select_own_permissions ON permissions;
CREATE POLICY select_own_permissions ON permissions FOR SELECT USING (auth.uid() = user_id);

-- 5. Políticas RLS para profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS select_own_profile ON profiles;
CREATE POLICY select_own_profile ON profiles FOR SELECT USING (auth.uid() = id);
DROP POLICY IF EXISTS update_own_profile ON profiles;
CREATE POLICY update_own_profile ON profiles FOR UPDATE USING (auth.uid() = id);`;

console.log(sql);
console.log('\n' + '━'.repeat(80));
console.log('\n✅ Após executar, faça:');
console.log('   1. John faz LOGOUT e LOGIN novamente');
console.log('   2. Menu Admin deve aparecer');
console.log('   3. Importa lista M3U pelo painel Admin');
