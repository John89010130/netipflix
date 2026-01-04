import { useState, useEffect, useCallback } from 'react';
import { Navbar } from '@/components/Navbar';
import { ContentCarousel } from '@/components/ContentCarousel';
import { VideoPlayer } from '@/components/VideoPlayer';
import { supabase } from '@/integrations/supabase/client';
import { ContentItem } from '@/types';
import { Skeleton } from '@/components/ui/skeleton';
import { isAdultCategory } from '@/components/AdultContentGate';
import { Search, X, Loader2 } from 'lucide-react';
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

// Helper to check if category is series-related
const isSeriesCategory = (category: string): boolean => {
  const lower = category.toLowerCase();
  return lower.includes('serie') || lower.includes('netflix') || lower.includes('talk') || lower.includes('reality');
};

const PAGE_SIZE = 200;

const Series = () => {
  const [currentVideo, setCurrentVideo] = useState<{ src: string; title: string; poster?: string } | null>(null);
  const [seriesChannels, setSeriesChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos');
  const [categories, setCategories] = useState<string[]>([]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch categories once
  useEffect(() => {
    const fetchCategories = async () => {
      const { data, error } = await supabase
        .from('channels')
        .select('category')
        .eq('active', true);

      if (!error && data) {
        const uniqueCategories = [...new Set(data.map(c => c.category))]
          .filter(c => isSeriesCategory(c) && !isAdultCategory(c))
          .sort();
        setCategories(['Todos', ...uniqueCategories]);
      }
    };

    fetchCategories();
  }, []);

  // Fetch series
  const fetchSeries = useCallback(async (reset = false) => {
    if (reset) {
      setLoading(true);
      setSeriesChannels([]);
    } else {
      setLoadingMore(true);
    }

    const from = reset ? 0 : seriesChannels.length;

    let query = supabase
      .from('channels')
      .select('*')
      .eq('active', true)
      .order('name')
      .range(from, from + PAGE_SIZE - 1);

    if (debouncedSearch) {
      query = query.ilike('name', `%${debouncedSearch}%`);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching series:', error);
    } else if (data) {
      // Filter for series and non-adult
      let filtered = data.filter(c => isSeriesCategory(c.category) && !isAdultCategory(c.category));
      
      if (selectedCategory !== 'Todos') {
        filtered = filtered.filter(c => c.category === selectedCategory);
      }

      if (reset) {
        setSeriesChannels(filtered);
      } else {
        setSeriesChannels(prev => [...prev, ...filtered]);
      }
      setHasMore(data.length === PAGE_SIZE);
    }

    setLoading(false);
    setLoadingMore(false);
  }, [seriesChannels.length, selectedCategory, debouncedSearch]);

  // Initial fetch and refetch on filter change
  useEffect(() => {
    fetchSeries(true);
  }, [selectedCategory, debouncedSearch]);

  // Scroll handler for infinite scroll
  const handleScroll = useCallback(() => {
    if (loadingMore || !hasMore) return;

    const scrollTop = window.scrollY;
    const windowHeight = window.innerHeight;
    const documentHeight = document.documentElement.scrollHeight;

    if (scrollTop + windowHeight >= documentHeight - 500) {
      fetchSeries(false);
    }
  }, [loadingMore, hasMore, fetchSeries]);

  useEffect(() => {
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  const handlePlay = (item: ContentItem) => {
    setCurrentVideo({
      src: item.stream_url,
      title: item.title,
      poster: item.backdrop_url || item.poster_url,
    });
  };

  // Convert to ContentItem
  const seriesAsContent: ContentItem[] = seriesChannels.map(channel => ({
    id: channel.id,
    title: channel.name,
    poster_url: channel.logo_url || undefined,
    category: channel.category,
    type: 'TV' as const,
    stream_url: channel.stream_url,
  }));

  // Group by category for display
  const seriesCategories = [...new Set(seriesChannels.map(c => c.category))];
  const seriesByCategory = seriesCategories.reduce((acc, category) => {
    acc[category] = seriesAsContent.filter(s => s.category === category);
    return acc;
  }, {} as Record<string, ContentItem[]>);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="pt-24 px-4 md:px-12 pb-16">
        {/* Header */}
        <div className="mb-8">
          <h1 className="font-display text-4xl md:text-5xl tracking-wide mb-4">Séries</h1>
          <p className="text-muted-foreground">
            {loading ? 'Carregando...' : `${seriesChannels.length} séries disponíveis`}
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
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap ${
                selectedCategory === category
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
              }`}
            >
              {category}
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div className="space-y-8">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="space-y-4">
                <Skeleton className="h-8 w-48" />
                <div className="flex gap-4 overflow-hidden">
                  {Array.from({ length: 6 }).map((_, j) => (
                    <Skeleton key={j} className="aspect-video w-48 flex-shrink-0 rounded-lg" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : seriesAsContent.length > 0 ? (
          <div className="space-y-8">
            {selectedCategory === 'Todos' ? (
              // Show by category
              seriesCategories.map((category) => (
                seriesByCategory[category]?.length > 0 && (
                  <ContentCarousel
                    key={category}
                    title={category}
                    items={seriesByCategory[category]}
                    onPlay={handlePlay}
                  />
                )
              ))
            ) : (
              // Show all in selected category
              <ContentCarousel
                title={selectedCategory}
                items={seriesAsContent}
                onPlay={handlePlay}
              />
            )}

            {/* Loading more */}
            {loadingMore && (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            )}

            {/* End of list */}
            {!hasMore && seriesChannels.length > 0 && (
              <p className="text-center text-muted-foreground py-8">
                Todas as {seriesChannels.length} séries carregadas
              </p>
            )}
          </div>
        ) : (
          <div className="text-center py-16">
            <p className="text-muted-foreground">Nenhuma série encontrada.</p>
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

export default Series;
