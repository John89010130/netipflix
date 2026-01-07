import { useState } from 'react';
import { Play, Plus, ThumbsUp, ChevronDown, Tv } from 'lucide-react';
import { ContentItem } from '@/types';
import { cn } from '@/lib/utils';

interface ContentCardProps {
  item: ContentItem;
  index?: number;
  showRank?: boolean;
  onPlay?: (item: ContentItem) => void;
  onAddToList?: (item: ContentItem) => void;
  onMoreInfo?: (item: ContentItem) => void;
}

export const ContentCard = ({ item, index, showRank, onPlay, onAddToList, onMoreInfo }: ContentCardProps) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      className={cn(
        "relative flex-shrink-0 cursor-pointer transition-all duration-300 ease-out",
        showRank ? "w-[200px]" : "w-[180px] md:w-[220px]",
        isHovered && "z-20 scale-110"
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Rank Number for Top 10 */}
      {showRank && index !== undefined && (
        <div className="absolute -left-12 top-1/2 -translate-y-1/2 z-10">
          <span 
            className="font-display text-[120px] leading-none text-transparent"
            style={{
              WebkitTextStroke: '3px hsl(var(--muted-foreground))',
            }}
          >
            {index + 1}
          </span>
        </div>
      )}

      {/* Card Image */}
      <div className="relative aspect-[2/3] overflow-hidden rounded-md">
        <img
          src={item.poster_url}
          alt={item.title}
          className="h-full w-full object-cover transition-transform duration-300"
        />
        
        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

        {/* TV Badge */}
        {item.type === 'TV' && (
          <div className="absolute top-2 left-2 flex items-center gap-1 rounded bg-primary/90 px-2 py-1">
            <Tv className="h-3 w-3" />
            <span className="text-xs font-medium">AO VIVO</span>
          </div>
        )}

        {/* Progress Bar */}
        {item.progress && item.progress > 0 && (
          <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-background/80">
            <div 
              className="h-full bg-primary"
              style={{ 
                // Assume ~90 min average movie duration, show at least 5% if there's any progress
                width: `${Math.max(5, Math.min((item.progress / 5400) * 100, 95))}%` 
              }}
            />
          </div>
        )}

        {/* Hover Content */}
        {isHovered && (
          <div className="absolute inset-0 flex flex-col justify-end bg-gradient-card p-3 animate-fade-in">
            <h3 className="font-semibold text-foreground line-clamp-2 mb-2">{item.title}</h3>
            
            {/* Action Buttons */}
            <div className="flex items-center gap-2 mb-2">
              <button
                onClick={() => onPlay?.(item)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-foreground text-background transition-transform hover:scale-110"
              >
                <Play className="h-4 w-4 fill-current" />
              </button>
              <button
                onClick={() => onAddToList?.(item)}
                className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-muted-foreground text-muted-foreground transition-all hover:border-foreground hover:text-foreground"
              >
                <Plus className="h-4 w-4" />
              </button>
              <button className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-muted-foreground text-muted-foreground transition-all hover:border-foreground hover:text-foreground">
                <ThumbsUp className="h-4 w-4" />
              </button>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  onMoreInfo?.(item);
                }}
                className="ml-auto flex h-8 w-8 items-center justify-center rounded-full border-2 border-muted-foreground text-muted-foreground transition-all hover:border-foreground hover:text-foreground"
              >
                <ChevronDown className="h-4 w-4" />
              </button>
            </div>

            {/* Meta Info */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {item.rating && (
                <span className="text-green-500 font-semibold">{Math.round(item.rating * 10)}% Match</span>
              )}
              {item.year && <span>{item.year}</span>}
              {item.duration && <span>{item.duration}</span>}
            </div>
            
            {/* Category */}
            <div className="mt-1">
              <span className="text-xs text-muted-foreground">{item.category}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
