import { useState } from 'react';
import { ChevronDown, ChevronUp, Play, Radio, Wifi, WifiOff } from 'lucide-react';
import { ChannelGroup, getQualityBadge, Channel, cleanDisplayName } from '@/hooks/useChannelGroups';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface ChannelGroupCardProps {
  group: ChannelGroup;
  onPlay: (channel: Channel) => void;
}

export const ChannelGroupCard = ({ group, onPlay }: ChannelGroupCardProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const hasMultipleOptions = group.channels.length > 1;
  const { bestChannel } = group;
  const qualityBadge = getQualityBadge(bestChannel.name);

  const handleMainPlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    onPlay(bestChannel);
  };

  const handleOptionPlay = (e: React.MouseEvent, channel: Channel) => {
    e.stopPropagation();
    onPlay(channel);
  };

  const getStatusIcon = (channel: Channel) => {
    if (channel.last_test_status === 'online') {
      return <Wifi className="h-3 w-3 text-green-500" />;
    } else if (channel.last_test_status === 'offline') {
      return <WifiOff className="h-3 w-3 text-destructive" />;
    }
    return null;
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onPlay(bestChannel);
    }
  };

  return (
    <div 
      className="group relative overflow-hidden rounded-lg bg-card border border-border transition-all hover:border-primary/50 focus-within:border-primary/50"
      tabIndex={0}
      role="button"
      aria-label={`Assistir ${group.groupName}`}
      onKeyDown={handleKeyDown}
      data-tv-focusable
    >
      {/* Main Card */}
      <div
        className="relative aspect-video cursor-pointer"
        onClick={handleMainPlay}
      >
        {/* Logo/Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center">
          {bestChannel.logo_url ? (
            <img
              src={bestChannel.logo_url}
              alt={group.groupName}
              className="h-16 w-auto object-contain"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          ) : (
            <Radio className="h-12 w-12 text-muted-foreground/50" />
          )}
        </div>

        {/* Hover Overlay */}
        <div className="absolute inset-0 bg-background/80 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity flex items-center justify-center">
          <div className="p-3 rounded-full bg-primary text-primary-foreground">
            <Play className="h-6 w-6 fill-current" />
          </div>
        </div>

        {/* Badges */}
        <div className="absolute top-2 left-2 flex gap-1">
          {qualityBadge && (
            <Badge variant="secondary" className="text-xs px-1.5 py-0.5">
              {qualityBadge}
            </Badge>
          )}
          {getStatusIcon(bestChannel)}
        </div>

        {/* Options Count */}
        {hasMultipleOptions && (
          <Badge
            variant="outline"
            className="absolute top-2 right-2 text-xs px-1.5 py-0.5 bg-background/80"
          >
            +{group.channels.length - 1}
          </Badge>
        )}
      </div>

      {/* Channel Info */}
      <div className="p-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-medium text-sm truncate flex-1">{group.groupName}</h3>
          {hasMultipleOptions && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsExpanded(!isExpanded);
              }}
              className="p-1 hover:bg-muted rounded transition-colors"
            >
              {isExpanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </button>
          )}
        </div>
        <p className="text-xs text-muted-foreground truncate">{bestChannel.category}</p>
      </div>

      {/* Expanded Options */}
      {isExpanded && hasMultipleOptions && (
        <div className="border-t border-border bg-muted/30">
          <div className="max-h-48 overflow-y-auto">
            {group.channels.map((channel) => {
              const badge = getQualityBadge(channel.name);
              const isActive = channel.id === bestChannel.id;
              
              return (
                <button
                  key={channel.id}
                  onClick={(e) => handleOptionPlay(e, channel)}
                  className={cn(
                    "w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-muted transition-colors",
                    isActive && "bg-primary/10"
                  )}
                >
                  {channel.logo_url ? (
                    <img
                      src={channel.logo_url}
                      alt={channel.name}
                      className="h-6 w-6 object-contain rounded"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  ) : (
                    <Radio className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span className="flex-1 text-sm truncate">{cleanDisplayName(channel.name)}</span>
                  <div className="flex items-center gap-1">
                    {getStatusIcon(channel)}
                    {badge && (
                      <Badge variant="outline" className="text-xs px-1 py-0">
                        {badge}
                      </Badge>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
