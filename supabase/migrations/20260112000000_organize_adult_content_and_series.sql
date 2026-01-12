-- =====================================================
-- ORGANIZAÇÃO DE CONTEÚDO ADULTO E SÉRIES
-- =====================================================
-- Este migration organiza:
-- 1. Categorias adultas sempre por último
-- 2. Melhora agrupamento de séries
-- 3. Adiciona ordem de exibição para categorias

-- 1. Adicionar coluna para marcar categorias adultas e ordem
ALTER TABLE public.channels 
ADD COLUMN IF NOT EXISTS is_adult_category boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS category_order integer DEFAULT 0;

-- 2. Criar índices para melhorar performance
CREATE INDEX IF NOT EXISTS idx_channels_is_adult ON public.channels(is_adult_category);
CREATE INDEX IF NOT EXISTS idx_channels_category_order ON public.channels(category_order);
CREATE INDEX IF NOT EXISTS idx_channels_content_adult ON public.channels(content_type, is_adult_category);

-- 3. Função para detectar se uma categoria é adulta
CREATE OR REPLACE FUNCTION public.is_adult_category(p_category text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $function$
DECLARE
  cat_lower text;
BEGIN
  cat_lower := lower(trim(coalesce(p_category, '')));
  
  RETURN cat_lower ~ 'adult|adulto|\+18|18\+|xxx|onlyfans|bella da semana|porn|erotico|erótico|campur';
END;
$function$;

-- 4. Atualizar a coluna is_adult_category baseado na categoria
UPDATE public.channels
SET is_adult_category = is_adult_category(category)
WHERE is_adult_category IS NULL OR is_adult_category = false;

-- 5. Função para atribuir ordem às categorias (adultas sempre por último)
CREATE OR REPLACE FUNCTION public.assign_category_order()
RETURNS void
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  cat_record record;
  current_order integer := 0;
BEGIN
  -- Primeiro, ordenar categorias não-adultas por tipo de conteúdo e nome
  FOR cat_record IN (
    SELECT DISTINCT content_type, category, is_adult_category
    FROM public.channels
    WHERE is_adult_category = false
    ORDER BY content_type, category
  ) LOOP
    UPDATE public.channels
    SET category_order = current_order
    WHERE content_type = cat_record.content_type 
      AND category = cat_record.category
      AND is_adult_category = false;
    
    current_order := current_order + 1;
  END LOOP;
  
  -- Depois, ordenar categorias adultas (começam após as regulares)
  FOR cat_record IN (
    SELECT DISTINCT content_type, category, is_adult_category
    FROM public.channels
    WHERE is_adult_category = true
    ORDER BY content_type, category
  ) LOOP
    UPDATE public.channels
    SET category_order = current_order
    WHERE content_type = cat_record.content_type 
      AND category = cat_record.category
      AND is_adult_category = true;
    
    current_order := current_order + 1;
  END LOOP;
END;
$function$;

-- 6. Executar a atribuição de ordem às categorias
SELECT public.assign_category_order();

-- 7. Melhorar a função de extração de informações de séries
-- Adiciona lógica para melhor agrupamento de episódios

CREATE OR REPLACE FUNCTION public.normalize_series_title(p_title text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $function$
DECLARE
  normalized_title text;
BEGIN
  normalized_title := trim(p_title);
  
  -- Remover informações de temporada/episódio do título
  normalized_title := regexp_replace(normalized_title, '\s*[Ss]\d+\s*[Ee]\d+.*$', '', 'g');
  normalized_title := regexp_replace(normalized_title, '\s*T\d+\|EP\d+.*$', '', 'g');
  normalized_title := regexp_replace(normalized_title, '\s*\d+x\d+.*$', '', 'g');
  normalized_title := regexp_replace(normalized_title, '\s*Temporada\s*\d+.*$', '', 'gi');
  
  -- Remover ano
  normalized_title := regexp_replace(normalized_title, '\s*\(\d{4}\)\s*', '', 'g');
  normalized_title := regexp_replace(normalized_title, '\s+\d{4}\s*$', '', 'g');
  
  -- Remover qualidade de vídeo
  normalized_title := regexp_replace(normalized_title, '\s*(720p|1080p|4K|HD|FHD|UHD).*$', '', 'gi');
  
  -- Remover caracteres especiais duplicados e espaços extras
  normalized_title := regexp_replace(normalized_title, '\s+', ' ', 'g');
  normalized_title := regexp_replace(normalized_title, '\.{2,}', '.', 'g');
  normalized_title := trim(normalized_title);
  
  RETURN normalized_title;
END;
$function$;

-- 8. Atualizar series_title para todas as séries usando título normalizado
UPDATE public.channels
SET series_title = COALESCE(
  normalize_series_title(series_title),
  normalize_series_title(name)
)
WHERE content_type = 'SERIES' 
  AND (series_title IS NULL OR series_title = '');

-- 9. Criar view para listar categorias em ordem (adultas por último)
CREATE OR REPLACE VIEW public.categories_ordered AS
SELECT DISTINCT 
  content_type,
  category,
  is_adult_category,
  category_order,
  COUNT(*) as items_count
FROM public.channels
WHERE active = true
GROUP BY content_type, category, is_adult_category, category_order
ORDER BY category_order, category;

-- 10. Criar view para séries agrupadas corretamente
CREATE OR REPLACE VIEW public.series_grouped AS
SELECT 
  series_title,
  category,
  is_adult_category,
  MIN(logo_url) as poster_url,
  COUNT(*) as episodes_count,
  COUNT(DISTINCT season_number) as seasons_count,
  MAX(season_number) as latest_season,
  MAX(episode_number) as latest_episode,
  array_agg(DISTINCT season_number ORDER BY season_number) as seasons,
  MIN(id) as first_episode_id
FROM public.channels
WHERE content_type = 'SERIES' 
  AND active = true
  AND series_title IS NOT NULL
GROUP BY series_title, category, is_adult_category
ORDER BY series_title;

-- 11. Criar trigger para auto-atualizar is_adult_category quando inserir/atualizar
CREATE OR REPLACE FUNCTION public.update_adult_category_flag()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  NEW.is_adult_category := is_adult_category(NEW.category);
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trigger_update_adult_category ON public.channels;
CREATE TRIGGER trigger_update_adult_category
  BEFORE INSERT OR UPDATE OF category ON public.channels
  FOR EACH ROW
  EXECUTE FUNCTION update_adult_category_flag();

-- 12. Adicionar comentários nas tabelas para documentação
COMMENT ON COLUMN public.channels.is_adult_category IS 'Indica se a categoria é considerada conteúdo adulto (+18)';
COMMENT ON COLUMN public.channels.category_order IS 'Ordem de exibição da categoria (adultas sempre por último)';
COMMENT ON VIEW public.categories_ordered IS 'Categorias ordenadas com conteúdo adulto por último';
COMMENT ON VIEW public.series_grouped IS 'Séries agrupadas corretamente por título';

-- 13. Criar função para re-processar ordenação de categorias (útil após importações)
CREATE OR REPLACE FUNCTION public.reorder_categories()
RETURNS text
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  -- Atualizar flags de adulto
  UPDATE public.channels
  SET is_adult_category = is_adult_category(category);
  
  -- Re-ordenar categorias
  PERFORM assign_category_order();
  
  RETURN 'Categorias reordenadas com sucesso. Categorias adultas movidas para o final.';
END;
$function$;

-- 14. Corrigir series_title vazios ou nulos para séries existentes
DO $$
DECLARE
  rec record;
  parsed_info record;
BEGIN
  FOR rec IN 
    SELECT id, name, series_title 
    FROM public.channels 
    WHERE content_type = 'SERIES' 
      AND (series_title IS NULL OR series_title = '')
  LOOP
    -- Usar a função parse_content_name para extrair o título
    SELECT * INTO parsed_info 
    FROM parse_content_name(rec.name);
    
    IF parsed_info.clean_title IS NOT NULL THEN
      UPDATE public.channels
      SET series_title = normalize_series_title(parsed_info.clean_title)
      WHERE id = rec.id;
    END IF;
  END LOOP;
END;
$$;

-- 15. Criar índice composto para queries de séries agrupadas
CREATE INDEX IF NOT EXISTS idx_channels_series_grouped 
  ON public.channels(series_title, season_number, episode_number)
  WHERE content_type = 'SERIES' AND active = true;

-- 16. Estatísticas finais
DO $$
DECLARE
  total_series integer;
  total_episodes integer;
  adult_series integer;
  regular_series integer;
BEGIN
  SELECT COUNT(DISTINCT series_title) INTO total_series
  FROM public.channels
  WHERE content_type = 'SERIES' AND active = true AND series_title IS NOT NULL;
  
  SELECT COUNT(*) INTO total_episodes
  FROM public.channels
  WHERE content_type = 'SERIES' AND active = true;
  
  SELECT COUNT(DISTINCT series_title) INTO adult_series
  FROM public.channels
  WHERE content_type = 'SERIES' AND active = true AND is_adult_category = true;
  
  SELECT COUNT(DISTINCT series_title) INTO regular_series
  FROM public.channels
  WHERE content_type = 'SERIES' AND active = true AND is_adult_category = false;
  
  RAISE NOTICE 'Organização concluída:';
  RAISE NOTICE '- Total de séries: %', total_series;
  RAISE NOTICE '- Total de episódios: %', total_episodes;
  RAISE NOTICE '- Séries regulares: %', regular_series;
  RAISE NOTICE '- Séries adultas: %', adult_series;
END;
$$;

-- Arquivo de migration: supabase\migrations\20260112000000_organize_adult_content_and_series.sql
