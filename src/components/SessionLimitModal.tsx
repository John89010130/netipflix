import { useSession } from '@/contexts/SessionContext';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { AlertTriangle, MessageCircle, Monitor } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const SessionLimitModal = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { sessionInfo, showLimitModal, setShowLimitModal, subscription } = useSession();

  const isParentUser = true; // TODO: detect if current user is parent

  const handleContactSupport = () => {
    setShowLimitModal(false);
    // Open support chat
    const event = new CustomEvent('openSupportChat');
    window.dispatchEvent(event);
  };

  return (
    <Dialog open={showLimitModal} onOpenChange={setShowLimitModal}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3 text-yellow-500">
            <AlertTriangle className="h-6 w-6" />
            <DialogTitle>Limite de Telas Atingido</DialogTitle>
          </div>
          <DialogDescription className="pt-4 space-y-3">
            <div className="flex items-center gap-2 text-foreground">
              <Monitor className="h-5 w-5 text-muted-foreground" />
              <span>
                {sessionInfo?.active_count || 0} de {sessionInfo?.max_screens || 1} telas em uso
              </span>
            </div>
            
            {isParentUser ? (
              <p className="text-muted-foreground">
                Você atingiu o limite de telas simultâneas da sua conta. 
                Deseja adquirir mais telas? Cada tela adicional custa apenas{' '}
                <span className="text-primary font-medium">
                  R$ {subscription?.price_per_screen?.toFixed(2) || '5,00'}
                </span>
                /mês.
              </p>
            ) : (
              <p className="text-muted-foreground">
                O limite de telas da conta foi atingido. 
                Entre em contato com o titular da conta ({profile?.name}) para liberar uma tela 
                ou adquirir mais telas.
              </p>
            )}
          </DialogDescription>
        </DialogHeader>
        
        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={() => setShowLimitModal(false)}
            className="w-full sm:w-auto"
          >
            Tentar Novamente
          </Button>
          <Button
            onClick={handleContactSupport}
            className="w-full sm:w-auto gap-2"
          >
            <MessageCircle className="h-4 w-4" />
            {isParentUser ? 'Adquirir Mais Telas' : 'Falar com Suporte'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
