-- Melhoria no sistema de classificação de conteúdo
-- Esta migration adiciona mais padrões e melhora a detecção automática

-- Garantir que podemos alterar assinatura/nomes de parâmetros (DROP + CREATE)
DROP FUNCTION IF EXISTS public.normalize_text(text);

CREATE OR REPLACE FUNCTION public.normalize_text(p_text text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN lower(
    unaccent(
      trim(
        regexp_replace(p_text, '\s+', ' ', 'g')
      )
    )
  );
END;
$function$;

-- 2) Melhorar detecção de conteúdo com mais padrões
CREATE OR REPLACE FUNCTION public.determine_content_type_v3(p_category text, p_name text, p_stream_url text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $function$
DECLARE
  cat_lower text := normalize_text(coalesce(p_category, ''));
  name_lower text := normalize_text(coalesce(p_name, ''));
  url_lower text := lower(coalesce(p_stream_url, ''));
  confidence_score integer := 0;
  series_score integer := 0;
  movie_score integer := 0;
  tv_score integer := 0;
BEGIN
  -- ANÁLISE DE URL (maior peso - 90 pontos)
  -- Xtream Codes patterns
  IF url_lower LIKE '%/live/%' OR url_lower LIKE '%/livestream/%' THEN
    tv_score := tv_score + 90;
  END IF;

  IF url_lower LIKE '%/movie/%' OR url_lower LIKE '%/vod/%' THEN
    movie_score := movie_score + 90;
  END IF;

  IF url_lower LIKE '%/series/%' OR url_lower LIKE '%/episode/%' THEN
    series_score := series_score + 90;
  END IF;

  -- Extensões de vídeo (peso médio - 40 pontos)
  IF url_lower ~ '\.(mp4|mkv|avi)(\?|$)' THEN
    movie_score := movie_score + 40;
  END IF;

  -- M3U8 sugere TV ao vivo (peso baixo - 30 pontos)
  IF url_lower ~ '\.m3u8(\?|$)' THEN
    tv_score := tv_score + 30;
  END IF;

  -- ANÁLISE DO NOME (peso alto - 80 pontos)
  -- Padrões de série muito específicos
  IF name_lower ~ 't\d+\|ep\d+' 
     OR name_lower ~ 's\d+\s*e\d+' 
     OR name_lower ~ '\d+x\d+' 
     OR name_lower LIKE '%episodio%'
     OR name_lower LIKE '%episodio %'
     OR name_lower LIKE '%temporada%'
  THEN
    series_score := series_score + 85;
  END IF;

  -- Palavras indicativas de filme
  IF name_lower LIKE '%dublado%'
     OR name_lower LIKE '%legendado%'
     OR name_lower LIKE '%dual%'
     OR name_lower LIKE '%bluray%'
     OR name_lower LIKE '%web-dl%'
     OR name_lower LIKE '%webrip%'
  THEN
    movie_score := movie_score + 50;
  END IF;

  -- Palavras indicativas de TV ao vivo
  IF name_lower LIKE '%24h%'
     OR name_lower LIKE '%24/7%'
     OR name_lower LIKE '% hd'
     OR name_lower LIKE '% sd'
     OR name_lower LIKE '% fhd'
  THEN
    tv_score := tv_score + 30;
  END IF;

  -- ANÁLISE DA CATEGORIA (peso médio-alto - 70 pontos)
  -- Categorias de série
  IF cat_lower LIKE '%serie%'
     OR cat_lower LIKE '%seriado%'
     OR cat_lower LIKE '%novela%'
     OR cat_lower LIKE '%miniserie%'
  THEN
    series_score := series_score + 75;
  END IF;

  -- Categorias de filme
  IF cat_lower LIKE '%filme%'
     OR cat_lower LIKE '%film%'
     OR cat_lower LIKE '%movie%'
     OR cat_lower LIKE '%cinema%'
     OR cat_lower LIKE '%acao%'
     OR cat_lower LIKE '%comedia%'
     OR cat_lower LIKE '%drama%'
     OR cat_lower LIKE '%terror%'
     OR cat_lower LIKE '%suspense%'
     OR cat_lower LIKE '%aventura%'
     OR cat_lower LIKE '%romance%'
     OR cat_lower LIKE '%ficcao%'
     OR cat_lower LIKE '%fantasia%'
     OR cat_lower LIKE '%animacao%'
     OR cat_lower LIKE '%documentario-filme%'
     OR cat_lower LIKE '%western%'
  THEN
    movie_score := movie_score + 70;
  END IF;

  -- Categorias de TV
  IF cat_lower LIKE '%tv%'
     OR cat_lower LIKE '%canal%'
     OR cat_lower LIKE '%channel%'
     OR cat_lower LIKE '%ao vivo%'
     OR cat_lower LIKE '%live%'
     OR cat_lower LIKE '%noticia%'
     OR cat_lower LIKE '%esporte%'
     OR cat_lower LIKE '%sport%'
     OR cat_lower LIKE '%entretenimento%'
     OR cat_lower LIKE '%infantil%'
     OR cat_lower LIKE '%musica%'
     OR cat_lower LIKE '%religioso%'
     OR cat_lower LIKE '%documentario%'
     OR cat_lower LIKE '%news%'
  THEN
    tv_score := tv_score + 65;
  END IF;

  -- Canais específicos conhecidos (bonus)
  IF cat_lower LIKE '%globo%'
     OR cat_lower LIKE '%sbt%'
     OR cat_lower LIKE '%record%'
     OR cat_lower LIKE '%band%'
     OR cat_lower LIKE '%espn%'
     OR cat_lower LIKE '%sportv%'
     OR cat_lower LIKE '%hbo%'
     OR cat_lower LIKE '%telecine%'
     OR cat_lower LIKE '%discovery%'
     OR cat_lower LIKE '%fox%'
  THEN
    tv_score := tv_score + 20;
  END IF;

  -- DECISÃO BASEADA EM PONTUAÇÃO
  -- Determina o tipo com maior score
  IF series_score > movie_score AND series_score > tv_score THEN
    RETURN 'SERIES';
  ELSIF movie_score > tv_score THEN
    RETURN 'MOVIE';
  ELSE
    RETURN 'TV';
  END IF;
END;
$function$;

-- 3) Atualizar trigger para usar a nova versão
DROP TRIGGER IF EXISTS trigger_set_channel_content_type ON public.channels;

