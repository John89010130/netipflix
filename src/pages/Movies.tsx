import { useState } from 'react';
import { Navbar } from '@/components/Navbar';
import { ContentCard } from '@/components/ContentCard';
import { VideoPlayer } from '@/components/VideoPlayer';
import { mockMovies, categories } from '@/data/mockData';
import { ContentItem } from '@/types';

const Movies = () => {
  const [currentVideo, setCurrentVideo] = useState<{ src: string; title: string; poster?: string } | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos');

  const allCategories = ['Todos', ...categories];

  const filteredMovies = selectedCategory === 'Todos'
    ? mockMovies
    : mockMovies.filter((m) => m.category === selectedCategory);

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
          <h1 className="font-display text-4xl md:text-5xl tracking-wide mb-4">Filmes</h1>
          <p className="text-muted-foreground">Os melhores filmes para você</p>
        </div>

        {/* Category Filter */}
        <div className="flex gap-2 mb-8 overflow-x-auto scrollbar-hide pb-2">
          {allCategories.map((category) => (
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

        {/* Movies Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {filteredMovies.map((movie) => {
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

        {filteredMovies.length === 0 && (
          <div className="text-center py-16">
            <p className="text-muted-foreground">Nenhum filme encontrado nesta categoria.</p>
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

export default Movies;
