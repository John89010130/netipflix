-- =====================================================
-- PARTE 3: TRIGGERS E FINALIZAÇÕES
-- =====================================================
-- Execute após a Parte 2
-- Tempo estimado: 5 segundos

-- 1. Criar trigger para auto-detectar categoria adulta
CREATE OR REPLACE FUNCTION public.update_adult_category_flag()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  NEW.is_adult_category := is_adult_category(NEW.category);
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trigger_update_adult_category ON public.channels;
CREATE TRIGGER trigger_update_adult_category
  BEFORE INSERT OR UPDATE OF category ON public.channels
  FOR EACH ROW
  EXECUTE FUNCTION update_adult_category_flag();

-- 2. Estatísticas finais
DO $$
DECLARE
  total_series integer;
  total_episodes integer;
  adult_series integer;
  regular_series integer;
  total_channels integer;
  adult_channels integer;
BEGIN
  -- Séries
  SELECT COUNT(DISTINCT series_title) INTO total_series
  FROM public.channels
  WHERE content_type = 'SERIES' AND active = true AND series_title IS NOT NULL;
  
  SELECT COUNT(*) INTO total_episodes
  FROM public.channels
  WHERE content_type = 'SERIES' AND active = true;
  
  SELECT COUNT(DISTINCT series_title) INTO adult_series
  FROM public.channels
  WHERE content_type = 'SERIES' AND active = true AND is_adult_category = true;
  
  SELECT COUNT(DISTINCT series_title) INTO regular_series
  FROM public.channels
  WHERE content_type = 'SERIES' AND active = true AND is_adult_category = false;
  
  -- Total de canais
  SELECT COUNT(*) INTO total_channels FROM public.channels WHERE active = true;
  SELECT COUNT(*) INTO adult_channels FROM public.channels WHERE active = true AND is_adult_category = true;
  
  RAISE NOTICE '========================================';
  RAISE NOTICE 'ORGANIZAÇÃO CONCLUÍDA COM SUCESSO!';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Total de canais ativos: %', total_channels;
  RAISE NOTICE 'Canais adultos: % (%.1f%%)', adult_channels, (adult_channels::float / total_channels * 100);
  RAISE NOTICE '';
  RAISE NOTICE 'Total de séries: %', total_series;
  RAISE NOTICE 'Total de episódios: %', total_episodes;
  RAISE NOTICE 'Séries regulares: %', regular_series;
  RAISE NOTICE 'Séries adultas: %', adult_series;
  RAISE NOTICE '';
  RAISE NOTICE '✅ Categorias adultas movidas para o final';
  RAISE NOTICE '✅ Séries agrupadas corretamente';
  RAISE NOTICE '✅ Triggers automáticos ativos';
END;
$$;

SELECT 'Organização 100% concluída! ✨' as status;
