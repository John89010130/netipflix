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
}

interface Movie {
  id: string;
  title: string;
  category: string;
  poster_url: string | null;
  backdrop_url: string | null;
  stream_url: string;
  description: string | null;
  year: number | null;
  duration: string | null;
  rating: number | null;
  views_count: number;
  active: boolean;
}

const Index = () => {
  const [currentVideo, setCurrentVideo] = useState<{ src: string; title: string; poster?: string } | null>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [movies, setMovies] = useState<Movie[]>([]);
  const [seriesChannels, setSeriesChannels] = useState<Channel[]>([]);
  const [loadingChannels, setLoadingChannels] = useState(true);
  const [loadingMovies, setLoadingMovies] = useState(true);
  const [loadingSeries, setLoadingSeries] = useState(true);
  const channelsScrollRef = useRef<HTMLDivElement>(null);
  const seriesScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchChannels = async () => {
      const { data, error } = await supabase
        .from('channels')
        .select('*')
        .eq('active', true)
        .order('name')
        .limit(50);

      if (!error && data) {
        // Filter out adult content and series content for home page TV section
        setChannels(data.filter(c => 
          !isAdultCategory(c.category) && 
          !c.category.toLowerCase().includes('serie') &&
          !c.category.toLowerCase().includes('netflix') &&
          !c.category.toLowerCase().includes('filmes')
        ));
      }
      setLoadingChannels(false);
    };

    const fetchMovies = async () => {
      const { data, error } = await supabase
        .from('movies')
        .select('*')
        .eq('active', true)
        .order('views_count', { ascending: false })
        .limit(100);

      if (!error && data) {
        // Filter out adult content for home page
        setMovies(data.filter(m => !isAdultCategory(m.category)));
      }
      setLoadingMovies(false);
    };

    const fetchSeries = async () => {
      const { data, error } = await supabase
        .from('channels')
        .select('*')
        .eq('active', true)
        .order('name')
        .limit(50);

      if (!error && data) {
        // Filter for series-related categories
        const filtered = data.filter(channel => {
          const category = channel.category.toLowerCase();
          return (
            category.includes('serie') ||
            category.includes('netflix') ||
            category.includes('talk') ||
            category.includes('reality')
          ) && !isAdultCategory(channel.category);
        });
        setSeriesChannels(filtered);
      }
      setLoadingSeries(false);
    };

    fetchChannels();
    fetchMovies();
    fetchSeries();
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

  const scrollChannels = (ref: React.RefObject<HTMLDivElement>, direction: 'left' | 'right') => {
    if (ref.current) {
      const scrollAmount = 300;
      ref.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });
    }
  };

  // Convert movies to ContentItem format
  const allMovies: ContentItem[] = movies.map(movie => ({
    id: movie.id,
    title: movie.title,
    poster_url: movie.poster_url || undefined,
    backdrop_url: movie.backdrop_url || undefined,
    category: movie.category,
    type: 'MOVIE' as const,
    stream_url: movie.stream_url,
    description: movie.description || undefined,
    year: movie.year || undefined,
    duration: movie.duration || undefined,
    rating: movie.rating || undefined,
    views_count: movie.views_count,
  }));

  // Convert series channels to ContentItem format
  const allSeries: ContentItem[] = seriesChannels.map(channel => ({
    id: channel.id,
    title: channel.name,
    poster_url: channel.logo_url || undefined,
    category: channel.category,
    type: 'TV' as const,
    stream_url: channel.stream_url,
  }));

  // Get top 10 movies by views
  const top10Movies = allMovies.slice(0, 10);

  // Get movies by category
  const movieCategories = [...new Set(movies.map(m => m.category))];
  const moviesByCategory = movieCategories.reduce((acc, category) => {
    acc[category] = allMovies.filter(m => m.category === category);
    return acc;
  }, {} as Record<string, ContentItem[]>);

  // Hero item - top movie or fallback
  const heroItem = top10Movies[0];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Hero Section */}
      {loadingMovies ? (
        <div className="h-[70vh] relative">
          <Skeleton className="absolute inset-0" />
        </div>
      ) : heroItem ? (
        <HeroSection item={heroItem} onPlay={handlePlay} />
      ) : (
        <div className="h-[50vh] flex items-center justify-center">
          <p className="text-muted-foreground">Nenhum conteúdo disponível</p>
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

          {/* Top 10 */}
          {loadingMovies ? (
            <div className="space-y-4">
              <Skeleton className="h-8 w-48" />
              <div className="flex gap-4 overflow-hidden">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="aspect-[2/3] w-40 flex-shrink-0 rounded-lg" />
                ))}
              </div>
            </div>
          ) : top10Movies.length > 0 && (
            <ContentCarousel title="Top 10" items={top10Movies} onPlay={handlePlay} />
          )}

          {/* Movies by Category */}
          {!loadingMovies && movieCategories.slice(0, 3).map((category) => (
            moviesByCategory[category]?.length > 0 && (
              <div key={category} className="mt-8">
                <ContentCarousel
                  title={category}
                  items={moviesByCategory[category]}
                  onPlay={handlePlay}
                />
              </div>
            )
          ))}
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
                onClick={() => scrollChannels(channelsScrollRef, 'left')}
                className="rounded-full"
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => scrollChannels(channelsScrollRef, 'right')}
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
            ref={channelsScrollRef}
            className="flex gap-4 overflow-x-auto scrollbar-hide scroll-smooth"
          >
            {loadingChannels ? (
              Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="aspect-video w-48 flex-shrink-0 rounded-lg" />
              ))
            ) : channels.length > 0 ? (
              channels.map((channel) => (
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
                onClick={() => scrollChannels(seriesScrollRef, 'left')}
                className="rounded-full"
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => scrollChannels(seriesScrollRef, 'right')}
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
            {loadingSeries ? (
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
