@echo off
echo ========================================
echo    NETIPFLIX - Servidor Local HTTP
echo ========================================
echo.
echo Iniciando servidor em http://localhost:5000
echo.
echo Pressione Ctrl+C para parar o servidor
echo.
start http://localhost:5000
npx serve dist -l 5000 --no-clipboard
pause
