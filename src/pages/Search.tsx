import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Navbar } from '@/components/Navbar';
import { ContentCard } from '@/components/ContentCard';
import { ChannelCard } from '@/components/ChannelCard';
import { VideoPlayer } from '@/components/VideoPlayer';
import { supabase } from '@/integrations/supabase/client';
import { isAdultCategory } from '@/components/AdultContentGate';
import { Skeleton } from '@/components/ui/skeleton';
import { Search as SearchIcon, Film, Tv, PlayCircle } from 'lucide-react';
import { ContentItem } from '@/types';

interface Channel {
  id: string;
  name: string;
  category: string;
  country: string;
  logo_url: string | null;
  stream_url: string;
  content_type: string;
  series_title?: string | null;
}

const Search = () => {
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q') || '';
  
  const [results, setResults] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
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

    const { data, error } = await supabase
      .from('active_channels' as any)
      .select('*')
      .or(`name.ilike.%${query}%,series_title.ilike.%${query}%,category.ilike.%${query}%`)
      .limit(100);

    if (error) {
      console.error('Search error:', error);
      setLoading(false);
      return;
    }

    // Filter adult content
    const safeResults = (data as unknown as Channel[]).filter(
      c => !isAdultCategory(c.category)
    );

    setResults(safeResults);
    setLoading(false);
  }, [query]);

  useEffect(() => {
    searchContent();
  }, [searchContent]);

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
            {loading ? 'Buscando...' : `${results.length} resultados encontrados`}
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

            {/* Series */}
            {seriesResults.length > 0 && (
              <section>
                <div className="flex items-center gap-3 mb-6">
                  <PlayCircle className="h-5 w-5 text-primary" />
                  <h2 className="text-xl font-semibold">Séries ({seriesResults.length})</h2>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                  {seriesResults.map((channel) => {
                    const item: ContentItem = {
                      id: channel.id,
                      title: channel.series_title || channel.name,
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
