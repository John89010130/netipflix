@echo off
echo.
echo ========================================
echo  SETUP ADMIN - NETIPFLIX
echo ========================================
echo.
echo Acesse: https://supabase.com/dashboard/project/kwhusiffihtdmmvaqgxx/settings/api
echo.
echo Cole a SERVICE_ROLE KEY (secret, nao a anon):
echo.
set /p SERVICE_KEY="Service Key: "
echo.
echo Executando...
node setup-admin.mjs %SERVICE_KEY%
pause
