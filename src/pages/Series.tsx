import { useState, useEffect } from 'react';
import { Navbar } from '@/components/Navbar';
import { ContentCarousel } from '@/components/ContentCarousel';
import { VideoPlayer } from '@/components/VideoPlayer';
import { supabase } from '@/integrations/supabase/client';
import { ContentItem } from '@/types';
import { Skeleton } from '@/components/ui/skeleton';
import { isAdultCategory } from '@/components/AdultContentGate';

// Series categories (from channels that contain series content)
const SERIES_CATEGORIES = [
  'Filmes e Series',
  'Filmes & Series',
  'Filmes - Drama',
  'Filmes - Comedy',
  'Filmes - Crime',
  'Filmes - Mystery',
  'Filmes - Talk',
  'Filmes - Reality',
  'Filmes  - Drama',
  'Filmes  - Comedy',
  'Filmes  - Crime',
  'Filmes  - Mystery',
  'Filmes  - Talk',
  'Filmes  - Reality',
  'Netflix Channel',
];

interface Channel {
  id: string;
  name: string;
  category: string;
  country: string;
  logo_url: string | null;
  stream_url: string;
  active: boolean;
}

const Series = () => {
  const [currentVideo, setCurrentVideo] = useState<{ src: string; title: string; poster?: string } | null>(null);
  const [seriesChannels, setSeriesChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSeries = async () => {
      const { data, error } = await supabase
        .from('channels')
        .select('*')
        .eq('active', true)
        .order('name');

      if (!error && data) {
        // Filter for series-related categories
        const filtered = data.filter(channel => {
          const category = channel.category.toLowerCase();
          // Include channels with series-related categories
          return (
            category.includes('serie') ||
            category.includes('netflix') ||
            category.includes('talk') ||
            category.includes('reality')
          ) && !isAdultCategory(channel.category);
        });
        setSeriesChannels(filtered);
      }
      setLoading(false);
    };

    fetchSeries();
  }, []);

  const handlePlay = (item: ContentItem) => {
    setCurrentVideo({
      src: item.stream_url,
      title: item.title,
      poster: item.backdrop_url || item.poster_url,
    });
  };

  // Convert channels to ContentItem format
  const seriesContent: ContentItem[] = seriesChannels.map(channel => ({
    id: channel.id,
    title: channel.name,
    poster_url: channel.logo_url || undefined,
    category: channel.category,
    type: 'TV' as const,
    stream_url: channel.stream_url,
  }));

  // Group by category
  const categories = [...new Set(seriesChannels.map(c => c.category))];
  const seriesByCategory = categories.reduce((acc, category) => {
    acc[category] = seriesContent.filter(s => s.category === category);
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
            {loading ? 'Carregando...' : `Assista às melhores séries • ${seriesChannels.length} canais disponíveis`}
          </p>
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
        ) : seriesContent.length > 0 ? (
          <div className="space-y-8">
            {/* Featured */}
            {seriesContent.length > 0 && (
              <ContentCarousel
                title="Em Destaque"
                items={seriesContent.slice(0, 20)}
                onPlay={handlePlay}
              />
            )}

            {/* By Category */}
            {categories.slice(0, 8).map((category) => (
              seriesByCategory[category]?.length > 0 && (
                <ContentCarousel
                  key={category}
                  title={category}
                  items={seriesByCategory[category]}
                  onPlay={handlePlay}
                />
              )
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <p className="text-muted-foreground">Nenhuma série disponível no momento.</p>
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
