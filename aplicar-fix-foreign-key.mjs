import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import 'dotenv/config';

const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt3aHVzaWZmaWh0ZG1tdmFxZ3h4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzI0Mjc0NSwiZXhwIjoyMDUyODE4NzQ1fQ.YO5h1jvHUPKsPCgxFPjX2P98wXfNaZg1wSN3NqiXPcM';
const supabaseUrl = process.env.VITE_SUPABASE_URL;

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false }
});

async function aplicarMigration() {
  console.log('🔧 Removendo foreign key do qr_login_tokens...\n');
  
  const sql = readFileSync('./supabase/migrations/20260118000002_remover_foreign_key_qr_tokens.sql', 'utf8');
  
  const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
  
  if (error) {
    console.error('❌ Erro:', error);
    
    // Tentar executar diretamente
    console.log('\n🔄 Tentando executar SQL diretamente...\n');
    const sqlCommands = sql.split(';').filter(cmd => cmd.trim());
    
    for (const command of sqlCommands) {
      if (!command.trim() || command.trim().startsWith('--')) continue;
      
      console.log('Executando:', command.trim().substring(0, 80) + '...');
      const { error: execError } = await supabase.rpc('exec_sql', { sql_query: command });
      
      if (execError) {
        console.error('❌', execError.message);
      } else {
        console.log('✅ OK');
      }
    }
  } else {
    console.log('✅ Migration aplicada com sucesso!');
  }
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

aplicarMigration();
