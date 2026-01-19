import { useState, useEffect } from 'react';
import { Navbar } from '@/components/Navbar';
import { ContentCard } from '@/components/ContentCard';
import { VideoPlayer } from '@/components/VideoPlayer';
import { ContentItem } from '@/types';
import { Heart, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

const MyList = () => {
  const { user } = useAuth();
  const [currentVideo, setCurrentVideo] = useState<{ src: string; title: string; poster?: string } | null>(null);
  const [favorites, setFavorites] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFavorites();
  }, [user?.email]);

  const loadFavorites = async () => {
    if (!user?.email) {
      setLoading(false);
      return;
    }

    try {
      // Buscar IDs dos favoritos por email (sincroniza entre dispositivos)
      const { data: favData, error: favError } = await supabase
        .from('favorites')
        .select('content_id, content_type')
        .eq('email', user.email);

      if (favError) throw favError;

      if (!favData || favData.length === 0) {
        setFavorites([]);
        setLoading(false);
        return;
      }

      // Buscar detalhes do conteúdo
      const movieIds = favData.filter(f => f.content_type === 'MOVIE').map(f => f.content_id);
      const seriesIds = favData.filter(f => f.content_type === 'SERIES').map(f => f.content_id);

      const allContent: ContentItem[] = [];

      // Buscar filmes
      if (movieIds.length > 0) {
        const { data: movies } = await supabase
          .from('movies')
          .select('*')
          .in('id', movieIds);
        
        if (movies) {
          allContent.push(...movies.map((m: any) => ({
            id: m.id,
            title: m.name,
            poster_url: m.stream_icon || m.cover,
            backdrop_url: m.cover,
            category: m.category_name || 'Filmes',
            type: 'MOVIE' as const,
            stream_url: m.stream_url || '',
            description: m.plot || '',
            year: m.year,
            duration: m.duration,
            rating: m.rating,
            views_count: 0,
          })));
        }
      }

      // Buscar séries
      if (seriesIds.length > 0) {
        const { data: series } = await supabase
          .from('series')
          .select('*')
          .in('id', seriesIds);
        
        if (series) {
          allContent.push(...series.map((s: any) => ({
            id: s.id,
            title: s.name,
            poster_url: s.cover,
            backdrop_url: s.backdrop,
            category: s.category_name || 'Séries',
            type: 'SERIES' as const,
            stream_url: '',
            description: s.plot || '',
            year: s.year,
            rating: s.rating,
            views_count: 0,
          })));
        }
      }

      setFavorites(allContent);
    } catch (error) {
      console.error('Error loading favorites:', error);
      toast.error('Erro ao carregar favoritos');
    } finally {
      setLoading(false);
    }
  };

  const handlePlay = (item: ContentItem) => {
    if (item.stream_url) {
      setCurrentVideo({
        src: item.stream_url,
        title: item.title,
        poster: item.backdrop_url || item.poster_url,
      });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="pt-24 px-4 md:px-12 pb-16">
        {/* Header */}
        <div className="mb-8">
          <h1 className="font-display text-4xl md:text-5xl tracking-wide mb-4">Minha Lista</h1>
          <p className="text-muted-foreground">Seus favoritos em um só lugar</p>
        </div>

        {/* Favorites Grid */}
        {loading ? (
          <div className="flex justify-center items-center py-24">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
          </div>
        ) : favorites.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {favorites.map((movie) => {
              const item: ContentItem = {
                id: movie.id,
                title: movie.title,
                poster_url: movie.poster_url,
                backdrop_url: movie.backdrop_url,
                category: movie.category,
                type: 'MOVIE',
                stream_url: movie.stream_url,
                description: movie.description,
                year: movie.year,
                duration: movie.duration,
                rating: movie.rating,
                views_count: movie.views_count,
              };
              return (
                <ContentCard
                  key={movie.id}
                  item={item}
                  onPlay={handlePlay}
                />
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="h-24 w-24 rounded-full bg-secondary flex items-center justify-center mb-6">
              <Heart className="h-12 w-12 text-muted-foreground" />
            </div>
            <h2 className="font-display text-2xl mb-2">Sua lista está vazia</h2>
            <p className="text-muted-foreground max-w-md">
              Adicione filmes e séries à sua lista clicando no ícone + em qualquer conteúdo.
            </p>
          </div>
        )}
      </main>

      {/* Video Player Modal */}
      {currentVideo && (
        <VideoPlayer
          src={currentVideo.src}
          title={currentVideo.title}
          poster={currentVideo.poster}
          onClose={() => setCurrentVideo(null)}
        />
      )}
    </div>
  );
};

export default MyList;
