import { useState } from 'react';
import { X, Play, Plus, ThumbsUp, Share2, Calendar, Clock, Star, Film, Tv, Tag, Check } from 'lucide-react';
import { ContentItem } from '@/types';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface ContentDetailModalProps {
  item: ContentItem;
  onClose: () => void;
  onPlay: (item: ContentItem) => void;
}

export const ContentDetailModal = ({ item, onClose, onPlay }: ContentDetailModalProps) => {
  const { user } = useAuth();
  const [isInList, setIsInList] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [isAddingToList, setIsAddingToList] = useState(false);

  const handleAddToList = async () => {
    if (!user?.id) {
      toast.error('Faça login para adicionar à sua lista');
      return;
    }

    setIsAddingToList(true);
    try {
      if (isInList) {
        await supabase
          .from('favorites')
          .delete()
          .eq('user_id', user.id)
          .eq('content_id', item.id);
        setIsInList(false);
        toast.success('Removido da sua lista');
      } else {
        await supabase.from('favorites').insert({
          user_id: user.id,
          content_id: item.id,
          content_type: item.type,
        });
        setIsInList(true);
        toast.success('Adicionado à sua lista');
      }
    } catch (error) {
      toast.error('Erro ao atualizar lista');
    } finally {
      setIsAddingToList(false);
    }
  };

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.origin + `?content=${item.id}`);
      toast.success('Link copiado!');
    } catch {
      toast.error('Erro ao copiar link');
    }
  };

  // Extract year from title if present (pattern "Title (YYYY)")
  const extractedYear = item.title.match(/\((\d{4})\)/)?.[1] || item.year;
  const cleanTitle = item.title.replace(/\s*\(\d{4}\)\s*/, '').trim();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-background/90 backdrop-blur-md animate-fade-in"
        onClick={onClose}
      />

      {/* Modal Container */}
      <div className="relative w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-2xl bg-card shadow-2xl animate-scale-in">
        {/* Hero Image */}
        <div className="relative h-[40vh] md:h-[50vh] overflow-hidden">
          <img
            src={item.backdrop_url || item.poster_url}
            alt={item.title}
            className="h-full w-full object-cover"
          />
          
          {/* Gradient Overlays */}
          <div className="absolute inset-0 bg-gradient-to-t from-card via-card/50 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-card/80 via-transparent to-transparent" />
          
          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full bg-background/50 backdrop-blur-sm hover:bg-background/80 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>

          {/* Type Badge */}
          <div className="absolute top-4 left-4 flex items-center gap-2">
            <span className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium",
              item.type === 'TV' 
                ? "bg-red-500/90 text-white" 
                : "bg-primary/90 text-primary-foreground"
            )}>
              {item.type === 'TV' ? (
                <>
                  <Tv className="h-4 w-4" />
                  AO VIVO
                </>
              ) : (
                <>
                  <Film className="h-4 w-4" />
                  FILME
                </>
              )}
            </span>
          </div>

          {/* Title and Actions on Hero */}
          <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8">
            <h1 className="font-display text-3xl md:text-5xl lg:text-6xl tracking-wider mb-4 text-gradient">
              {cleanTitle}
            </h1>

            {/* Quick Info Row */}
            <div className="flex flex-wrap items-center gap-3 mb-6 text-sm">
              {item.rating && (
                <span className="flex items-center gap-1 text-green-500 font-bold">
                  <Star className="h-4 w-4 fill-current" />
                  {Math.round(item.rating * 10)}% Match
                </span>
              )}
              {extractedYear && (
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  {extractedYear}
                </span>
              )}
              {item.duration && (
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  {item.duration}
                </span>
              )}
              <span className="px-2 py-0.5 rounded border border-muted-foreground/50 text-xs text-muted-foreground">
                HD
              </span>
              <span className="px-2 py-0.5 rounded border border-muted-foreground/50 text-xs text-muted-foreground">
                16+
              </span>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-3">
              <Button
                variant="play"
                size="xl"
                onClick={() => onPlay(item)}
                className="gap-2"
              >
                <Play className="h-6 w-6 fill-current" />
                Assistir Agora
              </Button>
              
              <Button
                variant="glass"
                size="lg"
                onClick={handleAddToList}
                disabled={isAddingToList}
                className="gap-2"
              >
                {isInList ? (
                  <Check className="h-5 w-5" />
                ) : (
                  <Plus className="h-5 w-5" />
                )}
                {isInList ? 'Na Lista' : 'Minha Lista'}
              </Button>
              
              <button
                onClick={() => setIsLiked(!isLiked)}
                className={cn(
                  "flex h-12 w-12 items-center justify-center rounded-full border-2 transition-all",
                  isLiked 
                    ? "border-primary bg-primary text-primary-foreground" 
                    : "border-muted-foreground text-muted-foreground hover:border-foreground hover:text-foreground"
                )}
              >
                <ThumbsUp className={cn("h-5 w-5", isLiked && "fill-current")} />
              </button>
              
              <button
                onClick={handleShare}
                className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-muted-foreground text-muted-foreground transition-all hover:border-foreground hover:text-foreground"
              >
                <Share2 className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Content Details */}
        <div className="p-6 md:p-8 space-y-6 overflow-y-auto max-h-[40vh]">
          {/* Category */}
          <div className="flex items-center gap-2">
            <Tag className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-primary">{item.category}</span>
          </div>

          {/* Description */}
          {item.description ? (
            <p className="text-foreground/90 leading-relaxed text-base md:text-lg">
              {item.description}
            </p>
          ) : (
            <p className="text-muted-foreground italic">
              Sem descrição disponível para este conteúdo.
            </p>
          )}

          {/* Additional Info Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-border">
            {item.views_count !== undefined && item.views_count > 0 && (
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground uppercase tracking-wider">Visualizações</span>
                <p className="text-lg font-semibold">{item.views_count.toLocaleString()}</p>
              </div>
            )}
            {extractedYear && (
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground uppercase tracking-wider">Ano</span>
                <p className="text-lg font-semibold">{extractedYear}</p>
              </div>
            )}
            {item.duration && (
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground uppercase tracking-wider">Duração</span>
                <p className="text-lg font-semibold">{item.duration}</p>
              </div>
            )}
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground uppercase tracking-wider">Tipo</span>
              <p className="text-lg font-semibold">{item.type === 'TV' ? 'Canal ao Vivo' : 'Filme'}</p>
            </div>
          </div>

          {/* Poster Thumbnail */}
          {item.poster_url && item.poster_url !== item.backdrop_url && (
            <div className="flex gap-4 pt-4 border-t border-border">
              <img
                src={item.poster_url}
                alt={item.title}
                className="w-24 h-36 object-cover rounded-lg shadow-lg"
              />
              <div className="flex-1">
                <h3 className="font-semibold mb-2">Poster</h3>
                <p className="text-sm text-muted-foreground">
                  Imagem promocional do conteúdo
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
