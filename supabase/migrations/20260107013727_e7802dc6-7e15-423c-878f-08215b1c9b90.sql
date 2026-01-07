-- Drop and recreate view with SECURITY INVOKER (default, but explicit)
DROP VIEW IF EXISTS public.active_channels;

CREATE VIEW public.active_channels 
WITH (security_invoker = true)
AS
SELECT c.*
FROM public.channels c
LEFT JOIN public.m3u_links m ON c.m3u_link_id = m.id
WHERE c.active = true
  AND (c.m3u_link_id IS NULL OR m.is_active = true);

-- Grant access to the view
GRANT SELECT ON public.active_channels TO anon, authenticated;