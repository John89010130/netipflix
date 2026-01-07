-- =====================================================
-- REORGANIZAÇÃO DO BANCO DE DADOS - ESTRUTURA NORMALIZADA
-- =====================================================

-- 1. Adicionar novas colunas na tabela channels
ALTER TABLE public.channels 
ADD COLUMN IF NOT EXISTS clean_title text,
ADD COLUMN IF NOT EXISTS year integer,
ADD COLUMN IF NOT EXISTS subcategory text,
ADD COLUMN IF NOT EXISTS genre text,
ADD COLUMN IF NOT EXISTS episode_title text,
ADD COLUMN IF NOT EXISTS original_name text;

-- 2. Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_channels_clean_title ON public.channels(clean_title);
CREATE INDEX IF NOT EXISTS idx_channels_year ON public.channels(year);
CREATE INDEX IF NOT EXISTS idx_channels_subcategory ON public.channels(subcategory);
CREATE INDEX IF NOT EXISTS idx_channels_genre ON public.channels(genre);

-- 3. Função robusta para extrair informações do nome
CREATE OR REPLACE FUNCTION public.parse_content_name(p_name text)
RETURNS TABLE(
  clean_title text,
  year_extracted integer,
  season_num integer,
  episode_num integer,
  episode_title text
)
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $function$
DECLARE
  working_name text;
  match_result text[];
  extracted_title text;
  extracted_year integer;
  extracted_season integer;
  extracted_episode integer;
  extracted_ep_title text;
BEGIN
  working_name := trim(p_name);
  extracted_title := working_name;
  extracted_year := NULL;
  extracted_season := NULL;
  extracted_episode := NULL;
  extracted_ep_title := NULL;

  -- Extrair ano no formato (YYYY) ou YYYY
  IF working_name ~ '\((\d{4})\)' THEN
    match_result := regexp_match(working_name, '\((\d{4})\)');
    extracted_year := match_result[1]::integer;
    working_name := regexp_replace(working_name, '\s*\(\d{4}\)\s*', ' ', 'g');
  ELSIF working_name ~ '\b(19\d{2}|20\d{2})\b' THEN
    match_result := regexp_match(working_name, '\b(19\d{2}|20\d{2})\b');
    extracted_year := match_result[1]::integer;
  END IF;

  -- Padrão 1: "Nome S01 E10" ou "Nome S01E10"
  IF working_name ~* '(.+?)\s*S(\d+)\s*E(\d+)' THEN
    match_result := regexp_match(working_name, '(.+?)\s*S(\d+)\s*E(\d+)', 'i');
    extracted_title := trim(match_result[1]);
    extracted_season := match_result[2]::integer;
    extracted_episode := match_result[3]::integer;
    
  -- Padrão 2: "Nome T01|EP10" ou "Nome T1|EP10"
  ELSIF working_name ~* '(.+?)\s*T(\d+)\|EP(\d+)' THEN
    match_result := regexp_match(working_name, '(.+?)\s*T(\d+)\|EP(\d+)', 'i');
    extracted_title := trim(match_result[1]);
    extracted_season := match_result[2]::integer;
    extracted_episode := match_result[3]::integer;

  -- Padrão 3: "T01|EP10" sem nome (título vem de pltv-subgroup)
  ELSIF working_name ~* '^T(\d+)\|EP(\d+)$' THEN
    match_result := regexp_match(working_name, '^T(\d+)\|EP(\d+)$', 'i');
    extracted_title := NULL;
    extracted_season := match_result[1]::integer;
    extracted_episode := match_result[2]::integer;

  -- Padrão 4: "Nome 1x03" ou "Nome 01x03"
  ELSIF working_name ~* '(.+?)\s+(\d{1,2})x(\d{1,2})' THEN
    match_result := regexp_match(working_name, '(.+?)\s+(\d{1,2})x(\d{1,2})', 'i');
    extracted_title := trim(match_result[1]);
    extracted_season := match_result[2]::integer;
    extracted_episode := match_result[3]::integer;

  -- Padrão 5: "Nome Temporada 1 Episódio 3"
  ELSIF working_name ~* '(.+?)\s*Temporada\s*(\d+)\s*Epis[oó]dio\s*(\d+)' THEN
    match_result := regexp_match(working_name, '(.+?)\s*Temporada\s*(\d+)\s*Epis[oó]dio\s*(\d+)', 'i');
    extracted_title := trim(match_result[1]);
    extracted_season := match_result[2]::integer;
    extracted_episode := match_result[3]::integer;

  -- Padrão 6: "Nome.S01.E01.720p" (com pontos)
  ELSIF working_name ~* '(.+?)\.S(\d+)\.?E(\d+)' THEN
    match_result := regexp_match(working_name, '(.+?)\.S(\d+)\.?E(\d+)', 'i');
    extracted_title := regexp_replace(trim(match_result[1]), '\.', ' ', 'g');
    extracted_season := match_result[2]::integer;
    extracted_episode := match_result[3]::integer;

  ELSE
    -- Sem padrão de episódio, limpar título
    -- Remover qualidade e outras tags
    extracted_title := regexp_replace(working_name, '\s*(720p|1080p|4K|HDR|BluRay|WEB-DL|HDTV)\s*', '', 'gi');
    extracted_title := regexp_replace(extracted_title, '\s*(Dublado|Legendado|Dual|Nacional)\s*', '', 'gi');
  END IF;

  -- Limpar título final
  IF extracted_title IS NOT NULL THEN
    extracted_title := regexp_replace(extracted_title, '\s+', ' ', 'g');
    extracted_title := trim(extracted_title);
    -- Remover ano do título se ainda estiver lá
    extracted_title := regexp_replace(extracted_title, '\s*\(\d{4}\)\s*', '', 'g');
    extracted_title := regexp_replace(extracted_title, '\s*(19\d{2}|20\d{2})\s*$', '', 'g');
  END IF;

  -- Se título ficou vazio, usar o nome original
  IF extracted_title IS NULL OR extracted_title = '' THEN
    extracted_title := p_name;
  END IF;

  RETURN QUERY SELECT extracted_title, extracted_year, extracted_season, extracted_episode, extracted_ep_title;
