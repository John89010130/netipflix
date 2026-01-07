import { useState, useRef, useEffect } from 'react';
import { Navbar } from '@/components/Navbar';
import { HeroSection } from '@/components/HeroSection';
import { ContentCarousel } from '@/components/ContentCarousel';
import { ChannelCard } from '@/components/ChannelCard';
import { VideoPlayer } from '@/components/VideoPlayer';
import { ContentDetailModal } from '@/components/ContentDetailModal';
import { SeriesDetailModal } from '@/components/SeriesDetailModal';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Tv, Film, PlayCircle, History } from 'lucide-react';
import { ContentItem } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { isAdultCategory } from '@/components/AdultContentGate';
import { Skeleton } from '@/components/ui/skeleton';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

interface Channel {
  id: string;
  name: string;
  category: string;
  country: string;
  logo_url: string | null;
  stream_url: string;
  active: boolean;
  content_type: string;
  series_title?: string | null;
  created_at?: string;
}

interface WatchHistoryItem {
  content_id: string;
  content_type: string;
  watched_at: string;
  progress?: number;
}

interface SeriesEpisode {
  id: string;
  name: string;
  stream_url: string;
  poster?: string;
  season: number;
  episode: number;
}

const Index = () => {
  const { user } = useAuth();
  const [currentVideo, setCurrentVideo] = useState<{ 
    src: string; 
    title: string; 
    poster?: string; 
    contentId?: string; 
    contentType?: 'TV' | 'MOVIE' | 'SERIES';
    nextEpisode?: SeriesEpisode | null;
    allEpisodes?: SeriesEpisode[];
    currentEpisodeIndex?: number;
  } | null>(null);
  const [selectedContent, setSelectedContent] = useState<ContentItem | null>(null);
  const [selectedSeries, setSelectedSeries] = useState<ContentItem | null>(null);
  const [tvChannels, setTVChannels] = useState<Channel[]>([]);
  const [filmChannels, setFilmChannels] = useState<Channel[]>([]);
  const [seriesChannels, setSeriesChannels] = useState<Channel[]>([]);
  const [heroItems, setHeroItems] = useState<ContentItem[]>([]);
  const [recentlyWatched, setRecentlyWatched] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const tvScrollRef = useRef<HTMLDivElement>(null);
  const seriesScrollRef = useRef<HTMLDivElement>(null);

  // Fetch recently watched content
  useEffect(() => {
    const fetchRecentlyWatched = async () => {
      if (!user?.id) return;

      try {
        // Fetch watch history
        const { data: historyData, error: historyError } = await supabase
          .from('watch_history')
          .select('content_id, content_type, watched_at, progress')
          .eq('user_id', user.id)
          .order('watched_at', { ascending: false })
          .limit(20);

        if (historyError) {
          console.error('Error fetching watch history:', historyError);
          return;
        }

        if (!historyData || historyData.length === 0) return;

        // Get unique content IDs
        const contentIds = historyData.map(h => h.content_id);

        // Fetch channel details
        const { data: channelsData, error: channelsError } = await supabase
          .from('channels')
          .select('*')
          .in('id', contentIds);

        if (channelsError) {
          console.error('Error fetching channels for history:', channelsError);
          return;
        }

        if (!channelsData) return;

        // Create maps for quick lookup
        const channelMap = new Map(channelsData.map(c => [c.id, c]));
        const progressMap = new Map((historyData as WatchHistoryItem[]).map(h => [h.content_id, h.progress || 0]));

        // Group by series_title (for series) or keep as-is (for movies/tv)
        const seenSeries = new Set<string>();
        const recentItems: ContentItem[] = [];

        for (const history of historyData as WatchHistoryItem[]) {
          const channel = channelMap.get(history.content_id);
          if (!channel) continue;

          // Skip adult content
          if (isAdultCategory(channel.category)) continue;

          // For series, group by series_title
          if (channel.content_type === 'SERIES' && channel.series_title) {
            if (seenSeries.has(channel.series_title)) continue;
            seenSeries.add(channel.series_title);

            recentItems.push({
              id: channel.id,
              title: channel.series_title,
              poster_url: channel.logo_url || undefined,
              category: channel.category,
              type: 'MOVIE' as const,
              stream_url: channel.stream_url,
              progress: progressMap.get(channel.id) || 0,
            });
          } else {
            recentItems.push({
              id: channel.id,
              title: channel.name,
              poster_url: channel.logo_url || undefined,
              category: channel.category,
              type: channel.content_type === 'TV' ? 'TV' : 'MOVIE',
              stream_url: channel.stream_url,
              progress: progressMap.get(channel.id) || 0,
            });
          }

          if (recentItems.length >= 15) break;
        }

        setRecentlyWatched(recentItems);
      } catch (error) {
        console.error('Error in fetchRecentlyWatched:', error);
      }
    };

    fetchRecentlyWatched();
  }, [user?.id]);

  useEffect(() => {
    const fetchAllChannels = async () => {
      setLoading(true);
      
      try {
        // Fetch newest movies for hero banner - extract year from name
        const { data: newestMovies, error: heroError } = await supabase
          .from('active_channels' as any)
          .select('*')
          .eq('content_type', 'MOVIE')
          .limit(500);

        if (!heroError && newestMovies) {
          const safeHeroMovies = (newestMovies as unknown as Channel[])
            .filter(c => !isAdultCategory(c.category))
            .map(movie => {
              // Extract year from name pattern "Title (YYYY)"
              const yearMatch = movie.name.match(/\((\d{4})\)/);
              const extractedYear = yearMatch ? parseInt(yearMatch[1]) : 0;
              return { ...movie, extractedYear };
            })
            .sort((a, b) => b.extractedYear - a.extractedYear)
            .slice(0, 5);

          const heroContent: ContentItem[] = safeHeroMovies.map(channel => ({
            id: channel.id,
            title: channel.name,
            poster_url: channel.logo_url || undefined,
            category: channel.category,
            type: 'MOVIE' as const,
            stream_url: channel.stream_url,
          }));

          setHeroItems(heroContent);
        }

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

        console.log('Fetched channels from active_channels view:', data?.length || 0);

        if (data && data.length > 0) {
          // Cast data to Channel array
          const channels = data as unknown as Channel[];
          
          // Filter out adult content
          const safeChannels = channels.filter(c => !isAdultCategory(c.category));
          
          console.log('Safe channels after adult filter:', safeChannels.length);
          
          // Separate by content_type
          const films = safeChannels.filter(c => c.content_type === 'MOVIE');
          const series = safeChannels.filter(c => c.content_type === 'SERIES');
          const tv = safeChannels.filter(c => c.content_type === 'TV');
          
          console.log('Distribution:', { films: films.length, series: series.length, tv: tv.length });
          
          setFilmChannels(films.slice(0, 50));
          setSeriesChannels(series.slice(0, 50));
          setTVChannels(tv.slice(0, 50));
        } else {
          console.warn('No channels found in active_channels view');
          // Reset arrays to empty
          setFilmChannels([]);
          setSeriesChannels([]);
          setTVChannels([]);
        }
      } catch (error) {
        console.error('Unexpected error fetching channels:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAllChannels();
    
    // Set up realtime subscription to reload when channels change
    const channelSubscription = supabase
      .channel('channels-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'channels'
        },
        (payload) => {
          console.log('Channels table changed, reloading...', payload);
          fetchAllChannels();
        }
      )
      .subscribe();
    
    return () => {
      channelSubscription.unsubscribe();
    };
  }, []);

  const handlePlay = (item: ContentItem) => {
    setCurrentVideo({
      src: item.stream_url,
      title: item.title,
      poster: item.backdrop_url || item.poster_url,
      contentId: item.id,
      contentType: item.type as 'TV' | 'MOVIE' | 'SERIES',
    });
  };

  const handleMoreInfo = (item: ContentItem) => {
    // Check if it's a series based on content type or title pattern
    const isSeries = item.type === 'MOVIE' && (
      item.title.match(/[Ss]\d+[Ee]\d+/) ||
      item.category?.toLowerCase().includes('série') ||
      item.category?.toLowerCase().includes('series')
    );
    
    if (isSeries) {
      setSelectedSeries(item);
    } else {
      setSelectedContent(item);
    }
  };

  const handlePlayChannel = (channel: Channel) => {
    setCurrentVideo({
      src: channel.stream_url,
      title: channel.name,
      contentId: channel.id,
      contentType: (channel.content_type as 'TV' | 'MOVIE' | 'SERIES') || 'TV',
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

  // Check if there's no content at all

  // Check if there's no content at all
  const hasNoContent = filmChannels.length === 0 && seriesChannels.length === 0 && tvChannels.length === 0;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Hero Section */}
      {loading ? (
        <div className="h-[70vh] relative">
          <Skeleton className="absolute inset-0" />
        </div>
      ) : hasNoContent ? (
        <div className="h-[50vh] flex items-center justify-center bg-gradient-to-b from-muted to-background">
          <div className="text-center max-w-md px-4">
            <Tv className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">Nenhum conteúdo disponível</h2>
            <p className="text-muted-foreground mb-4">
              Nenhuma lista M3U está ativa. Vá ao Admin para ativar listas ou importar novo conteúdo.
            </p>
            <Link to="/admin">
              <Button>
                Ir para Admin
              </Button>
            </Link>
          </div>
        </div>
      ) : heroItems.length > 0 ? (
        <HeroSection items={heroItems} onPlay={handlePlay} onMoreInfo={setSelectedContent} />
      ) : (
        <div className="h-[50vh] flex items-center justify-center bg-gradient-to-b from-muted to-background">
          <p className="text-muted-foreground">Sem destaque disponível</p>
        </div>
      )}

      <main className="relative z-10 px-4 md:px-12 space-y-12 pb-16 pt-8">
        {/* ========== ASSISTIDO RECENTEMENTE ========== */}
        {!loading && recentlyWatched.length > 0 && (
          <section>
            <ContentCarousel
              title="Assistido Recentemente"
              items={recentlyWatched}
              onPlay={handlePlay}
              onMoreInfo={handleMoreInfo}
            />
          </section>
        )}

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
              {/* By Category */}
              {filmCategories.slice(0, 2).map((category) => (
                filmsByCategory[category]?.length > 0 && (
                  <ContentCarousel
                    key={category}
                    title={category}
                    items={filmsByCategory[category]}
                    onPlay={handlePlay}
                    onMoreInfo={handleMoreInfo}
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

      {/* Content Detail Modal */}
      {selectedContent && (
        <ContentDetailModal
          item={selectedContent}
          onClose={() => setSelectedContent(null)}
          onPlay={(item) => {
            setSelectedContent(null);
            handlePlay(item);
          }}
        />
      )}

      {/* Series Detail Modal */}
      {selectedSeries && (
        <SeriesDetailModal
          item={selectedSeries}
          onClose={() => setSelectedSeries(null)}
          onPlay={async (episode) => {
            setSelectedSeries(null);
            
            // Parse episode info from the name
            const seasonMatch = episode.name.match(/[Ss](\d+)/);
            const episodeMatch = episode.name.match(/[Ss]\d+\s*[Ee](\d+)/);
            const currentSeason = seasonMatch ? parseInt(seasonMatch[1]) : 1;
            const currentEpisode = episodeMatch ? parseInt(episodeMatch[1]) : 1;
            
            // Fetch all episodes of this series to determine next episode
            const seriesTitle = selectedSeries.title.replace(/\s*\(\d{4}\)\s*/, '').replace(/\s*[Ss]\d+[Ee]\d+.*$/, '').trim();
            
            const { data: allEpisodes } = await supabase
              .from('active_channels' as any)
              .select('id, name, stream_url, logo_url, season_number, episode_number, series_title')
              .eq('content_type', 'SERIES')
              .or(`series_title.ilike.%${seriesTitle}%,name.ilike.%${seriesTitle}%`)
              .limit(500);
            
            let nextEpisode: SeriesEpisode | null = null;
            let allEpisodesList: SeriesEpisode[] = [];
            
            if (allEpisodes) {
              // Parse and deduplicate episodes
              const parsed = (allEpisodes as any[]).map(ep => {
                const sMatch = ep.name.match(/[Ss](\d+)/);
                const eMatch = ep.name.match(/[Ss]\d+\s*[Ee](\d+)/);
                return {
                  id: ep.id,
                  name: ep.name,
                  stream_url: ep.stream_url,
                  poster: ep.logo_url,
                  season: sMatch ? parseInt(sMatch[1]) : 1,
                  episode: eMatch ? parseInt(eMatch[1]) : 999,
                };
              });
              
              // Deduplicate and sort
              const uniqueMap = new Map<string, SeriesEpisode>();
              parsed.forEach(ep => {
                const key = `S${ep.season}E${ep.episode}`;
                if (!uniqueMap.has(key)) uniqueMap.set(key, ep);
              });
              
              allEpisodesList = Array.from(uniqueMap.values()).sort((a, b) => {
                if (a.season !== b.season) return a.season - b.season;
                return a.episode - b.episode;
              });
              
              // Find current and next episode
              const currentIndex = allEpisodesList.findIndex(
                ep => ep.season === currentSeason && ep.episode === currentEpisode
              );
              
              if (currentIndex >= 0 && currentIndex < allEpisodesList.length - 1) {
                nextEpisode = allEpisodesList[currentIndex + 1];
              }
            }
            
            setCurrentVideo({
              src: episode.stream_url,
              title: episode.name,
              poster: episode.poster,
              contentId: episode.id,
              contentType: 'SERIES',
              nextEpisode,
              allEpisodes: allEpisodesList,
              currentEpisodeIndex: allEpisodesList.findIndex(
                ep => ep.season === currentSeason && ep.episode === currentEpisode
              ),
            });
          }}
        />
      )}

      {/* Video Player Modal */}
      {currentVideo && (
        <VideoPlayer
          src={currentVideo.src}
          title={currentVideo.title}
          poster={currentVideo.poster}
          contentId={currentVideo.contentId}
          contentType={currentVideo.contentType}
          onClose={() => setCurrentVideo(null)}
          nextEpisode={currentVideo.nextEpisode}
          onPlayNext={(nextEp) => {
            if (currentVideo.allEpisodes) {
              const nextIndex = currentVideo.allEpisodes.findIndex(
                ep => ep.id === nextEp.id
              );
              const futureEpisode = nextIndex < currentVideo.allEpisodes.length - 1 
                ? currentVideo.allEpisodes[nextIndex + 1] 
                : null;
              
              setCurrentVideo({
                src: nextEp.stream_url,
                title: nextEp.name,
                poster: nextEp.poster,
                contentId: nextEp.id,
                contentType: 'SERIES',
                nextEpisode: futureEpisode,
                allEpisodes: currentVideo.allEpisodes,
                currentEpisodeIndex: nextIndex,
              });
            }
          }}
        />
      )}
    </div>
  );
};

export default Index;
