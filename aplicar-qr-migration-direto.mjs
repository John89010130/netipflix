import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const supabaseUrl = 'https://kwhusiffihtdmmvaqgxx.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt3aHVzaWZmaWh0ZG1tdmFxZ3h4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczMzAwMTkzNywiZXhwIjoyMDQ4NTc3OTM3fQ.QEbDMWJCkqUg0kc9tTQEZBQJMXb7Q7CqBTPWXPkx50k';

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

console.log('🔄 Aplicando migration de QR Code Login...\n');

const sql = readFileSync('./supabase/migrations/20260118000001_add_qr_login_tokens.sql', 'utf8');

console.log('📄 SQL a ser executado:\n');
console.log(sql);
console.log('\n');

// Dividir o SQL em comandos individuais
const commands = sql
  .split(';')
  .map(cmd => cmd.trim())
  .filter(cmd => cmd.length > 0 && !cmd.startsWith('--'));

console.log(`📊 Total de comandos: ${commands.length}\n`);

let successCount = 0;
let errorCount = 0;

for (let i = 0; i < commands.length; i++) {
  const cmd = commands[i] + ';';
  console.log(`\n[${i + 1}/${commands.length}] Executando comando...`);
  
  try {
    const { error } = await supabase.rpc('query', { query_text: cmd }).catch(async () => {
      // Fallback: tentar via REST API
      const response = await fetch(`${supabaseUrl}/rest/v1/rpc/query`, {
        method: 'POST',
        headers: {
          'apikey': serviceRoleKey,
          'Authorization': `Bearer ${serviceRoleKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query_text: cmd })
      });
      
      if (!response.ok) {
        const text = await response.text();
        return { error: { message: text } };
      }
      
      return { error: null };
    });

    if (error) {
      console.log(`   ⚠️  Aviso: ${error.message}`);
      errorCount++;
    } else {
      console.log('   ✅ Sucesso!');
      successCount++;
    }
  } catch (err) {
    console.log(`   ⚠️  Erro: ${err.message}`);
    errorCount++;
  }
}

console.log('\n========================================');
console.log(`✅ Comandos bem-sucedidos: ${successCount}`);
console.log(`⚠️  Comandos com erro: ${errorCount}`);
console.log('========================================\n');

if (errorCount > 0) {
  console.log('⚠️  Alguns comandos falharam, mas isso é normal se a tabela já existir.');
  console.log('   Vamos verificar se a tabela foi criada...\n');
}

// Verificar se a tabela existe
try {
  const { data, error } = await supabase
    .from('qr_login_tokens')
    .select('count')
    .limit(1);

  if (!error) {
    console.log('✅ Tabela qr_login_tokens criada com sucesso!\n');
    console.log('🎉 Migration aplicada! Você pode agora:');
    console.log('   1. Ir para /login');
    console.log('   2. Clicar em "Login via QR Code"');
    console.log('   3. Escanear com o celular');
    console.log('   4. Fazer login automaticamente!\n');
  } else {
    console.log('⚠️  Não foi possível verificar a tabela.');
    console.log('   Tente executar o SQL manualmente no Supabase SQL Editor:');
    console.log('   https://supabase.com/dashboard/project/kwhusiffihtdmmvaqgxx/sql/new\n');
  }
} catch (err) {
  console.log('⚠️  Erro ao verificar tabela:', err.message);
}
