@echo off
echo ========================================
echo  Netipflix - Build para Samsung TV Tizen
echo ========================================
echo.

REM Verificar se o Tizen Studio está instalado
where tizen >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [AVISO] Tizen Studio CLI nao encontrado
    echo Voce pode empacotar manualmente seguindo o README-TIZEN.md
    echo.
)

echo [1/4] Limpando build anterior...
if exist "tizen-build" rd /s /q "tizen-build"
mkdir tizen-build

echo [2/4] Copiando arquivos Tizen...
xcopy /E /I /Y tizen tizen-build

echo [3/4] Criando icone...
if not exist "tizen-build\icon.png" (
    if exist "public\android-chrome-192x192.png" (
        copy "public\android-chrome-192x192.png" "tizen-build\icon.png"
    ) else (
        echo [AVISO] Icone nao encontrado - usando placeholder
    )
)

echo [4/4] Tentando empacotar .wgt...
where tizen >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    cd tizen-build
    tizen package -t wgt -s NetipflixTizen
    cd ..
    echo.
    echo [OK] Build concluido! Arquivo .wgt gerado em: tizen-build\
    echo.
) else (
    echo.
    echo ========================================
    echo  Build manual necessario
    echo ========================================
    echo.
    echo 1. Instale o Tizen Studio:
    echo    https://developer.samsung.com/smarttv/develop/getting-started/setting-up-sdk/installing-tv-sdk.html
    echo.
    echo 2. Ou crie o .wgt manualmente:
    echo    - Compacte a pasta 'tizen-build' em formato ZIP
    echo    - Renomeie de .zip para .wgt
    echo    - Instale via Developer Mode na TV
    echo.
    echo Veja README-TIZEN.md para instrucoes completas
    echo.
)

pause
