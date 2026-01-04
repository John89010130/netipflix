import { useMemo } from 'react';

export interface Channel {
  id: string;
  name: string;
  category: string;
  country: string;
  logo_url: string | null;
  stream_url: string;
  active: boolean;
  last_test_status?: string | null;
  last_tested_at?: string | null;
}

export interface ChannelGroup {
  groupName: string;
  channels: Channel[];
  bestChannel: Channel;
  isExpanded?: boolean;
}

// Clean display name (remove country prefixes like "BR:", "PT:", etc.)
export const cleanDisplayName = (name: string): string => {
  return name
    .replace(/^(BR:|PT:|US:|UK:|AR:|MX:|CO:|CL:|PE:|VE:|EC:|BO:|PY:|UY:|CR:|PA:|DO:|GT:|HN:|SV:|NI:|CU:|PR:)\s*/gi, '')
    .trim();
};

// Extract base name from channel name (remove prefixes, quality suffixes, location)
const extractBaseName = (name: string): string => {
  let baseName = name
    // Remove common prefixes
    .replace(/^(BR:|PT:|US:|UK:|AR:|MX:|CO:|CL:|PE:|VE:|EC:|BO:|PY:|UY:|CR:|PA:|DO:|GT:|HN:|SV:|NI:|CU:|PR:)\s*/gi, '')
    // Remove quality suffixes
    .replace(/\s*(UHD|4K|FHD|FULL\s*HD|HD|SD|HQ|LQ|H\.?265|HEVC|H\.?264|AVC)\s*/gi, ' ')
    // Remove location/regional info
    .replace(/\s*(SP|RJ|MG|BA|RS|PR|SC|GO|DF|CE|PE|PA|MA|MT|MS|ES|PB|RN|AL|PI|SE|AM|RO|AC|AP|RR|TO)\s*$/gi, '')
    // Remove common suffixes
    .replace(/\s*(EPTV|Campinas|Brasilia|São Paulo|Rio|Regional|Local|Nacional)\s*/gi, ' ')
    // Clean up multiple spaces and trim
    .replace(/\s+/g, ' ')
    .trim();
  
  return baseName || name;
};

// Calculate priority score for a channel (higher is better)
const getChannelPriority = (channel: Channel): number => {
  let score = 0;
  const name = channel.name.toUpperCase();
  
  // Quality scores
  if (name.includes('4K') || name.includes('UHD')) score += 100;
  else if (name.includes('FHD') || name.includes('FULL HD')) score += 80;
  else if (name.includes('HD')) score += 60;
  else if (name.includes('SD')) score += 20;
  else score += 40; // Default score
  
  // Online status bonus
  if (channel.last_test_status === 'online') score += 50;
  else if (channel.last_test_status === 'offline') score -= 100;
  
  // Recent test bonus
  if (channel.last_tested_at) {
    const lastTest = new Date(channel.last_tested_at);
    const hoursSinceTest = (Date.now() - lastTest.getTime()) / (1000 * 60 * 60);
    if (hoursSinceTest < 24) score += 20;
    else if (hoursSinceTest < 72) score += 10;
  }
  
  return score;
};

export const useChannelGroups = (channels: Channel[]): ChannelGroup[] => {
  return useMemo(() => {
    const groupMap = new Map<string, Channel[]>();
    
    // Group channels by base name
    channels.forEach(channel => {
      const baseName = extractBaseName(channel.name);
      const existing = groupMap.get(baseName) || [];
      existing.push(channel);
      groupMap.set(baseName, existing);
    });
    
    // Convert to array and sort each group by priority
    const groups: ChannelGroup[] = Array.from(groupMap.entries()).map(([groupName, groupChannels]) => {
      const sortedChannels = [...groupChannels].sort((a, b) => getChannelPriority(b) - getChannelPriority(a));
      return {
        groupName,
        channels: sortedChannels,
        bestChannel: sortedChannels[0],
      };
    });
    
    // Sort groups alphabetically
    groups.sort((a, b) => a.groupName.localeCompare(b.groupName));
    
    return groups;
  }, [channels]);
};

// Helper to get quality badge
export const getQualityBadge = (name: string): string | null => {
  const upperName = name.toUpperCase();
  if (upperName.includes('4K') || upperName.includes('UHD')) return '4K';
  if (upperName.includes('FHD') || upperName.includes('FULL HD')) return 'FHD';
  if (upperName.includes('HD')) return 'HD';
  if (upperName.includes('SD')) return 'SD';
  return null;
};
