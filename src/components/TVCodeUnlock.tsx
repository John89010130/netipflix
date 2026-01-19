import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Tv, X, Check } from 'lucide-react';
import { toast } from 'sonner';

export const TVCodeUnlock = () => {
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [step, setStep] = useState<'code' | 'password'>('code');

  // Não mostra na página de login ou code
  if (location.pathname === '/login' || location.pathname === '/code') {
    return null;
  }

  const handleUnlock = async () => {
    if (code.length !== 6) {
      toast.error('Digite o código de 6 caracteres');
      return;
    }

    setLoading(true);

    try {
      // Verificar se o código existe e é válido
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

      // Código válido, pedir senha
      setStep('password');
      setLoading(false);

    } catch (error) {
      toast.error('Erro ao verificar código');
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!password) {
      toast.error('Digite sua senha');
      return;
    }

    setLoading(true);

    try {
      // Pegar usuário atual
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user?.email) {
        toast.error('Usuário não encontrado');
        setLoading(false);
        return;
      }

      // Verificar senha fazendo um sign in
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: password
      });

      if (authError) {
        toast.error('Senha incorreta');
        setLoading(false);
        return;
      }

      // Atualizar o código com os dados do usuário
      const { error: updateError } = await supabase
        .from('tv_login_codes' as any)
        .update({
          used: true,
          email: user.email,
          temp_password: password,
          used_at: new Date().toISOString()
        })
        .eq('code', code.toUpperCase());

      if (updateError) {
        toast.error('Erro ao autorizar TV');
        setLoading(false);
        return;
      }

      setSuccess(true);
      toast.success('TV autorizada! A TV vai fazer login automaticamente.');
      
      // Fechar após 2 segundos
      setTimeout(() => {
        setIsOpen(false);
        setCode('');
        setPassword('');
        setSuccess(false);
        setStep('code');
      }, 2500);

    } catch (error) {
      toast.error('Erro ao processar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Botão flutuante */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-24 right-6 z-[9999] bg-red-600 hover:bg-red-700 text-white p-4 rounded-full shadow-2xl transition-all hover:scale-110 border-2 border-white"
        title="Conectar TV"
      >
        <Tv className="h-7 w-7" />
      </button>

      {/* Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="bg-card rounded-lg p-6 w-full max-w-sm border border-border shadow-xl">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Tv className="h-5 w-5 text-primary" />
                Conectar TV
              </h2>
              <button 
                onClick={() => { setIsOpen(false); setCode(''); setPassword(''); setSuccess(false); setStep('code'); }}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {success ? (
              // Tela de sucesso
              <div className="text-center py-6">
                <div className="bg-green-500/20 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                  <Check className="h-8 w-8 text-green-500" />
                </div>
                <p className="text-lg font-medium">TV Conectada!</p>
                <p className="text-sm text-muted-foreground">A TV já está logando...</p>
              </div>
            ) : step === 'code' ? (
              // Formulário do Código
              <>
                <p className="text-sm text-muted-foreground mb-4">
                  Digite o código de 6 caracteres que aparece na TV
                </p>

                <Input
                  type="text"
                  placeholder="XXXXXX"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 6))}
                  className="text-center text-2xl font-mono tracking-[0.3em] h-14 uppercase mb-4"
                  maxLength={6}
                  disabled={loading}
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && code.length === 6 && handleUnlock()}
                />

                <Button 
                  onClick={handleUnlock} 
                  className="w-full" 
                  disabled={loading || code.length !== 6}
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : null}
                  Continuar
                </Button>
              </>
            ) : (
              // Formulário da Senha
              <>
                <div className="bg-muted/50 p-3 rounded-lg text-center mb-4">
                  <span className="text-sm text-muted-foreground">Código: </span>
                  <span className="font-mono font-bold text-primary">{code}</span>
                </div>

                <p className="text-sm text-muted-foreground mb-4">
                  Digite sua senha para autorizar a TV
                </p>

                <Input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mb-4"
                  disabled={loading}
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && password && handleConfirm()}
                />

                <div className="flex gap-2">
                  <Button 
                    onClick={() => { setStep('code'); setPassword(''); }} 
                    variant="outline"
                    className="flex-1"
                    disabled={loading}
                  >
                    Voltar
                  </Button>
                  <Button 
                    onClick={handleConfirm} 
                    className="flex-1" 
                    disabled={loading || !password}
                  >
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Tv className="h-4 w-4 mr-2" />
                    )}
                    Conectar TV
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
};
