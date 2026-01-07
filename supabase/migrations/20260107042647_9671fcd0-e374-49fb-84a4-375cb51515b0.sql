-- Remove o constraint antigo e adiciona um novo com SERIES
ALTER TABLE watch_history DROP CONSTRAINT watch_history_content_type_check;

ALTER TABLE watch_history ADD CONSTRAINT watch_history_content_type_check 
CHECK (content_type = ANY (ARRAY['TV'::text, 'MOVIE'::text, 'SERIES'::text]));