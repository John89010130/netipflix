import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://kwhusiffihtdmmvaqgxx.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt3aHVzaWZmaWh0ZG1tdmFxZ3h4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzUxMzg0NDEsImV4cCI6MjA1MDcxNDQ0MX0.PYzQl4s_1Gu1bShcPmPOh6P0BIwqhZmDQ3TbgIDQBvk';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testarFluxoQR() {
  console.log('🧪 Testando fluxo completo do QR Code Login...\n');

  // 1. Criar token de teste
  const testToken = `test_${Date.now()}`;
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + 5);

  console.log('1️⃣ Criando token de teste...');
  const { data: createData, error: createError } = await supabase
    .from('qr_login_tokens')
    .insert({
      token: testToken,
      expires_at: expiresAt.toISOString(),
      used: false
    })
    .select()
    .single();

  if (createError) {
    console.error('❌ Erro ao criar token:', createError);
    return;
  }
  console.log('✅ Token criado:', createData.id);

  // 2. Ler token
  console.log('\n2️⃣ Lendo token...');
  const { data: readData, error: readError } = await supabase
    .from('qr_login_tokens')
    .select('*')
    .eq('token', testToken)
    .single();

  if (readError) {
    console.error('❌ Erro ao ler token:', readError);
    return;
  }
  console.log('✅ Token lido:', { id: readData.id, used: readData.used });

  // 3. Atualizar token (simular login)
  console.log('\n3️⃣ Atualizando token (simulando login)...');
  const { data: updateData, error: updateError } = await supabase
    .from('qr_login_tokens')
    .update({
      used: true,
      email: 'teste@example.com',
      temp_password: 'senha123',
      used_at: new Date().toISOString()
    })
    .eq('token', testToken)
    .select()
    .single();

  if (updateError) {
    console.error('❌ Erro ao atualizar token:', updateError);
    return;
  }
  console.log('✅ Token atualizado:', { used: updateData.used, email: updateData.email });

  // 4. Verificar atualização
  console.log('\n4️⃣ Verificando atualização...');
  const { data: verifyData, error: verifyError } = await supabase
    .from('qr_login_tokens')
    .select('*')
    .eq('token', testToken)
    .single();

  if (verifyError) {
    console.error('❌ Erro ao verificar:', verifyError);
    return;
  }
  
  console.log('✅ Verificação final:', {
    used: verifyData.used,
    email: verifyData.email,
    temp_password: verifyData.temp_password ? '***' : null,
    used_at: verifyData.used_at
  });

  // 5. Limpar teste
  console.log('\n5️⃣ Limpando token de teste...');
  const { error: deleteError } = await supabase
    .from('qr_login_tokens')
    .delete()
    .eq('token', testToken);

  if (deleteError) {
    console.error('❌ Erro ao deletar:', deleteError);
    return;
  }
  console.log('✅ Token deletado\n');

  console.log('🎉 Teste completo! Todas as operações funcionam.');
}

testarFluxoQR();
