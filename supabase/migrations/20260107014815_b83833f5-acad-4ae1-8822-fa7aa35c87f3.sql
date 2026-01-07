-- Step 1: Create special list for orphan channels (inactive by default)
INSERT INTO public.m3u_links (url, channels_imported, is_active)
VALUES ('internal://orphan-channels', 0, false);

-- Step 2: Link all orphan channels to this new list and count them
WITH orphan_list AS (
  SELECT id FROM public.m3u_links WHERE url = 'internal://orphan-channels'
),
updated AS (
  UPDATE public.channels 
  SET m3u_link_id = (SELECT id FROM orphan_list)
  WHERE m3u_link_id IS NULL
  RETURNING 1
)
UPDATE public.m3u_links 
SET channels_imported = (SELECT COUNT(*) FROM updated)
WHERE url = 'internal://orphan-channels';

-- Step 3: Recreate view with INNER JOIN (only shows channels from active lists)
DROP VIEW IF EXISTS public.active_channels;

CREATE VIEW public.active_channels 
WITH (security_invoker = true)
AS
SELECT c.*
FROM public.channels c
INNER JOIN public.m3u_links m ON c.m3u_link_id = m.id
WHERE c.active = true
  AND m.is_active = true;

-- Grant access to the view
GRANT SELECT ON public.active_channels TO anon, authenticated;