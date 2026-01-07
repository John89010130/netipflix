import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { 
  Tv, 
  Film, 
  Clapperboard,
  Search, 
  Loader2,
  CheckCircle,
  XCircle,
  Trash2,
  RefreshCw,
  AlertCircle,
  Link as LinkIcon,
  Filter,
  X
} from 'lucide-react';

interface Channel {
  id: string;
  name: string;
  clean_title: string | null;
  category: string;
  subcategory: string | null;
  content_type: string;
  country: string;
  logo_url: string | null;
  stream_url: string;
  active: boolean;
  year: number | null;
  season_number: number | null;
  episode_number: number | null;
  last_tested_at: string | null;
  last_test_status: string | null;
  m3u_link_id: string | null;
}

interface M3uLink {
  id: string;
  url: string;
  channels_imported: number;
  imported_at: string;
  is_active: boolean;
}

interface TestJob {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  total_channels: number;
  tested_channels: number;
  online_count: number;
  offline_count: number;
  error_count: number;
  started_at: string | null;
  completed_at: string | null;
}

interface AdminChannelsProps {
  testJob: TestJob | null;
  onStartTest: () => void;
  isTestRunning: boolean;
  onRefreshChannels: () => void;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const PAGE_SIZE = 100;

export const AdminChannels = ({ testJob, onStartTest, isTestRunning, onRefreshChannels }: AdminChannelsProps) => {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [m3uLinks, setM3uLinks] = useState<M3uLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const listRef = useRef<HTMLDivElement>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('active');
  const [contentTypeFilter, setContentTypeFilter] = useState<'all' | 'TV' | 'MOVIE' | 'SERIES'>('all');
  const [testStatusFilter, setTestStatusFilter] = useState<'all' | 'online' | 'offline' | 'untested'>('all');
  const [selectedLinkId, setSelectedLinkId] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedSubcategory, setSelectedSubcategory] = useState<string>('all');

