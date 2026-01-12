@echo off
echo ========================================
echo    NETIPFLIX - Servidor de Desenvolvimento
echo ========================================
echo.
echo Iniciando servidor em http://localhost:8080
echo.
echo Aguarde o servidor iniciar...
echo Pressione Ctrl+C para parar o servidor
echo.
timeout /t 3 /nobreak >nul
start http://localhost:8080
npm run dev
