-- Create a view that only shows channels from active m3u links
CREATE OR REPLACE VIEW public.active_channels AS
SELECT c.*
FROM public.channels c
LEFT JOIN public.m3u_links m ON c.m3u_link_id = m.id
WHERE c.active = true
  AND (c.m3u_link_id IS NULL OR m.is_active = true);

-- Grant access to the view
GRANT SELECT ON public.active_channels TO anon, authenticated;