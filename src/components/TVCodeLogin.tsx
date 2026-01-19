import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, Tv, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export const TVCodeLogin = () => {
  const [code, setCode] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const { signIn } = useAuth();

  // Gerar código de 6 caracteres
  const generateCode = useCallback(async () => {
    setLoading(true);
    
    try {
      // Código simples: 6 caracteres alfanuméricos maiúsculos
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Sem I, O, 0, 1 para evitar confusão
      let newCode = '';
      for (let i = 0; i < 6; i++) {
        newCode += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      
      console.log('📺 Código gerado:', newCode);
      
      // Salvar no banco
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + 10); // 10 minutos
      
      const { error } = await supabase
        .from('tv_login_codes' as any)
        .insert({
          code: newCode,
          expires_at: expiresAt.toISOString(),
          used: false
        });

      if (error) {
        console.error('Erro ao salvar código:', error);
        toast.error('Erro ao gerar código');
        setLoading(false);
        return;
      }
      
      setCode(newCode);
      setLoading(false);
      setChecking(true);
      
      // Começar a verificar se foi usado
      startPolling(newCode);
      
    } catch (error) {
      console.error('Erro:', error);
      toast.error('Erro ao gerar código');
      setLoading(false);
    }
  }, []);

  // Verificar se o código foi usado
  const checkCode = useCallback(async (codeValue: string) => {
    try {
      const { data, error } = await supabase
        .from('tv_login_codes' as any)
        .select('*')
        .eq('code', codeValue)
        .single();

      if (error) return false;

      const codeData = data as any;
      
      // Se foi usado e tem credenciais, fazer login
      if (codeData?.used && codeData?.email && codeData?.temp_password) {
        console.log('✅ Código usado! Fazendo login...');
        
        const { error: loginError } = await signIn(codeData.email, codeData.temp_password);
        
        if (!loginError) {
          toast.success('Login realizado com sucesso!');
          return true;
        }
      }

      return false;
    } catch (error) {
      return false;
    }
  }, [signIn]);

  // Polling para verificar o código
  const startPolling = useCallback((codeValue: string) => {
    let attempts = 0;
    const maxAttempts = 120; // 10 minutos (120 * 5 segundos)
    
    const interval = setInterval(async () => {
      attempts++;
      
      if (attempts >= maxAttempts) {
        clearInterval(interval);
        setChecking(false);
        toast.error('Código expirado. Gere um novo.');
        return;
      }

      const success = await checkCode(codeValue);
      
      if (success) {
        clearInterval(interval);
        setChecking(false);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [checkCode]);

  useEffect(() => {
    generateCode();
  }, [generateCode]);

  return (
    <div className="flex flex-col items-center space-y-6 p-8 bg-card/50 backdrop-blur-xl rounded-lg border border-border/50">
      <div className="flex items-center gap-3">
        <Tv className="h-6 w-6 text-primary" />
        <h3 className="text-xl font-semibold">Login na TV</h3>
      </div>

      <p className="text-sm text-muted-foreground text-center max-w-sm">
        No seu celular, acesse o site e digite o código abaixo
      </p>

      {/* Código */}
      <div className="relative">
        {loading ? (
          <div className="w-full h-24 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="bg-background border-2 border-primary rounded-lg p-6">
            <div className="text-5xl font-mono font-bold tracking-[0.5em] text-primary text-center">
              {code}
            </div>
          </div>
        )}
      </div>

      {/* Instruções */}
      <div className="text-sm text-muted-foreground space-y-2 text-center">
        <p>1. No celular, acesse: <span className="text-primary font-medium">john89010130.github.io/netipflix</span></p>
        <p>2. Clique em "Entrar com Código"</p>
        <p>3. Digite o código acima e faça login</p>
      </div>

      {checking && (
        <div className="flex items-center gap-2 text-primary">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Aguardando autenticação...</span>
        </div>
      )}

      <Button 
        variant="outline" 
        size="sm"
        onClick={generateCode}
        disabled={loading}
      >
        <RefreshCw className="h-4 w-4 mr-2" />
        Gerar Novo Código
      </Button>
    </div>
  );
};
