/**
 * Testes e Exemplos do Sistema de Classificação Automática
 * Execute este arquivo para ver o classificador em ação
 */

import { classifyContent, generateClassificationReport } from './contentClassifier';

// Exemplos de canais para teste
const testChannels = [
  // TV ao Vivo
  {
    name: 'Globo HD',
    category: 'Canais',
    stream_url: 'http://server.com/live/globo/playlist.m3u8'
  },
  {
    name: 'ESPN FHD 24h',
    category: 'Esportes',
    stream_url: 'http://provider.com:8080/live/user/pass/12345.m3u8'
  },
  {
    name: 'CNN Brasil',
    category: 'Notícias',
    stream_url: 'http://server.com/channels/cnn.m3u8'
  },

  // Filmes
  {
    name: 'Vingadores Ultimato Dublado',
    category: 'Filmes Ação',
    stream_url: 'http://server.com/movie/vingadores.mp4'
  },
  {
    name: 'Avatar Legendado BluRay',
    category: 'Ficção Científica',
    stream_url: 'http://provider.com:8080/movie/user/pass/avatar.mkv'
  },
  {
    name: 'Titanic Dual Audio',
    category: 'Romance',
    stream_url: 'http://server.com/vod/titanic.avi'
  },

  // Séries
  {
    name: 'Breaking Bad T05|EP08',
    category: 'Séries Dramáticas',
    stream_url: 'http://server.com/series/bb/s05e08.mkv'
  },
  {
    name: 'Friends S01E01',
    category: 'Séries Comédia',
    stream_url: 'http://provider.com:8080/series/user/pass/friends.mp4'
  },
  {
    name: 'Game of Thrones 8x06',
    category: 'Séries',
    stream_url: 'http://server.com/episode/got/final.mkv'
  },
  {
    name: 'Stranger Things Temporada 4 Episodio 9',
    category: 'Séries Netflix',
    stream_url: 'http://server.com/content/st-s04e09.mp4'
  },

  // Casos ambíguos
  {
    name: 'Canal Desconhecido',
    category: 'Geral',
    stream_url: 'http://server.com/stream/unknown.ts'
  },
  {
    name: 'Documentário Planeta Terra',
    category: 'Documentário',
    stream_url: 'http://server.com/content/doc.mp4'
  }
];

console.log('🎬 SISTEMA DE CLASSIFICAÇÃO AUTOMÁTICA - TESTES\n');
console.log('='.repeat(80));
console.log('\n');

// Testar classificação individual
console.log('📊 CLASSIFICAÇÕES INDIVIDUAIS:\n');
testChannels.forEach((channel, index) => {
  const result = classifyContent(channel.name, channel.category, channel.stream_url);
  
  const typeIcon = result.contentType === 'TV' ? '📺' : 
                   result.contentType === 'MOVIE' ? '🎬' : '📺';
  
  const confidenceColor = result.confidence >= 80 ? '🟢' : 
                          result.confidence >= 60 ? '🟡' : '🔴';
  
  console.log(`${index + 1}. ${typeIcon} "${channel.name}"`);
  console.log(`   Tipo: ${result.contentType}`);
  console.log(`   Confiança: ${confidenceColor} ${result.confidence}%`);
  console.log(`   Razões:`);
  result.reasons.forEach(reason => {
    console.log(`     - ${reason}`);
  });
  console.log('');
});

// Gerar relatório geral
console.log('='.repeat(80));
console.log('\n📈 RELATÓRIO GERAL DE CLASSIFICAÇÃO:\n');

const report = generateClassificationReport(testChannels);

console.log(`Total de canais analisados: ${report.total}`);
console.log('');
console.log('Distribuição por tipo:');
console.log(`  📺 TV ao Vivo: ${report.byType.TV} (${Math.round((report.byType.TV / report.total) * 100)}%)`);
console.log(`  🎬 Filmes: ${report.byType.MOVIE} (${Math.round((report.byType.MOVIE / report.total) * 100)}%)`);
console.log(`  📺 Séries: ${report.byType.SERIES} (${Math.round((report.byType.SERIES / report.total) * 100)}%)`);
console.log('');
console.log(`Confiança média: ${report.averageConfidence}%`);
console.log(`Classificações com baixa confiança (<60%): ${report.lowConfidence}`);
console.log('');

// Visualização gráfica
console.log('Gráfico de distribuição:');
const barLength = 50;
const tvBar = '█'.repeat(Math.round((report.byType.TV / report.total) * barLength));
const movieBar = '█'.repeat(Math.round((report.byType.MOVIE / report.total) * barLength));
const seriesBar = '█'.repeat(Math.round((report.byType.SERIES / report.total) * barLength));

console.log(`TV     : ${tvBar} ${report.byType.TV}`);
console.log(`Filmes : ${movieBar} ${report.byType.MOVIE}`);
console.log(`Séries : ${seriesBar} ${report.byType.SERIES}`);
console.log('');

console.log('='.repeat(80));
console.log('\n✅ Teste concluído!\n');

// Exportar para uso em outros arquivos
export { testChannels };
