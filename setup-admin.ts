import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import 'https://deno.land/x/dotenv@v3.2.2/load.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL') || 'https://kwhusiffihtdmmvaqgxx.supabase.co';
const serviceRoleKey = Deno.env.get('SERVICE_ROLE_KEY');

if (!serviceRoleKey) {
  console.error('❌ SERVICE_ROLE_KEY não encontrada nas variáveis de ambiente');
  console.error('Cole sua Service Role Key do projeto kwhusiffihtdmmvaqgxx:');
  Deno.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

console.log('🔄 Configurando admin e políticas RLS...\n');

// 1. Promover john89010130@gmail.com a ADMIN_MASTER
console.log('1️⃣ Promovendo john89010130@gmail.com a ADMIN_MASTER...');
const { data: users } = await supabase.auth.admin.listUsers();
const johnUser = users?.users.find(u => u.email?.toLowerCase() === 'john89010130@gmail.com');

if (!johnUser) {
  console.error('❌ Usuário john89010130@gmail.com não encontrado');
  Deno.exit(1);
}

console.log(`   → User ID: ${johnUser.id}`);

// Inserir role
await supabase.from('user_roles').upsert({
  user_id: johnUser.id,
  role: 'ADMIN_MASTER'
});
console.log('   ✅ Role ADMIN_MASTER atribuída');

// Inserir permissions
await supabase.from('permissions').upsert({
  user_id: johnUser.id,
  can_tv: true,
  can_movies: true,
  allowed_categories: []
});
console.log('   ✅ Permissões completas atribuídas\n');

// 2. Aplicar políticas RLS
console.log('2️⃣ Aplicando políticas RLS...');

const policies = `
-- user_roles
alter table user_roles enable row level security;
drop policy if exists select_own_role on user_roles;
create policy select_own_role on user_roles
  for select using (auth.uid() = user_id);

-- permissions
alter table permissions enable row level security;
drop policy if exists select_own_permissions on permissions;
create policy select_own_permissions on permissions
  for select using (auth.uid() = user_id);

-- profiles
alter table profiles enable row level security;
drop policy if exists select_own_profile on profiles;
create policy select_own_profile on profiles
  for select using (auth.uid() = id);
drop policy if exists update_own_profile on profiles;
create policy update_own_profile on profiles
  for update using (auth.uid() = id);
`;

const { error: policyError } = await supabase.rpc('exec_sql', { sql: policies }).single();

if (policyError) {
  console.log('   ⚠️  Não foi possível aplicar via RPC, aplicando manualmente...');
  console.log('   📋 Execute o seguinte SQL no Supabase SQL Editor:\n');
  console.log(policies);
} else {
  console.log('   ✅ Políticas RLS aplicadas\n');
}

console.log('✅ Configuração concluída!');
console.log('\n📌 Próximos passos:');
console.log('   1. John deve fazer logout e login novamente');
console.log('   2. O menu Admin deve aparecer');
console.log('   3. Importar uma lista M3U pelo painel Admin');
