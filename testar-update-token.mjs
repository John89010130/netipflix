import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Faltam variáveis de ambiente');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testarUpdate() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🧪 TESTE: UPDATE no token do QR Code');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  // Pegar o último token criado
  console.log('\n1️⃣ Buscando último token...');
  const { data: tokens, error: selectError } = await supabase
    .from('qr_login_tokens')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1);
    
  if (selectError) {
    console.error('❌ Erro ao buscar:', selectError);
    return;
  }
  
  if (!tokens || tokens.length === 0) {
    console.log('❌ Nenhum token encontrado');
    return;
  }
  
  const token = tokens[0];
  console.log('✅ Token encontrado:');
  console.log('  - ID:', token.id);
  console.log('  - Token:', token.token);
  console.log('  - Used:', token.used);
  console.log('  - User ID:', token.user_id);
  console.log('  - Created:', token.created_at);
  
  // Tentar fazer UPDATE
  console.log('\n2️⃣ Tentando UPDATE...');
  const { data: updateResult, error: updateError } = await supabase
    .from('qr_login_tokens')
    .update({
      used: true,
      user_id: '11111111-1111-1111-1111-111111111111',
      email: 'teste@update.com',
      temp_password: 'senha123',
      used_at: new Date().toISOString()
    })
    .eq('token', token.token)
    .select();
    
  if (updateError) {
    console.error('❌ ERRO no UPDATE:', updateError);
    console.error('  - Code:', updateError.code);
    console.error('  - Details:', updateError.details);
    console.error('  - Hint:', updateError.hint);
    console.error('  - Message:', updateError.message);
    return;
  }
  
  console.log('✅ UPDATE executado!');
  console.log('  - Linhas afetadas:', updateResult?.length || 0);
  console.log('  - Resultado:', updateResult);
  
  // Verificar se realmente atualizou
  console.log('\n3️⃣ Verificando se atualizou...');
  const { data: verificacao, error: verifyError } = await supabase
    .from('qr_login_tokens')
    .select('*')
    .eq('token', token.token)
    .single();
    
  if (verifyError) {
    console.error('❌ Erro ao verificar:', verifyError);
    return;
  }
  
  console.log('📊 Estado atual:');
  console.log('  - Used:', verificacao.used);
  console.log('  - User ID:', verificacao.user_id);
  console.log('  - Email:', verificacao.email);
  console.log('  - Tem senha:', !!verificacao.temp_password);
  console.log('  - Used at:', verificacao.used_at);
  
  if (verificacao.used && verificacao.user_id) {
    console.log('\n✅✅✅ UPDATE FUNCIONOU!');
  } else {
    console.log('\n❌❌❌ UPDATE NÃO FUNCIONOU - Valores não mudaram!');
  }
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

testarUpdate();
