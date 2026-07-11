
CREATE OR REPLACE FUNCTION public.delete_channels_by_link(p_link_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '0'
AS $function$
DECLARE
  total_deleted integer := 0;
  batch_deleted integer := 0;
BEGIN
  LOOP
    WITH del AS (
      DELETE FROM public.channels
      WHERE ctid IN (
        SELECT ctid FROM public.channels
        WHERE m3u_link_id = p_link_id
        LIMIT 5000
      )
      RETURNING 1
    )
    SELECT count(*) INTO batch_deleted FROM del;

    total_deleted := total_deleted + batch_deleted;
    EXIT WHEN batch_deleted = 0;
  END LOOP;

  RETURN total_deleted;
END;
$function$;
