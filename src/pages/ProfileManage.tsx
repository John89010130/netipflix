import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '@/contexts/SessionContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { ArrowLeft, Plus, Pencil, Trash2, User, Baby, Loader2, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';

const AVATAR_COLORS = [
  'bg-red-500',
  'bg-blue-500',
  'bg-green-500',
  'bg-yellow-500',
  'bg-purple-500',
  'bg-pink-500',
  'bg-indigo-500',
  'bg-teal-500',
  'bg-orange-500',
  'bg-cyan-500',
];

interface ProfileFormData {
  name: string;
  pin: string;
  is_kids_profile: boolean;
}

const ProfileManage = () => {
  const navigate = useNavigate();
  const { profiles, fetchProfiles } = useSession();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingProfile, setEditingProfile] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [formData, setFormData] = useState<ProfileFormData>({
    name: '',
    pin: '',
    is_kids_profile: false,
  });

  const resetForm = () => {
    setFormData({ name: '', pin: '', is_kids_profile: false });
    setEditingProfile(null);
  };

  const handleAddProfile = async () => {
    if (!formData.name.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }

    if (formData.pin && formData.pin.length !== 4) {
      toast.error('PIN deve ter 4 dígitos');
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const { error } = await supabase
        .from('client_profiles')
        .insert({
          parent_user_id: user.id,
          name: formData.name.trim(),
          pin: formData.pin || null,
          is_kids_profile: formData.is_kids_profile,
        });

      if (error) throw error;

      toast.success('Perfil criado com sucesso!');
      setShowAddDialog(false);
      resetForm();
      fetchProfiles();
    } catch (error: any) {
      console.error('Error adding profile:', error);
      if (error.message?.includes('max 10')) {
        toast.error('Limite máximo de 10 perfis atingido');
      } else {
        toast.error('Erro ao criar perfil');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleEditProfile = async () => {
    if (!editingProfile || !formData.name.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }

    if (formData.pin && formData.pin.length !== 4) {
      toast.error('PIN deve ter 4 dígitos');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('client_profiles')
        .update({
          name: formData.name.trim(),
          pin: formData.pin || null,
          is_kids_profile: formData.is_kids_profile,
        })
        .eq('id', editingProfile);

      if (error) throw error;

      toast.success('Perfil atualizado!');
      setEditingProfile(null);
      resetForm();
      fetchProfiles();
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Erro ao atualizar perfil');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteProfile = async (profileId: string) => {
    setDeleting(profileId);
    try {
      const { error } = await supabase
        .from('client_profiles')
        .delete()
        .eq('id', profileId);

      if (error) throw error;

      toast.success('Perfil removido');
      fetchProfiles();
    } catch (error) {
      console.error('Error deleting profile:', error);
      toast.error('Erro ao remover perfil');
    } finally {
      setDeleting(null);
    }
  };

  const openEditDialog = (profile: any) => {
    setFormData({
      name: profile.name,
      pin: profile.pin || '',
      is_kids_profile: profile.is_kids_profile,
    });
    setEditingProfile(profile.id);
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <Button
          variant="ghost"
          onClick={() => navigate('/profiles')}
          className="mb-6 gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Button>

        <h1 className="text-3xl font-bold mb-8">Gerenciar Perfis</h1>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {profiles.map((profile, index) => (
            <Card key={profile.id} className="relative">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-4">
                  <div 
                    className={cn(
                      "w-16 h-16 rounded-lg flex items-center justify-center",
                      AVATAR_COLORS[(index + 1) % AVATAR_COLORS.length]
                    )}
                  >
                    {profile.is_kids_profile ? (
                      <Baby className="h-8 w-8 text-white" />
                    ) : (
                      <User className="h-8 w-8 text-white" />
                    )}
                  </div>
                  <div className="flex-1">
                    <CardTitle className="flex items-center gap-2">
                      {profile.name}
                      {profile.pin && <Lock className="h-4 w-4 text-muted-foreground" />}
                    </CardTitle>
                    {profile.is_kids_profile && (
                      <span className="text-xs bg-yellow-400 text-yellow-900 px-2 py-0.5 rounded">
                        Perfil Infantil
                      </span>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-2">
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openEditDialog(profile)}
                    className="gap-1"
                  >
                    <Pencil className="h-3 w-3" />
                    Editar
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDeleteProfile(profile.id)}
                    disabled={deleting === profile.id}
                    className="gap-1"
                  >
                    {deleting === profile.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Trash2 className="h-3 w-3" />
                    )}
                    Remover
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Add Profile Card */}
          {profiles.length < 10 && (
            <Card 
              className="border-dashed cursor-pointer hover:border-primary transition-colors"
              onClick={() => setShowAddDialog(true)}
            >
              <CardContent className="flex flex-col items-center justify-center h-full min-h-[140px] gap-2">
                <Plus className="h-8 w-8 text-muted-foreground" />
                <span className="text-muted-foreground">Adicionar Perfil</span>
                <span className="text-xs text-muted-foreground">
                  {profiles.length}/10 perfis
                </span>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Add/Edit Dialog */}
        <Dialog 
          open={showAddDialog || editingProfile !== null} 
          onOpenChange={(open) => {
            if (!open) {
              setShowAddDialog(false);
              resetForm();
            }
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingProfile ? 'Editar Perfil' : 'Adicionar Perfil'}
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome do Perfil</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Ex: João"
                  maxLength={50}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="pin">PIN (opcional - 4 dígitos)</Label>
                <Input
                  id="pin"
                  type="password"
                  value={formData.pin}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '').slice(0, 4);
                    setFormData(prev => ({ ...prev, pin: value }));
                  }}
                  placeholder="••••"
                  maxLength={4}
                />
                <p className="text-xs text-muted-foreground">
                  O PIN será solicitado ao selecionar este perfil
                </p>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="kids">Perfil Infantil</Label>
                  <p className="text-xs text-muted-foreground">
                    Restringe conteúdo adulto automaticamente
                  </p>
                </div>
                <Switch
                  id="kids"
                  checked={formData.is_kids_profile}
                  onCheckedChange={(checked) => 
                    setFormData(prev => ({ ...prev, is_kids_profile: checked }))
                  }
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowAddDialog(false);
                  resetForm();
                }}
              >
                Cancelar
              </Button>
              <Button
                onClick={editingProfile ? handleEditProfile : handleAddProfile}
                disabled={saving}
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : editingProfile ? (
                  'Salvar'
                ) : (
                  'Adicionar'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default ProfileManage;
