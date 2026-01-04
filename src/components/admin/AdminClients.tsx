import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { 
  Users, 
  Monitor, 
  Search, 
  Pencil, 
  Trash2, 
  Loader2,
  UserPlus,
  XCircle,
  Clock
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ClientData {
  id: string;
  name: string;
  email: string;
  created_at: string;
  subscription: {
    id: string;
    max_screens: number;
    is_active: boolean;
  } | null;
  profiles_count: number;
  active_sessions: number;
}

interface ActiveSession {
  id: string;
  user_id: string;
  profile_id: string | null;
  device_info: string | null;
  started_at: string;
  last_activity: string;
}

export const AdminClients = () => {
  const [clients, setClients] = useState<ClientData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingClient, setEditingClient] = useState<ClientData | null>(null);
  const [maxScreens, setMaxScreens] = useState(1);
  const [saving, setSaving] = useState(false);
  const [showSessionsDialog, setShowSessionsDialog] = useState(false);
  const [selectedClientSessions, setSelectedClientSessions] = useState<ActiveSession[]>([]);
  const [selectedClientName, setSelectedClientName] = useState('');

  const fetchClients = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch all profiles (users)
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;

      // Fetch subscriptions
      const { data: subscriptions, error: subError } = await supabase
        .from('client_subscriptions')
        .select('*');

      if (subError) throw subError;

      // Fetch profile counts
      const { data: profileCounts, error: countError } = await supabase
        .from('client_profiles')
        .select('parent_user_id');

      if (countError) throw countError;

      // Fetch active sessions
      const { data: sessions, error: sessError } = await supabase
        .from('active_sessions')
        .select('*');

      if (sessError) throw sessError;

      // Build client data
      const clientData: ClientData[] = (profiles || []).map(profile => {
        const sub = subscriptions?.find(s => s.user_id === profile.id);
        const profileCount = profileCounts?.filter(p => p.parent_user_id === profile.id).length || 0;
        const activeSessions = sessions?.filter(s => s.user_id === profile.id).length || 0;

        return {
          id: profile.id,
          name: profile.name,
          email: profile.email,
          created_at: profile.created_at,
          subscription: sub ? {
            id: sub.id,
            max_screens: sub.max_screens,
            is_active: sub.is_active,
          } : null,
          profiles_count: profileCount,
          active_sessions: activeSessions,
        };
      });

      setClients(clientData);
    } catch (error) {
      console.error('Error fetching clients:', error);
      toast.error('Erro ao carregar clientes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  const handleEditScreens = async () => {
    if (!editingClient) return;

    setSaving(true);
    try {
      if (editingClient.subscription) {
        // Update existing subscription
        const { error } = await supabase
          .from('client_subscriptions')
          .update({ max_screens: maxScreens })
          .eq('id', editingClient.subscription.id);

        if (error) throw error;
      } else {
        // Create new subscription
        const { error } = await supabase
          .from('client_subscriptions')
          .insert({
            user_id: editingClient.id,
            max_screens: maxScreens,
          });

        if (error) throw error;
      }

      toast.success(`Limite atualizado para ${maxScreens} tela(s)`);
      setEditingClient(null);
      fetchClients();
    } catch (error) {
      console.error('Error updating screens:', error);
      toast.error('Erro ao atualizar limite');
    } finally {
      setSaving(false);
    }
  };

  const handleViewSessions = async (client: ClientData) => {
    try {
      const { data, error } = await supabase
        .from('active_sessions')
        .select('*')
        .eq('user_id', client.id);

      if (error) throw error;

      setSelectedClientSessions(data || []);
      setSelectedClientName(client.name);
      setShowSessionsDialog(true);
    } catch (error) {
      console.error('Error fetching sessions:', error);
      toast.error('Erro ao carregar sessões');
    }
  };

  const handleEndSession = async (sessionId: string) => {
    try {
      const { error } = await supabase
        .from('active_sessions')
        .delete()
        .eq('id', sessionId);

      if (error) throw error;

      setSelectedClientSessions(prev => prev.filter(s => s.id !== sessionId));
      toast.success('Sessão encerrada');
      fetchClients();
    } catch (error) {
      console.error('Error ending session:', error);
      toast.error('Erro ao encerrar sessão');
    }
  };

  const filteredClients = clients.filter(client =>
    client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <Users className="h-8 w-8 text-primary" />
              <div>
                <p className="text-2xl font-bold">{clients.length}</p>
                <p className="text-sm text-muted-foreground">Total de Clientes</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <Monitor className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-2xl font-bold">
                  {clients.reduce((acc, c) => acc + c.active_sessions, 0)}
                </p>
                <p className="text-sm text-muted-foreground">Sessões Ativas</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <UserPlus className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">
                  {clients.reduce((acc, c) => acc + c.profiles_count, 0)}
                </p>
                <p className="text-sm text-muted-foreground">Sub-perfis Criados</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome ou email..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Clients List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : (
        <div className="space-y-3">
          {filteredClients.map(client => (
            <Card key={client.id}>
              <CardContent className="py-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium">{client.name}</h3>
                      {client.subscription?.is_active === false && (
                        <Badge variant="destructive">Inativo</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{client.email}</p>
                    <div className="flex flex-wrap gap-3 mt-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Monitor className="h-3 w-3" />
                        {client.subscription?.max_screens || 1} tela(s)
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {client.profiles_count} perfis
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {client.active_sessions} ativa(s)
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleViewSessions(client)}
                      className="gap-1"
                    >
                      <Monitor className="h-3 w-3" />
                      Sessões
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditingClient(client);
                        setMaxScreens(client.subscription?.max_screens || 1);
                      }}
                      className="gap-1"
                    >
                      <Pencil className="h-3 w-3" />
                      Telas
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {filteredClients.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              Nenhum cliente encontrado
            </div>
          )}
        </div>
      )}

      {/* Edit Screens Dialog */}
      <Dialog open={editingClient !== null} onOpenChange={() => setEditingClient(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Limite de Telas</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground mb-4">
              Cliente: <span className="font-medium text-foreground">{editingClient?.name}</span>
            </p>
            <div className="space-y-2">
              <Label htmlFor="screens">Quantidade de Telas</Label>
              <Input
                id="screens"
                type="number"
                min={1}
                max={10}
                value={maxScreens}
                onChange={(e) => setMaxScreens(parseInt(e.target.value) || 1)}
              />
              <p className="text-xs text-muted-foreground">
                Valor: R$ {(maxScreens * 5).toFixed(2)}/mês
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingClient(null)}>
              Cancelar
            </Button>
            <Button onClick={handleEditScreens} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sessions Dialog */}
      <Dialog open={showSessionsDialog} onOpenChange={setShowSessionsDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Sessões Ativas - {selectedClientName}</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            {selectedClientSessions.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">
                Nenhuma sessão ativa
              </p>
            ) : (
              <div className="space-y-3">
                {selectedClientSessions.map(session => (
                  <Card key={session.id}>
                    <CardContent className="py-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium truncate max-w-[200px]">
                            {session.device_info || 'Dispositivo desconhecido'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Último acesso:{' '}
                            {format(new Date(session.last_activity), "dd/MM HH:mm", { locale: ptBR })}
                          </p>
                        </div>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleEndSession(session.id)}
                          className="gap-1"
                        >
                          <XCircle className="h-3 w-3" />
                          Encerrar
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
