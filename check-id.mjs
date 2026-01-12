import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://xvawnchhkcykqsbzpfhg.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh2YXduY2hoa2N5a3FzYnpwZmhnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzYxMzgxNzUsImV4cCI6MjA1MTcxNDE3NX0.J6HGp2eMNyYa9MH8bG3qF35jRLx31rOBOb6PYwQnJTw'
);

const id = '30e663b9-5420-43ea-a041-dc396f919526';

console.log(`\n🔍 Buscando ID: ${id}\n`);

// Buscar em active_channels
console.log('📺 Buscando em active_channels...');
const { data: active, error: activeError } = await supabase
  .from('active_channels')
  .select('*')
  .eq('id', id);

if (activeError) {
  console.log('❌ Erro:', activeError.message);
} else if (active && active.length > 0) {
  console.log('✅ Encontrado em active_channels:');
  console.log(JSON.stringify(active[0], null, 2));
} else {
  console.log('❌ Não encontrado em active_channels');
}

// Buscar em all_channels (caso não tenha sido movido para active)
console.log('\n📂 Buscando em all_channels...');
const { data: all, error: allError } = await supabase
  .from('all_channels')
  .select('*')
  .eq('id', id);

if (allError) {
  console.log('❌ Erro:', allError.message);
} else if (all && all.length > 0) {
  console.log('✅ Encontrado em all_channels:');
  console.log(JSON.stringify(all[0], null, 2));
} else {
  console.log('❌ Não encontrado em all_channels');
}

console.log('\n✨ Busca concluída!');
