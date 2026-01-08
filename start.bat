@echo off
title NETIPFLIX - Iniciando...
color 0A

echo.
echo ========================================
echo    NETIPFLIX - Streaming Platform
echo ========================================
echo.
echo Iniciando servidores...
echo.

REM Iniciar proxy em segundo plano
start /B node proxy-server.js

REM Aguardar 2 segundos
timeout /t 2 /nobreak >nul

REM Iniciar app Vite
start /B npm run dev

REM Aguardar 5 segundos para Vite iniciar
timeout /t 5 /nobreak >nul

REM Abrir navegador
start http://localhost:8081

echo.
echo ========================================
echo    NETIPFLIX INICIADO!
echo ========================================
echo.
echo Proxy:  http://localhost:3000
echo App:    http://localhost:8081
echo.
echo Pressione CTRL+C para encerrar
echo ========================================
echo.

pause
