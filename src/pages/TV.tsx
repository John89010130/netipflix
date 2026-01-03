import { useState, useEffect } from 'react';
import { Navbar } from '@/components/Navbar';
import { ChannelCard } from '@/components/ChannelCard';
import { VideoPlayer } from '@/components/VideoPlayer';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';

interface Channel {
  id: string;
  name: string;
  category: string;
  country: string;
  logo_url: string | null;
  stream_url: string;
  active: boolean;
}

const TV = () => {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentVideo, setCurrentVideo] = useState<{ src: string; title: string } | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos');

  useEffect(() => {
    const fetchChannels = async () => {
      const { data, error } = await supabase
        .from('channels')
        .select('*')
        .eq('active', true)
        .order('name');

      if (error) {
        console.error('Error fetching channels:', error);
      } else {
        setChannels(data || []);
      }
      setLoading(false);
    };

    fetchChannels();
  }, []);

  const categories = ['Todos', ...new Set(channels.map((c) => c.category))].sort();

  const filteredChannels = selectedCategory === 'Todos'
    ? channels
    : channels.filter((c) => c.category === selectedCategory);

  const handlePlayChannel = (channel: Channel) => {
    setCurrentVideo({
      src: channel.stream_url,
      title: channel.name,
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="pt-24 px-4 md:px-12 pb-16">
        {/* Header */}
        <div className="mb-8">
          <h1 className="font-display text-4xl md:text-5xl tracking-wide mb-4">TV ao Vivo</h1>
          <p className="text-muted-foreground">Assista aos melhores canais ao vivo • {channels.length} canais disponíveis</p>
        </div>

        {/* Category Filter */}
        <div className="flex gap-2 mb-8 overflow-x-auto scrollbar-hide pb-2">
          {loading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-24 rounded-full" />
            ))
          ) : (
            categories.map((category) => (
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
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {filteredChannels.map((channel) => (
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

        {!loading && filteredChannels.length === 0 && (
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
    </div>
  );
};

export default TV;
