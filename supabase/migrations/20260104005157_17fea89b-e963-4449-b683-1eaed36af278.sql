-- Create table to store used M3U links
CREATE TABLE public.m3u_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  url TEXT NOT NULL,
  channels_imported INTEGER DEFAULT 0,
  imported_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  imported_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.m3u_links ENABLE ROW LEVEL SECURITY;

-- Admins can manage m3u_links
CREATE POLICY "Admins can manage m3u_links"
ON public.m3u_links
FOR ALL
USING (is_admin(auth.uid()));

-- Admins can view all m3u_links
CREATE POLICY "Admins can view m3u_links"
ON public.m3u_links
FOR SELECT
USING (is_admin(auth.uid()));