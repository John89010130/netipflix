import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, Smartphone, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export const QRCodeLogin = () => {
  const [qrCode, setQrCode] = useState<string>('');
  const [loginToken, setLoginToken] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string>('');
  const { signIn } = useAuth();

  // Gerar QR Code
  const generateQRCode = useCallback(async () => {
    setLoading(true);
    setError('');
    console.log('🔄 Gerando QR Code...');
    
    try {
      // Gerar token único
      const token = `qr_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      console.log('📝 Token gerado:', token);
      
      // Gerar URL do QR Code usando domínio público com HASH ROUTER
      const loginUrl = `https://netipflix.startapp.net.br/#/qr-login?token=${token}`;
      console.log('🔗 URL de login:', loginUrl);
      
      // Gerar QR Code usando API pública
      const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(loginUrl)}`;
      console.log('🖼️ QR Code URL:', qrCodeUrl);
      
      // Mostrar QR Code imediatamente
      setQrCode(qrCodeUrl);
      setLoginToken(token);
      
      // Tentar salvar token no banco em background
      console.log('💾 Salvando token no banco...');
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + 5);
      
      const { error: dbError } = await supabase
        .from('qr_login_tokens' as any)
        .insert({
          token,
          expires_at: expiresAt.toISOString(),
          used: false
        });

      if (dbError) {
        console.warn('⚠️ Aviso: Não foi possível salvar no banco:', dbError.message);
        setError('Banco de dados offline - Login pode não funcionar');
      } else {
        console.log('✅ Token salvo com sucesso!');
        // Começar a verificar se foi escaneado
        startChecking(token);
      }
      
      setLoading(false);
      console.log('✅ QR Code gerado com sucesso!');
      
    } catch (error: any) {
      console.error('❌ Erro inesperado:', error);
      setError(`Erro: ${error.message || 'Erro desconhecido'}`);
      setLoading(false);
    }
  }, []);

  // Verificar se o QR Code foi escaneado e autenticado
  const checkLoginStatus = useCallback(async (token: string) => {
    try {
      const { data, error } = await supabase
        .from('qr_login_tokens' as any)
        .select('*')
        .eq('token', token)
        .single();

      if (error) {
        console.error('Erro ao verificar token:', error);
        return false;
      }

      const tokenData = data as any;

      // Verificar se foi usado e tem user_id
      if (tokenData?.used && tokenData?.user_id) {
        // Buscar credenciais temporárias
        const { data: userData, error: userError } = await supabase
          .from('qr_login_tokens' as any)
          .select('email, temp_password')
          .eq('token', token)
          .single();

        const userDataTyped = userData as any;

        if (!userError && userDataTyped?.email && userDataTyped?.temp_password) {
          // Fazer login automaticamente
          const { error: loginError } = await signIn(userDataTyped.email, userDataTyped.temp_password);
          
          if (!loginError) {
            toast.success('Login realizado com sucesso!');
            return true;
          }
        }
      }

      return false;
    } catch (error) {
      console.error('Erro ao verificar login:', error);
      return false;
    }
  }, [signIn]);

  // Iniciar verificação periódica
  const startChecking = useCallback((token: string) => {
    setChecking(true);
    
    let attempts = 0;
    const maxAttempts = 60; // 5 minutos (60 * 5 segundos)
    
    const interval = setInterval(async () => {
      attempts++;
      
      if (attempts >= maxAttempts) {
        clearInterval(interval);
        setChecking(false);
        toast.error('QR Code expirado. Gere um novo código.');
        return;
      }

      const success = await checkLoginStatus(token);
      
      if (success) {
        clearInterval(interval);
        setChecking(false);
      }
    }, 5000); // Verificar a cada 5 segundos

    // Cleanup
    return () => clearInterval(interval);
  }, [checkLoginStatus]);

  // Gerar QR Code ao montar
  useEffect(() => {
    generateQRCode();
  }, [generateQRCode]);

  return (
    <div className="flex flex-col items-center space-y-6 p-8 bg-card/50 backdrop-blur-xl rounded-lg border border-border/50">
      <div className="flex items-center gap-3">
        <Smartphone className="h-6 w-6 text-primary" />
        <h3 className="text-xl font-semibold">Login via Celular</h3>
      </div>

      <p className="text-sm text-muted-foreground text-center max-w-sm">
        Escaneie o QR Code com seu celular para fazer login rapidamente
      </p>

      {/* Error Message */}
      {error && (
        <div className="bg-destructive/10 border border-destructive/50 rounded-lg p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* QR Code */}
      <div className="relative">
        {loading ? (
          <div className="w-[300px] h-[300px] flex items-center justify-center bg-background/50 rounded-lg">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
          </div>
        ) : qrCode ? (
          <div className="relative">
            <img 
              src={qrCode} 
              alt="QR Code para login" 
              className="w-[300px] h-[300px] rounded-lg shadow-lg"
            />
          </div>
        ) : (
          <div className="w-[300px] h-[300px] flex items-center justify-center bg-destructive/10 rounded-lg border-2 border-dashed border-destructive/50">
            <p className="text-sm text-center text-destructive px-4">
              Erro ao gerar QR Code<br/>Clique em "Gerar Novo"
            </p>
          </div>
        )}
      </div>

      {/* Instruções */}
      <div className="text-sm text-muted-foreground space-y-2 text-center max-w-sm">
        <p>1. Abra a câmera do seu celular</p>
        <p>2. Aponte para o QR Code</p>
        <p>3. Faça login na página que abrir</p>
        {checking && (
          <div className="flex items-center justify-center gap-2 text-primary pt-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-xs font-medium">Verificando autenticação...</span>
          </div>
        )}
      </div>

      {/* Botão para gerar novo QR Code */}
      <Button 
        variant="outline" 
        size="sm"
        onClick={generateQRCode}
        disabled={loading || checking}
      >
        <RefreshCw className="h-4 w-4 mr-2" />
        Gerar Novo QR Code
      </Button>

      <div className="text-xs text-muted-foreground text-center">
        O QR Code expira em 5 minutos
      </div>
    </div>
  );
};
