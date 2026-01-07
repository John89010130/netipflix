/**
 * Sistema de Classificação Inteligente de Conteúdo
 * Analisa canais M3U e classifica automaticamente em TV, FILME ou SÉRIE
 */

export type ContentType = 'TV' | 'MOVIE' | 'SERIES';

export interface ClassificationResult {
  contentType: ContentType;
  confidence: number; // 0-100
  reasons: string[];
}

// Palavras-chave para categorias de TV ao vivo
const TV_KEYWORDS = {
  categories: [
    'tv', 'canal', 'channel', 'live', 'ao vivo', 'transmissao', 'transmissão',
    'noticia', 'notícia', 'news', 'esporte', 'sport', 'entretenimento',
    'documentario', 'documentário', 'infantil', 'kids', 'musica', 'música',
    'religioso', 'adulto', 'xxx', 'premium', 'hbo', 'fox', 'discovery',
    'telecine', 'globo', 'sbt', 'record', 'band', 'espn', 'sportv'
  ],
  names: [
    '24h', '24/7', 'hd', 'sd', 'fhd', '4k', 'uhd'
  ]
};

// Palavras-chave para filmes
const MOVIE_KEYWORDS = {
  categories: [
    'filme', 'film', 'movie', 'cinema', 'vod',
    'acao', 'ação', 'action', 'aventura', 'adventure',
    'comedia', 'comédia', 'comedy', 'drama', 'terror', 'horror',
    'suspense', 'thriller', 'romance', 'ficcao', 'ficção', 'sci-fi',
    'fantasia', 'fantasy', 'animacao', 'animação', 'animation',
    'documentario-filme', 'biografia', 'western', 'guerra', 'war'
  ],
  names: [
    'dublado', 'legendado', 'dual', 'bluray', 'webrip', 'web-dl',
    'hdcam', 'ts', 'dvdrip', 'nacional', 'latino'
  ]
};

// Palavras-chave para séries
const SERIES_KEYWORDS = {
  categories: [
    'serie', 'série', 'series', 'seriado', 'novela',
    'miniserie', 'minisserie', 'temporada', 'season'
  ],
  names: [
    'episodio', 'episódio', 'episode', 'ep', 'temp', 'temporada',
    's01', 's02', 's03', 's04', 's05', 's06', 's07', 's08', 's09', 's10'
  ]
};

// Padrões de URL para Xtream Codes e similares
const URL_PATTERNS = {
  tv: [
    /\/live\//i,
    /\.m3u8$/i,
    /\/ts$/i,
    /livestream/i,
    /channel/i
  ],
  movie: [
    /\/movie\//i,
    /\/vod\//i,
    /\.(mp4|mkv|avi)(\?|$)/i
  ],
  series: [
    /\/series\//i,
    /\/episode\//i
  ]
};

// Padrões de nomes para séries
const SERIES_NAME_PATTERNS = [
  /T\d+\|EP\d+/i,              // T01|EP01
  /S\d+\s*E\d+/i,              // S01E01, S01 E01
  /temporada\s*\d+/i,          // Temporada 1
  /season\s*\d+/i,             // Season 1
  /\d+x\d+/i,                  // 1x01
  /ep\s*\d+/i,                 // EP 01
  /episodio\s*\d+/i           // Episódio 01
];

/**
 * Normaliza texto para comparação
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove acentos
    .trim();
}

/**
 * Verifica se o texto contém alguma palavra-chave da lista
 */
function containsKeywords(text: string, keywords: string[]): boolean {
  const normalized = normalizeText(text);
  return keywords.some(keyword => normalized.includes(normalizeText(keyword)));
}

/**
 * Verifica se a URL corresponde a algum padrão
 */
function matchesUrlPattern(url: string, patterns: RegExp[]): boolean {
  return patterns.some(pattern => pattern.test(url));
}

/**
 * Verifica se o nome corresponde a padrões de séries
 */
function matchesSeriesPattern(name: string): boolean {
  return SERIES_NAME_PATTERNS.some(pattern => pattern.test(name));
}

/**
 * Analisa a URL do stream
 */
function analyzeUrl(url: string): { type: ContentType | null; confidence: number; reason: string } {
  if (!url) return { type: null, confidence: 0, reason: '' };

  // Xtream Codes patterns (alta confiança)
  if (matchesUrlPattern(url, URL_PATTERNS.series)) {
    return { type: 'SERIES', confidence: 90, reason: 'URL pattern: /series/' };
  }
  if (matchesUrlPattern(url, URL_PATTERNS.movie)) {
    return { type: 'MOVIE', confidence: 85, reason: 'URL pattern: /movie/ ou extensão de vídeo' };
  }
  if (matchesUrlPattern(url, URL_PATTERNS.tv)) {
    return { type: 'TV', confidence: 80, reason: 'URL pattern: /live/ ou .m3u8' };
  }

  return { type: null, confidence: 0, reason: '' };
}

/**
 * Analisa o nome do canal
 */
