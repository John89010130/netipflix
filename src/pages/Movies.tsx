import { useState, useEffect } from 'react';
import { Navbar } from '@/components/Navbar';
import { ContentCard } from '@/components/ContentCard';
import { VideoPlayer } from '@/components/VideoPlayer';
import { AdultContentGate, isAdultCategory, isAdultContentVerified, setAdultContentVerified } from '@/components/AdultContentGate';
import { supabase } from '@/integrations/supabase/client';
import { ContentItem } from '@/types';
import { Skeleton } from '@/components/ui/skeleton';

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

const Movies = () => {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentVideo, setCurrentVideo] = useState<{ src: string; title: string; poster?: string } | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos');
  const [showAdultGate, setShowAdultGate] = useState(false);
  const [pendingAdultCategory, setPendingAdultCategory] = useState<string | null>(null);

  useEffect(() => {
    const fetchMovies = async () => {
      const allMovies: Movie[] = [];
      let from = 0;
      const batchSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from('movies')
          .select('*')
          .eq('active', true)
          .order('title')
          .range(from, from + batchSize - 1);

        if (error) {
          console.error('Error fetching movies:', error);
          break;
        }

        if (data && data.length > 0) {
          allMovies.push(...data);
          from += batchSize;
          hasMore = data.length === batchSize;
        } else {
          hasMore = false;
        }
      }

      setMovies(allMovies);
      setLoading(false);
    };

    fetchMovies();
  }, []);

  // Get unique categories, separating adult content
  const regularCategories = [...new Set(movies.filter(m => !isAdultCategory(m.category)).map(m => m.category))].sort();
  const adultCategories = [...new Set(movies.filter(m => isAdultCategory(m.category)).map(m => m.category))].sort();
  
  const allCategories = ['Todos', ...regularCategories, ...(adultCategories.length > 0 ? ['🔞 Adulto'] : [])];

  const handleCategoryClick = (category: string) => {
    if (category === '🔞 Adulto') {
      if (isAdultContentVerified()) {
        setSelectedCategory(category);
      } else {
        setPendingAdultCategory(category);
        setShowAdultGate(true);
      }
    } else {
      setSelectedCategory(category);
    }
  };

  const handleAdultGateSuccess = () => {
    setShowAdultGate(false);
    if (pendingAdultCategory) {
      setSelectedCategory(pendingAdultCategory);
      setPendingAdultCategory(null);
    }
  };

  const filteredMovies = (() => {
    if (selectedCategory === 'Todos') {
      return movies.filter(m => !isAdultCategory(m.category));
    }
    if (selectedCategory === '🔞 Adulto') {
      return movies.filter(m => isAdultCategory(m.category));
    }
    return movies.filter(m => m.category === selectedCategory);
  })();

  const handlePlay = (item: ContentItem) => {
    setCurrentVideo({
      src: item.stream_url,
      title: item.title,
      poster: item.backdrop_url || item.poster_url,
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="pt-24 px-4 md:px-12 pb-16">
        {/* Header */}
        <div className="mb-8">
          <h1 className="font-display text-4xl md:text-5xl tracking-wide mb-4">Filmes</h1>
          <p className="text-muted-foreground">
            {loading ? 'Carregando...' : `${movies.filter(m => !isAdultCategory(m.category)).length} filmes disponíveis`}
          </p>
        </div>

        {/* Category Filter */}
        <div className="flex gap-2 mb-8 overflow-x-auto scrollbar-hide pb-2">
          {loading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-24 rounded-full flex-shrink-0" />
            ))
          ) : (
            allCategories.map((category) => (
              <button
                key={category}
                onClick={() => handleCategoryClick(category)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap ${
                  selectedCategory === category
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                }`}
              >
                {category}
              </button>
            ))
          )}
        </div>

        {/* Movies Grid */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <Skeleton key={i} className="aspect-[2/3] rounded-lg" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {filteredMovies.map((movie) => {
              const item: ContentItem = {
                id: movie.id,
                title: movie.title,
                poster_url: movie.poster_url || undefined,
                backdrop_url: movie.backdrop_url || undefined,
                category: movie.category,
                type: 'MOVIE',
                stream_url: movie.stream_url,
                description: movie.description || undefined,
                year: movie.year || undefined,
                duration: movie.duration || undefined,
                rating: movie.rating || undefined,
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
        )}

        {!loading && filteredMovies.length === 0 && (
          <div className="text-center py-16">
            <p className="text-muted-foreground">Nenhum filme encontrado nesta categoria.</p>
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

      {/* Adult Content Gate */}
      <AdultContentGate
        isOpen={showAdultGate}
        onClose={() => {
          setShowAdultGate(false);
          setPendingAdultCategory(null);
        }}
        onSuccess={handleAdultGateSuccess}
      />
    </div>
  );
};

export default Movies;
