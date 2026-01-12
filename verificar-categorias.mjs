import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://xvawnchhkcykqsbzpfhg.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh2YXduY2hoa2N5a3FzYnpwZmhnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzYxMzgxNzUsImV4cCI6MjA1MTcxNDE3NX0.J6HGp2eMNyYa9MH8bG3qF35jRLx31rOBOb6PYwQnJTw'
);

console.log('\n🔍 VERIFICANDO CATEGORIAS...\n');

// Verificar categorias de SERIES
const { data: seriesCat, error: err1 } = await supabase
  .from('active_channels')
  .select('category, content_type')
  .eq('content_type', 'SERIES');

if (err1) {
  console.log('❌ Erro ao buscar categorias:', err1.message);
} else {
  console.log(`✅ Total de registros SERIES: ${seriesCat.length}`);
  
  const categories = [...new Set(seriesCat.map(c => c.category))];
  console.log(`📂 Categorias únicas: ${categories.length}`);
  
  categories.forEach(cat => {
    const count = seriesCat.filter(c => c.category === cat).length;
    console.log(`  - "${cat}" (${count} registros)`);
  });
  
  const emptyCats = seriesCat.filter(c => !c.category || c.category.trim() === '');
  if (emptyCats.length > 0) {
    console.log(`\n⚠️ ${emptyCats.length} registros com categoria vazia!`);
  }
}

// Verificar TV
const { data: tvCat, error: err2 } = await supabase
  .from('active_channels')
  .select('category')
  .eq('content_type', 'TV');

if (tvCat) {
  const tvCategories = [...new Set(tvCat.map(c => c.category))].filter(c => c && c.trim() !== '');
  console.log(`\n📺 TV: ${tvCategories.length} categorias`);
}

// Verificar MOVIE
const { data: movieCat, error: err3 } = await supabase
  .from('active_channels')
  .select('category')
  .eq('content_type', 'MOVIE');

if (movieCat) {
  const movieCategories = [...new Set(movieCat.map(c => c.category))].filter(c => c && c.trim() !== '');
  console.log(`🎬 Filmes: ${movieCategories.length} categorias`);
}

console.log('\n✨ Verificação concluída!\n');
