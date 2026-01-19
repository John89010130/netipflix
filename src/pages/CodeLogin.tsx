import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, CheckCircle, Smartphone, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

const CodeLogin = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState<'code' | 'login' | 'success'>('code');
  const [code, setCode] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // Verificar código
  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (code.length !== 6) {
      toast.error('Digite um código de 6 caracteres');
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase
        .from('tv_login_codes' as any)
        .select('*')
        .eq('code', code.toUpperCase())
        .single();

      if (error || !data) {
        toast.error('Código inválido');
        setLoading(false);
        return;
      }

      const codeData = data as any;

      // Verificar se já foi usado
      if (codeData.used) {
        toast.error('Este código já foi usado');
        setLoading(false);
        return;
      }

      // Verificar se expirou
      if (new Date(codeData.expires_at) < new Date()) {
        toast.error('Código expirado');
        setLoading(false);
        return;
      }

      // Código válido, ir para login
      setStep('login');
      setLoading(false);

    } catch (error) {
      toast.error('Erro ao verificar código');
      setLoading(false);
    }
  };

  // Fazer login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      toast.error('Preencha email e senha');
      return;
    }

    setLoading(true);

    try {
      // Verificar credenciais
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (authError || !authData.user) {
        toast.error('Email ou senha incorretos');
        setLoading(false);
        return;
      }

      // Atualizar o código com as credenciais
      const { error: updateError } = await supabase
        .from('tv_login_codes' as any)
        .update({
          used: true,
          user_id: authData.user.id,
          email: email,
          temp_password: password,
          used_at: new Date().toISOString()
        })
        .eq('code', code.toUpperCase());

      if (updateError) {
        toast.error('Erro ao autorizar TV');
        setLoading(false);
        return;
      }

      // Deslogar do celular (a TV vai fazer o login)
      await supabase.auth.signOut();

      setStep('success');
      setLoading(false);

    } catch (error) {
      toast.error('Erro ao processar login');
      setLoading(false);
    }
  };

  // Tela de sucesso
  if (step === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="max-w-md w-full text-center space-y-6">
          <CheckCircle className="h-20 w-20 text-green-500 mx-auto" />
          <h1 className="text-2xl font-bold">TV Autorizada!</h1>
          <p className="text-muted-foreground">
            A TV foi autorizada com sucesso.<br/>
            Você pode fechar esta página.
          </p>
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
            <Smartphone className="h-12 w-12 text-primary mx-auto" />
            <h1 className="text-2xl font-bold">
              {step === 'code' ? 'Digite o Código da TV' : 'Fazer Login'}
            </h1>
            <p className="text-sm text-muted-foreground">
              {step === 'code' 
                ? 'Digite o código de 6 caracteres mostrado na TV' 
                : 'Entre com sua conta para autorizar a TV'}
            </p>
          </div>

          {/* Formulário do Código */}
          {step === 'code' && (
            <form onSubmit={handleVerifyCode} className="space-y-4">
              <Input
                type="text"
                placeholder="XXXXXX"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 6))}
                className="text-center text-3xl font-mono tracking-[0.3em] h-16 uppercase"
                maxLength={6}
                disabled={loading}
                autoFocus
              />

              <Button type="submit" className="w-full" disabled={loading || code.length !== 6}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Verificar Código
              </Button>

              <Button 
                type="button" 
                variant="ghost" 
                className="w-full"
                onClick={() => navigate('/login')}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar para Login
              </Button>
            </form>
          )}

          {/* Formulário de Login */}
          {step === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="bg-muted/50 p-3 rounded-lg text-center">
                <span className="text-sm text-muted-foreground">Código: </span>
                <span className="font-mono font-bold text-primary">{code}</span>
              </div>

              <div className="space-y-2">
                <label className="text-sm text-muted-foreground">Email</label>
                <Input
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  autoFocus
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
                />
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Autorizar TV
              </Button>

              <Button 
                type="button" 
                variant="ghost" 
                className="w-full"
                onClick={() => setStep('code')}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default CodeLogin;