END;
$function$;

-- 4. Função para extrair categoria e subcategoria
CREATE OR REPLACE FUNCTION public.parse_category_info(p_category text)
RETURNS TABLE(
  main_category text,
  sub_category text,
  detected_genre text
)
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $function$
DECLARE
  cat_lower text;
  parts text[];
  main_cat text;
  sub_cat text;
  genre text;
BEGIN
  cat_lower := lower(trim(coalesce(p_category, '')));
  main_cat := p_category;
  sub_cat := NULL;
  genre := NULL;

  -- Separar por | ou /
  IF p_category ~ '\|' THEN
    parts := string_to_array(p_category, '|');
    main_cat := trim(parts[1]);
    sub_cat := trim(parts[2]);
  ELSIF p_category ~ '/' THEN
    parts := string_to_array(p_category, '/');
    main_cat := trim(parts[1]);
    sub_cat := trim(parts[2]);
  END IF;

  -- Detectar gêneros conhecidos
  IF cat_lower ~ 'acao|action' THEN genre := 'Ação';
  ELSIF cat_lower ~ 'comedia|comedy' THEN genre := 'Comédia';
  ELSIF cat_lower ~ 'drama' THEN genre := 'Drama';
  ELSIF cat_lower ~ 'terror|horror' THEN genre := 'Terror';
  ELSIF cat_lower ~ 'romance' THEN genre := 'Romance';
  ELSIF cat_lower ~ 'ficcao|sci-?fi|science' THEN genre := 'Ficção Científica';
  ELSIF cat_lower ~ 'aventura|adventure' THEN genre := 'Aventura';
  ELSIF cat_lower ~ 'anima[cç][aã]o|animation|anime' THEN genre := 'Animação';
  ELSIF cat_lower ~ 'document[aá]rio|documentary' THEN genre := 'Documentário';
  ELSIF cat_lower ~ 'suspense|thriller' THEN genre := 'Suspense';
  ELSIF cat_lower ~ 'infantil|kids|crian[cç]a' THEN genre := 'Infantil';
  ELSIF cat_lower ~ 'famil[iy]|familia' THEN genre := 'Família';
  ELSIF cat_lower ~ 'guerra|war' THEN genre := 'Guerra';
  ELSIF cat_lower ~ 'western|faroeste' THEN genre := 'Faroeste';
  ELSIF cat_lower ~ 'musical' THEN genre := 'Musical';
  ELSIF cat_lower ~ 'crime' THEN genre := 'Crime';
  ELSIF cat_lower ~ 'mist[ée]rio|mystery' THEN genre := 'Mistério';
  ELSIF cat_lower ~ 'fantasia|fantasy' THEN genre := 'Fantasia';
  ELSIF cat_lower ~ 'biogr[aá]fi|biography' THEN genre := 'Biografia';
  ELSIF cat_lower ~ 'hist[oó]ri[ac]|history' THEN genre := 'História';
  ELSIF cat_lower ~ 'esport|sport' THEN genre := 'Esportes';
  ELSIF cat_lower ~ 'reality' THEN genre := 'Reality';
  ELSIF cat_lower ~ 'novela|soap' THEN genre := 'Novela';
  ELSIF cat_lower ~ 'talk.?show' THEN genre := 'Talk Show';
  ELSIF cat_lower ~ 'news|not[íi]cia|jornal' THEN genre := 'Notícias';
  END IF;

  RETURN QUERY SELECT main_cat, sub_cat, genre;
