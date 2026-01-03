import { useState } from 'react';
import { Navbar } from '@/components/Navbar';
import { ContentCard } from '@/components/ContentCard';
import { VideoPlayer } from '@/components/VideoPlayer';
import { mockMovies } from '@/data/mockData';
import { ContentItem } from '@/types';
import { Heart } from 'lucide-react';

const MyList = () => {
  const [currentVideo, setCurrentVideo] = useState<{ src: string; title: string; poster?: string } | null>(null);

  // Mock favorites - will be replaced with actual user data
  const favoriteIds = ['1', '3', '6', '7'];
  const favorites = mockMovies.filter((m) => favoriteIds.includes(m.id));

  const handlePlay = (item: ContentItem) => {
    setCurrentVideo({
      src: item.stream_url,
      title: item.title,
      poster: item.backdrop_url || item.poster_url,
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="pt-24 px-4 md:px-12 pb-16">
        {/* Header */}
        <div className="mb-8">
          <h1 className="font-display text-4xl md:text-5xl tracking-wide mb-4">Minha Lista</h1>
          <p className="text-muted-foreground">Seus favoritos em um só lugar</p>
        </div>

        {/* Favorites Grid */}
        {favorites.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {favorites.map((movie) => {
              const item: ContentItem = {
                id: movie.id,
                title: movie.title,
                poster_url: movie.poster_url,
                backdrop_url: movie.backdrop_url,
                category: movie.category,
                type: 'MOVIE',
                stream_url: movie.stream_url,
                description: movie.description,
                year: movie.year,
                duration: movie.duration,
                rating: movie.rating,
                views_count: movie.views_count,
              };
              return (
                <ContentCard
                  key={movie.id}
                  item={item}
                  onPlay={handlePlay}
                />
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="h-24 w-24 rounded-full bg-secondary flex items-center justify-center mb-6">
              <Heart className="h-12 w-12 text-muted-foreground" />
            </div>
            <h2 className="font-display text-2xl mb-2">Sua lista está vazia</h2>
            <p className="text-muted-foreground max-w-md">
              Adicione filmes e séries à sua lista clicando no ícone + em qualquer conteúdo.
            </p>
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

export default MyList;
