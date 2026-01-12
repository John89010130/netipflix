import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Navbar } from '@/components/Navbar';
import { ContentCard } from '@/components/ContentCard';
import { ChannelCard } from '@/components/ChannelCard';
import { VideoPlayer } from '@/components/VideoPlayer';
import { ContentDetailModal } from '@/components/ContentDetailModal';
import { SeriesDetailModal } from '@/components/SeriesDetailModal';
import { supabase } from '@/integrations/supabase/client';
import { isAdultCategory } from '@/components/AdultContentGate';
import { Skeleton } from '@/components/ui/skeleton';
import { Search as SearchIcon, Film, Tv, PlayCircle, ChevronDown, ChevronUp, Play } from 'lucide-react';
import { ContentItem } from '@/types';
import { cn } from '@/lib/utils';
import { filterByAllWords } from '@/utils/searchUtils';

interface Channel {
  id: string;
  name: string;
  category: string;
  country: string;
  logo_url: string | null;
  stream_url: string;
  content_type: string;
  series_title?: string | null;
  season_number?: number | null;
  episode_number?: number | null;
}

interface SeriesGroup {
  seriesTitle: string;
  category: string;
  poster: string | null;
  episodes: Channel[];
  seasons: number[];
}

// Parse episode number from name if not in database
const parseEpisodeNumber = (name: string, dbEpisodeNum: number | null): number => {
  if (dbEpisodeNum && dbEpisodeNum > 0) return dbEpisodeNum;
  
  // Try to extract from patterns like "S01E09", "E09", "Ep 09", "Episode 9"
  const patterns = [
    /[Ss]\d+[Ee](\d+)/,      // S01E09
    /[Ee][Pp]?\s*(\d+)/i,    // E09, Ep09, Ep 09
    /[Ee]pisode\s*(\d+)/i,   // Episode 9
    /\s(\d{1,3})\s*[-–]\s*/  // " 09 - Title"
  ];
  
  for (const pattern of patterns) {
    const match = name.match(pattern);
    if (match) {
      return parseInt(match[1], 10);
    }
  }
  
  return 999; // Default for unknown ordering
};

const parseSeasonNumber = (name: string, dbSeasonNum: number | null): number => {
  if (dbSeasonNum && dbSeasonNum > 0) return dbSeasonNum;
  
  const match = name.match(/[Ss](\d+)/);
  if (match) {
    return parseInt(match[1], 10);
  }
  
  return 1; // Default to season 1
};

