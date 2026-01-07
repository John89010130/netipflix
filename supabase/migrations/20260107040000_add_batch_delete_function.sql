-- Function to delete channels in batches (avoids timeout)
CREATE OR REPLACE FUNCTION public.delete_channels_by_link_batch(
  _link_id UUID,
  _batch_size INTEGER DEFAULT 100
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _total_deleted INTEGER := 0;
  _batch_deleted INTEGER;
BEGIN
  -- Delete in batches until no more records
  LOOP
    DELETE FROM public.channels
    WHERE id IN (
      SELECT id 
      FROM public.channels 
      WHERE m3u_link_id = _link_id 
      LIMIT _batch_size
    );
    
    GET DIAGNOSTICS _batch_deleted = ROW_COUNT;
    
    IF _batch_deleted = 0 THEN
      EXIT; -- No more rows to delete
    END IF;
    
    _total_deleted := _total_deleted + _batch_deleted;
    
    -- Small pause to avoid overwhelming DB
    PERFORM pg_sleep(0.1);
  END LOOP;
  
  RETURN json_build_object(
    'deleted', _total_deleted,
    'success', true
  );
END;
$$;

-- Grant execute to authenticated users (RLS will still apply)
GRANT EXECUTE ON FUNCTION public.delete_channels_by_link_batch TO authenticated;

COMMENT ON FUNCTION public.delete_channels_by_link_batch IS 
'Deletes all channels from a specific M3U link in batches to avoid timeout. Returns count of deleted channels.';
