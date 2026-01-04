import { useState, useEffect, useCallback, useRef } from 'react';
import { Navbar } from '@/components/Navbar';
import { ContentCard } from '@/components/ContentCard';
import { VideoPlayer } from '@/components/VideoPlayer';
import { AdultContentGate, isAdultCategory, isAdultContentVerified } from '@/components/AdultContentGate';
import { supabase } from '@/integrations/supabase/client';
import { ContentItem } from '@/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2 } from 'lucide-react';

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

const PAGE_SIZE = 100;

const Movies = () => {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [totalMovies, setTotalMovies] = useState(0);
  const [currentVideo, setCurrentVideo] = useState<{ src: string; title: string; poster?: string } | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos');
  const [showAdultGate, setShowAdultGate] = useState(false);
  const [pendingAdultCategory, setPendingAdultCategory] = useState<string | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fetch categories once
  useEffect(() => {
    const fetchCategories = async () => {
      const { data, error } = await supabase
        .from('movies')
        .select('category')
        .eq('active', true);

      if (!error && data) {
        const uniqueCategories = [...new Set(data.map(m => m.category))].sort();
        const regularCategories = uniqueCategories.filter(c => !isAdultCategory(c));
        const adultCategories = uniqueCategories.filter(c => isAdultCategory(c));
        setCategories(['Todos', ...regularCategories, ...(adultCategories.length > 0 ? ['🔞 Adulto'] : [])]);
      }
    };

    fetchCategories();
  }, []);

  // Fetch total count
  useEffect(() => {
    const fetchCount = async () => {
      let query = supabase
        .from('movies')
        .select('*', { count: 'exact', head: true })
        .eq('active', true);

      if (selectedCategory !== 'Todos' && selectedCategory !== '🔞 Adulto') {
        query = query.eq('category', selectedCategory);
      }

      const { count } = await query;
      setTotalMovies(count || 0);
    };

    fetchCount();
  }, [selectedCategory]);

  // Fetch movies with pagination
  const fetchMovies = useCallback(async (reset = false) => {
    if (reset) {
      setLoading(true);
      setMovies([]);
    } else {
      setLoadingMore(true);
    }

    const from = reset ? 0 : movies.length;

    let query = supabase
      .from('movies')
      .select('*')
      .eq('active', true)
      .order('title')
      .range(from, from + PAGE_SIZE - 1);

    if (selectedCategory !== 'Todos' && selectedCategory !== '🔞 Adulto') {
      query = query.eq('category', selectedCategory);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching movies:', error);
    } else if (data) {
      let filteredData = data;
      
      // Filter for adult/non-adult content
      if (selectedCategory === 'Todos') {
        filteredData = data.filter(m => !isAdultCategory(m.category));
      } else if (selectedCategory === '🔞 Adulto') {
        filteredData = data.filter(m => isAdultCategory(m.category));
      }

      if (reset) {
        setMovies(filteredData);
      } else {
        setMovies(prev => [...prev, ...filteredData]);
      }
      setHasMore(data.length === PAGE_SIZE);
    }

    setLoading(false);
    setLoadingMore(false);
  }, [movies.length, selectedCategory]);

  // Initial fetch and refetch on category change
  useEffect(() => {
    fetchMovies(true);
  }, [selectedCategory]);

  // Scroll handler for infinite scroll
  const handleScroll = useCallback(() => {
    if (loadingMore || !hasMore) return;

    const scrollTop = window.scrollY;
    const windowHeight = window.innerHeight;
    const documentHeight = document.documentElement.scrollHeight;

    if (scrollTop + windowHeight >= documentHeight - 500) {
      fetchMovies(false);
    }
  }, [loadingMore, hasMore, fetchMovies]);

  useEffect(() => {
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

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

  const handlePlay = (item: ContentItem) => {
    setCurrentVideo({
      src: item.stream_url,
      title: item.title,
      poster: item.backdrop_url || item.poster_url,
    });
  };

  return (
    <div className="min-h-screen bg-background" ref={containerRef}>
      <Navbar />

      <main className="pt-24 px-4 md:px-12 pb-16">
        {/* Header */}
        <div className="mb-8">
          <h1 className="font-display text-4xl md:text-5xl tracking-wide mb-4">Filmes</h1>
          <p className="text-muted-foreground">
            {loading ? 'Carregando...' : `${movies.length} de ${totalMovies} filmes`}
          </p>
        </div>

        {/* Category Filter */}
        <div className="flex gap-2 mb-8 overflow-x-auto scrollbar-hide pb-2">
          {loading && categories.length === 0 ? (
            Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-24 rounded-full flex-shrink-0" />
            ))
          ) : (
            categories.map((category) => (
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
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {movies.map((movie) => {
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

            {/* Loading more indicator */}
            {loadingMore && (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            )}

            {/* End of list */}
            {!hasMore && movies.length > 0 && (
              <p className="text-center text-muted-foreground py-8">
                Todos os {movies.length} filmes carregados
              </p>
            )}
          </>
        )}

        {!loading && movies.length === 0 && (
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
