import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://xvawnchhkcykqsbzpfhg.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh2YXduY2hoa2N5a3FzYnpwZmhnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzYxMzgxNzUsImV4cCI6MjA1MTcxNDE3NX0.J6HGp2eMNyYa9MH8bG3qF35jRLx31rOBOb6PYwQnJTw'
);

console.log('\n🔍 DIAGNÓSTICO DO SISTEMA\n');

// 1. Verificar séries sem series_title
console.log('📺 Verificando séries sem series_title...');
const { data: seriesWithoutTitle, error: err1 } = await supabase
  .from('active_channels')
  .select('id, name, series_title, season_number, episode_number')
  .eq('content_type', 'SERIES')
  .or('series_title.is.null,series_title.eq.')
  .limit(10);

if (seriesWithoutTitle && seriesWithoutTitle.length > 0) {
  console.log(`⚠️ Encontradas ${seriesWithoutTitle.length} séries sem series_title (mostrando 10 primeiras):`);
  seriesWithoutTitle.forEach(s => {
    console.log(`  - "${s.name}" (S${s.season_number || '?'}E${s.episode_number || '?'})`);
  });
} else {
  console.log('✅ Todas as séries têm series_title preenchido');
}

// 2. Verificar categorias vazias
console.log('\n📂 Verificando categorias...');
const { data: categories, error: err2 } = await supabase
  .from('active_channels')
  .select('category, content_type')
  .not('category', 'is', null);

if (categories) {
  const emptyCats = categories.filter(c => !c.category || c.category.trim() === '');
  if (emptyCats.length > 0) {
    console.log(`⚠️ Encontrados ${emptyCats.length} registros com categoria vazia`);
  } else {
    console.log('✅ Todas as categorias estão preenchidas');
  }
  
  const tvCats = [...new Set(categories.filter(c => c.content_type === 'TV').map(c => c.category))];
  const movieCats = [...new Set(categories.filter(c => c.content_type === 'MOVIE').map(c => c.category))];
  const seriesCats = [...new Set(categories.filter(c => c.content_type === 'SERIES').map(c => c.category))];
  
  console.log(`  TV: ${tvCats.length} categorias`);
  console.log(`  Filmes: ${movieCats.length} categorias`);
  console.log(`  Séries: ${seriesCats.length} categorias`);
}

// 3. Verificar ID específico
console.log('\n🔎 Verificando ID 30e663b9-5420-43ea-a041-dc396f919526...');
const { data: specificId, error: err3 } = await supabase
  .from('active_channels')
  .select('*')
  .eq('id', '30e663b9-5420-43ea-a041-dc396f919526');

if (specificId && specificId.length > 0) {
  console.log('✅ ID encontrado:');
  console.log(JSON.stringify(specificId[0], null, 2));
} else {
  console.log('❌ ID não encontrado em active_channels');
  
  // Buscar em all_channels
  const { data: allChannels, error: err4 } = await supabase
    .from('all_channels')
    .select('*')
    .eq('id', '30e663b9-5420-43ea-a041-dc396f919526');
    
  if (allChannels && allChannels.length > 0) {
    console.log('⚠️ Mas foi encontrado em all_channels:');
    console.log(JSON.stringify(allChannels[0], null, 2));
  } else {
    console.log('❌ ID também não encontrado em all_channels');
  }
}

// 4. Verificar séries duplicadas (Os Simpsons)
console.log('\n📊 Verificando séries "Os Simpsons"...');
const { data: simpsons, error: err5 } = await supabase
  .from('active_channels')
  .select('id, name, series_title, season_number, episode_number')
  .eq('content_type', 'SERIES')
  .or('name.ilike.%simpsons%,series_title.ilike.%simpsons%')
  .order('season_number')
  .order('episode_number')
  .limit(5);

if (simpsons && simpsons.length > 0) {
  console.log(`Encontrados ${simpsons.length} episódios:`);
  simpsons.forEach(s => {
    console.log(`  - ${s.name}`);
    console.log(`    series_title: "${s.series_title || '(vazio)'}"`);
    console.log(`    S${s.season_number || '?'}E${s.episode_number || '?'}`);
  });
}

console.log('\n✨ Diagnóstico concluído!\n');
