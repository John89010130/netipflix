-- 1) Improve series info extraction (supports "S01 E01" pattern)
CREATE OR REPLACE FUNCTION public.extract_series_info(p_name text)
RETURNS TABLE(series_title text, season_num integer, episode_num integer)
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $function$
DECLARE
  cleaned_name text;
  title_part text;
  season_part integer;
  episode_part integer;
  match_result text[];
BEGIN
  cleaned_name := trim(p_name);

  -- Pattern 1: "SeriesName T1|EP01" or "SeriesName T01|EP15"
  IF cleaned_name ~ '^(.+?)\s*T(\d+)\|EP(\d+)' THEN
    match_result := regexp_match(cleaned_name, '^(.+?)\s*T(\d+)\|EP(\d+)');
    title_part := trim(match_result[1]);
    season_part := match_result[2]::integer;
    episode_part := match_result[3]::integer;

    IF title_part = '' OR title_part IS NULL THEN
      RETURN QUERY SELECT NULL::text, season_part, episode_part;
      RETURN;
    END IF;

    RETURN QUERY SELECT title_part, season_part, episode_part;
    RETURN;
  END IF;

  -- Pattern 2: "01|EP01" (no series name)
  IF cleaned_name ~ '^\d+\|EP\d+' THEN
    match_result := regexp_match(cleaned_name, '^(\d+)\|EP(\d+)');
    season_part := match_result[1]::integer;
    episode_part := match_result[2]::integer;
    RETURN QUERY SELECT NULL::text, season_part, episode_part;
    RETURN;
  END IF;

  -- Pattern 3: "Number|EP01 Episode Title"
  IF cleaned_name ~ '^\d+\|EP\d+\s+.+' THEN
    match_result := regexp_match(cleaned_name, '^(\d+)\|EP(\d+)\s+(.+)');
    season_part := match_result[1]::integer;
    episode_part := match_result[2]::integer;
    title_part := trim(match_result[3]);
    RETURN QUERY SELECT title_part, season_part, episode_part;
    RETURN;
  END IF;

  -- Pattern 4: "SeriesName S01 E01" or "SeriesName.S01 E01" (space between season and E)
  IF cleaned_name ~* '(.+?)[.\s]S(\d+)\s*E(\d+)' THEN
    match_result := regexp_match(cleaned_name, '(.+?)[.\s]S(\d+)\s*E(\d+)', 'i');
    title_part := regexp_replace(trim(match_result[1]), '\\.', ' ', 'g');
    season_part := match_result[2]::integer;
    episode_part := match_result[3]::integer;
    RETURN QUERY SELECT title_part, season_part, episode_part;
    RETURN;
  END IF;

  -- Pattern 5: "SeriesName.S01E01" or "SeriesName S01E01"
  IF cleaned_name ~* '(.+?)[.\s]S(\d+)E(\d+)' THEN
    match_result := regexp_match(cleaned_name, '(.+?)[.\s]S(\d+)E(\d+)', 'i');
    title_part := regexp_replace(trim(match_result[1]), '\\.', ' ', 'g');
    season_part := match_result[2]::integer;
    episode_part := match_result[3]::integer;
    RETURN QUERY SELECT title_part, season_part, episode_part;
    RETURN;
  END IF;

  -- Pattern 6: "SeriesName.S01e01" (lowercase e)
  IF cleaned_name ~* '(.+?)[.\s]S(\d+)e(\d+)' THEN
    match_result := regexp_match(cleaned_name, '(.+?)[.\s]S(\d+)e(\d+)', 'i');
    title_part := regexp_replace(trim(match_result[1]), '\\.', ' ', 'g');
    season_part := match_result[2]::integer;
    episode_part := match_result[3]::integer;
    RETURN QUERY SELECT title_part, season_part, episode_part;
    RETURN;
  END IF;

  RETURN QUERY SELECT NULL::text, NULL::integer, NULL::integer;
END;
$function$;

-- 2) New, more reliable content type detection using stream_url when available
CREATE OR REPLACE FUNCTION public.determine_content_type_v2(p_category text, p_name text, p_stream_url text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $function$
DECLARE
  cat_lower text := normalize_text(coalesce(p_category, ''));
  name_lower text := normalize_text(coalesce(p_name, ''));
  url_lower text := lower(coalesce(p_stream_url, ''));
BEGIN
  -- Xtream Codes patterns (most reliable)
  IF url_lower LIKE '%/live/%' THEN
    RETURN 'TV';
  END IF;

  IF url_lower LIKE '%/movie/%' THEN
    RETURN 'MOVIE';
  END IF;

  IF url_lower LIKE '%/series/%' THEN
    RETURN 'SERIES';
  END IF;

  -- Name-based episode patterns
  IF name_lower ~ 't\d+\|ep\d+'
     OR name_lower ~ 's\d+\s*e\d+'
     OR name_lower LIKE '%temporada%'
     OR name_lower LIKE '%episod%'
  THEN
    RETURN 'SERIES';
  END IF;

  -- Category hints
  IF cat_lower LIKE '%seriad%'
     OR cat_lower LIKE '%serie%'
     OR cat_lower LIKE '%s\u00e9ries%'
     OR cat_lower LIKE '%series%'
  THEN
    RETURN 'SERIES';
  END IF;

  IF cat_lower LIKE '%film%'
     OR cat_lower LIKE '%filme%'
     OR cat_lower LIKE '%movie%'
     OR cat_lower LIKE '%vod%'
  THEN
    RETURN 'MOVIE';
  END IF;

  IF cat_lower LIKE '%canal%'
     OR cat_lower LIKE '%channel%'
     OR cat_lower LIKE '%tv%'
     OR cat_lower LIKE '%ao vivo%'
     OR cat_lower LIKE '%live%'
  THEN
    RETURN 'TV';
  END IF;

  -- Extension heuristic (last resort)
  IF url_lower ~ '\\.(mp4|mkv|avi)(\\?|$)' THEN
    RETURN 'MOVIE';
  END IF;

  RETURN 'TV';
END;
$function$;

-- 3) Update trigger function to use determine_content_type_v2 (and keep series fields consistent)
CREATE OR REPLACE FUNCTION public.set_channel_content_type()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  series_info RECORD;
BEGIN
  NEW.content_type := determine_content_type_v2(NEW.category, NEW.name, NEW.stream_url);

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

-- 4) Ensure trigger also reacts to stream_url updates (and is in sync with new logic)
DROP TRIGGER IF EXISTS trigger_set_channel_content_type ON public.channels;

CREATE TRIGGER trigger_set_channel_content_type
BEFORE INSERT OR UPDATE OF category, name, stream_url
ON public.channels
FOR EACH ROW
EXECUTE FUNCTION public.set_channel_content_type();