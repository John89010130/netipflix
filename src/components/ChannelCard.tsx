import { useState } from 'react';
import { Play, Tv } from 'lucide-react';
import { Channel } from '@/types';
import { cn } from '@/lib/utils';
import { cleanDisplayName } from '@/hooks/useChannelGroups';

const PROD_PROXY = (import.meta.env.VITE_STREAM_PROXY_URL || 'https://stream-proxy.john89010130.workers.dev/stream').trim();

const proxiedImage = (url?: string) => {
  if (!url) return '';
  if (url.startsWith('https://stream-proxy.') || url.includes('/stream?url=')) return url;
  if (/^https?:\/\//i.test(url)) {
    const base = PROD_PROXY.endsWith('/') ? PROD_PROXY.slice(0, -1) : PROD_PROXY;
    return `${base}?url=${encodeURIComponent(url)}`;
  }
  return url;
};

interface ChannelCardProps {
  channel: Channel;
  onPlay?: (channel: Channel) => void;
}

export const ChannelCard = ({ channel, onPlay }: ChannelCardProps) => {
  const [isFocused, setIsFocused] = useState(false);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onPlay?.(channel);
    }
  };

  return (
    <div
      tabIndex={0}
      role="button"
      aria-label={`Assistir ${channel.name}`}
      onClick={() => onPlay?.(channel)}
      onKeyDown={handleKeyDown}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      className={cn(
        "relative flex-shrink-0 w-[140px] md:w-[180px] cursor-pointer transition-all duration-300 hover:scale-105 focus:scale-105 group focus:outline-none",
        isFocused && "z-10"
      )}
      data-tv-focusable
    >
      <div className={cn(
        "relative aspect-video overflow-hidden rounded-lg bg-secondary transition-all",
        isFocused && "ring-2 ring-foreground/50 ring-offset-2 ring-offset-background shadow-lg"
      )}>
        {/* Logo Container */}
        <div className="absolute inset-0 flex items-center justify-center p-4">
          <img
            src={proxiedImage(channel.logo_url)}
            alt={channel.name}
            className="max-h-full max-w-full object-contain filter brightness-0 invert"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        </div>

        {/* Hover/Focus Overlay */}
        <div className={cn(
          "absolute inset-0 bg-primary/20 opacity-0 transition-opacity flex items-center justify-center",
          "group-hover:opacity-100",
          isFocused && "opacity-100"
        )}>
          <div className="h-12 w-12 rounded-full bg-foreground text-background flex items-center justify-center">
            <Play className="h-6 w-6 fill-current ml-1" />
          </div>
        </div>

        {/* Live Badge */}
        <div className="absolute top-2 left-2 flex items-center gap-1 rounded bg-primary px-2 py-0.5">
          <span className="h-2 w-2 rounded-full bg-foreground animate-pulse" />
          <span className="text-[10px] font-bold uppercase">Ao Vivo</span>
        </div>
      </div>

      {/* Channel Info */}
      <div className="mt-2 px-1">
        <h3 className="font-medium text-sm truncate">{cleanDisplayName(channel.name)}</h3>
        <p className="text-xs text-muted-foreground">{channel.category}</p>
      </div>
    </div>
  );
};
