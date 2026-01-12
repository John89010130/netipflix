@echo off
cls
echo.
echo ========================================
echo   ORGANIZACAO DO BANCO DE DADOS
echo ========================================
echo.
echo Para organizar o banco de dados:
echo.
echo 1. Abra seu navegador
echo 2. Acesse: https://supabase.com/dashboard
echo 3. Selecione o projeto "netipflix"
echo 4. Clique em "SQL Editor" no menu lateral
echo 5. Clique em "New query"
echo 6. Abra o arquivo:
echo    supabase\migrations\20260112000000_organize_adult_content_and_series.sql
echo 7. Copie TODO o conteudo (Ctrl+A, Ctrl+C)
echo 8. Cole no SQL Editor (Ctrl+V)
echo 9. Clique em "RUN" (botao verde)
echo 10. Aguarde a execucao (10-30 segundos)
echo.
echo ========================================
echo   O QUE VAI ACONTECER
echo ========================================
echo.
echo [X] Categorias adultas irao para o final
echo [X] Series serao agrupadas corretamente
echo [X] Sistema de senha adulta continua ativo
echo [X] Nada sera quebrado!
echo.
echo ========================================
echo   VERIFICAR SUCESSO
echo ========================================
echo.
echo Apos executar, acesse a aplicacao e veja:
echo  - TV ao Vivo: categoria Adulto por ultimo
echo  - Filmes: categoria Adulto por ultimo
echo  - Series: categoria Adulto por ultimo
echo  - Series agrupadas (nao mais episodios soltos)
echo.
echo Pressione qualquer tecla para abrir o arquivo SQL...
pause >nul

start notepad supabase\migrations\20260112000000_organize_adult_content_and_series.sql

echo.
echo Arquivo SQL aberto no Notepad!
echo Copie o conteudo e cole no Supabase Dashboard.
echo.
pause