  // Stats
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    inactive: 0,
    tv: 0,
    movies: 0,
    series: 0,
  });

  // Available options for filters
  const [categories, setCategories] = useState<string[]>([]);
  const [subcategories, setSubcategories] = useState<string[]>([]);

  // Fetch M3U links
  const fetchM3uLinks = async () => {
    const { data, error } = await supabase
      .from('m3u_links')
      .select('*')
      .order('imported_at', { ascending: false });
    
    if (!error && data) {
      setM3uLinks(data);
    }
  };

  // Fetch stats
  const fetchStats = async () => {
    const [totalRes, activeRes, inactiveRes, tvRes, moviesRes, seriesRes] = await Promise.all([
      supabase.from('channels').select('*', { count: 'exact', head: true }),
      supabase.from('channels').select('*', { count: 'exact', head: true }).eq('active', true),
      supabase.from('channels').select('*', { count: 'exact', head: true }).eq('active', false),
      supabase.from('channels').select('*', { count: 'exact', head: true }).eq('content_type', 'TV'),
      supabase.from('channels').select('*', { count: 'exact', head: true }).eq('content_type', 'MOVIE'),
      supabase.from('channels').select('*', { count: 'exact', head: true }).eq('content_type', 'SERIES'),
    ]);
    
    setStats({
      total: totalRes.count || 0,
      active: activeRes.count || 0,
      inactive: inactiveRes.count || 0,
      tv: tvRes.count || 0,
      movies: moviesRes.count || 0,
      series: seriesRes.count || 0,
    });
  };

  // Fetch filter options
  const fetchFilterOptions = async () => {
    const [catRes, subcatRes] = await Promise.all([
      supabase.from('channels').select('category').order('category'),
      supabase.from('channels').select('subcategory').not('subcategory', 'is', null).order('subcategory'),
    ]);
    
    if (catRes.data) {
      setCategories([...new Set(catRes.data.map(c => c.category))].sort());
    }
    if (subcatRes.data) {
      setSubcategories([...new Set(subcatRes.data.map(c => c.subcategory).filter(Boolean))] as string[]);
    }
  };

  // Fetch channels with filters
  const fetchChannels = async (reset = false) => {
    if (reset) {
      setLoading(true);
      setChannels([]);
    } else {
      setLoadingMore(true);
    }
    
    const from = reset ? 0 : channels.length;
    
    let query = supabase
      .from('channels')
      .select('id, name, clean_title, category, subcategory, content_type, country, logo_url, stream_url, active, year, season_number, episode_number, last_tested_at, last_test_status, m3u_link_id')
      .order('name')
      .range(from, from + PAGE_SIZE - 1);
    
    // Apply filters
    if (statusFilter === 'active') {
      query = query.eq('active', true);
    } else if (statusFilter === 'inactive') {
      query = query.eq('active', false);
    }
    
    if (contentTypeFilter !== 'all') {
      query = query.eq('content_type', contentTypeFilter);
    }
    
    if (testStatusFilter === 'online') {
      query = query.eq('last_test_status', 'online');
    } else if (testStatusFilter === 'offline') {
      query = query.eq('last_test_status', 'offline');
    } else if (testStatusFilter === 'untested') {
      query = query.is('last_test_status', null);
    }
    
    if (selectedLinkId !== 'all') {
      query = query.eq('m3u_link_id', selectedLinkId);
    }
    
    if (selectedCategory !== 'all') {
      query = query.eq('category', selectedCategory);
    }
    
    if (selectedSubcategory !== 'all') {
      query = query.eq('subcategory', selectedSubcategory);
    }
    
    if (searchTerm.trim()) {
      query = query.or(`name.ilike.%${searchTerm.trim()}%,clean_title.ilike.%${searchTerm.trim()}%`);
    }
    
    const { data, error } = await query;
    
    if (error) {
      toast.error('Erro ao carregar canais');
      console.error(error);
    } else {
      const newChannels = (data || []) as Channel[];
      if (reset) {
        setChannels(newChannels);
      } else {
        setChannels(prev => [...prev, ...newChannels]);
      }
      setHasMore(newChannels.length === PAGE_SIZE);
    }
    
    setLoading(false);
    setLoadingMore(false);
  };

  // Initial load
  useEffect(() => {
    fetchM3uLinks();
    fetchStats();
    fetchFilterOptions();
    fetchChannels(true);
  }, []);

  // Refetch when filters change
  useEffect(() => {
    fetchChannels(true);
  }, [statusFilter, contentTypeFilter, testStatusFilter, selectedLinkId, selectedCategory, selectedSubcategory, searchTerm]);

  // Infinite scroll
  const loadMore = useCallback(() => {
    if (!loadingMore && hasMore) {
      fetchChannels(false);
    }
  }, [loadingMore, hasMore, channels.length]);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - scrollTop <= clientHeight + 100) {
      loadMore();
    }
  }, [loadMore]);

  // Channel actions
  const updateChannelStatus = async (channelId: string, active: boolean) => {
    const { error } = await supabase
      .from('channels')
      .update({ active })
      .eq('id', channelId);
    
    if (error) {
      toast.error('Erro ao atualizar canal');
    } else {
      setChannels(prev => prev.map(c => c.id === channelId ? { ...c, active } : c));
      fetchStats();
    }
  };

  const deleteChannel = async (channelId: string) => {
    const { error } = await supabase
      .from('channels')
      .delete()
      .eq('id', channelId);
    
    if (error) {
      toast.error('Erro ao excluir canal');
    } else {
      setChannels(prev => prev.filter(c => c.id !== channelId));
      fetchStats();
      toast.success('Canal excluído');
    }
  };

  // Get link name by ID
  const getLinkName = (linkId: string | null): string => {
    if (!linkId) return 'Sem link';
    const link = m3uLinks.find(l => l.id === linkId);
    if (!link) return 'Link desconhecido';
    try {
      const url = new URL(link.url);
      return url.hostname + url.pathname.split('/').pop();
    } catch {
      return link.url.substring(0, 30) + '...';
    }
  };

  // Get content type icon
  const getContentTypeIcon = (type: string) => {
    switch (type) {
      case 'TV': return <Tv className="h-4 w-4" />;
      case 'MOVIE': return <Film className="h-4 w-4" />;
      case 'SERIES': return <Clapperboard className="h-4 w-4" />;
      default: return <Tv className="h-4 w-4" />;
    }
  };

  // Clear all filters
  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter('active');
    setContentTypeFilter('all');
    setTestStatusFilter('all');
    setSelectedLinkId('all');
    setSelectedCategory('all');
    setSelectedSubcategory('all');
  };

  const hasActiveFilters = 
    searchTerm || 
    statusFilter !== 'active' || 
    contentTypeFilter !== 'all' || 
    testStatusFilter !== 'all' || 
    selectedLinkId !== 'all' || 
    selectedCategory !== 'all' || 
    selectedSubcategory !== 'all';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Gerenciar Canais</span>
          <div className="flex gap-2">
            <Button
              onClick={onStartTest}
              disabled={isTestRunning}
              variant="outline"
              size="sm"
            >
              {isTestRunning ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Testar Streams
            </Button>
          </div>
        </CardTitle>
        <CardDescription>
          Total: {stats.total.toLocaleString()} | TV: {stats.tv.toLocaleString()} | Filmes: {stats.movies.toLocaleString()} | Séries: {stats.series.toLocaleString()}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card 
            className={`cursor-pointer transition-all hover:ring-2 hover:ring-primary/50 ${statusFilter === 'all' ? 'ring-2 ring-primary' : ''}`}
            onClick={() => setStatusFilter('all')}
          >
            <CardContent className="py-3 px-4">
              <div className="flex items-center gap-2">
                <Tv className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-lg font-bold">{stats.total.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">Total</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card 
            className={`cursor-pointer transition-all hover:ring-2 hover:ring-green-500/50 ${statusFilter === 'active' ? 'ring-2 ring-green-500' : ''}`}
            onClick={() => setStatusFilter('active')}
          >
            <CardContent className="py-3 px-4">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <div>
                  <p className="text-lg font-bold">{stats.active.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">Ativos</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card 
            className={`cursor-pointer transition-all hover:ring-2 hover:ring-red-500/50 ${statusFilter === 'inactive' ? 'ring-2 ring-red-500' : ''}`}
            onClick={() => setStatusFilter('inactive')}
          >
            <CardContent className="py-3 px-4">
              <div className="flex items-center gap-2">
                <XCircle className="h-5 w-5 text-red-500" />
                <div>
                  <p className="text-lg font-bold">{stats.inactive.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">Inativos</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-3 px-4">
              <div className="flex items-center gap-2">
                <LinkIcon className="h-5 w-5 text-blue-500" />
                <div>
                  <p className="text-lg font-bold">{m3uLinks.length}</p>
                  <p className="text-xs text-muted-foreground">Listas M3U</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Filtros</span>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="h-6 px-2 text-xs">
                <X className="h-3 w-3 mr-1" />
                Limpar
              </Button>
            )}
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar canal..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Content Type */}
            <Select value={contentTypeFilter} onValueChange={(v) => setContentTypeFilter(v as typeof contentTypeFilter)}>
              <SelectTrigger>
                <SelectValue placeholder="Tipo de conteúdo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                <SelectItem value="TV">📺 TV ao Vivo</SelectItem>
                <SelectItem value="MOVIE">🎬 Filmes</SelectItem>
                <SelectItem value="SERIES">📺 Séries</SelectItem>
              </SelectContent>
            </Select>

            {/* Test Status */}
            <Select value={testStatusFilter} onValueChange={(v) => setTestStatusFilter(v as typeof testStatusFilter)}>
              <SelectTrigger>
                <SelectValue placeholder="Status do teste" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="online">🟢 Online</SelectItem>
                <SelectItem value="offline">🔴 Offline</SelectItem>
                <SelectItem value="untested">⚪ Não testado</SelectItem>
              </SelectContent>
            </Select>

            {/* M3U Link */}
            <Select value={selectedLinkId} onValueChange={setSelectedLinkId}>
              <SelectTrigger>
                <SelectValue placeholder="Lista M3U" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as listas</SelectItem>
                {m3uLinks.map(link => (
                  <SelectItem key={link.id} value={link.id}>
                    {getLinkName(link.id)} ({link.channels_imported})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Category */}
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as categorias</SelectItem>
                {categories.map(cat => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Subcategory */}
            <Select value={selectedSubcategory} onValueChange={setSelectedSubcategory}>
              <SelectTrigger>
                <SelectValue placeholder="Subcategoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as subcategorias</SelectItem>
                {subcategories.map(sub => (
                  <SelectItem key={sub} value={sub}>{sub}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Test Job Progress */}
        {testJob && (testJob.status === 'running' || testJob.status === 'pending') && (
          <div className="space-y-2 p-4 rounded-lg bg-secondary/30 border border-border">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">
                {testJob.status === 'pending' ? 'Iniciando teste...' : 'Testando streams...'}
              </span>
              <span className="text-muted-foreground">
                {testJob.tested_channels} / {testJob.total_channels}
              </span>
            </div>
            <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${testJob.total_channels > 0 ? (testJob.tested_channels / testJob.total_channels) * 100 : 0}%` }}
              />
            </div>
            <div className="flex gap-4 text-xs">
              <span className="flex items-center gap-1">
                <CheckCircle className="h-3 w-3 text-green-500" />
                {testJob.online_count} online
              </span>
              <span className="flex items-center gap-1">
                <XCircle className="h-3 w-3 text-red-500" />
                {testJob.offline_count} offline
              </span>
              <span className="flex items-center gap-1">
                <AlertCircle className="h-3 w-3 text-yellow-500" />
                {testJob.error_count} erros
              </span>
            </div>
          </div>
        )}

        {/* Channels List */}
        <div 
          ref={listRef}
          className="max-h-[500px] overflow-y-auto space-y-2"
          onScroll={handleScroll}
        >
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : channels.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Nenhum canal encontrado
            </p>
          ) : (
            <>
              {channels.map(channel => (
                <div
                  key={channel.id}
                  className="flex items-center gap-3 p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors"
                >
                  {/* Logo */}
                  {channel.logo_url ? (
                    <img
                      src={channel.logo_url}
                      alt={channel.name}
                      className="h-10 w-10 object-contain rounded flex-shrink-0"
                      onError={(e) => (e.currentTarget.style.display = 'none')}
                    />
                  ) : (
                    <div className="h-10 w-10 bg-muted rounded flex items-center justify-center flex-shrink-0">
                      {getContentTypeIcon(channel.content_type)}
                    </div>
                  )}
                  
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium truncate">
                        {channel.clean_title || channel.name}
                      </p>
                      {channel.year && (
                        <span className="text-xs text-muted-foreground">({channel.year})</span>
                      )}
                      {channel.season_number && channel.episode_number && (
                        <Badge variant="outline" className="text-xs">
                          S{String(channel.season_number).padStart(2, '0')}E{String(channel.episode_number).padStart(2, '0')}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="truncate">{channel.category}</span>
                      {channel.subcategory && (
                        <>
                          <span>•</span>
                          <span className="truncate">{channel.subcategory}</span>
                        </>
                      )}
                      <span>•</span>
                      <span className="flex items-center gap-1 text-blue-400">
                        <LinkIcon className="h-3 w-3" />
                        {getLinkName(channel.m3u_link_id)}
                      </span>
                    </div>
                  </div>
                  
                  {/* Badges & Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Badge variant="outline" className="text-xs">
                      {channel.content_type}
                    </Badge>
                    {channel.last_test_status === 'online' && (
                      <Badge className="bg-green-600 text-xs">Online</Badge>
                    )}
                    {channel.last_test_status === 'offline' && (
                      <Badge variant="destructive" className="text-xs">Offline</Badge>
                    )}
                    <Badge variant={channel.active ? 'default' : 'secondary'} className="text-xs">
                      {channel.active ? 'Ativo' : 'Inativo'}
                    </Badge>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => updateChannelStatus(channel.id, !channel.active)}
                    >
                      {channel.active ? (
                        <XCircle className="h-4 w-4 text-red-500" />
                      ) : (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => deleteChannel(channel.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
              {loadingMore && (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  <span className="ml-2 text-sm text-muted-foreground">Carregando mais...</span>
                </div>
              )}
              {!hasMore && channels.length > 0 && (
                <p className="text-center text-sm text-muted-foreground py-4">
                  {channels.length.toLocaleString()} canais carregados
                </p>
              )}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
