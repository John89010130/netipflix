// Script para testar consulta de filmes no Supabase
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://kcwdpfdmcvkwtyikvxfr.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtjd2RwZmRtY3Zrd3R5aWt2eGZyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzU4NTM4NDEsImV4cCI6MjA1MTQyOTg0MX0.fh0Wz9xMxCqVtMXNVKLT09JB6rFMBR0Q1M5bsVPXV4M';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testQueries() {
  console.log('\n=== Teste 1: Buscar filme Zootopia ===');
  const { data: zootopia, error: error1 } = await supabase
    .from('channels')
    .select('*')
    .ilike('name', '%zootopia%');
  
  console.log('Resultados:', zootopia?.length || 0);
  if (zootopia?.length > 0) {
    console.log('Primeiro resultado:', {
      id: zootopia[0].id,
      name: zootopia[0].name,
      content_type: zootopia[0].content_type,
      category: zootopia[0].category,
      m3u_list_id: zootopia[0].m3u_list_id
    });
  }
  if (error1) console.error('Erro:', error1);

  console.log('\n=== Teste 2: Verificar active_channels ===');
  const { data: activeChannels, error: error2 } = await supabase
    .from('active_channels')
    .select('*')
    .ilike('name', '%zootopia%');
  
  console.log('Resultados em active_channels:', activeChannels?.length || 0);
  if (error2) console.error('Erro:', error2);

  console.log('\n=== Teste 3: Total de MOVIES em active_channels ===');
  const { count, error: error3 } = await supabase
    .from('active_channels')
    .select('*', { count: 'exact', head: true })
    .eq('content_type', 'MOVIE');
  
  console.log('Total de filmes:', count);
  if (error3) console.error('Erro:', error3);

  console.log('\n=== Teste 4: Verificar m3u_lists ativas ===');
  const { data: lists, error: error4 } = await supabase
    .from('m3u_lists')
    .select('id, name, is_active');
  
  console.log('Listas M3U:');
  lists?.forEach(list => {
    console.log(`- ${list.name}: ${list.is_active ? 'ATIVA' : 'INATIVA'} (ID: ${list.id})`);
  });
  if (error4) console.error('Erro:', error4);

  console.log('\n=== Teste 5: Primeiros 5 filmes em active_channels ===');
  const { data: movies, error: error5 } = await supabase
    .from('active_channels')
    .select('name, category, content_type')
    .eq('content_type', 'MOVIE')
    .limit(5);
  
  console.log('Primeiros 5 filmes:');
  movies?.forEach(movie => {
    console.log(`- ${movie.name} (${movie.category})`);
  });
  if (error5) console.error('Erro:', error5);
}

testQueries().then(() => {
  console.log('\n=== Testes concluídos ===\n');
  process.exit(0);
}).catch(err => {
  console.error('Erro ao executar testes:', err);
  process.exit(1);
});
