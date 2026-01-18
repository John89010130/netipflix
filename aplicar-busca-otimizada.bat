@echo off
echo ========================================
echo   APLICAR MIGRATION DE BUSCA OTIMIZADA
echo ========================================
echo.

set /p SERVICE_KEY="Cole a SERVICE ROLE KEY e pressione ENTER: "

if "%SERVICE_KEY%"=="" (
    echo.
    echo [ERRO] Service Key nao pode estar vazia!
    echo.
    pause
    exit /b 1
)

echo.
echo Executando migration...
echo.

node apply-search-migration.mjs %SERVICE_KEY%

echo.
echo ========================================
echo.
pause