CREATE OR REPLACE FUNCTION public.set_channel_content_type()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  series_info RECORD;
BEGIN
  -- Usar a nova versão de classificação
  NEW.content_type := determine_content_type_v3(NEW.category, NEW.name, NEW.stream_url);

  -- Se for série, extrair informações de temporada/episódio
  IF NEW.content_type = 'SERIES' THEN
    SELECT * INTO series_info FROM extract_series_info(NEW.name);
    NEW.series_title := series_info.series_title;
    NEW.season_number := series_info.season_num;
    NEW.episode_number := series_info.episode_num;
  ELSE
    NEW.series_title := NULL;
    NEW.season_number := NULL;
    NEW.episode_number := NULL;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE TRIGGER trigger_set_channel_content_type
BEFORE INSERT OR UPDATE OF category, name, stream_url
ON public.channels
FOR EACH ROW
EXECUTE FUNCTION public.set_channel_content_type();

-- 4) Criar função para reclassificar canais existentes
CREATE OR REPLACE FUNCTION public.reclassify_all_channels()
RETURNS TABLE(
  updated_count bigint,
  by_type jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  result_count bigint;
  type_counts jsonb;
BEGIN
  -- Atualizar todos os canais para recalcular content_type
  UPDATE public.channels
  SET content_type = determine_content_type_v3(category, name, stream_url);
  
  GET DIAGNOSTICS result_count = ROW_COUNT;
  
  -- Contar por tipo
  SELECT jsonb_build_object(
    'TV', COUNT(*) FILTER (WHERE content_type = 'TV'),
    'MOVIE', COUNT(*) FILTER (WHERE content_type = 'MOVIE'),
    'SERIES', COUNT(*) FILTER (WHERE content_type = 'SERIES')
  )
  INTO type_counts
  FROM public.channels;
  
  RETURN QUERY SELECT result_count, type_counts;
END;
$function$;

-- 5) Comentários úteis
COMMENT ON FUNCTION public.determine_content_type_v3 IS 
'Classifica conteúdo em TV, MOVIE ou SERIES usando análise ponderada de URL, nome e categoria. Versão melhorada com sistema de pontuação.';

COMMENT ON FUNCTION public.reclassify_all_channels IS 
'Reclassifica todos os canais existentes usando a lógica mais recente. Use após importar listas ou atualizar a lógica de classificação.';
