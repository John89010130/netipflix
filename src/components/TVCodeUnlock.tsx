import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Tv, X, Check } from 'lucide-react';
import { toast } from 'sonner';

export const TVCodeUnlock = () => {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // Só mostra se o usuário estiver logado
  if (!user) return null;

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

      // Atualizar o código com os dados do usuário logado
      const { error: updateError } = await supabase
        .from('tv_login_codes' as any)
        .update({
          used: true,
          user_id: user.id,
          email: user.email,
          used_at: new Date().toISOString()
        })
        .eq('code', code.toUpperCase());

      if (updateError) {
        toast.error('Erro ao autorizar TV');
        setLoading(false);
        return;
      }

      setSuccess(true);
      toast.success('TV autorizada com sucesso!');
      
      // Fechar após 2 segundos
      setTimeout(() => {
        setIsOpen(false);
        setCode('');
        setSuccess(false);
      }, 2000);

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
        className="fixed bottom-20 right-4 z-40 bg-primary hover:bg-primary/90 text-primary-foreground p-3 rounded-full shadow-lg transition-all hover:scale-110"
        title="Conectar TV"
      >
        <Tv className="h-6 w-6" />
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
                onClick={() => { setIsOpen(false); setCode(''); setSuccess(false); }}
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
            ) : (
              // Formulário
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
                  ) : (
                    <Tv className="h-4 w-4 mr-2" />
                  )}
                  Conectar TV
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
};
