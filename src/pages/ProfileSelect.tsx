import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useSession } from '@/contexts/SessionContext';
import { Button } from '@/components/ui/button';
import { Plus, User, Settings, Loader2, Baby } from 'lucide-react';
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

const ProfileSelect = () => {
  const navigate = useNavigate();
  const { profile: mainProfile, signOut } = useAuth();
  const { profiles, selectProfile, loading } = useSession();
  const [selecting, setSelecting] = useState<string | null>(null);

  const handleSelectProfile = async (profile: { id: string; name: string; avatar_url: string | null; is_kids_profile: boolean } | null) => {
    setSelecting(profile?.id || 'main');
    
    const success = await selectProfile(profile as any);
    
    if (success) {
      navigate('/');
    }
    
    setSelecting(null);
  };

  const handleManageProfiles = () => {
    navigate('/profiles/manage');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <h1 className="text-3xl md:text-5xl font-bold mb-12">Quem está assistindo?</h1>
      
      <div className="flex flex-wrap justify-center gap-6 max-w-4xl">
        {/* Main Profile (User) */}
        <button
          onClick={() => handleSelectProfile(null)}
          disabled={selecting !== null}
          className="group flex flex-col items-center gap-3 focus:outline-none"
        >
          <div 
            className={cn(
              "w-24 h-24 md:w-32 md:h-32 rounded-lg flex items-center justify-center transition-all",
              "border-2 border-transparent group-hover:border-primary group-focus:border-primary",
              AVATAR_COLORS[0],
              selecting === 'main' && "opacity-50"
            )}
          >
            {selecting === 'main' ? (
              <Loader2 className="h-8 w-8 animate-spin text-white" />
            ) : (
              <User className="h-12 w-12 md:h-16 md:w-16 text-white" />
            )}
          </div>
          <span className="text-muted-foreground group-hover:text-foreground transition-colors">
            {mainProfile?.name || 'Principal'}
          </span>
        </button>

        {/* Sub-profiles */}
        {profiles.map((profile, index) => (
          <button
            key={profile.id}
            onClick={() => handleSelectProfile(profile)}
            disabled={selecting !== null}
            className="group flex flex-col items-center gap-3 focus:outline-none"
          >
            <div 
              className={cn(
                "w-24 h-24 md:w-32 md:h-32 rounded-lg flex items-center justify-center transition-all relative",
                "border-2 border-transparent group-hover:border-primary group-focus:border-primary",
                AVATAR_COLORS[(index + 1) % AVATAR_COLORS.length],
                selecting === profile.id && "opacity-50"
              )}
            >
              {selecting === profile.id ? (
                <Loader2 className="h-8 w-8 animate-spin text-white" />
              ) : profile.is_kids_profile ? (
                <Baby className="h-12 w-12 md:h-16 md:w-16 text-white" />
              ) : (
                <User className="h-12 w-12 md:h-16 md:w-16 text-white" />
              )}
              {profile.is_kids_profile && (
                <span className="absolute bottom-1 right-1 text-xs bg-yellow-400 text-yellow-900 px-1 rounded">
                  Kids
                </span>
              )}
            </div>
            <span className="text-muted-foreground group-hover:text-foreground transition-colors">
              {profile.name}
            </span>
          </button>
        ))}

        {/* Add Profile Button (max 10) */}
        {profiles.length < 10 && (
          <button
            onClick={handleManageProfiles}
            className="group flex flex-col items-center gap-3 focus:outline-none"
          >
            <div 
              className={cn(
                "w-24 h-24 md:w-32 md:h-32 rounded-lg flex items-center justify-center transition-all",
                "border-2 border-dashed border-muted-foreground/50 group-hover:border-primary",
                "bg-muted/30"
              )}
            >
              <Plus className="h-12 w-12 md:h-16 md:w-16 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
            <span className="text-muted-foreground group-hover:text-foreground transition-colors">
              Adicionar Perfil
            </span>
          </button>
        )}
      </div>

      <div className="mt-16 flex gap-4">
        <Button
          variant="outline"
          onClick={handleManageProfiles}
          className="gap-2"
        >
          <Settings className="h-4 w-4" />
          Gerenciar Perfis
        </Button>
        <Button
          variant="ghost"
          onClick={signOut}
        >
          Sair
        </Button>
      </div>
    </div>
  );
};

export default ProfileSelect;
