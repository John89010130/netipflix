import { useState, useEffect, useRef, useCallback } from 'react';
import { Navbar } from '@/components/Navbar';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { 
  Upload, 
  Play, 
  Trash2, 
  CheckCircle, 
  XCircle, 
  Loader2,
  RefreshCw,
  Tv,
  Film,
  AlertCircle,
  Users,
  MessageCircle,
  FileUp
} from 'lucide-react';
import { Navigate } from 'react-router-dom';
import { AdminClients } from '@/components/admin/AdminClients';
import { AdminSupport } from '@/components/admin/AdminSupport';
import { AdminChannels } from '@/components/admin/AdminChannels';
import { classifyContent } from '@/utils/contentClassifier';

interface Channel {
  id: string;
  name: string;
  category: string;
  country: string;
  logo_url: string | null;
  stream_url: string;
  active: boolean;
  last_tested_at: string | null;
  last_test_status: string | null;
}

interface StreamTestResult {
  url: string;
  status: 'online' | 'offline' | 'error';
  statusCode?: number;
  error?: string;
}

interface M3uLink {
  id: string;
  url: string;
  channels_imported: number;
  imported_at: string;
  is_active: boolean;
}

interface ImportProgress {
  stage: 'downloading' | 'parsing' | 'checking' | 'inserting' | 'done';
  message: string;
  current?: number;
  total?: number;
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
  created_at: string;
}

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL || '').replace(/^http:\/\//i, 'https://');

const getProxyErrorMessage = async (response: Response): Promise<string> => {
  const contentType = response.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    const data = (await response.json().catch(() => null)) as any;
    if (data?.hint) return `${data.hint} (${response.status})`;
    if (data?.error) return `${data.error} (${response.status})`;
  }

  return `Erro ao buscar M3U: ${response.status}`;
};

