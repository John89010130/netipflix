import { useState, useEffect } from 'react';
import { X, Play, Plus, Share2, Tag, ChevronDown, ChevronUp, Check, PlayCircle } from 'lucide-react';
import { ContentItem } from '@/types';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { isAdultCategory } from '@/components/AdultContentGate';

interface Episode {
  id: string;
  name: string;
  stream_url: string;
  logo_url: string | null;
  season_number: number | null;
  episode_number: number | null;
  series_title: string | null;
}

interface SeriesDetailModalProps {
  item: ContentItem;
  onClose: () => void;
  onPlay: (episode: { id: string; name: string; stream_url: string; poster?: string }) => void;
}

// Parse episode number from name if not in database
const parseEpisodeNumber = (name: string, dbEpisodeNum: number | null): number => {
  if (dbEpisodeNum && dbEpisodeNum > 0) return dbEpisodeNum;
  
  // Try to extract from patterns like "S01E09", "E09", "Ep 09", "Episode 9"
  const patterns = [
    /[Ss]\d+[Ee](\d+)/,      // S01E09
    /[Ee][Pp]?\s*(\d+)/i,    // E09, Ep09, Ep 09
    /[Ee]pisode\s*(\d+)/i,   // Episode 9
    /\s(\d{1,3})\s*[-–]\s*/  // " 09 - Title"
  ];
  
  for (const pattern of patterns) {
    const match = name.match(pattern);
    if (match) {
      return parseInt(match[1], 10);
    }
  }
  
  return 999; // Default for unknown ordering
};

const parseSeasonNumber = (name: string, dbSeasonNum: number | null): number => {
  if (dbSeasonNum && dbSeasonNum > 0) return dbSeasonNum;
  
  const match = name.match(/[Ss](\d+)/);
  if (match) {
    return parseInt(match[1], 10);
  }
  
  return 1; // Default to season 1
};

