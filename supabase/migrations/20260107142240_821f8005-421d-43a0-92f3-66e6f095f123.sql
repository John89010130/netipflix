-- Corrigir função parse_content_name - usar regex greedy para capturar episódios corretamente
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

  -- Padrão 1: "Nome S01 E10" ou "Nome S01E10" - usar greedy (.+) e word boundary
  IF working_name ~* '\sS(\d{1,2})\s*E(\d+)' THEN
    match_result := regexp_match(working_name, '^(.+)\s+S(\d{1,2})\s*E(\d+)', 'i');
    IF match_result IS NOT NULL THEN
      extracted_title := trim(match_result[1]);
      extracted_season := match_result[2]::integer;
      extracted_episode := match_result[3]::integer;
    END IF;
    
  -- Padrão 2: "Nome T01|EP10"
  ELSIF working_name ~* 'T(\d{1,2})\|EP(\d+)' THEN
    match_result := regexp_match(working_name, '^(.+?)\s*T(\d{1,2})\|EP(\d+)', 'i');
    IF match_result IS NOT NULL AND match_result[1] IS NOT NULL AND trim(match_result[1]) != '' THEN
      extracted_title := trim(match_result[1]);
      extracted_season := match_result[2]::integer;
      extracted_episode := match_result[3]::integer;
    ELSE
      -- Sem título, só T01|EP10
      match_result := regexp_match(working_name, 'T(\d{1,2})\|EP(\d+)', 'i');
      extracted_title := NULL;
      extracted_season := match_result[1]::integer;
      extracted_episode := match_result[2]::integer;
    END IF;

  -- Padrão 3: "Nome 1x03"
  ELSIF working_name ~* '\s(\d{1,2})x(\d+)' THEN
    match_result := regexp_match(working_name, '^(.+)\s+(\d{1,2})x(\d+)', 'i');
    IF match_result IS NOT NULL THEN
      extracted_title := trim(match_result[1]);
      extracted_season := match_result[2]::integer;
      extracted_episode := match_result[3]::integer;
    END IF;

  -- Padrão 4: "Nome Temporada 1 Episódio 3"
  ELSIF working_name ~* 'Temporada\s*(\d+)\s*Epis[oó]dio\s*(\d+)' THEN
    match_result := regexp_match(working_name, '^(.+?)\s*Temporada\s*(\d+)\s*Epis[oó]dio\s*(\d+)', 'i');
    IF match_result IS NOT NULL THEN
      extracted_title := trim(match_result[1]);
      extracted_season := match_result[2]::integer;
      extracted_episode := match_result[3]::integer;
    END IF;

  -- Padrão 5: "Nome.S01.E01"
  ELSIF working_name ~* '\.S(\d{1,2})\.?E(\d+)' THEN
    match_result := regexp_match(working_name, '^(.+?)\.S(\d{1,2})\.?E(\d+)', 'i');
    IF match_result IS NOT NULL THEN
      extracted_title := regexp_replace(trim(match_result[1]), '\.', ' ', 'g');
      extracted_season := match_result[2]::integer;
      extracted_episode := match_result[3]::integer;
    END IF;

  ELSE
    -- Sem padrão de episódio, limpar título
    extracted_title := regexp_replace(working_name, '\s*(720p|1080p|4K|HDR|BluRay|WEB-DL|HDTV)\s*', '', 'gi');
    extracted_title := regexp_replace(extracted_title, '\s*(Dublado|Legendado|Dual|Nacional)\s*', '', 'gi');
  END IF;

  -- Limpar título final
  IF extracted_title IS NOT NULL THEN
    extracted_title := regexp_replace(extracted_title, '\s+', ' ', 'g');
    extracted_title := trim(extracted_title);
    extracted_title := regexp_replace(extracted_title, '\s*\(\d{4}\)\s*', '', 'g');
    extracted_title := regexp_replace(extracted_title, '\s*(19\d{2}|20\d{2})\s*$', '', 'g');
  END IF;

  IF extracted_title IS NULL OR extracted_title = '' THEN
    extracted_title := p_name;
  END IF;

  RETURN QUERY SELECT extracted_title, extracted_year, extracted_season, extracted_episode, extracted_ep_title;
END;
$function$;