-- Change foreign key to CASCADE delete instead of SET NULL
-- This makes deleting m3u links much faster as PostgreSQL handles it internally

ALTER TABLE public.channels 
DROP CONSTRAINT IF EXISTS channels_m3u_link_id_fkey;

ALTER TABLE public.channels
ADD CONSTRAINT channels_m3u_link_id_fkey 
FOREIGN KEY (m3u_link_id) 
REFERENCES public.m3u_links(id) 
ON DELETE CASCADE;

COMMENT ON CONSTRAINT channels_m3u_link_id_fkey ON public.channels IS 
'Cascade delete: when m3u_link is deleted, all its channels are automatically deleted';
