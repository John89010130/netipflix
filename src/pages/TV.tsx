import { useState, useEffect, useCallback, useRef } from 'react';
import { Navbar } from '@/components/Navbar';
import { ChannelGroupCard } from '@/components/ChannelGroupCard';
import { VideoPlayer } from '@/components/VideoPlayer';
import { AdultContentGate, isAdultCategory, isAdultContentVerified } from '@/components/AdultContentGate';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, Search, X, Grid, List } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useChannelGroups, Channel, cleanDisplayName } from '@/hooks/useChannelGroups';
import { Button } from '@/components/ui/button';
import { ChannelCard } from '@/components/ChannelCard';

const PAGE_SIZE = 200;

const TV = () => {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [totalChannels, setTotalChannels] = useState(0);
  const [currentVideo, setCurrentVideo] = useState<{ src: string; title: string } | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos');
  const [showAdultGate, setShowAdultGate] = useState(false);
  const [pendingAdultCategory, setPendingAdultCategory] = useState<string | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [viewMode, setViewMode] = useState<'grouped' | 'list'>('grouped');
  const containerRef = useRef<HTMLDivElement>(null);

  // Use channel grouping hook
  const channelGroups = useChannelGroups(channels);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch categories once - only TV content
  useEffect(() => {
    const fetchCategories = async () => {
      const { data, error } = await supabase
        .from('channels')
        .select('category')
        .eq('active', true)
        .eq('content_type', 'TV');

      if (!error && data) {
        const uniqueCategories = [...new Set(data.map(c => c.category))].sort();
        const regularCategories = uniqueCategories.filter(c => !isAdultCategory(c));
        const adultCategories = uniqueCategories.filter(c => isAdultCategory(c));
        setCategories(['Todos', ...regularCategories, ...(adultCategories.length > 0 ? ['🔞 Adulto'] : [])]);
      }
    };

    fetchCategories();
  }, []);

  // Fetch total count - only TV content
  useEffect(() => {
    const fetchCount = async () => {
      let query = supabase
        .from('channels')
        .select('*', { count: 'exact', head: true })
        .eq('active', true)
        .eq('content_type', 'TV');

      if (selectedCategory !== 'Todos' && selectedCategory !== '🔞 Adulto') {
        query = query.eq('category', selectedCategory);
      }

      const { count } = await query;
      setTotalChannels(count || 0);
    };

    fetchCount();
  }, [selectedCategory]);

  // Fetch channels with pagination
  const fetchChannels = useCallback(async (reset = false, currentLength = 0) => {
    if (reset) {
      setLoading(true);
      setChannels([]);
    } else {
      setLoadingMore(true);
    }

    const from = reset ? 0 : currentLength;

    // Fetch only TV content type
    let query = supabase
      .from('channels')
      .select('*')
      .eq('active', true)
      .eq('content_type', 'TV')
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
      
      // Filter for adult/non-adult content only when "Todos" or "Adulto" is selected
      if (selectedCategory === 'Todos') {
        filteredData = filteredData.filter(c => !isAdultCategory(c.category));
      } else if (selectedCategory === '🔞 Adulto') {
        filteredData = filteredData.filter(c => isAdultCategory(c.category));
      }

      // Sort: BR channels first, then alphabetically by cleaned name
      filteredData.sort((a, b) => {
        const aIsBR = a.name.toUpperCase().startsWith('BR:');
        const bIsBR = b.name.toUpperCase().startsWith('BR:');
        if (aIsBR && !bIsBR) return -1;
        if (!aIsBR && bIsBR) return 1;
        return cleanDisplayName(a.name).localeCompare(cleanDisplayName(b.name));
      });

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

  // Initial fetch and refetch on category or search change
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

  const handlePlayChannel = (channel: Channel) => {
    setCurrentVideo({
      src: channel.stream_url,
      title: channel.name,
    });
  };

  return (
    <div className="min-h-screen bg-background" ref={containerRef}>
      <Navbar />

      <main className="pt-24 px-4 md:px-12 pb-16">
        {/* Header */}
        <div className="mb-8">
          <h1 className="font-display text-4xl md:text-5xl tracking-wide mb-4">TV ao Vivo</h1>
          <p className="text-muted-foreground">
            {loading ? 'Carregando...' : `${channelGroups.length} grupos • ${channels.length} canais de ${totalChannels} disponíveis`}
          </p>
        </div>

        {/* Search and View Toggle */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Buscar canais..."
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
          
          <div className="flex gap-2">
            <Button
              variant={viewMode === 'grouped' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('grouped')}
            >
              <Grid className="h-4 w-4 mr-2" />
              Agrupado
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('list')}
            >
              <List className="h-4 w-4 mr-2" />
              Lista
            </Button>
          </div>
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

        {/* Channels Grid */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <Skeleton key={i} className="aspect-video rounded-lg" />
            ))}
          </div>
        ) : (
          <>
            {viewMode === 'grouped' ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {channelGroups.map((group) => (
                  <ChannelGroupCard
                    key={group.groupName}
                    group={group}
                    onPlay={handlePlayChannel}
                  />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {channels.map((channel) => (
                  <ChannelCard
                    key={channel.id}
                    channel={{
                      ...channel,
                      logo_url: channel.logo_url || '',
                    }}
                    onPlay={() => handlePlayChannel(channel)}
                  />
                ))}
              </div>
            )}

            {/* Loading more indicator */}
            {loadingMore && (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            )}

            {/* End of list */}
            {!hasMore && channels.length > 0 && (
              <p className="text-center text-muted-foreground py-8">
                Todos os {channels.length} canais carregados ({channelGroups.length} grupos)
              </p>
            )}
          </>
        )}

        {!loading && channels.length === 0 && (
          <div className="text-center py-16">
            <p className="text-muted-foreground">Nenhum canal encontrado nesta categoria.</p>
          </div>
        )}
      </main>

      {/* Video Player Modal */}
      {currentVideo && (
        <VideoPlayer
          src={currentVideo.src}
          title={currentVideo.title}
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

export default TV;
