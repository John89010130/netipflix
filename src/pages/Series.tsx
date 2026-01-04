import { useState, useEffect, useCallback, useRef } from 'react';
import { Navbar } from '@/components/Navbar';
import { VideoPlayer } from '@/components/VideoPlayer';
import { AdultContentGate, isAdultCategory, isAdultContentVerified } from '@/components/AdultContentGate';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, Search, X, Play, ChevronDown, ChevronUp, Tv } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface Episode {
  id: string;
  name: string;
  category: string;
  stream_url: string;
  logo_url: string | null;
  series_title: string | null;
  season_number: number | null;
  episode_number: number | null;
}

interface SeriesGroup {
  title: string;
  episodes: Episode[];
  seasons: number[];
  poster: string | null;
  category: string;
}

const PAGE_SIZE = 500;

const Series = () => {
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [seriesGroups, setSeriesGroups] = useState<SeriesGroup[]>([]);
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
  const [expandedSeries, setExpandedSeries] = useState<Set<string>>(new Set());
  const [expandedSeasons, setExpandedSeasons] = useState<Set<string>>(new Set());
  const containerRef = useRef<HTMLDivElement>(null);

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

  // Group episodes by series
  useEffect(() => {
    const grouped = new Map<string, SeriesGroup>();
    
    episodes.forEach(ep => {
      // Use series_title if available, otherwise use the full name as title
      const title = ep.series_title || ep.name;
      
      if (!grouped.has(title)) {
        grouped.set(title, {
          title,
          episodes: [],
          seasons: [],
          poster: ep.logo_url,
          category: ep.category,
        });
      }
      
      const group = grouped.get(title)!;
      group.episodes.push(ep);
      
      if (ep.season_number !== null && !group.seasons.includes(ep.season_number)) {
        group.seasons.push(ep.season_number);
      }
    });
    
    // Sort seasons and episodes within each group
    grouped.forEach(group => {
      group.seasons.sort((a, b) => a - b);
      group.episodes.sort((a, b) => {
        if (a.season_number !== b.season_number) {
          return (a.season_number || 0) - (b.season_number || 0);
        }
        return (a.episode_number || 0) - (b.episode_number || 0);
      });
    });
    
    // Convert to array and sort by title
    const groupsArray = Array.from(grouped.values()).sort((a, b) => 
      a.title.localeCompare(b.title)
    );
    
    setSeriesGroups(groupsArray);
  }, [episodes]);

  // Fetch episodes
  const fetchEpisodes = useCallback(async (reset = false, currentLength = 0) => {
    if (reset) {
      setLoading(true);
      setEpisodes([]);
    } else {
      setLoadingMore(true);
    }

    const from = reset ? 0 : currentLength;

    let query = supabase
      .from('channels')
      .select('id, name, category, stream_url, logo_url, series_title, season_number, episode_number')
      .eq('active', true)
      .eq('content_type', 'SERIES')
      .order('series_title', { ascending: true, nullsFirst: false })
      .order('season_number', { ascending: true })
      .order('episode_number', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (selectedCategory !== 'Todos' && selectedCategory !== '🔞 Adulto') {
      query = query.eq('category', selectedCategory);
    }

    if (debouncedSearch) {
      query = query.or(`name.ilike.%${debouncedSearch}%,series_title.ilike.%${debouncedSearch}%`);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching episodes:', error);
      setLoading(false);
      setLoadingMore(false);
      return;
    }
    
    if (data) {
      let filteredData = data as Episode[];
      
      // Filter by adult content
      if (selectedCategory === 'Todos') {
        filteredData = filteredData.filter(c => !isAdultCategory(c.category));
      } else if (selectedCategory === '🔞 Adulto') {
        filteredData = filteredData.filter(c => isAdultCategory(c.category));
      }

      if (reset) {
        setEpisodes(filteredData);
      } else {
        setEpisodes(prev => [...prev, ...filteredData]);
      }
      setHasMore(data.length === PAGE_SIZE);
    }

    setLoading(false);
    setLoadingMore(false);
  }, [selectedCategory, debouncedSearch]);

  // Initial fetch
  useEffect(() => {
    fetchEpisodes(true, 0);
  }, [fetchEpisodes]);

  // Scroll handler for infinite scroll
  const handleScroll = useCallback(() => {
    if (loadingMore || !hasMore) return;

    const scrollTop = window.scrollY;
    const windowHeight = window.innerHeight;
    const documentHeight = document.documentElement.scrollHeight;

    if (scrollTop + windowHeight >= documentHeight - 500) {
      setEpisodes(prev => {
        fetchEpisodes(false, prev.length);
        return prev;
      });
    }
  }, [loadingMore, hasMore, fetchEpisodes]);

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

  const toggleSeries = (title: string) => {
    setExpandedSeries(prev => {
      const next = new Set(prev);
      if (next.has(title)) {
        next.delete(title);
      } else {
        next.add(title);
      }
      return next;
    });
  };

  const toggleSeason = (seriesTitle: string, season: number) => {
    const key = `${seriesTitle}-${season}`;
    setExpandedSeasons(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const playEpisode = (ep: Episode) => {
    setCurrentVideo({
      src: ep.stream_url,
      title: ep.name,
      poster: ep.logo_url || undefined,
    });
  };

  const getEpisodesBySeason = (episodes: Episode[], season: number) => {
    return episodes.filter(ep => ep.season_number === season);
  };

  return (
    <div className="min-h-screen bg-background" ref={containerRef}>
      <Navbar />

      <main className="pt-24 px-4 md:px-12 pb-16">
        {/* Header */}
        <div className="mb-8">
          <h1 className="font-display text-4xl md:text-5xl tracking-wide mb-4">Séries</h1>
          <p className="text-muted-foreground">
            {loading ? 'Carregando...' : `${seriesGroups.length} séries (${episodes.length} episódios)`}
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-32 rounded-lg" />
            ))}
          </div>
        ) : (
          <>
            <div className="space-y-4">
              {seriesGroups.map((series) => (
                <div 
                  key={series.title} 
                  className="bg-card rounded-lg border border-border overflow-hidden"
                >
                  {/* Series Header */}
                  <button
                    onClick={() => toggleSeries(series.title)}
                    className="w-full flex items-center gap-4 p-4 hover:bg-accent/50 transition-colors"
                  >
                    {/* Poster */}
                    <div className="w-16 h-24 flex-shrink-0 bg-muted rounded overflow-hidden">
                      {series.poster ? (
                        <img 
                          src={series.poster} 
                          alt={series.title}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            e.currentTarget.nextElementSibling?.classList.remove('hidden');
                          }}
                        />
                      ) : null}
                      <div className={`w-full h-full flex items-center justify-center ${series.poster ? 'hidden' : ''}`}>
                        <Tv className="h-8 w-8 text-muted-foreground" />
                      </div>
                    </div>
                    
                    {/* Info */}
                    <div className="flex-1 text-left">
                      <h3 className="font-semibold text-lg line-clamp-1">{series.title}</h3>
                      <p className="text-sm text-muted-foreground">
                        {series.seasons.length > 0 
                          ? `${series.seasons.length} temporada${series.seasons.length > 1 ? 's' : ''} • `
                          : ''}
                        {series.episodes.length} episódio{series.episodes.length > 1 ? 's' : ''}
                      </p>
                      <span className="text-xs text-muted-foreground/70">{series.category}</span>
                    </div>
                    
                    {/* Expand icon */}
                    {expandedSeries.has(series.title) ? (
                      <ChevronUp className="h-5 w-5 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-muted-foreground" />
                    )}
                  </button>
                  
                  {/* Expanded content */}
                  {expandedSeries.has(series.title) && (
                    <div className="border-t border-border">
                      {series.seasons.length > 0 ? (
                        // Show by seasons
                        series.seasons.map(season => {
                          const seasonKey = `${series.title}-${season}`;
                          const seasonEpisodes = getEpisodesBySeason(series.episodes, season);
                          
                          return (
                            <div key={seasonKey}>
                              <button
                                onClick={() => toggleSeason(series.title, season)}
                                className="w-full flex items-center justify-between px-4 py-3 bg-accent/30 hover:bg-accent/50 transition-colors"
                              >
                                <span className="font-medium">Temporada {season}</span>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm text-muted-foreground">
                                    {seasonEpisodes.length} ep
                                  </span>
                                  {expandedSeasons.has(seasonKey) ? (
                                    <ChevronUp className="h-4 w-4" />
                                  ) : (
                                    <ChevronDown className="h-4 w-4" />
                                  )}
                                </div>
                              </button>
                              
                              {expandedSeasons.has(seasonKey) && (
                                <div className="divide-y divide-border">
                                  {seasonEpisodes.map(ep => (
                                    <button
                                      key={ep.id}
                                      onClick={() => playEpisode(ep)}
                                      className="w-full flex items-center gap-3 px-6 py-3 hover:bg-accent/30 transition-colors text-left"
                                    >
                                      <Play className="h-4 w-4 text-primary flex-shrink-0" />
                                      <span className="text-sm line-clamp-1">
                                        {ep.episode_number !== null ? `EP ${ep.episode_number} - ` : ''}
                                        {ep.name}
                                      </span>
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })
                      ) : (
                        // No seasons - show all episodes directly
                        <div className="divide-y divide-border">
                          {series.episodes.map(ep => (
                            <button
                              key={ep.id}
                              onClick={() => playEpisode(ep)}
                              className="w-full flex items-center gap-3 px-6 py-3 hover:bg-accent/30 transition-colors text-left"
                            >
                              <Play className="h-4 w-4 text-primary flex-shrink-0" />
                              <span className="text-sm line-clamp-1">{ep.name}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Loading more indicator */}
            {loadingMore && (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            )}

            {/* End of list */}
            {!hasMore && seriesGroups.length > 0 && (
              <p className="text-center text-muted-foreground py-8">
                Todas as {seriesGroups.length} séries carregadas
              </p>
            )}
          </>
        )}

        {!loading && seriesGroups.length === 0 && (
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