function analyzeName(name: string): { type: ContentType | null; confidence: number; reason: string } {
  if (!name) return { type: null, confidence: 0, reason: '' };

  // Padrão de série (alta confiança)
  if (matchesSeriesPattern(name)) {
    return { type: 'SERIES', confidence: 95, reason: 'Nome com padrão de episódio (T01|EP01, S01E01, etc)' };
  }

  // Palavras-chave no nome
  if (containsKeywords(name, SERIES_KEYWORDS.names)) {
    return { type: 'SERIES', confidence: 70, reason: 'Nome contém palavras de série' };
  }
  if (containsKeywords(name, MOVIE_KEYWORDS.names)) {
    return { type: 'MOVIE', confidence: 60, reason: 'Nome contém palavras de filme (dublado, legendado, etc)' };
  }
  if (containsKeywords(name, TV_KEYWORDS.names)) {
    return { type: 'TV', confidence: 50, reason: 'Nome contém palavras de TV (24h, HD, etc)' };
  }

  return { type: null, confidence: 0, reason: '' };
}

/**
 * Analisa a categoria
 */
function analyzeCategory(category: string): { type: ContentType | null; confidence: number; reason: string } {
  if (!category) return { type: null, confidence: 0, reason: '' };

  // Série (alta confiança)
  if (containsKeywords(category, SERIES_KEYWORDS.categories)) {
    return { type: 'SERIES', confidence: 85, reason: 'Categoria de série' };
  }

  // Filme (média confiança)
  if (containsKeywords(category, MOVIE_KEYWORDS.categories)) {
    return { type: 'MOVIE', confidence: 75, reason: 'Categoria de filme' };
  }

  // TV ao vivo (média confiança)
  if (containsKeywords(category, TV_KEYWORDS.categories)) {
    return { type: 'TV', confidence: 70, reason: 'Categoria de TV ao vivo' };
  }

  return { type: null, confidence: 0, reason: '' };
}

/**
 * Classifica o conteúdo baseado em múltiplas análises
 */
export function classifyContent(
  name: string,
  category: string,
  streamUrl: string
): ClassificationResult {
  const analyses = [
    analyzeUrl(streamUrl),
    analyzeName(name),
    analyzeCategory(category)
  ];

  // Filtra análises válidas
  const validAnalyses = analyses.filter(a => a.type !== null);

  if (validAnalyses.length === 0) {
    // Fallback: se não tem informação, assume TV
    return {
      contentType: 'TV',
      confidence: 30,
      reasons: ['Sem padrões identificados, classificado como TV por padrão']
    };
  }

  // Conta votos ponderados por confiança
  const votes: Record<ContentType, { score: number; reasons: string[] }> = {
    TV: { score: 0, reasons: [] },
    MOVIE: { score: 0, reasons: [] },
    SERIES: { score: 0, reasons: [] }
  };

  for (const analysis of validAnalyses) {
    if (analysis.type) {
      votes[analysis.type].score += analysis.confidence;
      votes[analysis.type].reasons.push(`${analysis.reason} (${analysis.confidence}%)`);
    }
  }

  // Determina o vencedor
  let winner: ContentType = 'TV';
  let maxScore = 0;

  for (const [type, data] of Object.entries(votes) as [ContentType, typeof votes.TV][]) {
    if (data.score > maxScore) {
      maxScore = data.score;
      winner = type;
    }
  }

  // Calcula confiança final (normaliza para 0-100)
  const totalScore = Object.values(votes).reduce((sum, v) => sum + v.score, 0);
  const confidence = totalScore > 0 ? Math.min(100, (maxScore / totalScore) * 100) : 30;

  return {
    contentType: winner,
    confidence: Math.round(confidence),
    reasons: votes[winner].reasons
  };
}

/**
 * Classifica automaticamente uma lista de canais
 */
export function classifyChannels<T extends { name: string; category: string; stream_url: string }>(
  channels: T[]
): (T & { content_type: ContentType; classification_confidence: number })[] {
  return channels.map(channel => {
    const classification = classifyContent(
      channel.name,
      channel.category,
      channel.stream_url
    );

    return {
      ...channel,
      content_type: classification.contentType,
      classification_confidence: classification.confidence
    };
  });
}

/**
 * Gera relatório de classificação
 */
export function generateClassificationReport(
  channels: { name: string; category: string; stream_url: string }[]
): {
  total: number;
  byType: Record<ContentType, number>;
  lowConfidence: number;
  averageConfidence: number;
} {
  const classified = classifyChannels(channels);
  
  const report = {
    total: channels.length,
    byType: {
      TV: 0,
      MOVIE: 0,
      SERIES: 0
    } as Record<ContentType, number>,
    lowConfidence: 0,
    averageConfidence: 0
  };

  let totalConfidence = 0;

  for (const channel of classified) {
    report.byType[channel.content_type]++;
    totalConfidence += channel.classification_confidence;
    if (channel.classification_confidence < 60) {
      report.lowConfidence++;
    }
  }

  report.averageConfidence = Math.round(totalConfidence / channels.length);

  return report;
}
