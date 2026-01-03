import { useState } from 'react';
import { Navbar } from '@/components/Navbar';
import { HeroSection } from '@/components/HeroSection';
import { ContentCarousel } from '@/components/ContentCarousel';
import { ChannelCard } from '@/components/ChannelCard';
import { VideoPlayer } from '@/components/VideoPlayer';
import { ContentItem, Channel } from '@/types';
import { 
  getTop10, 
  mockMovies, 
  mockChannels, 
  categories,
  getMoviesByCategory 
} from '@/data/mockData';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useRef } from 'react';

const Index = () => {
  const [currentVideo, setCurrentVideo] = useState<{ src: string; title: string; poster?: string } | null>(null);
  const channelsScrollRef = useRef<HTMLDivElement>(null);

  const top10 = getTop10();
  const featuredItem = top10[0];

  const handlePlay = (item: ContentItem) => {
    setCurrentVideo({
      src: item.stream_url,
      title: item.title,
      poster: item.backdrop_url || item.poster_url,
    });
  };

  const handlePlayChannel = (channel: Channel) => {
    setCurrentVideo({
      src: channel.stream_url,
      title: channel.name,
      poster: channel.logo_url,
    });
  };

  const scrollChannels = (direction: 'left' | 'right') => {
    if (!channelsScrollRef.current) return;
    const scrollAmount = channelsScrollRef.current.clientWidth * 0.8;
    channelsScrollRef.current.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    });
  };

  // Get movies as ContentItem
  const allMovies: ContentItem[] = mockMovies.map((movie) => ({
    id: movie.id,
    title: movie.title,
    poster_url: movie.poster_url,
    backdrop_url: movie.backdrop_url,
    category: movie.category,
    type: 'MOVIE' as const,
    stream_url: movie.stream_url,
    description: movie.description,
    year: movie.year,
    duration: movie.duration,
    rating: movie.rating,
    views_count: movie.views_count,
  }));

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Hero Section */}
      {featuredItem && (
        <HeroSection
          item={featuredItem}
          onPlay={handlePlay}
          onMoreInfo={() => {}}
        />
      )}

      {/* Content Sections */}
      <div className="relative -mt-32 z-10 pb-16">
        {/* Top 10 Brasil */}
        <ContentCarousel
          title="Top 10 no Brasil Hoje"
          items={top10}
          showRank
          onPlay={handlePlay}
        />

        {/* TV ao Vivo */}
        <section className="relative py-6">
          <h2 className="mb-4 px-4 md:px-12 font-display text-xl md:text-2xl tracking-wide">
            TV ao Vivo
          </h2>
          <div className="relative">
            <button
              onClick={() => scrollChannels('left')}
              className="absolute left-0 top-0 bottom-0 z-10 flex w-12 items-center justify-center bg-gradient-to-r from-background to-transparent"
            >
              <ChevronLeft className="h-8 w-8" />
            </button>
            <div
              ref={channelsScrollRef}
              className="flex gap-3 overflow-x-auto scrollbar-hide px-4 md:px-12 pb-4"
            >
              {mockChannels.map((channel) => (
                <ChannelCard
                  key={channel.id}
                  channel={channel}
                  onPlay={handlePlayChannel}
                />
              ))}
            </div>
            <button
              onClick={() => scrollChannels('right')}
              className="absolute right-0 top-0 bottom-0 z-10 flex w-12 items-center justify-center bg-gradient-to-l from-background to-transparent"
            >
              <ChevronRight className="h-8 w-8" />
            </button>
          </div>
        </section>

        {/* Continue Assistindo (Mockado) */}
        <ContentCarousel
          title="Continue Assistindo"
          items={allMovies.slice(0, 5)}
          onPlay={handlePlay}
        />

        {/* Filmes por Categoria */}
        {categories.slice(0, 4).map((category) => {
          const categoryMovies = getMoviesByCategory(category);
          if (categoryMovies.length === 0) return null;
          return (
            <ContentCarousel
              key={category}
              title={category}
              items={categoryMovies.length > 0 ? categoryMovies : allMovies.slice(0, 5)}
              onPlay={handlePlay}
            />
          );
        })}

        {/* Recomendados para Você */}
        <ContentCarousel
          title="Recomendados para Você"
          items={allMovies.slice(3, 10)}
          onPlay={handlePlay}
        />
      </div>

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

export default Index;
