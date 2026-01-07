-- Add m3u_link_id column to channels to track which M3U list each channel came from
ALTER TABLE public.channels 
ADD COLUMN IF NOT EXISTS m3u_link_id UUID REFERENCES public.m3u_links(id) ON DELETE SET NULL;

-- Add is_active column to m3u_links to enable/disable all channels from a list
ALTER TABLE public.m3u_links 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_channels_m3u_link_id ON public.channels(m3u_link_id);