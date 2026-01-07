-- Função para migrar dados em lotes
CREATE OR REPLACE FUNCTION public.migrate_channels_batch(batch_size integer DEFAULT 1000)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  rec RECORD;
  updated_count integer := 0;
  pn RECORD;
  pc RECORD;
BEGIN
  FOR rec IN 
    SELECT id, name, category, content_type, season_number, episode_number, series_title
    FROM channels 
    WHERE original_name IS NULL 
    LIMIT batch_size
  LOOP
    SELECT * INTO pn FROM parse_content_name(rec.name);
    SELECT * INTO pc FROM parse_category_info(rec.category);
    
    UPDATE channels SET
      original_name = rec.name,
      clean_title = pn.clean_title,
      year = pn.year_extracted,
      season_number = COALESCE(pn.season_num, rec.season_number),
      episode_number = COALESCE(pn.episode_num, rec.episode_number),
      subcategory = pc.sub_category,
      genre = pc.detected_genre,
      series_title = CASE WHEN rec.content_type = 'SERIES' THEN pn.clean_title ELSE rec.series_title END
    WHERE id = rec.id;
    
    updated_count := updated_count + 1;
  END LOOP;
  
  RETURN updated_count;
END;
$function$;