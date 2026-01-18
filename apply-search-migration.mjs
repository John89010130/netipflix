import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const supabaseUrl = 'https://kwhusiffihtdmmvaqgxx.supabase.co';
const serviceRoleKey = process.argv[2];

if (!serviceRoleKey) {
  console.error('❌ Uso: node apply-search-migration.mjs <SERVICE_ROLE_KEY>');
  console.error('   Pegue a Service Role Key em: https://supabase.com/dashboard/project/kwhusiffihtdmmvaqgxx/settings/api');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

console.log('🔄 Aplicando migration de busca otimizada...\n');

try {
  // Ler o arquivo SQL
  const migrationPath = join(__dirname, 'supabase', 'migrations', '20260118000000_add_search_tv_channels_function.sql');
  const sql = readFileSync(migrationPath, 'utf8');
  
  console.log('📄 Executando SQL...\n');
  console.log(sql);
  console.log('\n');
  
  // Executar o SQL
  const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql }).catch(async () => {
    // Se exec_sql não existir, tentar executar diretamente via query
    return await supabase.from('_migrations').select('*').limit(1).then(() => {
      // Usar uma abordagem alternativa: executar via API REST
      return fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
        method: 'POST',
        headers: {
          'apikey': serviceRoleKey,
          'Authorization': `Bearer ${serviceRoleKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sql_query: sql })
      }).then(r => r.json());
    });
  });

  if (error) {
    console.error('❌ Erro ao executar SQL:', error);
    console.log('\n⚠️  Execute o SQL manualmente no Supabase SQL Editor:');
    console.log('   https://supabase.com/dashboard/project/kwhusiffihtdmmvaqgxx/sql/new');
    process.exit(1);
  }

  console.log('✅ Função search_tv_channels criada com sucesso!\n');
  console.log('🎉 Migration aplicada com sucesso!');
  console.log('\n📝 O que foi feito:');
  console.log('   • Criada função RPC search_tv_channels');
  console.log('   • Busca otimizada com CONCAT em múltiplos campos');
  console.log('   • Suporte para múltiplas palavras (independente da ordem)');
  console.log('   • Limite de 5000 resultados (removido o limite de 1000)');
  
} catch (err) {
  console.error('❌ Erro:', err);
  console.log('\n⚠️  Execute o SQL manualmente no Supabase SQL Editor:');
  console.log('   https://supabase.com/dashboard/project/kwhusiffihtdmmvaqgxx/sql/new');
  process.exit(1);
}
