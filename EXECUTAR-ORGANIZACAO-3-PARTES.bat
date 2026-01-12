@echo off
cls
color 0A
echo.
echo ========================================
echo   ORGANIZACAO DO BANCO - SEM TIMEOUT
echo ========================================
echo.
echo A migration foi dividida em 3 partes pequenas
echo para evitar timeout no Supabase!
echo.
echo ========================================
echo   PARTE 1: ESTRUTURA (5-10 seg)
echo ========================================
echo.
echo 1. Abra: https://supabase.com/dashboard
echo 2. Va em: SQL Editor ^> New query
echo 3. Abra o arquivo:
echo.
color 0E
echo    supabase\migrations\20260112000001_organize_part1_structure.sql
color 0A
echo.
echo 4. Copie TODO o conteudo (Ctrl+A, Ctrl+C)
echo 5. Cole no SQL Editor (Ctrl+V)
echo 6. Clique em RUN
echo 7. Aguarde "Parte 1 concluida!"
echo.
pause

cls
echo.
echo ========================================
echo   PARTE 2: DADOS (20-60 seg)
echo ========================================
echo.
echo 1. Limpe o editor (Delete All)
echo 2. Abra o arquivo:
echo.
color 0E
echo    supabase\migrations\20260112000002_organize_part2_data.sql
color 0A
echo.
echo 3. Copie TODO o conteudo (Ctrl+A, Ctrl+C)
echo 4. Cole no SQL Editor (Ctrl+V)
echo 5. Clique em RUN
echo 6. Aguarde "Parte 2 concluida!"
echo.
echo OBS: Esta parte pode demorar mais!
echo.
pause

cls
echo.
echo ========================================
echo   PARTE 3: TRIGGERS (5 seg)
echo ========================================
echo.
echo 1. Limpe o editor (Delete All)
echo 2. Abra o arquivo:
echo.
color 0E
echo    supabase\migrations\20260112000003_organize_part3_triggers.sql
color 0A
echo.
echo 3. Copie TODO o conteudo (Ctrl+A, Ctrl+C)
echo 4. Cole no SQL Editor (Ctrl+V)
echo 5. Clique em RUN
echo 6. Veja as estatisticas finais!
echo.
pause

cls
echo.
echo ========================================
echo   CONCLUIDO!
echo ========================================
echo.
color 0B
echo [OK] Categorias adultas agora por ultimo
echo [OK] Series agrupadas corretamente
echo [OK] Triggers automaticos ativos
echo.
color 0A
echo Acesse a aplicacao e veja as mudancas!
echo.
echo Quer abrir os arquivos SQL para copiar?
echo.
pause

start notepad supabase\migrations\20260112000001_organize_part1_structure.sql
timeout /t 2 >nul
start notepad supabase\migrations\20260112000002_organize_part2_data.sql
timeout /t 2 >nul
start notepad supabase\migrations\20260112000003_organize_part3_triggers.sql

echo.
echo Arquivos abertos no Notepad!
echo Copie e execute no Supabase Dashboard.
echo.
pause