export const SeriesDetailModal = ({ item, onClose, onPlay }: SeriesDetailModalProps) => {
  const { user } = useAuth();
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedSeason, setExpandedSeason] = useState<number | null>(null);
  const [isInList, setIsInList] = useState(false);
  const [isAddingToList, setIsAddingToList] = useState(false);

  // Extract series title from item
  const seriesTitle = item.title.replace(/\s*\(\d{4}\)\s*/, '').replace(/\s*[Ss]\d+[Ee]\d+.*$/, '').trim();

  useEffect(() => {
    const fetchEpisodes = async () => {
      setLoading(true);
      
      // Try to find by series_title first, fallback to name pattern
      const { data, error } = await supabase
        .from('active_channels' as any)
        .select('id, name, stream_url, logo_url, season_number, episode_number, series_title, category')
        .eq('content_type', 'SERIES')
        .or(`series_title.ilike.%${seriesTitle}%,name.ilike.%${seriesTitle}%`)
        .limit(500);
      
      if (error) {
        console.error('Error fetching episodes:', error);
        setLoading(false);
        return;
      }
      
      if (data) {
        // Filter adult content
        const safeData = (data as any[]).filter(ep => !isAdultCategory(ep.category));
        
        // Sort episodes properly
        const sortedEpisodes = safeData
          .map(ep => ({
            ...ep,
            parsedSeason: parseSeasonNumber(ep.name, ep.season_number),
            parsedEpisode: parseEpisodeNumber(ep.name, ep.episode_number),
          }))
          .sort((a, b) => {
            if (a.parsedSeason !== b.parsedSeason) {
              return a.parsedSeason - b.parsedSeason;
            }
            return a.parsedEpisode - b.parsedEpisode;
          });
        
        setEpisodes(sortedEpisodes);
        
        // Auto-expand first season
        if (sortedEpisodes.length > 0) {
          setExpandedSeason(sortedEpisodes[0].parsedSeason);
        }
      }
      
      setLoading(false);
    };

    fetchEpisodes();
  }, [seriesTitle]);

  // Get unique seasons
  const seasons = [...new Set(episodes.map(ep => 
    parseSeasonNumber(ep.name, ep.season_number)
  ))].sort((a, b) => a - b);

  const getEpisodesForSeason = (season: number) => {
    return episodes
      .filter(ep => parseSeasonNumber(ep.name, ep.season_number) === season)
      .sort((a, b) => {
        const epA = parseEpisodeNumber(a.name, a.episode_number);
        const epB = parseEpisodeNumber(b.name, b.episode_number);
        return epA - epB;
      });
  };

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
          content_type: 'SERIES',
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
      await navigator.clipboard.writeText(window.location.origin + `?series=${encodeURIComponent(seriesTitle)}`);
      toast.success('Link copiado!');
    } catch {
      toast.error('Erro ao copiar link');
    }
  };

  const formatEpisodeName = (episode: Episode) => {
    const epNum = parseEpisodeNumber(episode.name, episode.episode_number);
    // Clean title from patterns
    let cleanName = episode.name
      .replace(/^.*[Ss]\d+[Ee]\d+\s*[-–]?\s*/i, '')
      .replace(/^[Ee][Pp]?\s*\d+\s*[-–]?\s*/i, '')
      .trim();
    
    if (!cleanName || cleanName === episode.name) {
      cleanName = episode.series_title || seriesTitle;
    }
    
    return `Episódio ${epNum}${cleanName ? ` - ${cleanName}` : ''}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-background/90 backdrop-blur-md animate-fade-in"
        onClick={onClose}
      />

      {/* Modal Container */}
      <div className="relative w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-2xl bg-card shadow-2xl animate-scale-in flex flex-col">
        {/* Hero Image */}
        <div className="relative h-[30vh] md:h-[35vh] overflow-hidden flex-shrink-0">
          <img
            src={item.backdrop_url || item.poster_url}
            alt={seriesTitle}
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

          {/* Series Badge */}
          <div className="absolute top-4 left-4">
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-primary/90 text-primary-foreground">
              <PlayCircle className="h-4 w-4" />
              SÉRIE
            </span>
          </div>

          {/* Title and Actions */}
          <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8">
            <h1 className="font-display text-2xl md:text-4xl lg:text-5xl tracking-wider mb-4 text-gradient">
              {seriesTitle}
            </h1>

            {/* Quick Info */}
            <div className="flex flex-wrap items-center gap-3 mb-4 text-sm">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Tag className="h-4 w-4" />
                {item.category}
              </span>
              {!loading && (
                <span className="text-muted-foreground">
                  {seasons.length} temporada{seasons.length > 1 ? 's' : ''} • {episodes.length} episódios
                </span>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-3">
              {episodes.length > 0 && (
                <Button
                  variant="play"
                  size="lg"
                  onClick={() => {
                    const firstEp = getEpisodesForSeason(seasons[0])?.[0];
                    if (firstEp) {
                      onPlay({
                        id: firstEp.id,
                        name: firstEp.name,
                        stream_url: firstEp.stream_url,
                        poster: firstEp.logo_url || item.poster_url,
                      });
                    }
                  }}
                  className="gap-2"
                >
                  <Play className="h-5 w-5 fill-current" />
                  Assistir S1:E1
                </Button>
              )}
              
              <Button
                variant="glass"
                size="lg"
                onClick={handleAddToList}
                disabled={isAddingToList}
                className="gap-2"
              >
                {isInList ? <Check className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
                {isInList ? 'Na Lista' : 'Minha Lista'}
              </Button>
              
              <button
                onClick={handleShare}
                className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-muted-foreground text-muted-foreground transition-all hover:border-foreground hover:text-foreground"
              >
                <Share2 className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Episodes List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : episodes.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Nenhum episódio encontrado</p>
            </div>
          ) : (
            <div className="p-4 md:p-6 space-y-4">
              {seasons.map(season => (
                <div key={season} className="border border-border rounded-lg overflow-hidden">
                  {/* Season Header */}
                  <button
                    onClick={() => setExpandedSeason(expandedSeason === season ? null : season)}
                    className="w-full flex items-center justify-between p-4 hover:bg-secondary/50 transition-colors"
                  >
                    <span className="font-semibold">
                      Temporada {season}
                      <span className="ml-2 text-sm text-muted-foreground font-normal">
                        ({getEpisodesForSeason(season).length} episódios)
                      </span>
                    </span>
                    {expandedSeason === season ? (
                      <ChevronUp className="h-5 w-5 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-muted-foreground" />
                    )}
                  </button>

                  {/* Episodes */}
                  {expandedSeason === season && (
                    <div className="border-t border-border divide-y divide-border">
                      {getEpisodesForSeason(season).map(episode => (
                        <button
                          key={episode.id}
                          onClick={() => onPlay({
                            id: episode.id,
                            name: episode.name,
                            stream_url: episode.stream_url,
                            poster: episode.logo_url || item.poster_url,
                          })}
                          className="w-full flex items-center gap-4 p-4 hover:bg-secondary/30 transition-colors text-left group"
                        >
                          {/* Thumbnail */}
                          <div className="w-28 h-16 md:w-36 md:h-20 flex-shrink-0 rounded-md overflow-hidden bg-muted relative">
                            {episode.logo_url ? (
                              <img
                                src={episode.logo_url}
                                alt={episode.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-secondary">
                                <Play className="h-6 w-6 text-muted-foreground" />
                              </div>
                            )}
                            {/* Play overlay */}
                            <div className="absolute inset-0 bg-background/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                              <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center">
                                <Play className="h-5 w-5 fill-current text-primary-foreground" />
                              </div>
                            </div>
                          </div>

                          {/* Episode Info */}
                          <div className="flex-1 min-w-0">
                            <p className="font-medium line-clamp-1">
                              {formatEpisodeName(episode)}
                            </p>
                            <p className="text-sm text-muted-foreground mt-1">
                              Temporada {season}, Episódio {parseEpisodeNumber(episode.name, episode.episode_number)}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
