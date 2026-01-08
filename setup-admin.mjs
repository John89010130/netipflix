import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://kwhusiffihtdmmvaqgxx.supabase.co';
const serviceRoleKey = process.argv[2];

if (!serviceRoleKey) {
  console.error('❌ Uso: node setup-admin.mjs <SERVICE_ROLE_KEY>');
  console.error('   Pegue a Service Role Key em: https://supabase.com/dashboard/project/kwhusiffihtdmmvaqgxx/settings/api');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

console.log('🔄 Configurando admin e políticas RLS...\n');

// 0. Verificar se usuário existe, senão criar
console.log('0️⃣ Verificando usuário john89010130@gmail.com...');
const { data: userData } = await supabase.auth.admin.listUsers();

console.log(`   → Total de usuários existentes: ${userData?.users?.length || 0}`);

let johnUser = userData?.users.find(u => u.email?.toLowerCase() === 'john89010130@gmail.com');

if (!johnUser) {
  console.log('   → Usuário não encontrado, criando...');
  const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
    email: 'john89010130@gmail.com',
    password: 'Admin@123456',
    email_confirm: true,
    user_metadata: { name: 'John Admin' }
  });

  if (createError) {
    console.error('   ❌ Erro ao criar usuário:', createError.message);
    process.exit(1);
  }

  johnUser = newUser.user;
  console.log(`   ✅ Usuário criado com ID: ${johnUser.id}`);
  console.log('   📧 Email: john89010130@gmail.com');
  console.log('   🔑 Senha temporária: Admin@123456');
  console.log('   ⚠️  ALTERE A SENHA NO PRIMEIRO LOGIN!\n');
} else {
  console.log(`   ✅ Usuário já existe - ID: ${johnUser.id}\n`);
}

// 1. Promover john89010130@gmail.com a ADMIN_MASTER
console.log('1️⃣ Promovendo a ADMIN_MASTER...');

console.log(`   → User ID: ${johnUser.id}`);

// Inserir role
const { error: roleError } = await supabase.from('user_roles').upsert({
  user_id: johnUser.id,
  role: 'ADMIN_MASTER'
});

if (roleError) {
  console.error('   ❌ Erro ao atribuir role:', roleError.message);
} else {
  console.log('   ✅ Role ADMIN_MASTER atribuída');
}

// Inserir permissions
const { error: permError } = await supabase.from('permissions').upsert({
  user_id: johnUser.id,
  can_tv: true,
  can_movies: true,
  allowed_categories: []
});

if (permError) {
  console.error('   ❌ Erro ao atribuir permissões:', permError.message);
} else {
  console.log('   ✅ Permissões completas atribuídas\n');
}

// 2. Políticas RLS - executar via SQL raw
console.log('2️⃣ Aplicando políticas RLS...');

const policies = [
  // user_roles
  'alter table user_roles enable row level security',
  'drop policy if exists select_own_role on user_roles',
  'create policy select_own_role on user_roles for select using (auth.uid() = user_id)',
  
  // permissions
  'alter table permissions enable row level security',
  'drop policy if exists select_own_permissions on permissions',
  'create policy select_own_permissions on permissions for select using (auth.uid() = user_id)',
  
  // profiles
  'alter table profiles enable row level security',
  'drop policy if exists select_own_profile on profiles',
  'create policy select_own_profile on profiles for select using (auth.uid() = id)',
  'drop policy if exists update_own_profile on profiles',
  'create policy update_own_profile on profiles for update using (auth.uid() = id)'
];

console.log('   ⚠️  Execute as seguintes queries no SQL Editor do Supabase:\n');
console.log('   https://supabase.com/dashboard/project/kwhusiffihtdmmvaqgxx/sql/new\n');
for (const sql of policies) {
  console.log(`   ${sql};`);
}

console.log('\n✅ Configuração de roles e permissões concluída!');
console.log('\n📌 Próximos passos:');
console.log('   1. Execute as queries SQL acima no Supabase SQL Editor');
console.log('   2. John deve fazer logout e login novamente no app');
console.log('   3. O menu Admin deve aparecer');
console.log('   4. Importar uma lista M3U pelo painel Admin');
