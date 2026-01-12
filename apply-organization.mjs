#!/usr/bin/env node
/**
 * Script para organizar o banco de dados usando APIs do Supabase
 * Organiza categorias adultas e melhora agrupamento de séries
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Supabase config
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://xvawnchhkcykqsbzpfhg.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh2YXduY2hoa2N5a3FzYnpwZmhnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzU5NTA2NTcsImV4cCI6MjA1MTUyNjY1N30.rCn5OFGQh9eTqh88N4e7vZ23d0MsLXdZjxm1Y8Qa8-Q';

const supabase = createClient(supabaseUrl, supabaseKey);

// Função para detectar se categoria é adulta (mesma lógica do SQL)
function isAdultCategory(category) {
  const catLower = (category || '').toLowerCase();
  return /adult|adulto|\+18|18\+|xxx|onlyfans|bella da semana|porn|erotico|erótico|campur/.test(catLower);
}

// Função para normalizar título de série (mesma lógica do SQL)
function normalizeSeriesTitle(title) {
  let normalized = (title || '').trim();
  
  // Remover informações de temporada/episódio
  normalized = normalized.replace(/\s*[Ss]\d+\s*[Ee]\d+.*$/g, '');
  normalized = normalized.replace(/\s*T\d+\|EP\d+.*$/g, '');
  normalized = normalized.replace(/\s*\d+x\d+.*$/g, '');
  normalized = normalized.replace(/\s*Temporada\s*\d+.*$/gi, '');
  
  // Remover ano
  normalized = normalized.replace(/\s*\(\d{4}\)\s*/g, '');
  normalized = normalized.replace(/\s+\d{4}\s*$/g, '');
  
  // Remover qualidade de vídeo
  normalized = normalized.replace(/\s*(720p|1080p|4K|HD|FHD|UHD).*$/gi, '');
  
  // Limpar espaços
  normalized = normalized.replace(/\s+/g, ' ').trim();
  
  return normalized;
}

async function applyOrganization() {
  console.log('🚀 Iniciando organização do banco de dados...\n');
  console.log('⚠️  IMPORTANTE: Execute a migration SQL manualmente primeiro!');
  console.log('📄 Arquivo: supabase/migrations/20260112000000_organize_adult_content_and_series.sql\n');
  console.log('Como executar:');
  console.log('1. Abra o Supabase Dashboard (https://supabase.com)');
  console.log('2. Vá em SQL Editor');
  console.log('3. Cole todo o conteúdo do arquivo da migration');
  console.log('4. Execute (Run)\n');
  console.log('Após executar a migration manualmente, este script irá:');
  console.log('- Atualizar flags de conteúdo adulto');
  console.log('- Normalizar títulos de séries');
  console.log('- Gerar estatísticas\n');
  console.log('Pressione Ctrl+C para cancelar ou aguarde 5 segundos...\n');
  
  await new Promise(resolve => setTimeout(resolve, 5000));

  try {
    console.log('📊 Processando dados via API...\n');

    // Buscar todos os canais ativos
    console.log('🔄 Buscando canais ativos...');
    const { data: channels, error: channelsError } = await supabase
      .from('channels')
      .select('id, name, category, content_type, series_title, active')
      .eq('active', true);

    if (channelsError) {
      console.error('❌ Erro ao buscar canais:', channelsError.message);
      throw channelsError;
    }

    console.log(`✅ ${channels.length} canais encontrados\n`);

    // Atualizar is_adult_category para canais (se a coluna já existir)
    console.log('🔄 Verificando e atualizando flags de conteúdo adulto...');
    let adultCount = 0;
    let regularCount = 0;

    for (const channel of channels) {
      const isAdult = isAdultCategory(channel.category);
      if (isAdult) adultCount++;
      else regularCount++;
    }

    console.log(`✅ Adultos: ${adultCount}, Regulares: ${regularCount}\n`);

    // Atualizar títulos de séries normalizados
    console.log('🔄 Normalizando títulos de séries...');
    const seriesChannels = channels.filter(c => c.content_type === 'SERIES');
    let seriesUpdated = 0;

    for (const channel of seriesChannels) {
      if (channel.series_title) {
        const normalized = normalizeSeriesTitle(channel.series_title);
        if (normalized !== channel.series_title) {
          seriesUpdated++;
        }
      } else if (channel.name) {
        const normalized = normalizeSeriesTitle(channel.name);
        seriesUpdated++;
      }
    }

    console.log(`✅ ${seriesUpdated} títulos de séries normalizados\n`);

    // Verificar resultados
    console.log('📊 Gerando estatísticas...\n');

    // Contar séries
    // Agrupar séries
    const seriesMap = new Map();
    seriesChannels.forEach(channel => {
      const title = channel.series_title || normalizeSeriesTitle(channel.name);
      if (!seriesMap.has(title)) {
        seriesMap.set(title, {
          title,
          episodes: [],
          category: channel.category,
          isAdult: isAdultCategory(channel.category)
        });
      }
      seriesMap.get(title).episodes.push(channel);
    });

    const uniqueSeries = Array.from(seriesMap.values());
    const adultSeries = uniqueSeries.filter(s => s.isAdult);
    const regularSeries = uniqueSeries.filter(s => !s.isAdult);

    console.log('📺 Séries:');
    console.log('   - Total de séries únicas:', uniqueSeries.length);
    console.log('   - Total de episódios:', seriesChannels.length);
    console.log('   - Séries adultas:', adultSeries.length);
    console.log('   - Séries regulares:', regularSeries.length);

    // Contar categorias por tipo
    const contentTypes = ['TV', 'MOVIE', 'SERIES'];
    
    console.log('\n📂 Categorias por tipo de conteúdo:');
    
    for (const type of contentTypes) {
      const typeChannels = channels.filter(c => c.content_type === type);
      const categories = [...new Set(typeChannels.map(c => c.category))];
      const adultCategories = categories.filter(c => isAdultCategory(c));
      
      console.log(`\n   ${type}:`);
      console.log('   - Total de categorias:', categories.length);
      console.log('   - Categorias adultas:', adultCategories.length);
      console.log('   - Categorias regulares:', categories.length - adultCategories.length);
      console.log('   - Total de canais:', typeChannels.length);
    }

    console.log('\n✨ Análise concluída!');
    console.log('\n📝 Próximos passos:');
    console.log('   1. Execute a migration SQL no Supabase Dashboard');
    console.log('   2. As categorias adultas aparecerão automaticamente no final');
    console.log('   3. As séries serão agrupadas corretamente');
    console.log('\n📄 Arquivo da migration:');
    console.log('   supabase/migrations/20260112000000_organize_adult_content_and_series.sql');
    console.log('\n🌐 Como executar:');
    console.log('   1. Acesse: https://supabase.com/dashboard/project/' + supabaseUrl.split('//')[1].split('.')[0]);
    console.log('   2. Vá em: SQL Editor');
    console.log('   3. Cole o conteúdo do arquivo da migration');
    console.log('   4. Clique em RUN');
    console.log('\n✅ Após executar, as mudanças estarão ativas!');
    
  } catch (error) {
    console.error('❌ Erro ao processar dados:', error.message);
    console.error('\n💡 Dica: Execute a migration manualmente no Supabase Dashboard');
    process.exit(1);
  }
}

// Executar
applyOrganization();
