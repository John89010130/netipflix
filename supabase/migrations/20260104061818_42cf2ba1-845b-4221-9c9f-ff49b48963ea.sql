-- Atualizar categorias com tags de cor
UPDATE channels 
SET category = trim(regexp_replace(
  regexp_replace(category, '\[COLOR[^\]]*\]', '', 'gi'),
  '\[/COLOR\]', '', 'gi'
))
WHERE category ILIKE '%[COLOR%' OR category ILIKE '%[/COLOR]%';

-- Atualizar nomes com tags de cor
UPDATE channels 
SET name = trim(regexp_replace(
  regexp_replace(name, '\[COLOR[^\]]*\]', '', 'gi'),
  '\[/COLOR\]', '', 'gi'
))
WHERE name ILIKE '%[COLOR%' OR name ILIKE '%[/COLOR]%';

-- Deletar canais com URLs inválidas (apenas protocolo sem path)
DELETE FROM channels WHERE stream_url = 'http://' OR stream_url = 'https://';