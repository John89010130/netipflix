-- =====================================================
-- PARTE 1: ESTRUTURA (Colunas, Índices e Funções)
-- =====================================================
-- Execute esta parte primeiro
-- Tempo estimado: 5-10 segundos

-- 1. Adicionar colunas
ALTER TABLE public.channels 
ADD COLUMN IF NOT EXISTS is_adult_category boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS category_order integer DEFAULT 0;

-- 2. Criar índices
CREATE INDEX IF NOT EXISTS idx_channels_is_adult ON public.channels(is_adult_category);
CREATE INDEX IF NOT EXISTS idx_channels_category_order ON public.channels(category_order);
CREATE INDEX IF NOT EXISTS idx_channels_content_adult ON public.channels(content_type, is_adult_category);
CREATE INDEX IF NOT EXISTS idx_channels_series_grouped ON public.channels(series_title, season_number, episode_number) WHERE content_type = 'SERIES' AND active = true;

-- 3. Função para detectar categoria adulta
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

-- 4. Função para normalizar título de série
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
  normalized_title := regexp_replace(normalized_title, '\s*[Ss]\d+\s*[Ee]\d+.*$', '', 'g');
  normalized_title := regexp_replace(normalized_title, '\s*T\d+\|EP\d+.*$', '', 'g');
  normalized_title := regexp_replace(normalized_title, '\s*\d+x\d+.*$', '', 'g');
  normalized_title := regexp_replace(normalized_title, '\s*Temporada\s*\d+.*$', '', 'gi');
  normalized_title := regexp_replace(normalized_title, '\s*\(\d{4}\)\s*', '', 'g');
  normalized_title := regexp_replace(normalized_title, '\s+\d{4}\s*$', '', 'g');
  normalized_title := regexp_replace(normalized_title, '\s*(720p|1080p|4K|HD|FHD|UHD).*$', '', 'gi');
  normalized_title := regexp_replace(normalized_title, '\s+', ' ', 'g');
  normalized_title := regexp_replace(normalized_title, '\.{2,}', '.', 'g');
  RETURN trim(normalized_title);
END;
$function$;

-- 5. Função para atribuir ordem às categorias
CREATE OR REPLACE FUNCTION public.assign_category_order()
RETURNS void
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  cat_record record;
  current_order integer := 0;
BEGIN
  -- Categorias regulares primeiro
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
  
  -- Categorias adultas por último
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

-- 6. Função para reordenar (útil após importações)
CREATE OR REPLACE FUNCTION public.reorder_categories()
RETURNS text
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.channels SET is_adult_category = is_adult_category(category);
  PERFORM assign_category_order();
  RETURN 'Categorias reordenadas com sucesso!';
END;
$function$;

-- 7. Views otimizadas
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

-- 8. Comentários
COMMENT ON COLUMN public.channels.is_adult_category IS 'Indica se a categoria é conteúdo adulto (+18)';
COMMENT ON COLUMN public.channels.category_order IS 'Ordem de exibição (adultas por último)';

SELECT 'Parte 1 concluída! Execute a Parte 2 agora.' as status;
