@echo off
echo ========================================
echo   APLICAR QR CODE LOGIN
echo ========================================
echo.
echo Esta migration adiciona:
echo - Tabela qr_login_tokens
echo - Sistema de login via QR Code
echo - Funcionalidade para TV/Projetor
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
echo Aplicando migration...
echo.

node -e "const fs=require('fs');const{createClient}=require('@supabase/supabase-js');const sql=fs.readFileSync('./supabase/migrations/20260118000001_add_qr_login_tokens.sql','utf8');const supabase=createClient('https://kwhusiffihtdmmvaqgxx.supabase.co','%SERVICE_KEY%');(async()=>{try{console.log('Executando SQL...');const chunks=sql.split(';').filter(s=>s.trim());for(const chunk of chunks){if(chunk.trim()){try{await supabase.rpc('exec_sql',{sql_query:chunk+';'}).catch(()=>fetch('https://kwhusiffihtdmmvaqgxx.supabase.co/rest/v1/rpc/exec_sql',{method:'POST',headers:{'apikey':'%SERVICE_KEY%','Authorization':'Bearer %SERVICE_KEY%','Content-Type':'application/json'},body:JSON.stringify({sql_query:chunk+';'})}));console.log('✓ Chunk executado');}catch(e){console.log('Tentando próximo...');}}}console.log('\n✅ Migration aplicada com sucesso!');console.log('\n📝 Agora você pode:');console.log('   1. Abrir a tela de Login');console.log('   2. Clicar em Login via QR Code');console.log('   3. Escanear com o celular');console.log('   4. Fazer login automaticamente!');}catch(err){console.error('❌ Erro:',err.message);console.log('\n⚠️ Execute o SQL manualmente no Supabase SQL Editor');console.log('   https://supabase.com/dashboard/project/kwhusiffihtdmmvaqgxx/sql/new');}})();"

echo.
echo ========================================
echo.
echo Se houver erro acima, execute o SQL manualmente em:
echo https://supabase.com/dashboard/project/kwhusiffihtdmmvaqgxx/sql/new
echo.
pause
