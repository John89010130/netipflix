import { Play, Info, Volume2, VolumeX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ContentItem } from '@/types';
import { useState, useEffect } from 'react';

interface HeroSectionProps {
  items: ContentItem[];
  onPlay?: (item: ContentItem) => void;
  onMoreInfo?: (item: ContentItem) => void;
  rotationInterval?: number;
}

export const HeroSection = ({ items, onPlay, onMoreInfo, rotationInterval = 10000 }: HeroSectionProps) => {
  const [isMuted, setIsMuted] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (items.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % items.length);
    }, rotationInterval);

    return () => clearInterval(interval);
  }, [items.length, rotationInterval]);

  const item = items[currentIndex];

  if (!item) return null;

  return (
    <section className="relative h-[70vh] md:h-[85vh] w-full overflow-hidden" data-skip-tv-nav>
      {/* Background Image with fade transition */}
      <div className="absolute inset-0">
        {items.map((heroItem, index) => (
          <img
            key={heroItem.id}
            src={heroItem.backdrop_url || heroItem.poster_url}
            alt={heroItem.title}
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-1000 ${
              index === currentIndex ? 'opacity-100' : 'opacity-0'
            }`}
          />
        ))}
        {/* Gradient Overlays */}
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/60 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
      </div>

      {/* Content */}
      <div className="absolute bottom-[15%] left-4 md:left-12 z-10 max-w-2xl animate-slide-up" key={item.id}>
        {/* Logo/Title */}
        <h1 className="mb-4 font-display text-5xl md:text-7xl lg:text-8xl tracking-wider text-gradient">
          {item.title}
        </h1>

        {/* Meta Info */}
        <div className="mb-4 flex items-center gap-3 text-sm">
          {item.rating && (
            <span className="text-green-500 font-bold">{Math.round(item.rating * 10)}% Match</span>
          )}
          {item.year && <span className="text-muted-foreground">{item.year}</span>}
          {item.duration && (
            <span className="rounded border border-muted-foreground/50 px-1.5 py-0.5 text-xs">
              {item.duration}
            </span>
          )}
          <span className="rounded border border-muted-foreground/50 px-1.5 py-0.5 text-xs">
            HD
          </span>
        </div>

        {/* Description */}
        {item.description && (
          <p className="mb-6 text-sm md:text-base text-foreground/90 line-clamp-3 max-w-lg">
            {item.description}
          </p>
        )}

        {/* Actions - TV Focusable */}
        <div className="flex items-center gap-3">
          <Button
            variant="play"
            size="xl"
            onClick={() => onPlay?.(item)}
            className="gap-2"
            data-tv-focusable
          >
            <Play className="h-6 w-6 fill-current" />
            Assistir
          </Button>
          <Button
            variant="glass"
            size="xl"
            onClick={() => onMoreInfo?.(item)}
            className="gap-2"
            data-tv-focusable
          >
            <Info className="h-5 w-5" />
            Mais Informações
          </Button>
        </div>
      </div>

      {/* Mute Button */}
      <button
        onClick={() => setIsMuted(!isMuted)}
        className="absolute bottom-[15%] right-4 md:right-12 z-10 flex h-10 w-10 items-center justify-center rounded-full border border-muted-foreground text-muted-foreground transition-all hover:border-foreground hover:text-foreground"
      >
        {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
      </button>

      {/* Pagination Dots */}
      {items.length > 1 && (
        <div className="absolute bottom-[15%] right-28 md:right-36 z-10 flex items-center gap-2">
          {items.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentIndex(index)}
              className={`h-2 rounded-full transition-all ${
                index === currentIndex
                  ? 'w-6 bg-primary'
                  : 'w-2 bg-muted-foreground/50 hover:bg-muted-foreground'
              }`}
            />
          ))}
        </div>
      )}

      {/* Age Rating */}
      <div className="absolute bottom-[15%] right-16 md:right-24 z-10 flex items-center gap-2 border-l-2 border-muted-foreground/50 pl-3">
        <span className="text-sm text-muted-foreground">16</span>
      </div>
    </section>
  );
};