END;
$function$;

-- 5. Atualizar trigger para usar as novas funções
CREATE OR REPLACE FUNCTION public.set_channel_content_type()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  name_info RECORD;
  cat_info RECORD;
BEGIN
  -- Salvar nome original se for inserção
  IF TG_OP = 'INSERT' THEN
    NEW.original_name := NEW.name;
  END IF;

  -- Determinar tipo de conteúdo
  NEW.content_type := determine_content_type_v2(NEW.category, NEW.name, NEW.stream_url);

  -- Extrair informações do nome
  SELECT * INTO name_info FROM parse_content_name(NEW.name);
  
  -- Popular colunas
  NEW.clean_title := name_info.clean_title;
  NEW.year := name_info.year_extracted;
  NEW.season_number := name_info.season_num;
  NEW.episode_number := name_info.episode_num;
  NEW.episode_title := name_info.episode_title;

  -- Se for série e clean_title foi extraído, usar como series_title
  IF NEW.content_type = 'SERIES' AND NEW.clean_title IS NOT NULL THEN
    NEW.series_title := NEW.clean_title;
  END IF;

  -- Extrair informações da categoria
  SELECT * INTO cat_info FROM parse_category_info(NEW.category);
  
  -- Popular categoria e subcategoria
  IF cat_info.sub_category IS NOT NULL THEN
    NEW.subcategory := cat_info.sub_category;
  END IF;
  
  IF cat_info.detected_genre IS NOT NULL THEN
    NEW.genre := cat_info.detected_genre;
  END IF;

  RETURN NEW;
END;
$function$;

-- 6. Recriar o trigger
DROP TRIGGER IF EXISTS trigger_set_channel_content_type ON public.channels;
CREATE TRIGGER trigger_set_channel_content_type
  BEFORE INSERT OR UPDATE ON public.channels
  FOR EACH ROW
  EXECUTE FUNCTION public.set_channel_content_type();

-- 7. Função para migrar dados existentes
CREATE OR REPLACE FUNCTION public.reorganize_all_channels()
RETURNS TABLE(
  total_processed integer,
  series_updated integer,
  movies_updated integer,
  tv_updated integer,
  years_extracted integer,
  subcategories_extracted integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  rec RECORD;
  name_info RECORD;
  cat_info RECORD;
  total_count integer := 0;
  series_count integer := 0;
  movies_count integer := 0;
  tv_count integer := 0;
  years_count integer := 0;
  subcat_count integer := 0;
BEGIN
  FOR rec IN SELECT * FROM channels LOOP
    total_count := total_count + 1;
    
    -- Extrair informações do nome
    SELECT * INTO name_info FROM parse_content_name(rec.name);
    
    -- Extrair informações da categoria
    SELECT * INTO cat_info FROM parse_category_info(rec.category);
    
    -- Atualizar registro
    UPDATE channels SET
      original_name = COALESCE(original_name, name),
      clean_title = name_info.clean_title,
      year = name_info.year_extracted,
      season_number = COALESCE(name_info.season_num, season_number),
      episode_number = COALESCE(name_info.episode_num, episode_number),
      episode_title = name_info.episode_title,
      subcategory = cat_info.sub_category,
      genre = cat_info.detected_genre,
      series_title = CASE 
        WHEN content_type = 'SERIES' AND name_info.clean_title IS NOT NULL 
        THEN name_info.clean_title 
        ELSE series_title 
      END
    WHERE id = rec.id;
    
    -- Contadores
    IF rec.content_type = 'SERIES' THEN series_count := series_count + 1;
    ELSIF rec.content_type = 'MOVIE' THEN movies_count := movies_count + 1;
    ELSE tv_count := tv_count + 1;
    END IF;
    
    IF name_info.year_extracted IS NOT NULL THEN years_count := years_count + 1; END IF;
    IF cat_info.sub_category IS NOT NULL THEN subcat_count := subcat_count + 1; END IF;
  END LOOP;
  
  RETURN QUERY SELECT total_count, series_count, movies_count, tv_count, years_count, subcat_count;
END;
$function$;