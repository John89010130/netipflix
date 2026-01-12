-- =====================================================
-- PARTE 2: ATUALIZAÇÃO DOS DADOS
-- =====================================================
-- Execute após a Parte 1
-- Tempo estimado: 20-60 segundos (depende do tamanho da base)

-- 1. Atualizar flags de categoria adulta
UPDATE public.channels
SET is_adult_category = is_adult_category(category)
WHERE is_adult_category IS NULL OR is_adult_category = false;

-- 2. Atualizar series_title para séries sem título
UPDATE public.channels
SET series_title = normalize_series_title(name)
WHERE content_type = 'SERIES' 
  AND (series_title IS NULL OR series_title = '');

-- 3. Normalizar series_title existentes
UPDATE public.channels
SET series_title = normalize_series_title(series_title)
WHERE content_type = 'SERIES' 
  AND series_title IS NOT NULL
  AND series_title != '';

-- 4. Atribuir ordem às categorias
SELECT assign_category_order();

SELECT 'Parte 2 concluída! Execute a Parte 3 agora.' as status;
