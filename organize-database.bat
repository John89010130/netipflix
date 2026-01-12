@echo off
echo ========================================
echo  ORGANIZACAO DO BANCO DE DADOS
echo ========================================
echo.
echo Este processo vai organizar:
echo  - Categorias adultas por ultimo
echo  - Series agrupadas corretamente
echo.
echo IMPORTANTE:
echo  1. Abra o Supabase Dashboard
echo  2. Va em SQL Editor
echo  3. Cole o conteudo do arquivo:
echo     supabase/migrations/20260112000000_organize_adult_content_and_series.sql
echo  4. Clique em RUN
echo.
echo Apos executar no Dashboard, este script vai mostrar estatisticas.
echo.
echo Pressione qualquer tecla para ver estatisticas...
pause >nul

echo.
echo Gerando estatisticas...
node apply-organization.mjs

echo.
echo ========================================
echo  PROXIMO PASSO
echo ========================================
echo.
echo Se ainda nao executou a migration:
echo  1. Abra: https://supabase.com/dashboard
echo  2. SQL Editor
echo  3. Cole o arquivo: supabase/migrations/20260112000000_organize_adult_content_and_series.sql
echo  4. RUN
echo.
echo Veja o guia completo em: GUIA-RAPIDO-ORGANIZACAO.md
echo.
pause
