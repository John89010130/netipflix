import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function testarFluxoCompleto() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🧪 TESTE COMPLETO DO FLUXO QR CODE');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  // PASSO 1: Criar token (simula PC)
  console.log('1️⃣ CRIANDO TOKEN (PC)...');
  const token = `qr_${Date.now()}_test`;
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
  
  const { data: tokenData, error: createError } = await supabase
    .from('qr_login_tokens')
    .insert({
      token,
      expires_at: expiresAt,
      used: false
    })
    .select()
    .single();
    
  if (createError) {
    console.error('❌ Erro ao criar token:', createError);
    return;
  }
  
  console.log('✅ Token criado:', token);
  console.log('   ID:', tokenData.id);
  console.log('   Expira:', expiresAt);
  
  // PASSO 2: Validar token (simula celular acessando URL)
  console.log('\n2️⃣ VALIDANDO TOKEN (CELULAR)...');
  const { data: validatedToken, error: validateError } = await supabase
    .from('qr_login_tokens')
    .select('*')
    .eq('token', token)
    .single();
    
  if (validateError) {
    console.error('❌ Erro ao validar:', validateError);
    return;
  }
  
  console.log('✅ Token válido encontrado');
  console.log('   Used:', validatedToken.used);
  console.log('   Expirado:', new Date(validatedToken.expires_at) < new Date());
  
  // PASSO 3: Login e UPDATE (simula celular fazendo login)
  console.log('\n3️⃣ FAZENDO LOGIN E UPDATE (CELULAR)...');
  
  // Simular que o usuário fez login com sucesso
  const fakeUserId = '22222222-2222-2222-2222-222222222222';
  const fakeEmail = 'teste@fluxo.com';
  const fakePassword = 'senha123';
  
  const { data: updateResult, error: updateError } = await supabase
    .from('qr_login_tokens')
    .update({
      used: true,
      user_id: fakeUserId,
      email: fakeEmail,
      temp_password: fakePassword,
      used_at: new Date().toISOString()
    })
    .eq('token', token)
    .select();
    
  if (updateError) {
    console.error('❌❌❌ ERRO NO UPDATE:', updateError);
    console.error('   Code:', updateError.code);
    console.error('   Message:', updateError.message);
    return;
  }
  
  console.log('✅ UPDATE executado com sucesso!');
  console.log('   Linhas afetadas:', updateResult?.length);
  console.log('   Resultado:', updateResult[0]);
  
  // PASSO 4: Polling (simula PC verificando)
  console.log('\n4️⃣ POLLING - VERIFICANDO STATUS (PC)...');
  
  const { data: checkedToken, error: checkError } = await supabase
    .from('qr_login_tokens')
    .select('*')
    .eq('token', token)
    .single();
    
  if (checkError) {
    console.error('❌ Erro ao verificar:', checkError);
    return;
  }
  
  console.log('✅ Token verificado:');
  console.log('   Used:', checkedToken.used);
  console.log('   User ID:', checkedToken.user_id);
  console.log('   Email:', checkedToken.email);
  console.log('   Tem senha:', !!checkedToken.temp_password);
  
  // PASSO 5: Verificar se pode fazer auto-login
  console.log('\n5️⃣ VERIFICANDO SE PODE AUTO-LOGIN...');
  
  if (checkedToken.used && checkedToken.user_id && checkedToken.email && checkedToken.temp_password) {
    console.log('✅✅✅ PODE FAZER AUTO-LOGIN!');
    console.log('   Email:', checkedToken.email);
    console.log('   Senha:', checkedToken.temp_password.substring(0, 3) + '***');
  } else {
    console.log('❌ NÃO PODE AUTO-LOGIN');
    console.log('   Used:', checkedToken.used);
    console.log('   User ID:', checkedToken.user_id);
    console.log('   Email:', checkedToken.email);
    console.log('   Tem senha:', !!checkedToken.temp_password);
  }
  
  // Limpar token de teste
  console.log('\n6️⃣ LIMPANDO TOKEN DE TESTE...');
  await supabase
    .from('qr_login_tokens')
    .delete()
    .eq('token', token);
  console.log('✅ Token removido');
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ TESTE COMPLETO FINALIZADO!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

testarFluxoCompleto();
