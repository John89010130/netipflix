-- Create a function to delete channels by m3u_link_id efficiently
CREATE OR REPLACE FUNCTION public.delete_channels_by_link(p_link_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM public.channels WHERE m3u_link_id = p_link_id;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- Grant execute permission to authenticated users (admin check will be in edge function)
GRANT EXECUTE ON FUNCTION public.delete_channels_by_link(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_channels_by_link(uuid) TO service_role;