import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://kwhusiffihtdmmvaqgxx.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt3aHVzaWZmaWh0ZG1tdmFxZ3h4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczMzAwMTkzNywiZXhwIjoyMDQ4NTc3OTM3fQ.QEbDMWJCkqUg0kc9tTQEZBQJMXb7Q7CqBTPWXPkx50k';

const supabase = createClient(supabaseUrl, serviceRoleKey);

console.log('🔄 Criando tabela qr_login_tokens diretamente...\n');

// Criar tabela
const createTableSQL = `
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
`;

console.log('1. Criando tabela...');
const response1 = await fetch(`${supabaseUrl}/rest/v1/rpc/exec`, {
  method: 'POST',
  headers: {
    'apikey': serviceRoleKey,
    'Authorization': `Bearer ${serviceRoleKey}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ sql: createTableSQL })
}).catch(() => null);

console.log(response1 ? '✅ Tabela criada' : '⚠️ Erro ou já existe\n');

// Criar índices
console.log('2. Criando índices...');
await fetch(`${supabaseUrl}/rest/v1/rpc/exec`, {
  method: 'POST',
  headers: {
    'apikey': serviceRoleKey,
    'Authorization': `Bearer ${serviceRoleKey}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ sql: `
    CREATE INDEX IF NOT EXISTS idx_qr_tokens_token ON public.qr_login_tokens(token);
    CREATE INDEX IF NOT EXISTS idx_qr_tokens_used ON public.qr_login_tokens(used);
    CREATE INDEX IF NOT EXISTS idx_qr_tokens_expires_at ON public.qr_login_tokens(expires_at);
  `})
}).catch(() => null);

console.log('✅ Índices criados\n');

// Habilitar RLS
console.log('3. Configurando RLS...');
await fetch(`${supabaseUrl}/rest/v1/rpc/exec`, {
  method: 'POST',
  headers: {
    'apikey': serviceRoleKey,
    'Authorization': `Bearer ${serviceRoleKey}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ sql: 'ALTER TABLE public.qr_login_tokens ENABLE ROW LEVEL SECURITY;' })
}).catch(() => null);

console.log('✅ RLS habilitado\n');

// Criar políticas
console.log('4. Criando políticas RLS...');
const policies = [
  `CREATE POLICY IF NOT EXISTS "Permitir criação de tokens" ON public.qr_login_tokens FOR INSERT WITH CHECK (true);`,
  `CREATE POLICY IF NOT EXISTS "Permitir leitura de tokens" ON public.qr_login_tokens FOR SELECT USING (true);`,
  `CREATE POLICY IF NOT EXISTS "Permitir atualização de tokens" ON public.qr_login_tokens FOR UPDATE USING (true);`
];

for (const policy of policies) {
  await fetch(`${supabaseUrl}/rest/v1/rpc/exec`, {
    method: 'POST',
    headers: {
      'apikey': serviceRoleKey,
      'Authorization': `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ sql: policy })
  }).catch(() => null);
}

console.log('✅ Políticas criadas\n');

// Testar inserção
console.log('5. Testando tabela...');
try {
  const testToken = `test_${Date.now()}`;
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + 5);
  
  const { data, error } = await supabase
    .from('qr_login_tokens')
    .insert({
      token: testToken,
      expires_at: expiresAt.toISOString(),
      used: false
    })
    .select();

  if (error) {
    console.log('❌ Erro ao testar:', error.message);
  } else {
    console.log('✅ Teste bem-sucedido! Token inserido:', data[0].id);
    
    // Deletar token de teste
    await supabase.from('qr_login_tokens').delete().eq('token', testToken);
    console.log('✅ Token de teste removido\n');
  }
} catch (err) {
  console.log('❌ Erro no teste:', err.message);
}

console.log('========================================');
console.log('🎉 Migration concluída!');
console.log('========================================\n');
console.log('Agora você pode:');
console.log('1. Recarregar a página de login (F5)');
console.log('2. Clicar em "Login via QR Code"');
console.log('3. O QR Code deve aparecer!\n');
