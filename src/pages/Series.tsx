import { useState, useEffect, useCallback, useRef } from 'react';
import { Navbar } from '@/components/Navbar';
import { ContentCard } from '@/components/ContentCard';
import { VideoPlayer } from '@/components/VideoPlayer';
import { AdultContentGate, isAdultCategory, isAdultContentVerified } from '@/components/AdultContentGate';
import { supabase } from '@/integrations/supabase/client';
import { ContentItem } from '@/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';

interface Channel {
  id: string;
  name: string;
  category: string;
  country: string;
  logo_url: string | null;
  stream_url: string;
  active: boolean;
}

const PAGE_SIZE = 300;

const Series = () => {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [currentVideo, setCurrentVideo] = useState<{ src: string; title: string; poster?: string } | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos');
  const [showAdultGate, setShowAdultGate] = useState(false);
  const [pendingAdultCategory, setPendingAdultCategory] = useState<string | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch categories once - only SERIES content
  useEffect(() => {
    const fetchCategories = async () => {
      const { data, error } = await supabase
        .from('channels')
        .select('category')
        .eq('active', true)
        .eq('content_type', 'SERIES');

      if (!error && data) {
        const uniqueCategories = [...new Set(data.map(c => c.category))].sort();
        const regularCategories = uniqueCategories.filter(c => !isAdultCategory(c));
        const adultCategories = uniqueCategories.filter(c => isAdultCategory(c));
        setCategories(['Todos', ...regularCategories, ...(adultCategories.length > 0 ? ['🔞 Adulto'] : [])]);
      }
    };

    fetchCategories();
  }, []);

  // Fetch channels - only SERIES content
  const fetchChannels = useCallback(async (reset = false, currentLength = 0) => {
    if (reset) {
      setLoading(true);
      setChannels([]);
    } else {
      setLoadingMore(true);
    }

    const from = reset ? 0 : currentLength;

    let query = supabase
      .from('channels')
      .select('*')
      .eq('active', true)
      .eq('content_type', 'SERIES')
      .order('name')
      .range(from, from + PAGE_SIZE - 1);

    if (selectedCategory !== 'Todos' && selectedCategory !== '🔞 Adulto') {
      query = query.eq('category', selectedCategory);
    }

    if (debouncedSearch) {
      query = query.ilike('name', `%${debouncedSearch}%`);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching channels:', error);
      setLoading(false);
      setLoadingMore(false);
      return;
    }
    
    if (data) {
      let filteredData = data as Channel[];
      
      // Filter by adult content
      if (selectedCategory === 'Todos') {
        filteredData = filteredData.filter(c => !isAdultCategory(c.category));
      } else if (selectedCategory === '🔞 Adulto') {
        filteredData = filteredData.filter(c => isAdultCategory(c.category));
      }

      if (reset) {
        setChannels(filteredData);
      } else {
        setChannels(prev => [...prev, ...filteredData]);
      }
      setHasMore(data.length === PAGE_SIZE);
    }

    setLoading(false);
    setLoadingMore(false);
  }, [selectedCategory, debouncedSearch]);

  // Initial fetch
  useEffect(() => {
    fetchChannels(true, 0);
  }, [fetchChannels]);

  // Scroll handler for infinite scroll
  const handleScroll = useCallback(() => {
    if (loadingMore || !hasMore) return;

    const scrollTop = window.scrollY;
    const windowHeight = window.innerHeight;
    const documentHeight = document.documentElement.scrollHeight;

    if (scrollTop + windowHeight >= documentHeight - 500) {
      setChannels(prev => {
        fetchChannels(false, prev.length);
        return prev;
      });
    }
  }, [loadingMore, hasMore, fetchChannels]);

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
          <h1 className="font-display text-4xl md:text-5xl tracking-wide mb-4">Séries</h1>
          <p className="text-muted-foreground">
            {loading ? 'Carregando...' : `${channels.length} séries disponíveis`}
          </p>
        </div>

        {/* Search */}
        <div className="relative mb-6 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Buscar séries..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 pr-10"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
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

        {/* Series Grid */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <Skeleton key={i} className="aspect-[2/3] rounded-lg" />
            ))}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {channels.map((channel) => {
                const item: ContentItem = {
                  id: channel.id,
                  title: channel.name,
                  poster_url: channel.logo_url || undefined,
                  category: channel.category,
                  type: 'TV',
                  stream_url: channel.stream_url,
                };
                return (
                  <ContentCard
                    key={channel.id}
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
            {!hasMore && channels.length > 0 && (
              <p className="text-center text-muted-foreground py-8">
                Todas as {channels.length} séries carregadas
              </p>
            )}
          </>
        )}

        {!loading && channels.length === 0 && (
          <div className="text-center py-16">
            <p className="text-muted-foreground">Nenhuma série encontrada nesta categoria.</p>
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

export default Series;
