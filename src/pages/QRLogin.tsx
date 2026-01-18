import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, CheckCircle, XCircle, Smartphone } from 'lucide-react';
import { toast } from 'sonner';

const QRLogin = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [token, setToken] = useState<string>('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const tokenParam = searchParams.get('token');
    if (tokenParam) {
      setToken(tokenParam);
      validateToken(tokenParam);
    } else {
      setValidating(false);
      toast.error('Token inválido');
    }
  }, [searchParams]);

  const validateToken = async (tokenValue: string) => {
    try {
      const { data, error } = await supabase
        .from('qr_login_tokens' as any)
        .select('*')
        .eq('token', tokenValue)
        .single();

      if (error || !data) {
        setTokenValid(false);
        toast.error('QR Code inválido ou expirado');
        setValidating(false);
        return;
      }

      const tokenData = data as any;

      // Verificar se já foi usado
      if (tokenData.used) {
        setTokenValid(false);
        toast.error('Este QR Code já foi usado');
        setValidating(false);
        return;
      }

      // Verificar se expirou
      const expiresAt = new Date(tokenData.expires_at);
      if (expiresAt < new Date()) {
        setTokenValid(false);
        toast.error('QR Code expirado');
        setValidating(false);
        return;
      }

      setTokenValid(true);
      setValidating(false);
    } catch (error) {
      console.error('Erro ao validar token:', error);
      setTokenValid(false);
      setValidating(false);
      toast.error('Erro ao validar QR Code');
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      toast.error('Preencha todos os campos');
      return;
    }

    setLoading(true);

    try {
      // Primeiro, fazer login para verificar credenciais
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (authError || !authData.user) {
        toast.error('Email ou senha incorretos');
        setLoading(false);
        return;
      }

      // Atualizar o token com as informações de login
      const { error: updateError } = await supabase
        .from('qr_login_tokens' as any)
        .update({
          used: true,
          user_id: authData.user.id,
          email: email,
          temp_password: password, // Apenas para transferir, será usado uma vez
          used_at: new Date().toISOString()
        })
        .eq('token', token);

      if (updateError) {
        console.error('Erro ao atualizar token:', updateError);
        toast.error('Erro ao processar login');
        setLoading(false);
        return;
      }

      // Fazer logout neste dispositivo (celular)
      await supabase.auth.signOut();

      setSuccess(true);
      toast.success('Login autorizado! Você pode fechar esta página.');
      
      // Redirecionar após 3 segundos
      setTimeout(() => {
        navigate('/');
      }, 3000);

    } catch (error) {
      console.error('Erro:', error);
      toast.error('Erro ao processar login');
      setLoading(false);
    }
  };

  if (validating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">Validando QR Code...</p>
        </div>
      </div>
    );
  }

  if (!tokenValid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="max-w-md w-full text-center space-y-6">
          <XCircle className="h-16 w-16 text-destructive mx-auto" />
          <div className="space-y-2">
            <h1 className="text-2xl font-bold">QR Code Inválido</h1>
            <p className="text-muted-foreground">
              Este QR Code é inválido, já foi usado ou expirou.
            </p>
          </div>
          <Button onClick={() => navigate('/')}>
            Ir para o Início
          </Button>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="max-w-md w-full text-center space-y-6">
          <CheckCircle className="h-16 w-16 text-green-500 mx-auto" />
          <div className="space-y-2">
            <h1 className="text-2xl font-bold">Login Autorizado!</h1>
            <p className="text-muted-foreground">
              Seu dispositivo foi autenticado com sucesso.
            </p>
            <p className="text-sm text-muted-foreground">
              Você pode fechar esta página agora.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-md w-full">
        <div className="bg-card rounded-lg p-8 shadow-lg border border-border space-y-6">
          {/* Header */}
          <div className="text-center space-y-2">
            <div className="flex justify-center">
              <Smartphone className="h-12 w-12 text-primary" />
            </div>
            <h1 className="text-2xl font-bold">Autenticar Dispositivo</h1>
            <p className="text-sm text-muted-foreground">
              Faça login para autorizar o acesso no outro dispositivo
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Email</label>
              <Input
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Senha</label>
              <Input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                required
              />
            </div>

            <Button 
              type="submit" 
              className="w-full"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Autorizando...
                </>
              ) : (
                'Autorizar Login'
              )}
            </Button>
          </form>

          {/* Info */}
          <div className="text-xs text-muted-foreground text-center space-y-1">
            <p>Suas credenciais serão usadas apenas para autorizar</p>
            <p>o outro dispositivo e depois serão descartadas.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QRLogin;