const Search = () => {
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q') || '';
  
  const [results, setResults] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedSeries, setExpandedSeries] = useState<string | null>(null);
  const [expandedSeason, setExpandedSeason] = useState<number | null>(null);
  const [currentVideo, setCurrentVideo] = useState<{ 
    src: string; 
    title: string; 
    poster?: string;
    contentId?: string;
    contentType?: 'TV' | 'MOVIE' | 'SERIES';
  } | null>(null);

  const searchContent = useCallback(async () => {
    if (!query.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    // Buscar pela primeira palavra no banco
    const words = query.trim().split(/\s+/).filter(w => w.length > 0);
    let dbQuery = supabase
      .from('active_channels' as any)
      .select('*')
      .limit(500);
    
    if (words.length > 0) {
      dbQuery = dbQuery.or(`name.ilike.%${words[0]}%,series_title.ilike.%${words[0]}%,category.ilike.%${words[0]}%`);
    }

    const { data, error } = await dbQuery;

    if (error) {
      console.error('Search error:', error);
      setLoading(false);
      return;
    }

    // Filtrar por todas as palavras do lado do cliente
    let filteredData = (data as unknown as Channel[]);
    if (query.trim()) {
      filteredData = filterByAllWords(filteredData, query, ['name', 'series_title', 'category']);
    }
    
    // Filter adult content
    const safeResults = filteredData.filter(c => !isAdultCategory(c.category));

    setResults(safeResults);
    setLoading(false);
  }, [query]);

  useEffect(() => {
    searchContent();
  }, [searchContent]);

  useEffect(() => {
    // Reset expanded state when query changes
    setExpandedSeries(null);
    setExpandedSeason(null);
  }, [query]);

  const handlePlay = (channel: Channel) => {
    setCurrentVideo({
      src: channel.stream_url,
      title: channel.name,
      poster: channel.logo_url || undefined,
      contentId: channel.id,
      contentType: channel.content_type as 'TV' | 'MOVIE' | 'SERIES',
    });
  };

  // Group results by content type
  const tvResults = results.filter(r => r.content_type === 'TV');
  const movieResults = results.filter(r => r.content_type === 'MOVIE');
  const seriesResults = results.filter(r => r.content_type === 'SERIES');

  // Group series by series_title
  const groupedSeries: SeriesGroup[] = [];
  const seriesMap = new Map<string, SeriesGroup>();

  seriesResults.forEach(episode => {
    const title = episode.series_title || episode.name;
    
    if (!seriesMap.has(title)) {
      seriesMap.set(title, {
        seriesTitle: title,
        category: episode.category,
        poster: episode.logo_url,
        episodes: [],
        seasons: [],
      });
    }

    const group = seriesMap.get(title)!;
    group.episodes.push(episode);
    
    // Parse season from name if not in DB
    const parsedSeason = parseSeasonNumber(episode.name, episode.season_number);
    if (parsedSeason && !group.seasons.includes(parsedSeason)) {
      group.seasons.push(parsedSeason);
    }
  });

  seriesMap.forEach(group => {
    group.seasons.sort((a, b) => a - b);
    group.episodes.sort((a, b) => {
      const seasonA = parseSeasonNumber(a.name, a.season_number);
      const seasonB = parseSeasonNumber(b.name, b.season_number);
      if (seasonA !== seasonB) return seasonA - seasonB;
      const epA = parseEpisodeNumber(a.name, a.episode_number);
      const epB = parseEpisodeNumber(b.name, b.episode_number);
      return epA - epB;
    });
    groupedSeries.push(group);
  });

  const handleSeriesClick = (seriesTitle: string) => {
    if (expandedSeries === seriesTitle) {
      setExpandedSeries(null);
      setExpandedSeason(null);
    } else {
      setExpandedSeries(seriesTitle);
      // Auto-expand first season
      const series = groupedSeries.find(s => s.seriesTitle === seriesTitle);
      if (series && series.seasons.length > 0) {
        setExpandedSeason(series.seasons[0]);
      } else {
        setExpandedSeason(null);
      }
    }
  };

  const getEpisodesForSeason = (series: SeriesGroup, season: number) => {
    return series.episodes
      .filter(ep => parseSeasonNumber(ep.name, ep.season_number) === season)
      .sort((a, b) => {
        const epA = parseEpisodeNumber(a.name, a.episode_number);
        const epB = parseEpisodeNumber(b.name, b.episode_number);
        return epA - epB;
      });
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="pt-24 px-4 md:px-12 pb-16">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <SearchIcon className="h-6 w-6 text-primary" />
            <h1 className="font-display text-3xl md:text-4xl tracking-wide">
              Resultados para "{query}"
            </h1>
          </div>
          <p className="text-muted-foreground">
            {loading ? 'Buscando...' : `${movieResults.length + groupedSeries.length + tvResults.length} resultados encontrados`}
          </p>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <Skeleton key={i} className="aspect-video rounded-lg" />
            ))}
          </div>
        ) : results.length === 0 ? (
          <div className="text-center py-16">
            <SearchIcon className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <p className="text-xl text-muted-foreground">
              Nenhum resultado encontrado para "{query}"
            </p>
            <p className="text-muted-foreground mt-2">
              Tente buscar por outro termo
            </p>
          </div>
        ) : (
          <div className="space-y-12">
            {/* Movies */}
            {movieResults.length > 0 && (
              <section>
                <div className="flex items-center gap-3 mb-6">
                  <Film className="h-5 w-5 text-primary" />
                  <h2 className="text-xl font-semibold">Filmes ({movieResults.length})</h2>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                  {movieResults.map((channel) => {
                    const item: ContentItem = {
                      id: channel.id,
                      title: channel.name,
                      poster_url: channel.logo_url || undefined,
                      category: channel.category,
                      type: 'MOVIE',
                      stream_url: channel.stream_url,
                    };
                    return (
                      <ContentCard
                        key={channel.id}
                        item={item}
                        onPlay={() => handlePlay(channel)}
                      />
                    );
                  })}
                </div>
              </section>
            )}

            {/* Series - Grouped */}
            {groupedSeries.length > 0 && (
              <section>
                <div className="flex items-center gap-3 mb-6">
                  <PlayCircle className="h-5 w-5 text-primary" />
                  <h2 className="text-xl font-semibold">Séries ({groupedSeries.length})</h2>
                </div>
                <div className="space-y-4">
                  {groupedSeries.map((series) => (
                    <div 
                      key={series.seriesTitle} 
                      className="bg-card rounded-xl overflow-hidden border border-border"
                    >
                      {/* Series Header */}
                      <button
                        onClick={() => handleSeriesClick(series.seriesTitle)}
                        className="w-full flex items-center gap-4 p-4 hover:bg-secondary/50 transition-colors"
                      >
                        {/* Poster */}
                        <div className="w-16 h-24 md:w-20 md:h-28 flex-shrink-0 rounded-lg overflow-hidden bg-muted">
                          {series.poster ? (
                            <img
                              src={series.poster}
                              alt={series.seriesTitle}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <PlayCircle className="h-8 w-8 text-muted-foreground" />
                            </div>
                          )}
                        </div>

                        {/* Info */}
                        <div className="flex-1 text-left">
                          <h3 className="text-lg font-semibold line-clamp-2">{series.seriesTitle}</h3>
                          <p className="text-sm text-muted-foreground">{series.category}</p>
                          <p className="text-sm text-muted-foreground mt-1">
                            {series.seasons.length > 0 
                              ? `${series.seasons.length} temporada${series.seasons.length > 1 ? 's' : ''} • ${series.episodes.length} episódios`
                              : `${series.episodes.length} episódios`
                            }
                          </p>
                        </div>

                        {/* Expand Icon */}
                        <div className="flex-shrink-0">
                          {expandedSeries === series.seriesTitle ? (
                            <ChevronUp className="h-6 w-6 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="h-6 w-6 text-muted-foreground" />
                          )}
                        </div>
                      </button>

                      {/* Episodes (Expanded) */}
                      {expandedSeries === series.seriesTitle && (
                        <div className="border-t border-border animate-fade-in">
                          {/* Season Tabs */}
                          {series.seasons.length > 0 && (
                            <div className="flex gap-2 p-4 overflow-x-auto scrollbar-hide border-b border-border">
                              {series.seasons.map(season => (
                                <button
                                  key={season}
                                  onClick={() => setExpandedSeason(season)}
                                  className={cn(
                                    "px-4 py-2 rounded-full text-sm font-medium transition-colors whitespace-nowrap",
                                    expandedSeason === season
                                      ? "bg-primary text-primary-foreground"
                                      : "bg-secondary text-muted-foreground hover:text-foreground"
                                  )}
                                >
                                  Temporada {season}
                                </button>
                              ))}
                            </div>
                          )}

                          {/* Episode List */}
                          <div className="p-4 space-y-2 max-h-[400px] overflow-y-auto">
                            {(series.seasons.length > 0 && expandedSeason
                              ? getEpisodesForSeason(series, expandedSeason)
                              : series.episodes
                            ).map(episode => (
                              <button
                                key={episode.id}
                                onClick={() => handlePlay(episode)}
                                className="w-full flex items-center gap-4 p-3 rounded-lg hover:bg-secondary/50 transition-colors text-left group"
                              >
                                {/* Episode Thumbnail */}
                                <div className="w-24 h-14 md:w-32 md:h-18 flex-shrink-0 rounded-md overflow-hidden bg-muted relative">
                                  {episode.logo_url ? (
                                    <img
                                      src={episode.logo_url}
                                      alt={episode.name}
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                      <Play className="h-6 w-6 text-muted-foreground" />
                                    </div>
                                  )}
                                  {/* Play overlay */}
                                  <div className="absolute inset-0 bg-background/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Play className="h-8 w-8 text-primary fill-current" />
                                  </div>
                                </div>

                                {/* Episode Info */}
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium line-clamp-1">
                                    {`E${String(parseEpisodeNumber(episode.name, episode.episode_number)).padStart(2, '0')} - ${episode.name.replace(/^.*[Ss]\d+[Ee]\d+\s*[-–]?\s*/i, '').replace(/^[Ee][Pp]?\s*\d+\s*[-–]?\s*/i, '').trim() || episode.series_title || 'Episódio'}`}
                                  </p>
                                  <p className="text-sm text-muted-foreground">
                                    Temporada {parseSeasonNumber(episode.name, episode.season_number)}, Episódio {parseEpisodeNumber(episode.name, episode.episode_number)}
                                  </p>
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* TV */}
            {tvResults.length > 0 && (
              <section>
                <div className="flex items-center gap-3 mb-6">
                  <Tv className="h-5 w-5 text-primary" />
                  <h2 className="text-xl font-semibold">TV ao Vivo ({tvResults.length})</h2>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                  {tvResults.map((channel) => (
                    <ChannelCard
                      key={channel.id}
                      channel={{
                        id: channel.id,
                        name: channel.name,
                        category: channel.category,
                        country: channel.country,
                        stream_url: channel.stream_url,
                        logo_url: channel.logo_url || '',
                        active: true,
                      }}
                      onPlay={() => handlePlay(channel)}
                    />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </main>

      {/* Video Player Modal */}
      {currentVideo && (
        <VideoPlayer
          src={currentVideo.src}
          title={currentVideo.title}
          poster={currentVideo.poster}
          contentId={currentVideo.contentId}
          contentType={currentVideo.contentType}
          onClose={() => setCurrentVideo(null)}
        />
      )}
    </div>
  );
};

export default Search;
