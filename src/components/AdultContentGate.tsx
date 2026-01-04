import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Lock, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface AdultContentGateProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const MASTER_PASSWORD = '1998';
const SESSION_KEY = 'adult_content_verified';

export const isAdultCategory = (category: string): boolean => {
  const lowerCategory = category.toLowerCase();
  return lowerCategory.includes('adulto') || 
         lowerCategory.includes('adult') || 
         lowerCategory.includes('+18') ||
         lowerCategory.includes('xxx');
};

export const isAdultContentVerified = (): boolean => {
  return sessionStorage.getItem(SESSION_KEY) === 'true';
};

export const setAdultContentVerified = (): void => {
  sessionStorage.setItem(SESSION_KEY, 'true');
};

export const AdultContentGate = ({ isOpen, onClose, onSuccess }: AdultContentGateProps) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Check master password first
      if (password === MASTER_PASSWORD) {
        setAdultContentVerified();
        toast.success('Acesso liberado');
        onSuccess();
        setPassword('');
        return;
      }

      // Check user's custom password
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('adult_password')
          .eq('id', user.id)
          .single();

        if (profile?.adult_password && password === profile.adult_password) {
          setAdultContentVerified();
          toast.success('Acesso liberado');
          onSuccess();
          setPassword('');
          return;
        }
      }

      toast.error('Senha incorreta');
    } catch (error) {
      console.error('Error verifying password:', error);
      toast.error('Erro ao verificar senha');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-primary" />
            Conteúdo Restrito
          </DialogTitle>
          <DialogDescription>
            Este conteúdo é restrito para maiores de 18 anos. Digite sua senha para continuar.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="adult-password">Senha</Label>
            <div className="relative">
              <Input
                id="adult-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Digite sua senha"
                className="pr-10"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Cancelar
            </Button>
            <Button type="submit" disabled={loading || !password} className="flex-1">
              {loading ? 'Verificando...' : 'Confirmar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
