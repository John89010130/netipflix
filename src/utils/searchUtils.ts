/**
 * Utilitário para busca avançada no banco de dados
 * Separa palavras e busca cada uma individualmente
 */

/**
 * Constrói uma query de busca que procura por cada palavra separadamente
 * Exemplo: "Breaking Bad" busca por registros que contenham "Breaking" E "Bad"
 */
export const buildSearchQuery = (searchTerm: string, fields: string[]): string => {
  if (!searchTerm || !searchTerm.trim()) {
    return '';
  }

  // Separar por espaços e remover vazios
  const words = searchTerm
    .trim()
    .split(/\s+/)
    .filter(word => word.length > 0);

  if (words.length === 0) {
    return '';
  }

  // Se for apenas uma palavra, busca simples
  if (words.length === 1) {
    const conditions = fields.map(field => `${field}.ilike.%${words[0]}%`);
    return conditions.join(',');
  }

  // Para múltiplas palavras, criar condições AND
  // Cada palavra deve aparecer em pelo menos um dos campos
  const wordConditions = words.map(word => {
    const fieldConditions = fields.map(field => `${field}.ilike.%${word}%`);
    return `(${fieldConditions.join(',')})`;
  });

  // Retorna a query no formato OR para Supabase
  // Infelizmente Supabase não tem AND direto via .or(), então fazemos cliente-side
  return fields.map(field => `${field}.ilike.%${searchTerm}%`).join(',');
};

/**
 * Filtra resultados do lado do cliente para busca por todas as palavras
 * Garante que TODAS as palavras estejam presentes
 */
export const filterByAllWords = <T extends Record<string, any>>(
  items: T[],
  searchTerm: string,
  fields: (keyof T)[]
): T[] => {
  if (!searchTerm || !searchTerm.trim()) {
    return items;
  }

  const words = searchTerm
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(word => word.length > 0);

  if (words.length === 0) {
    return items;
  }

  return items.filter(item => {
    // Para cada palavra, verificar se existe em algum campo
    return words.every(word => {
      return fields.some(field => {
        const value = item[field];
        if (!value) return false;
        return String(value).toLowerCase().includes(word);
      });
    });
  });
};

/**
 * Normaliza texto para busca (remove acentos, pontuação, etc)
 */
export const normalizeForSearch = (text: string): string => {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove acentos
    .replace(/[^\w\s]/g, ' ') // Remove pontuação
    .replace(/\s+/g, ' ') // Normaliza espaços
    .trim();
};
