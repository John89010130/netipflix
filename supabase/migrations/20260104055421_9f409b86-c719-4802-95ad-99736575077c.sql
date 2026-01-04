-- Add series grouping columns to channels table
ALTER TABLE public.channels 
ADD COLUMN IF NOT EXISTS series_title text,
ADD COLUMN IF NOT EXISTS season_number integer,
ADD COLUMN IF NOT EXISTS episode_number integer;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_channels_series_title ON public.channels(series_title) WHERE series_title IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_channels_series_season ON public.channels(series_title, season_number) WHERE series_title IS NOT NULL;

-- Create function to extract series info from name
CREATE OR REPLACE FUNCTION public.extract_series_info(p_name text)
RETURNS TABLE(series_title text, season_num integer, episode_num integer)
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
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
    
    -- Handle cases where title is empty (e.g., "T01|EP15")
    IF title_part = '' OR title_part IS NULL THEN
      RETURN QUERY SELECT NULL::text, season_part, episode_part;
      RETURN;
    END IF;
    
    RETURN QUERY SELECT title_part, season_part, episode_part;
    RETURN;
  END IF;
  
  -- Pattern 2: "01|EP01" (no series name, just season|episode)
  IF cleaned_name ~ '^\d+\|EP\d+' THEN
    match_result := regexp_match(cleaned_name, '^(\d+)\|EP(\d+)');
    season_part := match_result[1]::integer;
    episode_part := match_result[2]::integer;
    RETURN QUERY SELECT NULL::text, season_part, episode_part;
    RETURN;
  END IF;
  
  -- Pattern 3: "Number|EP01 Episode Title" (season before pipe, episode after)
  IF cleaned_name ~ '^\d+\|EP\d+\s+.+' THEN
    match_result := regexp_match(cleaned_name, '^(\d+)\|EP(\d+)\s+(.+)');
    season_part := match_result[1]::integer;
    episode_part := match_result[2]::integer;
    title_part := trim(match_result[3]);
    RETURN QUERY SELECT title_part, season_part, episode_part;
    RETURN;
  END IF;
  
  -- Pattern 4: "SeriesName.S01E01" or "SeriesName S01E01"
  IF cleaned_name ~* '(.+?)[.\s]S(\d+)E(\d+)' THEN
    match_result := regexp_match(cleaned_name, '(.+?)[.\s]S(\d+)E(\d+)', 'i');
    title_part := regexp_replace(trim(match_result[1]), '\.', ' ', 'g');
    season_part := match_result[2]::integer;
    episode_part := match_result[3]::integer;
    RETURN QUERY SELECT title_part, season_part, episode_part;
    RETURN;
  END IF;
  
  -- Pattern 5: "SeriesName.S01e01" (lowercase e)
  IF cleaned_name ~* '(.+?)[.\s]S(\d+)e(\d+)' THEN
    match_result := regexp_match(cleaned_name, '(.+?)[.\s]S(\d+)e(\d+)', 'i');
    title_part := regexp_replace(trim(match_result[1]), '\.', ' ', 'g');
    season_part := match_result[2]::integer;
    episode_part := match_result[3]::integer;
    RETURN QUERY SELECT title_part, season_part, episode_part;
    RETURN;
  END IF;
  
  -- No pattern matched - not a series episode
  RETURN QUERY SELECT NULL::text, NULL::integer, NULL::integer;
END;
$$;

-- Update the trigger function to also extract series info
CREATE OR REPLACE FUNCTION public.set_channel_content_type()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  series_info RECORD;
BEGIN
  -- Set content type
  NEW.content_type := determine_content_type(NEW.category, NEW.name);
  
  -- Extract series info if it's a series
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
$$;

-- Update all existing series channels with extracted info
UPDATE public.channels c
SET 
  series_title = info.series_title,
  season_number = info.season_num,
  episode_number = info.episode_num
FROM (
  SELECT id, (extract_series_info(name)).*
  FROM public.channels
  WHERE content_type = 'SERIES'
) info
WHERE c.id = info.id;