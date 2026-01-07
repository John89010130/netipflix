-- Small batch test: re-classify 1000 channels
UPDATE public.channels
SET content_type = determine_content_type_v2(category, name, stream_url)
WHERE id IN (
  SELECT id FROM public.channels LIMIT 1000
);