-- Adicionar constraint único para permitir upsert no watch_history
ALTER TABLE watch_history 
ADD CONSTRAINT watch_history_user_content_unique 
UNIQUE (user_id, content_id);