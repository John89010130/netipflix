import { useState, useEffect } from 'react';
import { Navbar } from '@/components/Navbar';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
  AlertCircle
} from 'lucide-react';
import { Navigate } from 'react-router-dom';

interface Channel {
  id: string;
  name: string;
  category: string;
  country: string;
  logo_url: string | null;
  stream_url: string;
  active: boolean;
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
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

const Admin = () => {
  const { isAdmin, loading } = useAuth();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loadingChannels, setLoadingChannels] = useState(true);
  const [m3uContent, setM3uContent] = useState('');
  const [importing, setImporting] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testProgress, setTestProgress] = useState({ current: 0, total: 0, online: 0, offline: 0 });
  const [testResults, setTestResults] = useState<Map<string, StreamTestResult>>(new Map());
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [usedM3uLinks, setUsedM3uLinks] = useState<M3uLink[]>([]);
  const [loadingLinks, setLoadingLinks] = useState(true);

  useEffect(() => {
    if (isAdmin) {
      fetchChannels();
      fetchM3uLinks();
    }
  }, [isAdmin]);

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

  const saveM3uLink = async (url: string, channelsImported: number) => {
    const { error } = await supabase
      .from('m3u_links')
      .insert({ url, channels_imported: channelsImported });
    
    if (error) {
      console.error('Error saving m3u link:', error);
    } else {
      fetchM3uLinks();
    }
  };

  const fetchChannels = async () => {
    setLoadingChannels(true);
    const { data, error } = await supabase
      .from('channels')
      .select('*')
      .order('name');
    
    if (error) {
      toast.error('Erro ao carregar canais');
      console.error(error);
    } else {
      setChannels(data || []);
    }
    setLoadingChannels(false);
  };

  const parseM3U = (content: string): Omit<Channel, 'id'>[] => {
    const lines = content.split('\n');
    const channels: Omit<Channel, 'id'>[] = [];
    let currentChannel: Partial<Omit<Channel, 'id'>> = {};

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      if (line.startsWith('#EXTINF:')) {
        // Parse channel info
        const logoMatch = line.match(/tvg-logo="([^"]+)"/);
        const groupMatch = line.match(/group-title="([^"]+)"/);
        const nameMatch = line.match(/,(.+)$/);

        currentChannel = {
          logo_url: logoMatch?.[1] || null,
          category: groupMatch?.[1] || 'Geral',
          name: nameMatch?.[1]?.trim() || 'Canal Desconhecido',
          country: 'BR',
          active: true,
        };
      } else if (line.startsWith('http') && currentChannel.name) {
        currentChannel.stream_url = line;
        channels.push(currentChannel as Omit<Channel, 'id'>);
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

  const importFromUrl = async (url: string) => {
    setImporting(true);
    
    try {
      const rawUrl = convertToRawUrl(url.trim());
      console.log('Fetching M3U from:', rawUrl);
      
      // Use edge function as proxy to avoid CORS
      const response = await fetch(`${SUPABASE_URL}/functions/v1/stream-proxy?url=${encodeURIComponent(rawUrl)}`);
      
      if (!response.ok) {
        throw new Error(`Erro ao buscar M3U: ${response.status}`);
      }
      
      const content = await response.text();
      const parsedChannels = parseM3U(content);
      
      if (parsedChannels.length === 0) {
        toast.error('Nenhum canal encontrado no M3U. Verifique o formato.');
        return 0;
      }

      // Get existing stream URLs to avoid duplicates
      const { data: existingChannels } = await supabase
        .from('channels')
        .select('stream_url');
      
      const existingUrls = new Set(existingChannels?.map(c => c.stream_url) || []);
      
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
    
    try {
      let inserted = 0;
      let importedUrl = '';

      // If it's a URL, use importFromUrl
      if (m3uContent.trim().startsWith('http')) {
        importedUrl = convertToRawUrl(m3uContent.trim());
        inserted = await importFromUrl(m3uContent.trim());
      } else {
        // Direct content paste
        const parsedChannels = parseM3U(m3uContent);
        
        if (parsedChannels.length === 0) {
          toast.error('Nenhum canal encontrado no M3U. Verifique o formato.');
          return;
        }

        // Get existing stream URLs to avoid duplicates
        const { data: existingChannels } = await supabase
          .from('channels')
          .select('stream_url');
        
        const existingUrls = new Set(existingChannels?.map(c => c.stream_url) || []);
        const newChannels = parsedChannels.filter(c => !existingUrls.has(c.stream_url));
        
        if (newChannels.length === 0) {
          toast.info('Todos os canais já existem no banco.');
          return;
        }

        const batchSize = 50;
        for (let i = 0; i < newChannels.length; i += batchSize) {
          const batch = newChannels.slice(i, i + batchSize);
          const { error } = await supabase.from('channels').insert(batch);
          
          if (error) {
            console.error('Batch insert error:', error);
          } else {
            inserted += batch.length;
          }
        }
      }

      // Save the M3U link to history if it was a URL
      if (importedUrl && inserted > 0) {
        await saveM3uLink(importedUrl, inserted);
      }

      if (inserted > 0) {
        toast.success(`${inserted} novos canais importados!`);
      }
      
      setM3uContent('');
      fetchChannels();
    } catch (error) {
      console.error('Import error:', error);
      toast.error('Erro ao importar M3U. Tente colar o conteúdo diretamente.');
    } finally {
      setImporting(false);
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
      toast.error('Erro ao reimportar. Verifique se a URL ainda está válida.');
    } finally {
      setImporting(false);
    }
  };

  const testStreams = async (channelsToTest: Channel[]) => {
    setTesting(true);
    setTestResults(new Map());
    
    const urls = channelsToTest.map(c => c.stream_url);
    const batchSize = 10; // Test in smaller batches for progress updates
    const totalBatches = Math.ceil(urls.length / batchSize);
    
    setTestProgress({ current: 0, total: urls.length, online: 0, offline: 0 });
    
    const allResults = new Map<string, StreamTestResult>();
    let onlineCount = 0;
    let offlineCount = 0;
    
    try {
      for (let i = 0; i < urls.length; i += batchSize) {
        const batch = urls.slice(i, i + batchSize);
        const batchNumber = Math.floor(i / batchSize) + 1;
        
        const response = await fetch(`${SUPABASE_URL}/functions/v1/test-stream`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ urls: batch }),
        });

        const data = await response.json();
        
        if (data.results) {
          data.results.forEach((result: StreamTestResult) => {
            allResults.set(result.url, result);
            if (result.status === 'online') {
              onlineCount++;
            } else {
              offlineCount++;
            }
          });
          
          // Update state with progressive results
          setTestResults(new Map(allResults));
          setTestProgress({
            current: Math.min(i + batchSize, urls.length),
            total: urls.length,
            online: onlineCount,
            offline: offlineCount
          });
        }
      }
      
      toast.success(`Teste concluído: ${onlineCount} online, ${offlineCount} offline`);
    } catch (error) {
      console.error('Test error:', error);
      toast.error('Erro ao testar streams');
    } finally {
      setTesting(false);
    }
  };

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
    
    fetchChannels();
  };

  const categories = ['all', ...new Set(channels.map(c => c.category))];
  
  const filteredChannels = channels.filter(channel => {
    const matchesCategory = selectedCategory === 'all' || channel.category === selectedCategory;
    const matchesSearch = channel.name.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const activeCount = channels.filter(c => c.active).length;
  const inactiveCount = channels.filter(c => !c.active).length;

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
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <Tv className="h-8 w-8 text-primary" />
                  <div>
                    <p className="text-2xl font-bold">{channels.length}</p>
                    <p className="text-sm text-muted-foreground">Total de Canais</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-8 w-8 text-green-500" />
                  <div>
                    <p className="text-2xl font-bold">{activeCount}</p>
                    <p className="text-sm text-muted-foreground">Ativos</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <XCircle className="h-8 w-8 text-red-500" />
                  <div>
                    <p className="text-2xl font-bold">{inactiveCount}</p>
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
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="channels">Canais</TabsTrigger>
              <TabsTrigger value="import">Importar M3U</TabsTrigger>
              <TabsTrigger value="links">Links Usados</TabsTrigger>
            </TabsList>

            {/* Channels Tab */}
            <TabsContent value="channels" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Gerenciar Canais</CardTitle>
                  <CardDescription>
                    Teste e gerencie os canais disponíveis
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Filters */}
                  <div className="flex flex-col md:flex-row gap-4">
                    <Input
                      placeholder="Buscar canal..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="md:w-64"
                    />
                    <select
                      value={selectedCategory}
                      onChange={(e) => setSelectedCategory(e.target.value)}
                      className="px-3 py-2 rounded-md border border-input bg-background"
                    >
                      {categories.map(cat => (
                        <option key={cat} value={cat}>
                          {cat === 'all' ? 'Todas as categorias' : cat}
                        </option>
                      ))}
                    </select>
                    <div className="flex gap-2 ml-auto">
                      <Button
                        onClick={() => testStreams(filteredChannels)}
                        disabled={testing || filteredChannels.length === 0}
                        variant="outline"
                      >
                        {testing ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <RefreshCw className="h-4 w-4 mr-2" />
                        )}
                        Testar {filteredChannels.length} Canais
                      </Button>
                      {testResults.size > 0 && (
                        <Button
                          onClick={deactivateOfflineChannels}
                          variant="destructive"
                        >
                          <XCircle className="h-4 w-4 mr-2" />
                          Desativar Offline
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Progress Bar */}
                  {testing && (
                    <div className="space-y-2 p-4 rounded-lg bg-secondary/30 border border-border">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">Testando streams...</span>
                        <span className="text-muted-foreground">
                          {testProgress.current} / {testProgress.total}
                        </span>
                      </div>
                      <div className="w-full h-3 bg-secondary rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-primary transition-all duration-300 ease-out"
                          style={{ width: `${testProgress.total > 0 ? (testProgress.current / testProgress.total) * 100 : 0}%` }}
                        />
                      </div>
                      <div className="flex gap-4 text-sm">
                        <span className="flex items-center gap-1">
                          <CheckCircle className="h-4 w-4 text-green-500" />
                          {testProgress.online} online
                        </span>
                        <span className="flex items-center gap-1">
                          <XCircle className="h-4 w-4 text-red-500" />
                          {testProgress.offline} offline
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Channels List */}
                  <div className="max-h-[600px] overflow-y-auto space-y-2">
                    {loadingChannels ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      </div>
                    ) : filteredChannels.length === 0 ? (
                      <p className="text-center text-muted-foreground py-8">
                        Nenhum canal encontrado
                      </p>
                    ) : (
                      filteredChannels.map(channel => {
                        const testResult = testResults.get(channel.stream_url);
                        return (
                          <div
                            key={channel.id}
                            className="flex items-center gap-4 p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors"
                          >
                            {channel.logo_url ? (
                              <img
                                src={channel.logo_url}
                                alt={channel.name}
                                className="h-10 w-10 object-contain rounded"
                                onError={(e) => (e.currentTarget.style.display = 'none')}
                              />
                            ) : (
                              <div className="h-10 w-10 bg-muted rounded flex items-center justify-center">
                                <Tv className="h-5 w-5 text-muted-foreground" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">{channel.name}</p>
                              <p className="text-sm text-muted-foreground truncate">
                                {channel.category}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              {testResult && (
                                <Badge
                                  variant={testResult.status === 'online' ? 'default' : 'destructive'}
                                  className={testResult.status === 'online' ? 'bg-green-600' : ''}
                                >
                                  {testResult.status === 'online' ? 'Online' : 'Offline'}
                                </Badge>
                              )}
                              <Badge variant={channel.active ? 'default' : 'secondary'}>
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
                        );
                      })
                    )}
                  </div>
                </CardContent>
              </Card>
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
                    Cole o conteúdo de um arquivo M3U ou uma URL direta
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Textarea
                    placeholder="Cole aqui o conteúdo M3U ou a URL do arquivo (ex: https://raw.githubusercontent.com/...)"
                    value={m3uContent}
                    onChange={(e) => setM3uContent(e.target.value)}
                    rows={10}
                    className="font-mono text-sm"
                  />
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
                            <th className="text-left py-3 px-2 font-medium">URL</th>
                            <th className="text-center py-3 px-2 font-medium">Canais</th>
                            <th className="text-center py-3 px-2 font-medium">Data</th>
                            <th className="text-right py-3 px-2 font-medium">Ações</th>
                          </tr>
                        </thead>
                        <tbody>
                          {usedM3uLinks.map((link) => (
                            <tr key={link.id} className="border-b border-border/50 hover:bg-secondary/30">
                              <td className="py-3 px-2">
                                <code className="text-xs bg-muted px-2 py-1 rounded truncate block max-w-[400px]">
                                  {link.url}
                                </code>
                              </td>
                              <td className="text-center py-3 px-2">
                                <Badge variant="secondary">{link.channels_imported}</Badge>
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
                              <td className="text-right py-3 px-2 space-x-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={importing}
                                  onClick={() => handleReimport(link.url)}
                                >
                                  {importing ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <RefreshCw className="h-4 w-4" />
                                  )}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    navigator.clipboard.writeText(link.url);
                                    toast.success('Link copiado!');
                                  }}
                                >
                                  Copiar
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  <div className="mt-4 p-4 bg-muted/50 rounded-lg">
                    <p className="text-sm text-muted-foreground">
                      <strong>Nota:</strong> Muitas listas M3U públicas têm URLs que expiram rapidamente. 
                      Use o botão "Testar Canais" regularmente para identificar e desativar streams offline.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default Admin;
