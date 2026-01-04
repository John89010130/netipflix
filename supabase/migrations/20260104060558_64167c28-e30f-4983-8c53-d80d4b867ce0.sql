-- Create unaccent extension for accent-insensitive search
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Create a function to normalize text (remove accents)
CREATE OR REPLACE FUNCTION public.normalize_text(text_input text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT unaccent(lower(text_input));
$$;