const Admin = () => {
  const { isAdmin, loading } = useAuth();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [totalChannels, setTotalChannels] = useState({ total: 0, active: 0, inactive: 0 });
  const [loadingChannels, setLoadingChannels] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [m3uContent, setM3uContent] = useState('');
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(null);
  const [testJob, setTestJob] = useState<TestJob | null>(null);
  const [testResults, setTestResults] = useState<Map<string, StreamTestResult>>(new Map());
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [usedM3uLinks, setUsedM3uLinks] = useState<M3uLink[]>([]);
  const [loadingLinks, setLoadingLinks] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('active'); // Default to active
  const [allCategories, setAllCategories] = useState<string[]>([]);
  const [selectedDeleteCategory, setSelectedDeleteCategory] = useState<string>('');
  const listRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const PAGE_SIZE = 100;

  // Poll for test job status
  useEffect(() => {
    if (!isAdmin) return;
    
    const fetchJobStatus = async () => {
      try {
        const response = await fetch(`${SUPABASE_URL}/functions/v1/test-streams-background?action=status`);
        const data = await response.json();
        if (data.job) {
          setTestJob(data.job);
          // If job just completed, refresh channels
          if (data.job.status === 'completed' && testJob?.status === 'running') {
            fetchChannels();
          }
        }
      } catch (error) {
        console.error('Error fetching job status:', error);
      }
    };
    
    fetchJobStatus();
    
    // Poll every 2 seconds if a job is running
    const interval = setInterval(() => {
      if (testJob?.status === 'running' || testJob?.status === 'pending') {
        fetchJobStatus();
      }
    }, 2000);
    
    return () => clearInterval(interval);
  }, [isAdmin, testJob?.status]);

  // Fetch counts for stats
  const fetchChannelCounts = async () => {
    const [totalRes, activeRes, inactiveRes] = await Promise.all([
      supabase.from('channels').select('*', { count: 'exact', head: true }),
      supabase.from('channels').select('*', { count: 'exact', head: true }).eq('active', true),
      supabase.from('channels').select('*', { count: 'exact', head: true }).eq('active', false),
    ]);
    
    setTotalChannels({
      total: totalRes.count || 0,
      active: activeRes.count || 0,
      inactive: inactiveRes.count || 0,
    });
  };

  const fetchAllCategories = async () => {
    const { data, error } = await supabase
      .from('channels')
      .select('category')
      .order('category');
    
    if (!error && data) {
      const uniqueCategories = [...new Set(data.map(c => c.category))].sort();
      setAllCategories(uniqueCategories);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchChannelCounts();
      fetchChannels(true);
      fetchM3uLinks();
      fetchAllCategories();
    }
  }, [isAdmin]);

  // Refetch when filters change
  useEffect(() => {
    if (isAdmin) {
      fetchChannels(true);
    }
  }, [statusFilter, selectedCategory, searchTerm]);

  const fetchM3uLinks = async () => {
    setLoadingLinks(true);
    const { data, error } = await supabase
      .from('m3u_links')
      .select('*')
      .order('imported_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching m3u links:', error);
    } else {
      setUsedM3uLinks(data || []);
    }
    setLoadingLinks(false);
  };

  const saveM3uLink = async (url: string, channelsImported: number): Promise<string | null> => {
    const { data, error } = await supabase
      .from('m3u_links')
      .insert({ url, channels_imported: channelsImported })
      .select('id')
      .single();
    
    if (error) {
      console.error('Error saving m3u link:', error);
      return null;
    } else {
      fetchM3uLinks();
      return data?.id || null;
    }
  };

  const toggleM3uLinkActive = async (linkId: string, isActive: boolean) => {
    try {
      setImporting(true);
      setImportProgress({ 
        stage: 'downloading', 
        message: `${isActive ? 'Ativando' : 'Desativando'} lista...` 
      });
      
      // First update the link status
      const { error: linkError } = await supabase
        .from('m3u_links')
        .update({ is_active: isActive })
        .eq('id', linkId);
      
      if (linkError) {
        console.error('Link update error:', linkError);
        toast.error(`Erro ao atualizar status da lista: ${linkError.message}`);
        setImportProgress(null);
        return;
      }

      setImportProgress({ 
        stage: 'parsing', 
        message: 'Buscando canais da lista...' 
      });

      // Get all channel IDs for this link
      const { data: channelIds, error: fetchError } = await supabase
        .from('channels')
        .select('id')
        .eq('m3u_link_id', linkId);
      
      if (fetchError) {
        console.error('Error fetching channel IDs:', fetchError);
        toast.error('Erro ao buscar canais');
        setImportProgress(null);
        return;
      }

      if (!channelIds || channelIds.length === 0) {
        toast.info('Nenhum canal encontrado para esta lista');
        setImportProgress(null);
        await Promise.all([
          fetchM3uLinks(),
          fetchChannelCounts(),
          fetchChannels(true)
        ]);
        return;
      }

      const totalChannels = channelIds.length;
      console.log(`Updating ${totalChannels} channels in batches...`);

      // Update channels in batches to avoid timeout
      const batchSize = 100;
      let updatedCount = 0;

      for (let i = 0; i < channelIds.length; i += batchSize) {
        const batch = channelIds.slice(i, i + batchSize);
        const batchIds = batch.map(c => c.id);
        
        setImportProgress({ 
          stage: 'inserting', 
          message: `${isActive ? 'Ativando' : 'Desativando'} canais...`,
          current: Math.min(updatedCount + batch.length, totalChannels),
          total: totalChannels
        });
        
        const { error: batchError } = await supabase
          .from('channels')
          .update({ active: isActive })
          .in('id', batchIds);
        
        if (batchError) {
          console.error(`Batch update error (${i}-${i + batch.length}):`, batchError);
        } else {
          updatedCount += batch.length;
          console.log(`Updated ${updatedCount}/${totalChannels} channels`);
        }
      }

      console.log(`Successfully updated ${updatedCount} channels`);

      setImportProgress({ 
        stage: 'done', 
        message: `${updatedCount} canais ${isActive ? 'ativados' : 'desativados'}!` 
      });

      toast.success(isActive 
        ? `Lista e ${updatedCount} canais ativados!` 
        : `Lista e ${updatedCount} canais desativados!`
      );
      
      // Reload all data
      await Promise.all([
        fetchM3uLinks(),
        fetchChannelCounts(),
        fetchChannels(true)
      ]);
      
    } catch (error) {
      console.error('Toggle link active error:', error);
      toast.error('Erro inesperado ao atualizar lista');
    } finally {
      setTimeout(() => {
        setImporting(false);
        setImportProgress(null);
      }, 1500);
    }
  };

  const fetchChannels = async (reset = false) => {
    if (reset) {
      setLoadingChannels(true);
      setChannels([]);
    } else {
      setLoadingMore(true);
    }
    
    const from = reset ? 0 : channels.length;
    
    let query = supabase
      .from('channels')
      .select('*')
      .order('name')
      .range(from, from + PAGE_SIZE - 1);
    
    // Apply status filter
    if (statusFilter === 'active') {
      query = query.eq('active', true);
    } else if (statusFilter === 'inactive') {
      query = query.eq('active', false);
    }
    
    // Apply category filter
    if (selectedCategory !== 'all') {
      query = query.eq('category', selectedCategory);
    }
    
    // Apply search filter
    if (searchTerm.trim()) {
      query = query.ilike('name', `%${searchTerm.trim()}%`);
    }
    
    const { data, error } = await query;
    
    if (error) {
      toast.error('Erro ao carregar canais');
      console.error(error);
    } else {
      const newChannels = data || [];
      if (reset) {
        setChannels(newChannels);
      } else {
        setChannels(prev => [...prev, ...newChannels]);
      }
      setHasMore(newChannels.length === PAGE_SIZE);
    }
    
    setLoadingChannels(false);
    setLoadingMore(false);
  };

  const loadMore = useCallback(() => {
    if (!loadingMore && hasMore) {
      fetchChannels(false);
    }
  }, [loadingMore, hasMore, channels.length, statusFilter, selectedCategory, searchTerm]);

  // Infinite scroll handler
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - scrollTop <= clientHeight + 100) {
      loadMore();
    }
  }, [loadMore]);

  // Helper: Remove color tags like [COLOR orange]...[/COLOR]
  const cleanColorTags = (text: string): string => {
    return text
      .replace(/\[COLOR[^\]]*\]/gi, '')
      .replace(/\[\/COLOR\]/gi, '')
      .trim();
  };

  // Helper: Check if URL is valid (not just protocol)
  const isValidStreamUrl = (url: string): boolean => {
    const trimmed = url.trim();
    if (trimmed === 'http://' || trimmed === 'https://') return false;
    if (!trimmed.match(/^https?:\/\/.+\..+/)) return false;
    return true;
  };

  // Helper: Check if entry is a section header/separator
  const isSectionHeader = (name: string): boolean => {
    const cleaned = cleanColorTags(name);
    if (!cleaned || cleaned.length === 0) return true;
    // If name is wrapped in parentheses/brackets and is all caps, it's likely a separator
    if (/^[\(\[\{]?[A-ZÁÉÍÓÚÀÂÊÔÃÕÇ\s]+[\)\]\}]?$/i.test(cleaned) && cleaned.length < 50) {
      // Check if it looks like a title separator (all caps, short)
      if (cleaned === cleaned.toUpperCase() && !cleaned.match(/\d/)) return true;
    }
    return false;
  };

  const parseM3U = (content: string): Omit<Channel, 'id'>[] => {
    const lines = content.split('\n');
    const channels: Omit<Channel, 'id'>[] = [];
    let currentChannel: Partial<Omit<Channel, 'id'>> & { series_title?: string } = {};

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      if (line.startsWith('#EXTINF:')) {
        // Parse channel info
        const logoMatch = line.match(/tvg-logo="([^"]+)"/);
        const groupMatch = line.match(/group-title="([^"]+)"/);
        const subgroupMatch = line.match(/pltv-subgroup="([^"]+)"/);
        const nameMatch = line.match(/,(.+)$/);

        const rawName = nameMatch?.[1]?.trim() || '';
        const rawCategory = groupMatch?.[1] || 'Geral';
        
        // Clean color tags from name and category
        let channelName = cleanColorTags(rawName);
        const category = cleanColorTags(rawCategory);
        
        // Skip if no valid name after cleaning or if it's a section header
        if (!channelName || isSectionHeader(channelName)) {
          currentChannel = {};
          continue;
        }

        const subgroup = subgroupMatch?.[1]?.trim();
        
        // If there's a subgroup (series name) and the name looks like an episode pattern,
        // prepend the series name to make it searchable and store the series_title
        let seriesTitle: string | undefined = undefined;
        if (subgroup && /^T?\d+\|EP\d+/i.test(channelName)) {
          seriesTitle = subgroup;
          channelName = `${subgroup} ${channelName}`;
        }

        currentChannel = {
          logo_url: logoMatch?.[1] || null,
          category: category || 'Geral',
          name: channelName,
          country: 'BR',
          active: true,
          series_title: seriesTitle,
        };
      } else if (line.startsWith('http') && currentChannel.name) {
        // Only add if URL is valid
        if (isValidStreamUrl(line)) {
          currentChannel.stream_url = line;
          
          // Usar o classificador inteligente para determinar o tipo de conteúdo
          const classification = classifyContent(
            currentChannel.name!,
            currentChannel.category!,
            line
          );
          
          // Adicionar informações de classificação
          (currentChannel as any).content_type = classification.contentType;
          
          // Log para debug (apenas em development)
          if (import.meta.env.DEV && classification.confidence < 60) {
            console.log(`[Classificação] ${currentChannel.name}:`, {
              type: classification.contentType,
              confidence: classification.confidence,
              reasons: classification.reasons
            });
          }
          
          channels.push(currentChannel as Omit<Channel, 'id'>);
        }
        currentChannel = {};
      }
    }

    return channels;
  };

  // Convert GitHub URLs to raw format
  const convertToRawUrl = (url: string): string => {
    const trimmedUrl = url.trim();
    
    // GitHub blob URL -> raw
    if (trimmedUrl.includes('github.com') && trimmedUrl.includes('/blob/')) {
      return trimmedUrl
        .replace('github.com', 'raw.githubusercontent.com')
        .replace('/blob/', '/');
    }
    
    // Already raw.githubusercontent.com - return as is
    if (trimmedUrl.includes('raw.githubusercontent.com')) {
      return trimmedUrl;
    }
    
    return trimmedUrl;
  };

  // Fetch all existing stream URLs without limit
  const fetchAllStreamUrls = async (): Promise<Set<string>> => {
    const allUrls: string[] = [];
    let from = 0;
    const batchSize = 1000;
    let hasMore = true;
    
    while (hasMore) {
      const { data, error } = await supabase
        .from('channels')
        .select('stream_url')
        .range(from, from + batchSize - 1);
      
      if (error) {
        console.error('Error fetching stream URLs:', error);
        break;
      }
      
      if (data && data.length > 0) {
        allUrls.push(...data.map(c => c.stream_url));
        from += batchSize;
        hasMore = data.length === batchSize;
      } else {
        hasMore = false;
      }
    }
    
    return new Set(allUrls);
  };

  const importFromUrl = async (url: string) => {
    setImporting(true);
    
    try {
      const rawUrl = convertToRawUrl(url.trim());
      console.log('Fetching M3U from:', rawUrl);
      
      // Use edge function as proxy to avoid CORS
      const response = await fetch(`${SUPABASE_URL}/functions/v1/stream-proxy?url=${encodeURIComponent(rawUrl)}`);
      
      if (!response.ok) {
        throw new Error(await getProxyErrorMessage(response));
      }
      
      const content = await response.text();
      const parsedChannels = parseM3U(content);
      
      if (parsedChannels.length === 0) {
        toast.error('Nenhum canal encontrado no M3U. Verifique o formato.');
        return 0;
      }

      // Get all existing stream URLs to avoid duplicates
      const existingUrls = await fetchAllStreamUrls();
      
      // Filter out duplicates
      const newChannels = parsedChannels.filter(c => !existingUrls.has(c.stream_url));
      
      if (newChannels.length === 0) {
        toast.info('Todos os canais já existem no banco.');
        return 0;
      }

      // Insert in batches
      const batchSize = 50;
      let inserted = 0;

      for (let i = 0; i < newChannels.length; i += batchSize) {
        const batch = newChannels.slice(i, i + batchSize);
        const { error } = await supabase.from('channels').insert(batch);
        
        if (error) {
          console.error('Batch insert error:', error);
        } else {
          inserted += batch.length;
        }
      }

      return inserted;
    } catch (error) {
      console.error('Import error:', error);
      throw error;
    }
  };

  const handleImportM3U = async () => {
    if (!m3uContent.trim()) {
      toast.error('Cole o conteúdo M3U ou uma URL');
      return;
    }

    setImporting(true);
    setImportProgress({ stage: 'downloading', message: 'Iniciando...' });
    
    try {
      let inserted = 0;
      let importedUrl = '';
      let content = m3uContent;

      // If it's a URL, download the content first
      if (m3uContent.trim().startsWith('http')) {
        importedUrl = convertToRawUrl(m3uContent.trim());
        setImportProgress({ stage: 'downloading', message: 'Baixando lista M3U...' });
        
        const response = await fetch(`${SUPABASE_URL}/functions/v1/stream-proxy?url=${encodeURIComponent(importedUrl)}`);
        
        if (!response.ok) {
          throw new Error(await getProxyErrorMessage(response));
        }
        
        content = await response.text();
      }

      // Parse the M3U content
      setImportProgress({ stage: 'parsing', message: 'Analisando canais...' });
      const parsedChannels = parseM3U(content);
      
      if (parsedChannels.length === 0) {
        toast.error('Nenhum canal encontrado no M3U. Verifique o formato.');
        setImportProgress(null);
        setImporting(false);
        return;
      }

      // Gerar estatísticas de classificação
      const tvCount = parsedChannels.filter((c: any) => c.content_type === 'TV').length;
      const movieCount = parsedChannels.filter((c: any) => c.content_type === 'MOVIE').length;
      const seriesCount = parsedChannels.filter((c: any) => c.content_type === 'SERIES').length;

      setImportProgress({ 
        stage: 'parsing', 
        message: `${parsedChannels.length} canais encontrados (TV: ${tvCount}, Filmes: ${movieCount}, Séries: ${seriesCount})` 
      });

      // Check for duplicates
      setImportProgress({ stage: 'checking', message: 'Verificando duplicados...' });
      const existingUrls = await fetchAllStreamUrls();
      const newChannels = parsedChannels.filter(c => !existingUrls.has(c.stream_url));
      
      if (newChannels.length === 0) {
        toast.info('Todos os canais já existem no banco.');
        setImportProgress(null);
        setImporting(false);
        return;
      }

      setImportProgress({ 
        stage: 'checking', 
        message: `${newChannels.length} novos canais para importar` 
      });

      // Save the M3U link first to get the ID
      let linkId: string | null = null;
      if (importedUrl) {
        linkId = await saveM3uLink(importedUrl, newChannels.length);
      }

      // Insert in batches with progress
      const batchSize = 50;
      const totalBatches = Math.ceil(newChannels.length / batchSize);

      for (let i = 0; i < newChannels.length; i += batchSize) {
        const batch = newChannels.slice(i, i + batchSize);
        const currentBatch = Math.floor(i / batchSize) + 1;
        
        setImportProgress({ 
          stage: 'inserting', 
          message: `Inserindo canais...`,
          current: inserted + batch.length,
          total: newChannels.length
        });

        // Add m3u_link_id to each channel if we have one
        const batchWithLink = linkId 
          ? batch.map(c => ({ ...c, m3u_link_id: linkId }))
          : batch;

        const { error } = await supabase.from('channels').insert(batchWithLink);
        
        if (error) {
          console.error('Batch insert error:', error);
        } else {
          inserted += batch.length;
        }
      }

      // Update link with actual inserted count
      if (linkId && inserted !== newChannels.length) {
        await supabase
          .from('m3u_links')
          .update({ channels_imported: inserted })
          .eq('id', linkId);
      }

      setImportProgress({ stage: 'done', message: `${inserted} canais importados!` });

      if (inserted > 0) {
        toast.success(`${inserted} novos canais importados!`);
      }
      
      setM3uContent('');
      fetchChannels(true);
      fetchChannelCounts();
    } catch (error) {
      console.error('Import error:', error);
      const msg = error instanceof Error ? error.message : 'Erro ao importar M3U.';
      toast.error(msg);
    } finally {
      setTimeout(() => {
        setImporting(false);
        setImportProgress(null);
      }, 2000);
    }
  };

  const handleReimport = async (url: string) => {
    setImporting(true);
    try {
      const inserted = await importFromUrl(url);
      
      if (inserted > 0) {
        // Update the link record
        await supabase
          .from('m3u_links')
          .update({ channels_imported: inserted, imported_at: new Date().toISOString() })
          .eq('url', url);
        
        toast.success(`${inserted} novos canais importados!`);
        fetchChannels();
        fetchM3uLinks();
      } else {
        toast.info('Nenhum canal novo encontrado.');
      }
    } catch (error) {
      console.error('Reimport error:', error);
      const msg = error instanceof Error ? error.message : 'Erro ao reimportar.';
      toast.error(msg);
    } finally {
      setImporting(false);
    }
  };

  const startBackgroundTest = async () => {
    toast.error('Testes de stream desabilitados');
    return;
  };

  const isTestRunning = testJob?.status === 'running' || testJob?.status === 'pending';

  const updateChannelStatus = async (channelId: string, active: boolean) => {
    const { error } = await supabase
      .from('channels')
      .update({ active })
      .eq('id', channelId);

    if (error) {
      toast.error('Erro ao atualizar canal');
    } else {
      setChannels(prev => 
        prev.map(c => c.id === channelId ? { ...c, active } : c)
      );
      toast.success(active ? 'Canal ativado' : 'Canal desativado');
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
      toast.success('Canal excluído');
    }
  };

  const deactivateOfflineChannels = async () => {
    const offlineUrls = Array.from(testResults.entries())
      .filter(([_, result]) => result.status !== 'online')
      .map(([url]) => url);

    console.log('Offline URLs found:', offlineUrls.length);

    if (offlineUrls.length === 0) {
      toast.info('Nenhum canal offline para desativar');
      return;
    }

    const channelsToDeactivate = channels.filter(c => offlineUrls.includes(c.stream_url));
    console.log('Channels to deactivate:', channelsToDeactivate.map(c => ({ id: c.id, name: c.name })));
    
    let deactivatedCount = 0;
    let errorCount = 0;

    for (const channel of channelsToDeactivate) {
      const { error } = await supabase
        .from('channels')
        .update({ active: false })
        .eq('id', channel.id);
      
      if (error) {
        console.error('Error deactivating channel:', channel.name, error);
        errorCount++;
      } else {
        console.log('Deactivated:', channel.name);
        deactivatedCount++;
      }
    }

    if (errorCount > 0) {
      toast.error(`Erro ao desativar ${errorCount} canais. Verifique permissões.`);
    }
    
    if (deactivatedCount > 0) {
      toast.success(`${deactivatedCount} canais desativados`);
    }
    
    fetchChannels(true);
    fetchChannelCounts();
  };

  const deleteSeriesWithoutTitle = async () => {
    const confirmed = window.confirm(
      'Isso vai deletar todos os episódios de séries cujo nome é apenas "T01|EP01" (sem título da série).\n\n' +
      'Após deletar, você deve reimportar o M3U para recuperar os episódios com os nomes corretos.\n\n' +
      'Continuar?'
    );
    
    if (!confirmed) return;
    
    setImporting(true);
    
    try {
      // Delete series episodes with generic names (no series title)
      const { error, count } = await supabase
        .from('channels')
        .delete()
        .eq('content_type', 'SERIES')
        .is('series_title', null)
        .like('name', '%|EP%');
      
      if (error) throw error;
      
      toast.success(`${count || 0} episódios sem título deletados. Reimporte o M3U agora.`);
      fetchChannels(true);
      fetchChannelCounts();
      fetchAllCategories();
    } catch (error) {
      console.error('Error deleting series:', error);
      toast.error('Erro ao deletar séries sem título');
    } finally {
      setImporting(false);
    }
  };

  const deleteAndReimportCategory = async (category: string, linkUrl?: string) => {
    if (!category) {
      toast.error('Selecione uma categoria');
      return;
    }

    const confirmed = window.confirm(
      `Isso vai DELETAR todos os canais da categoria "${category}" e reimportar do link selecionado.\n\n` +
      `Continuar?`
    );
    
    if (!confirmed) return;
    
    setImporting(true);
    
    try {
      // Delete all channels from the category
      const { error: deleteError, count } = await supabase
        .from('channels')
        .delete()
        .eq('category', category);
      
      if (deleteError) throw deleteError;
      
      toast.success(`${count || 0} canais da categoria "${category}" deletados.`);
      
      // If a link URL was provided, reimport
      if (linkUrl) {
        const inserted = await importFromUrl(linkUrl);
        if (inserted > 0) {
          toast.success(`${inserted} novos canais importados!`);
        }
      }
      
      fetchChannels(true);
      fetchChannelCounts();
      fetchAllCategories();
      setSelectedDeleteCategory('');
    } catch (error) {
      console.error('Error deleting category:', error);
      toast.error('Erro ao deletar categoria');
    } finally {
      setImporting(false);
    }
  };

  // Reimport from link (delete old channels and reimport)
  const reimportFromLink = async (linkId: string, linkUrl: string) => {
    const confirmed = window.confirm(
      `Isso vai DELETAR todos os canais desta lista e REIMPORTAR do link.\n\n` +
      `Link: ${linkUrl.substring(0, 60)}...\n\n` +
      `Deseja continuar?`
    );
    
    if (!confirmed) return;
    
    setImporting(true);
    
    try {
      // Delete all channels from this link
      const { error: deleteError, count } = await supabase
        .from('channels')
        .delete()
        .eq('m3u_link_id', linkId);
      
      if (deleteError) {
        throw deleteError;
      }
      
      toast.success(`${count || 0} canais deletados. Reimportando...`);
      
      // Reimport from URL
      const rawUrl = convertToRawUrl(linkUrl);
      const response = await fetch(`${SUPABASE_URL}/functions/v1/stream-proxy?url=${encodeURIComponent(rawUrl)}`);
      
      if (!response.ok) {
        throw new Error(await getProxyErrorMessage(response));
      }
      
      const content = await response.text();
      const parsedChannels = parseM3U(content);
      
      if (parsedChannels.length === 0) {
        toast.error('Nenhum canal encontrado no M3U');
        return;
      }
      
      // Get existing URLs to avoid duplicates
      const existingUrls = await fetchAllStreamUrls();
      const newChannels = parsedChannels.filter(c => !existingUrls.has(c.stream_url));
      
      // Insert with the same link ID
      let inserted = 0;
      const batchSize = 50;
      
      for (let i = 0; i < newChannels.length; i += batchSize) {
        const batch = newChannels.slice(i, i + batchSize);
        const batchWithLink = batch.map(c => ({ ...c, m3u_link_id: linkId }));
        
        const { error } = await supabase.from('channels').insert(batchWithLink);
        
        if (!error) {
          inserted += batch.length;
        }
      }
      
      // Update link record
      await supabase
        .from('m3u_links')
        .update({ 
          channels_imported: inserted,
          imported_at: new Date().toISOString()
        })
        .eq('id', linkId);
      
      toast.success(`${inserted} canais reimportados com sucesso!`);
      
      fetchChannels(true);
      fetchChannelCounts();
      fetchM3uLinks();
      fetchAllCategories();
    } catch (error) {
      console.error('Error reimporting:', error);
      toast.error('Erro ao reimportar. Verifique se o link ainda está válido.');
    } finally {
      setImporting(false);
    }
  };

  // Delete entire M3U list (link and all channels) using edge function
  const deleteM3uList = async (linkId: string, linkUrl: string) => {
    const confirmed = window.confirm(
      `Isso vai DELETAR PERMANENTEMENTE esta lista e TODOS os seus canais.\n\n` +
      `Link: ${linkUrl.substring(0, 60)}...\n\n` +
      `Esta ação não pode ser desfeita. Deseja continuar?`
    );
    
    if (!confirmed) return;
    
    setImporting(true);
    setImportProgress({ stage: 'downloading', message: 'Deletando lista e canais...', current: 0, total: 100 });
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Sessão expirada. Faça login novamente.');
      }

      const response = await fetch(`${SUPABASE_URL}/functions/v1/delete-m3u-list`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ linkId }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Erro ao deletar lista');
      }

      setImportProgress({ 
        stage: 'done', 
        message: `Lista deletada! ${result.deletedChannels} canais removidos.` 
      });
      
      toast.success(`Lista deletada! ${result.deletedChannels} canais removidos.`);
      
      await Promise.all([
        fetchChannels(true),
        fetchChannelCounts(),
        fetchM3uLinks(),
        fetchAllCategories()
      ]);
    } catch (error) {
      console.error('Error deleting list:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      toast.error(`Erro ao deletar lista: ${errorMessage}`);
    } finally {
      setTimeout(() => {
        setImporting(false);
        setImportProgress(null);
      }, 1500);
    }
  };

  // Delete all channels imported from a specific M3U link and reimport (legacy function - keeping for compatibility)
  const deleteAndReimportFromLink = async (linkUrl: string) => {
    const confirmed = window.confirm(
      `Isso vai DELETAR todos os canais deste link e reimportar com o parser atualizado.\n\n` +
      `Link: ${linkUrl.substring(0, 80)}...\n\n` +
      `Continuar?`
    );
    
    if (!confirmed) return;
    
    setImporting(true);
    
    try {
      // First, fetch the M3U content to get all stream URLs from this link
      const rawUrl = convertToRawUrl(linkUrl);
      const response = await fetch(`${SUPABASE_URL}/functions/v1/stream-proxy?url=${encodeURIComponent(rawUrl)}`);
      
      if (!response.ok) {
        throw new Error(await getProxyErrorMessage(response));
      }
      
      const content = await response.text();
      
      // Parse without filtering to get all stream URLs (including invalid ones that were previously imported)
      const lines = content.split('\n');
      const streamUrls: string[] = [];
      
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
          streamUrls.push(trimmed);
        }
      }
      
      if (streamUrls.length === 0) {
        toast.error('Nenhuma URL encontrada no M3U');
        return;
      }
      
      // Delete channels with these stream URLs in batches
      let deletedCount = 0;
      const batchSize = 100;
      
      for (let i = 0; i < streamUrls.length; i += batchSize) {
        const batch = streamUrls.slice(i, i + batchSize);
        const { error, count } = await supabase
          .from('channels')
          .delete()
          .in('stream_url', batch);
        
        if (!error && count) {
          deletedCount += count;
        }
      }
      
      toast.success(`${deletedCount} canais deletados. Reimportando...`);
      
      // Now reimport with the improved parser
      const inserted = await importFromUrl(linkUrl);
      
      if (inserted > 0) {
        // Update the link record
        await supabase
          .from('m3u_links')
          .update({ channels_imported: inserted, imported_at: new Date().toISOString() })
          .eq('url', linkUrl);
        
        toast.success(`${inserted} canais reimportados com o parser corrigido!`);
      } else {
        toast.info('Nenhum canal novo importado.');
      }
      
      fetchChannels(true);
      fetchChannelCounts();
      fetchM3uLinks();
      fetchAllCategories();
    } catch (error) {
      console.error('Error deleting and reimporting:', error);
      toast.error('Erro ao deletar e reimportar. Verifique se o link ainda está válido.');
    } finally {
      setImporting(false);
    }
  };

  const categories = ['all', ...new Set(channels.map(c => c.category))];
  
  // No need to filter again since the query already applies filters
  const filteredChannels = channels;

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <div className="pt-24 pb-16 px-4 md:px-12">
        <div className="max-w-7xl mx-auto">
          <h1 className="font-display text-3xl md:text-4xl mb-8">Painel Administrativo</h1>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <Card 
              className={`cursor-pointer transition-all hover:ring-2 hover:ring-primary/50 ${statusFilter === 'all' ? 'ring-2 ring-primary' : ''}`}
              onClick={() => setStatusFilter('all')}
            >
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <Tv className="h-8 w-8 text-primary" />
                  <div>
                    <p className="text-2xl font-bold">{totalChannels.total}</p>
                    <p className="text-sm text-muted-foreground">Total de Canais</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card 
              className={`cursor-pointer transition-all hover:ring-2 hover:ring-green-500/50 ${statusFilter === 'active' ? 'ring-2 ring-green-500' : ''}`}
              onClick={() => setStatusFilter('active')}
            >
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-8 w-8 text-green-500" />
                  <div>
                    <p className="text-2xl font-bold">{totalChannels.active}</p>
                    <p className="text-sm text-muted-foreground">Ativos</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card 
              className={`cursor-pointer transition-all hover:ring-2 hover:ring-red-500/50 ${statusFilter === 'inactive' ? 'ring-2 ring-red-500' : ''}`}
              onClick={() => setStatusFilter('inactive')}
            >
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <XCircle className="h-8 w-8 text-red-500" />
                  <div>
                    <p className="text-2xl font-bold">{totalChannels.inactive}</p>
                    <p className="text-sm text-muted-foreground">Inativos</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <Film className="h-8 w-8 text-blue-500" />
                  <div>
                    <p className="text-2xl font-bold">{categories.length - 1}</p>
                    <p className="text-sm text-muted-foreground">Categorias</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="channels" className="space-y-6">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="channels">Canais</TabsTrigger>
              <TabsTrigger value="import">Importar M3U</TabsTrigger>
              <TabsTrigger value="links">Links Usados</TabsTrigger>
              <TabsTrigger value="clients" className="gap-1">
                <Users className="h-4 w-4" />
                Clientes
              </TabsTrigger>
              <TabsTrigger value="support" className="gap-1">
                <MessageCircle className="h-4 w-4" />
                Suporte
              </TabsTrigger>
            </TabsList>

            {/* Channels Tab */}
            <TabsContent value="channels" className="space-y-6">
              <AdminChannels 
                testJob={testJob}
                onStartTest={startBackgroundTest}
                isTestRunning={isTestRunning}
                onRefreshChannels={() => fetchChannels(true)}
              />
            </TabsContent>

            {/* Import Tab */}
            <TabsContent value="import" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Upload className="h-5 w-5" />
                    Importar Lista M3U
                  </CardTitle>
                  <CardDescription>
                    Faça upload de um arquivo M3U, cole o conteúdo ou uma URL direta
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* File Upload */}
                  <div className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary/50 transition-colors">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".m3u,.m3u8,.txt"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (event) => {
                            const content = event.target?.result as string;
                            setM3uContent(content);
                            toast.success(`Arquivo "${file.name}" carregado!`);
                          };
                          reader.onerror = () => {
                            toast.error('Erro ao ler o arquivo');
                          };
                          reader.readAsText(file);
                        }
                        // Reset input so same file can be selected again
                        e.target.value = '';
                      }}
                      className="hidden"
                    />
                    <FileUp className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground mb-2">
                      Arraste um arquivo ou clique para selecionar
                    </p>
                    <Button
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={importing}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Selecionar Arquivo M3U
                    </Button>
                    <p className="text-xs text-muted-foreground mt-2">
                      Formatos aceitos: .m3u, .m3u8, .txt
                    </p>
                  </div>

                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-border" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-card px-2 text-muted-foreground">ou cole o conteúdo</span>
                    </div>
                  </div>

                  <Textarea
                    placeholder="Cole aqui o conteúdo M3U ou a URL do arquivo (ex: https://raw.githubusercontent.com/...)"
                    value={m3uContent}
                    onChange={(e) => setM3uContent(e.target.value)}
                    rows={10}
                    className="font-mono text-sm"
                  />
                  {/* Import Progress */}
                  {importProgress && (
                    <div className="p-4 bg-muted/50 rounded-lg space-y-3">
                      <div className="flex items-center gap-3">
                        <Loader2 className="h-5 w-5 animate-spin text-primary" />
                        <div className="flex-1">
                          <p className="font-medium text-sm">{importProgress.message}</p>
                          {importProgress.current !== undefined && importProgress.total !== undefined && (
                            <p className="text-xs text-muted-foreground">
                              {importProgress.current} de {importProgress.total}
                            </p>
                          )}
                        </div>
                      </div>
                      {importProgress.current !== undefined && importProgress.total !== undefined && (
                        <Progress 
                          value={(importProgress.current / importProgress.total) * 100} 
                          className="h-2"
                        />
                      )}
                    </div>
                  )}

                  <div className="flex gap-4">
                    <Button
                      onClick={handleImportM3U}
                      disabled={importing || !m3uContent.trim()}
                    >
                      {importing ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Upload className="h-4 w-4 mr-2" />
                      )}
                      Importar Canais
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setM3uContent('')}
                      disabled={importing}
                    >
                      Limpar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Used Links Tab */}
            <TabsContent value="links" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertCircle className="h-5 w-5" />
                    Links M3U Já Utilizados
                  </CardTitle>
                  <CardDescription>
                    Histórico de links M3U importados para referência
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {loadingLinks ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                  ) : usedM3uLinks.length === 0 ? (
                    <p className="text-muted-foreground">Nenhum link registrado ainda.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border">
                            <th className="text-center py-3 px-2 font-medium">Ativo</th>
                            <th className="text-left py-3 px-2 font-medium">URL</th>
                            <th className="text-center py-3 px-2 font-medium">Canais</th>
                            <th className="text-center py-3 px-2 font-medium">Data</th>
                            <th className="text-right py-3 px-2 font-medium">Ações</th>
                          </tr>
                        </thead>
                        <tbody>
                          {usedM3uLinks.map((link) => {
                            const isOrphanList = link.url.startsWith('internal://orphan-channels');
                            
                            return (
                            <tr 
                              key={link.id} 
                              className={`border-b border-border/50 hover:bg-secondary/30 ${!link.is_active ? 'opacity-60' : ''} ${isOrphanList ? 'bg-amber-500/5' : ''}`}
                            >
                              <td className="text-center py-3 px-2">
                                <Switch
                                  checked={link.is_active}
                                  onCheckedChange={(checked) => toggleM3uLinkActive(link.id, checked)}
                                  title={link.is_active ? 'Desativar todos os canais desta lista' : 'Ativar todos os canais desta lista'}
                                />
                              </td>
                              <td className="py-3 px-2">
                                {isOrphanList ? (
                                  <div className="flex items-center gap-2">
                                    <code className="text-xs bg-amber-500/10 px-2 py-1 rounded border border-amber-500/20">
                                      🔗 Canais Órfãos (Sistema)
                                    </code>
                                    <span className="text-xs text-muted-foreground">
                                      Canais importados sem link associado
                                    </span>
                                  </div>
                                ) : (
                                  <code className="text-xs bg-muted px-2 py-1 rounded truncate block max-w-[350px]">
                                    {link.url}
                                  </code>
                                )}
                              </td>
                              <td className="text-center py-3 px-2">
                                <Badge variant={link.is_active ? 'secondary' : 'outline'}>
                                  {link.channels_imported}
                                </Badge>
                              </td>
                              <td className="text-center py-3 px-2 text-muted-foreground">
                                {new Date(link.imported_at).toLocaleDateString('pt-BR', {
                                  day: '2-digit',
                                  month: '2-digit',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </td>
                              <td className="text-right py-3 px-2">
                                <div className="flex items-center justify-end gap-1">
                                  {isOrphanList ? (
                                    <>
                                      <Button
                                        size="sm"
                                        variant="destructive"
                                        disabled={importing}
                                        onClick={() => deleteM3uList(link.id, link.url)}
                                        title="Deletar canais órfãos: Remove permanentemente todos os canais sem link associado"
                                        className="h-8"
                                      >
                                        <Trash2 className="h-3.5 w-3.5 mr-1" />
                                        Limpar Órfãos
                                      </Button>
                                    </>
                                  ) : (
                                    <>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        disabled={importing}
                                        onClick={() => reimportFromLink(link.id, link.url)}
                                        title="Reimportar: Deletar canais antigos e reimportar do link"
                                        className="h-8"
                                      >
                                        <RefreshCw className="h-3.5 w-3.5 mr-1" />
                                        Reimportar
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="destructive"
                                        disabled={importing}
                                        onClick={() => deleteM3uList(link.id, link.url)}
                                        title="Deletar lista: Remove permanentemente o link e todos os canais"
                                        className="h-8"
                                      >
                                        <Trash2 className="h-3.5 w-3.5 mr-1" />
                                        Deletar
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => {
                                          navigator.clipboard.writeText(link.url);
                                          toast.success('Link copiado!');
                                        }}
                                        title="Copiar URL"
                                        className="h-8"
                                      >
                                        Copiar
                                      </Button>
                                    </>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                  <div className="mt-4 p-4 bg-muted/50 rounded-lg space-y-3">
                    <p className="text-sm font-medium">Ações Disponíveis:</p>
                    <div className="space-y-2 text-sm text-muted-foreground">
                      <div className="flex items-start gap-2">
                        <div className="mt-0.5">🔄</div>
                        <div>
                          <strong>Ativar/Inativar:</strong> Use o switch para ativar ou desativar todos os canais da lista sem deletá-los.
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <div className="mt-0.5">♻️</div>
                        <div>
                          <strong>Reimportar:</strong> Deleta os canais antigos e reimporta do mesmo link usando o parser atualizado. 
                          Útil após melhorias no sistema de classificação.
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <div className="mt-0.5">🗑️</div>
                        <div>
                          <strong>Deletar:</strong> Remove permanentemente o link e todos os seus canais. 
                          Esta ação não pode ser desfeita.
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 p-4 bg-muted/50 rounded-lg space-y-4">
                    <p className="text-sm text-muted-foreground">
                      <strong>Nota:</strong> Muitas listas M3U públicas têm URLs que expiram rapidamente. 
                      Use o botão "Testar Canais" regularmente para identificar e desativar streams offline.
                    </p>
                    
                    {/* Delete and Reimport by Category */}
                    <div className="pt-3 border-t border-border">
                      <p className="text-sm text-muted-foreground mb-3">
                        <strong>Deletar e reimportar categoria:</strong> Selecione uma categoria para deletar todos os canais 
                        e reimportar de um link.
                      </p>
                      <div className="flex flex-wrap gap-3 items-end">
                        <div className="flex-1 min-w-[200px]">
                          <label className="text-xs text-muted-foreground mb-1 block">Categoria</label>
                          <select
                            value={selectedDeleteCategory}
                            onChange={(e) => setSelectedDeleteCategory(e.target.value)}
                            className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm"
                          >
                            <option value="">Selecione uma categoria...</option>
                            {allCategories.map(cat => (
                              <option key={cat} value={cat}>{cat}</option>
                            ))}
                          </select>
                        </div>
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={importing || !selectedDeleteCategory}
                          onClick={() => deleteAndReimportCategory(selectedDeleteCategory)}
                        >
                          {importing ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4 mr-2" />
                          )}
                          Deletar Categoria
                        </Button>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-border">
                      <p className="text-sm text-muted-foreground mb-2">
                        <strong>Corrigir episódios de séries:</strong> Se episódios foram importados com nomes genéricos 
                        (ex: "T01|EP01" sem o nome da série), delete-os e reimporte o M3U.
                      </p>
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={importing}
                        onClick={deleteSeriesWithoutTitle}
                      >
                        {importing ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4 mr-2" />
                        )}
                        Deletar Séries sem Título
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            {/* Clients Tab */}
            <TabsContent value="clients">
              <AdminClients />
            </TabsContent>

            {/* Support Tab */}
            <TabsContent value="support">
              <AdminSupport />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default Admin;
