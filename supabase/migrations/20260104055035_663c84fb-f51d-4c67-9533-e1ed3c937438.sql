-- Add content_type column to channels table
ALTER TABLE public.channels 
ADD COLUMN IF NOT EXISTS content_type text NOT NULL DEFAULT 'TV';

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_channels_content_type ON public.channels(content_type);

-- Create function to determine content type based on category and name patterns
CREATE OR REPLACE FUNCTION public.determine_content_type(p_category text, p_name text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  cat_lower text := lower(p_category);
  name_lower text := lower(p_name);
BEGIN
  -- Check for SERIES patterns first (VOD episodes)
  IF cat_lower LIKE '%seriado%' 
     OR cat_lower LIKE '%serie%' 
     OR cat_lower LIKE '%séries%'
     OR cat_lower LIKE '%series%'
     OR name_lower ~ 't\d+\|ep\d+'  -- Pattern like T01|EP15
     OR name_lower ~ 's\d+e\d+'     -- Pattern like S01E15
     OR name_lower ~ 'temporada'
     OR name_lower ~ 'episodio'
     OR name_lower ~ 'episódio'
  THEN
    RETURN 'SERIES';
  END IF;
  
  -- Check for MOVIE patterns (VOD films)
  IF cat_lower LIKE '%film%' 
     OR cat_lower LIKE '%movie%'
     OR cat_lower LIKE '%vod%'
     OR cat_lower LIKE '%looney%'
     OR cat_lower LIKE '%espaconave%'
     OR (cat_lower LIKE '%filmes%' AND cat_lower NOT LIKE '%canal%' AND cat_lower NOT LIKE '%channel%')
  THEN
    RETURN 'MOVIE';
  END IF;
  
  -- Check for TV patterns (live channels)
  IF cat_lower LIKE '%channel%' 
     OR cat_lower LIKE '%canal%'
     OR cat_lower LIKE '%canais%'
     OR cat_lower LIKE '%tv%'
     OR cat_lower LIKE '%sport%'
     OR cat_lower LIKE '%news%'
     OR cat_lower LIKE '%hd%'
     OR cat_lower LIKE '%fhd%'
     OR cat_lower LIKE '%hevc%'
     OR cat_lower LIKE '%pluto%'
     OR cat_lower = 'geral'
     OR cat_lower = 'campur'
  THEN
    RETURN 'TV';
  END IF;
  
  -- Default to TV for unrecognized patterns
  RETURN 'TV';
END;
$$;

-- Update all existing channels with the correct content_type
UPDATE public.channels
SET content_type = determine_content_type(category, name);

-- Create a trigger to automatically set content_type on insert/update
CREATE OR REPLACE FUNCTION public.set_channel_content_type()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.content_type := determine_content_type(NEW.category, NEW.name);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_set_channel_content_type ON public.channels;
CREATE TRIGGER trigger_set_channel_content_type
  BEFORE INSERT OR UPDATE OF category, name ON public.channels
  FOR EACH ROW
  EXECUTE FUNCTION public.set_channel_content_type();