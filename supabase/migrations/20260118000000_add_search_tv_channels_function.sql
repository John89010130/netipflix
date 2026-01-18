-- Função RPC para buscar canais de TV com múltiplas palavras
-- Busca independente da ordem das palavras digitadas
-- Exemplo: "Globo HD" ou "HD Globo" retornam os mesmos resultados

CREATE OR REPLACE FUNCTION search_tv_channels(
  search_words text[],
  selected_category text DEFAULT NULL,
  max_results integer DEFAULT 5000
)
RETURNS TABLE (
  id text,
  name text,
  category text,
  country text,
  logo_url text,
  stream_url text,
  active boolean,
  content_type text,
  last_test_status text,
  last_tested_at timestamptz
) 
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.name,
    c.category,
    c.country,
    c.logo_url,
    c.stream_url,
    c.active,
    c.content_type,
    c.last_test_status,
    c.last_tested_at
  FROM active_channels c
  WHERE 
    c.content_type = 'TV'
    AND c.active = true
    -- Se categoria específica foi selecionada, filtrar por ela
    AND (selected_category IS NULL OR selected_category = 'Todos' OR selected_category = '🔞 Adulto' OR c.category = selected_category)
    -- Buscar todas as palavras (independente da ordem)
    -- Cada palavra deve estar presente no CONCAT de todos os campos
    AND (
      array_length(search_words, 1) IS NULL 
      OR (
        SELECT bool_and(
          CONCAT(
            COALESCE(c.name, ''), ' ',
            COALESCE(c.category, ''), ' ',
            COALESCE(c.country, ''), ' ',
            COALESCE(c.clean_title, '')
          ) ILIKE '%' || word || '%'
        )
        FROM unnest(search_words) AS word
      )
    )
  ORDER BY 
    -- Priorizar canais BR
    CASE WHEN c.name ILIKE 'BR:%' THEN 0 ELSE 1 END,
    -- Depois ordenar alfabeticamente
    c.name
  LIMIT max_results;
END;
$$;

-- Comentário da função
COMMENT ON FUNCTION search_tv_channels IS 'Busca canais de TV com múltiplas palavras independente da ordem. Usa CONCAT para buscar em name, category, country e clean_title.';
