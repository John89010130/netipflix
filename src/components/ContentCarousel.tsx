import { useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { ContentCard } from './ContentCard';
import { ContentItem } from '@/types';
import { cn } from '@/lib/utils';

interface ContentCarouselProps {
  title: string;
  items: ContentItem[];
  showRank?: boolean;
  onPlay?: (item: ContentItem) => void;
  onAddToList?: (item: ContentItem) => void;
}

export const ContentCarousel = ({ title, items, showRank, onPlay, onAddToList }: ContentCarouselProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(true);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
    setShowLeftArrow(scrollLeft > 0);
    setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 10);
  };

  const scroll = (direction: 'left' | 'right') => {
    if (!scrollRef.current) return;
    const scrollAmount = scrollRef.current.clientWidth * 0.8;
    scrollRef.current.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    });
  };

  return (
    <section className="relative py-6 group">
      <h2 className="mb-4 px-4 md:px-12 font-display text-xl md:text-2xl tracking-wide">
        {title}
      </h2>

      <div className="relative">
        {/* Left Arrow */}
        <button
          onClick={() => scroll('left')}
          className={cn(
            "absolute left-0 top-0 bottom-0 z-10 flex w-12 items-center justify-center bg-gradient-to-r from-background to-transparent transition-opacity duration-300",
            showLeftArrow ? "opacity-100" : "opacity-0 pointer-events-none"
          )}
        >
          <ChevronLeft className="h-8 w-8" />
        </button>

        {/* Content */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className={cn(
            "flex gap-2 overflow-x-auto scrollbar-hide px-4 md:px-12 pb-4",
            showRank && "pl-20 md:pl-24"
          )}
        >
          {items.map((item, index) => (
            <ContentCard
              key={item.id}
              item={item}
              index={index}
              showRank={showRank}
              onPlay={onPlay}
              onAddToList={onAddToList}
            />
          ))}
        </div>

        {/* Right Arrow */}
        <button
          onClick={() => scroll('right')}
          className={cn(
            "absolute right-0 top-0 bottom-0 z-10 flex w-12 items-center justify-center bg-gradient-to-l from-background to-transparent transition-opacity duration-300",
            showRightArrow ? "opacity-100" : "opacity-0 pointer-events-none"
          )}
        >
          <ChevronRight className="h-8 w-8" />
        </button>
      </div>
    </section>
  );
};
