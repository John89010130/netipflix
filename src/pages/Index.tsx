import { useState, useRef, useEffect } from 'react';
import { Navbar } from '@/components/Navbar';
import { HeroSection } from '@/components/HeroSection';
import { ContentCarousel } from '@/components/ContentCarousel';
import { ChannelCard } from '@/components/ChannelCard';
import { VideoPlayer } from '@/components/VideoPlayer';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Tv, Film, PlayCircle } from 'lucide-react';
import { ContentItem } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { isAdultCategory } from '@/components/AdultContentGate';
import { Skeleton } from '@/components/ui/skeleton';
import { Link } from 'react-router-dom';

interface Channel {
  id: string;
  name: string;
  category: string;
  country: string;
  logo_url: string | null;
  stream_url: string;
  active: boolean;
  content_type: string;
}

const Index = () => {
  const [currentVideo, setCurrentVideo] = useState<{ src: string; title: string; poster?: string } | null>(null);
  const [tvChannels, setTVChannels] = useState<Channel[]>([]);
  const [filmChannels, setFilmChannels] = useState<Channel[]>([]);
  const [seriesChannels, setSeriesChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const tvScrollRef = useRef<HTMLDivElement>(null);
  const seriesScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchAllChannels = async () => {
      setLoading(true);
      
      // Use active_channels view to filter out channels from inactive lists
      const { data, error } = await supabase
        .from('active_channels' as any)
        .select('*')
        .order('name')
        .limit(1000);

      if (error) {
        console.error('Error fetching channels:', error);
        setLoading(false);
        return;
      }

      if (data) {
        // Cast data to Channel array
        const channels = data as unknown as Channel[];
        
        // Filter out adult content
        const safeChannels = channels.filter(c => !isAdultCategory(c.category));
        
        // Separate by content_type
        const films = safeChannels.filter(c => c.content_type === 'MOVIE');
        const series = safeChannels.filter(c => c.content_type === 'SERIES');
        const tv = safeChannels.filter(c => c.content_type === 'TV');
        
        setFilmChannels(films.slice(0, 50));
        setSeriesChannels(series.slice(0, 50));
        setTVChannels(tv.slice(0, 50));
      }
      
      setLoading(false);
    };

    fetchAllChannels();
  }, []);

  const handlePlay = (item: ContentItem) => {
    setCurrentVideo({
      src: item.stream_url,
      title: item.title,
      poster: item.backdrop_url || item.poster_url,
    });
  };

  const handlePlayChannel = (channel: Channel) => {
    setCurrentVideo({
      src: channel.stream_url,
      title: channel.name,
    });
  };

  const scrollContainer = (ref: React.RefObject<HTMLDivElement | null>, direction: 'left' | 'right') => {
    if (ref.current) {
      const scrollAmount = 300;
      ref.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });
    }
  };

  // Convert channels to ContentItem format
  const filmsAsContent: ContentItem[] = filmChannels.map(channel => ({
    id: channel.id,
    title: channel.name,
    poster_url: channel.logo_url || undefined,
    category: channel.category,
    type: 'MOVIE' as const,
    stream_url: channel.stream_url,
  }));

  // Group films by category
  const filmCategories = [...new Set(filmChannels.map(c => c.category))];
  const filmsByCategory = filmCategories.reduce((acc, category) => {
    acc[category] = filmsAsContent.filter(f => f.category === category);
    return acc;
  }, {} as Record<string, ContentItem[]>);

  // Hero item - first film or fallback
  const heroItem = filmsAsContent[0];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Hero Section */}
      {loading ? (
        <div className="h-[70vh] relative">
          <Skeleton className="absolute inset-0" />
        </div>
      ) : heroItem ? (
        <HeroSection item={heroItem} onPlay={handlePlay} />
      ) : (
        <div className="h-[50vh] flex items-center justify-center bg-gradient-to-b from-muted to-background">
          <p className="text-muted-foreground">Carregando conteúdo...</p>
        </div>
      )}

      <main className="relative z-10 -mt-32 px-4 md:px-12 space-y-12 pb-16">
        {/* ========== FILMES ========== */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Film className="h-6 w-6 text-primary" />
              <h2 className="font-display text-2xl md:text-3xl tracking-wide">Filmes</h2>
            </div>
            <Link to="/movies">
              <Button variant="ghost" size="sm">
                Ver todos <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </div>

          {loading ? (
            <div className="flex gap-4 overflow-hidden">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="aspect-video w-48 flex-shrink-0 rounded-lg" />
              ))}
            </div>
          ) : filmsAsContent.length > 0 ? (
            <div className="space-y-8">
              {/* Top Films */}
              <ContentCarousel
                title="Em Destaque"
                items={filmsAsContent.slice(0, 15)}
                onPlay={handlePlay}
              />

              {/* By Category */}
              {filmCategories.slice(0, 2).map((category) => (
                filmsByCategory[category]?.length > 0 && (
                  <ContentCarousel
                    key={category}
                    title={category}
                    items={filmsByCategory[category]}
                    onPlay={handlePlay}
                  />
                )
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">Nenhum filme disponível</p>
          )}
        </section>

        {/* ========== TV AO VIVO ========== */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Tv className="h-6 w-6 text-primary" />
              <h2 className="font-display text-2xl md:text-3xl tracking-wide">TV ao Vivo</h2>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => scrollContainer(tvScrollRef, 'left')}
                className="rounded-full"
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => scrollContainer(tvScrollRef, 'right')}
                className="rounded-full"
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
              <Link to="/tv">
                <Button variant="ghost" size="sm">
                  Ver todos
                </Button>
              </Link>
            </div>
          </div>

          <div
            ref={tvScrollRef}
            className="flex gap-4 overflow-x-auto scrollbar-hide scroll-smooth"
          >
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="aspect-video w-48 flex-shrink-0 rounded-lg" />
              ))
            ) : tvChannels.length > 0 ? (
              tvChannels.map((channel) => (
                <div key={channel.id} className="flex-shrink-0 w-48">
                  <ChannelCard
                    channel={{
                      ...channel,
                      logo_url: channel.logo_url || '',
                    }}
                    onPlay={() => handlePlayChannel(channel)}
                  />
                </div>
              ))
            ) : (
              <p className="text-muted-foreground">Nenhum canal disponível</p>
            )}
          </div>
        </section>

        {/* ========== SÉRIES ========== */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <PlayCircle className="h-6 w-6 text-primary" />
              <h2 className="font-display text-2xl md:text-3xl tracking-wide">Séries</h2>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => scrollContainer(seriesScrollRef, 'left')}
                className="rounded-full"
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => scrollContainer(seriesScrollRef, 'right')}
                className="rounded-full"
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
              <Link to="/series">
                <Button variant="ghost" size="sm">
                  Ver todos
                </Button>
              </Link>
            </div>
          </div>

          <div
            ref={seriesScrollRef}
            className="flex gap-4 overflow-x-auto scrollbar-hide scroll-smooth"
          >
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="aspect-video w-48 flex-shrink-0 rounded-lg" />
              ))
            ) : seriesChannels.length > 0 ? (
              seriesChannels.map((channel) => (
                <div key={channel.id} className="flex-shrink-0 w-48">
                  <ChannelCard
                    channel={{
                      ...channel,
                      logo_url: channel.logo_url || '',
                    }}
                    onPlay={() => handlePlayChannel(channel)}
                  />
                </div>
              ))
            ) : (
              <p className="text-muted-foreground">Nenhuma série disponível</p>
            )}
          </div>
        </section>
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

export default Index;
