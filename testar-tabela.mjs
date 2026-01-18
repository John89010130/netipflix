import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://kwhusiffihtdmmvaqgxx.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt3aHVzaWZmaWh0ZG1tdmFxZ3h4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczMzAwMTkzNywiZXhwIjoyMDQ4NTc3OTM3fQ.QEbDMWJCkqUg0kc9tTQEZBQJMXb7Q7CqBTPWXPkx50k';

const supabase = createClient(supabaseUrl, serviceRoleKey);

console.log('🔄 Testando conexão e criando tabela...\n');

// Testar se consegue inserir (se falhar, a tabela não existe)
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
  console.log('❌ Tabela não existe ou erro:', error.message);
  console.log('\n📋 COPIE E EXECUTE ESTE SQL NO SUPABASE:\n');
  console.log('Link: https://supabase.com/dashboard/project/kwhusiffihtdmmvaqgxx/sql/new\n');
  console.log('='.repeat(80));
  console.log(`
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

CREATE INDEX idx_qr_tokens_token ON public.qr_login_tokens(token);
CREATE INDEX idx_qr_tokens_used ON public.qr_login_tokens(used);
CREATE INDEX idx_qr_tokens_expires_at ON public.qr_login_tokens(expires_at);

ALTER TABLE public.qr_login_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir criação de tokens" ON public.qr_login_tokens
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Permitir leitura de tokens" ON public.qr_login_tokens
  FOR SELECT USING (true);

CREATE POLICY "Permitir atualização de tokens" ON public.qr_login_tokens
  FOR UPDATE USING (true);
  `);
  console.log('='.repeat(80));
} else {
  console.log('✅ Tabela existe e funciona!');
  console.log('✅ Token de teste inserido:', data[0].id);
  
  // Deletar token de teste
  await supabase.from('qr_login_tokens').delete().eq('token', testToken);
  console.log('✅ Token de teste removido');
  console.log('\n🎉 Sistema pronto para uso!');
  console.log('\nRecarregue a página de login e clique em "Login via QR Code"');
}
