import { useEffect, useRef, useState, useCallback } from 'react';
import Hls from 'hls.js';
import { 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  Maximize, 
  Minimize,
  SkipBack,
  SkipForward,
  X,
  Copy,
  Check,
  Link,
  AlertTriangle,
  Cast,
  Airplay,
  MonitorSmartphone
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

// Ensure HTTPS for proxy URL to avoid mixed content errors
const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL || '').replace(/^http:\/\//i, 'https://');

type StreamType = 'hls' | 'mpegts' | 'mp4' | 'flv' | 'unknown';

interface ProbeResult {
  type: StreamType;
  contentType?: string;
}

// Probe the stream to detect its type
const probeStream = async (url: string, signal: AbortSignal): Promise<ProbeResult> => {
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Range': 'bytes=0-8191',
        'Accept': '*/*',
      },
      signal,
    });

    if (!response.ok) {
      return { type: 'unknown' };
    }

    const contentType = response.headers.get('content-type') || '';
    
    // Check content-type first
    if (/mpegurl/i.test(contentType) || /x-mpegurl/i.test(contentType)) {
      return { type: 'hls', contentType };
    }
    if (/video\/mp2t/i.test(contentType) || /video\/mpeg/i.test(contentType)) {
      return { type: 'mpegts', contentType };
    }
    if (/video\/mp4/i.test(contentType) || /video\/webm/i.test(contentType) || /video\/ogg/i.test(contentType)) {
      return { type: 'mp4', contentType };
    }

    // Read first bytes for magic number detection
    const buffer = await response.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    
    if (bytes.length === 0) {
      return { type: 'unknown', contentType };
    }

    // Check for HLS playlist (text-based)
    const text = new TextDecoder().decode(bytes.slice(0, 512));
    if (text.trimStart().startsWith('#EXTM3U') || text.includes('#EXT-X-')) {
      return { type: 'hls', contentType };
    }

    // Check for MPEG-TS sync byte (0x47) - check multiple positions
    // TS packets are 188 bytes, sync byte should appear at 0, 188, 376, etc.
    if (bytes[0] === 0x47) {
      // Check if it's consistently a TS stream
      if (bytes.length >= 188 && bytes[188] === 0x47) {
        return { type: 'mpegts', contentType };
      }
      // Single sync byte might still be TS
      if (bytes.length < 188) {
        return { type: 'mpegts', contentType };
      }
    }

    // Check for FLV header "FLV"
    if (bytes[0] === 0x46 && bytes[1] === 0x4C && bytes[2] === 0x56) {
      return { type: 'flv', contentType };
    }

    // Check for MP4/ftyp box
    if (bytes.length >= 8) {
      const ftypStr = String.fromCharCode(bytes[4], bytes[5], bytes[6], bytes[7]);
      if (ftypStr === 'ftyp') {
        return { type: 'mp4', contentType };
      }
    }

    // For live streams, often they're MPEG-TS even without clear markers
    // If content-type is octet-stream and no other detection, assume TS for live streams
    if (contentType.includes('octet-stream') || !contentType) {
      // Look for any 0x47 sync bytes in the buffer
      for (let i = 0; i < Math.min(bytes.length, 1000); i++) {
        if (bytes[i] === 0x47 && bytes[i + 188] === 0x47) {
          return { type: 'mpegts', contentType };
        }
      }
    }

    return { type: 'unknown', contentType };
  } catch (err) {
    console.error('Stream probe error:', err);
    return { type: 'unknown' };
  }
};

// Use proxy for all stream URLs to avoid CORS issues
const extractUnderlyingFromProxy = (maybeProxyUrl: string): string | null => {
  try {
    const parsed = new URL(maybeProxyUrl);
    const u = parsed.searchParams.get('url');
    if (!u) return null;

    // Supports both canonical and legacy proxy paths
    if (parsed.pathname.includes('stream-proxy')) {
      return decodeURIComponent(u);
    }

    return null;
  } catch {
    return null;
  }
};

const getProxiedUrl = (url: string): string => {
  if (!/^https?:\/\//i.test(url)) return url;

  // If it's already proxied (legacy or canonical), re-canonicalize to our HTTPS /functions/v1 endpoint
  const underlying = extractUnderlyingFromProxy(url);
  if (underlying) {
    return `${SUPABASE_URL}/functions/v1/stream-proxy?url=${encodeURIComponent(underlying)}`;
  }

  return `${SUPABASE_URL}/functions/v1/stream-proxy?url=${encodeURIComponent(url)}`;
};

// Extract underlying URL from proxied URL
const getUnderlyingUrl = (maybeProxied: string): string => {
  return extractUnderlyingFromProxy(maybeProxied) ?? maybeProxied;
};

interface NextEpisode {
  id: string;
  name: string;
  stream_url: string;
  poster?: string;
  season: number;
  episode: number;
}

interface VideoPlayerProps {
  src: string;
  title?: string;
  poster?: string;
  contentId?: string;
  contentType?: 'TV' | 'MOVIE' | 'SERIES';
  onClose?: () => void;
  autoPlay?: boolean;
  nextEpisode?: NextEpisode | null;
  onPlayNext?: (episode: NextEpisode) => void;
}

export const VideoPlayer = ({ src, title, poster, contentId, contentType, onClose, autoPlay = true, nextEpisode, onPlayNext }: VideoPlayerProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const mpegtsPlayerRef = useRef<any>(null);
  const lastSavedProgressRef = useRef<number>(0);
  const progressSaveIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [volume, setVolume] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showStreamUrl, setShowStreamUrl] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedProxied, setCopiedProxied] = useState(false);
  const [streamInfo, setStreamInfo] = useState<{ type: StreamType; contentType?: string } | null>(null);
  const [isCasting, setIsCasting] = useState(false);
  const [isPiP, setIsPiP] = useState(false);
  const [historySaved, setHistorySaved] = useState(false);
  const [savedProgress, setSavedProgress] = useState<number | null>(null);
  const [showResumePrompt, setShowResumePrompt] = useState(false);
  const [showNextEpisode, setShowNextEpisode] = useState(false);
  const [nextEpisodeCountdown, setNextEpisodeCountdown] = useState(15);
  
  const { isAdmin, user } = useAuth();

  // Load saved progress when component mounts
  useEffect(() => {
    const loadSavedProgress = async () => {
      if (!user?.id || !contentId) return;
      
      try {
        const { data } = await supabase
          .from('watch_history')
          .select('progress')
          .eq('user_id', user.id)
          .eq('content_id', contentId)
          .maybeSingle();
        
        if (data?.progress && data.progress > 10) {
          setSavedProgress(data.progress);
          setShowResumePrompt(true);
        }
      } catch (err) {
        console.error('Error loading saved progress:', err);
      }
    };

    loadSavedProgress();
  }, [user?.id, contentId]);

  // Resume from saved position
  const resumeFromSaved = () => {
    const video = videoRef.current;
    if (video && savedProgress) {
      video.currentTime = savedProgress;
    }
    setShowResumePrompt(false);
  };

  const startFromBeginning = () => {
    setShowResumePrompt(false);
  };

  // Save progress periodically
  useEffect(() => {
    if (!user?.id || !contentId || contentType === 'TV') return;

    const saveProgress = async () => {
      const video = videoRef.current;
      if (!video || !isFinite(video.currentTime) || video.currentTime < 10) return;
      
      // Only save if progress changed significantly (more than 5 seconds)
      if (Math.abs(video.currentTime - lastSavedProgressRef.current) < 5) return;
      
      lastSavedProgressRef.current = video.currentTime;

      try {
        await supabase
          .from('watch_history')
          .upsert({
            user_id: user.id,
            content_id: contentId,
            content_type: contentType || 'MOVIE',
            watched_at: new Date().toISOString(),
            progress: Math.floor(video.currentTime)
          }, {
            onConflict: 'user_id,content_id'
          });
      } catch (err) {
        console.error('Error saving progress:', err);
      }
    };

    // Save progress every 10 seconds
    progressSaveIntervalRef.current = setInterval(saveProgress, 10000);

    return () => {
      if (progressSaveIntervalRef.current) {
        clearInterval(progressSaveIntervalRef.current);
      }
      // Save final progress on unmount
      saveProgress();
    };
  }, [user?.id, contentId, contentType]);

  // Save watch history when video starts playing
  useEffect(() => {
    const saveWatchHistory = async () => {
      if (!user?.id || !contentId || historySaved) return;
      
      try {
        await supabase
          .from('watch_history')
          .upsert({
            user_id: user.id,
            content_id: contentId,
            content_type: contentType || 'MOVIE',
            watched_at: new Date().toISOString(),
            progress: 0
          }, {
            onConflict: 'user_id,content_id'
          });
        setHistorySaved(true);
      } catch (err) {
        console.error('Error saving watch history:', err);
      }
    };

    if (isPlaying && !isLoading && !error) {
      saveWatchHistory();
    }
  }, [isPlaying, isLoading, error, user?.id, contentId, contentType, historySaved]);
  
  const proxiedUrl = getProxiedUrl(src);

  const copyStreamUrl = async () => {
    try {
      await navigator.clipboard.writeText(src);
      setCopied(true);
      toast.success('Link original copiado!');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error('Erro ao copiar');
    }
  };

  const copyProxiedUrl = async () => {
    try {
      await navigator.clipboard.writeText(proxiedUrl);
      setCopiedProxied(true);
      toast.success('Link proxied copiado!');
      setTimeout(() => setCopiedProxied(false), 2000);
    } catch (err) {
      toast.error('Erro ao copiar');
    }
  };

  const cleanup = useCallback(() => {
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    if (mpegtsPlayerRef.current) {
      try {
        mpegtsPlayerRef.current.pause();
        mpegtsPlayerRef.current.unload();
        mpegtsPlayerRef.current.detachMediaElement();
        mpegtsPlayerRef.current.destroy();
      } catch (e) {
        console.error('Error cleaning up mpegts player:', e);
      }
      mpegtsPlayerRef.current = null;
    }
    const video = videoRef.current;
    if (video) {
      video.pause();
      video.removeAttribute('src');
      video.load();
    }
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const abortController = new AbortController();
    
    setError(null);
    setIsLoading(true);
    setStreamInfo(null);
    cleanup();

    const streamUrl = getProxiedUrl(src);
    const underlyingUrl = getUnderlyingUrl(streamUrl);
    
    // Quick check for obvious file types
    const looksLikeHls = /\.m3u8(\?|$)/i.test(underlyingUrl);
    const looksLikeDirectFile = /\.(mp4|webm|ogg|mov)(\?|$)/i.test(underlyingUrl);
    const looksLikeTsStream = /\.ts(\?|$)/i.test(underlyingUrl);
    const looksLikeMpegTs = looksLikeTsStream || /\/live\//i.test(underlyingUrl) || underlyingUrl.includes(':80/');

    const initPlayer = async () => {
      try {
        // If it obviously looks like an MP4/WebM/etc, skip probing and proxy
        // Use original URL directly for better compatibility
        if (looksLikeDirectFile) {
          console.log('Direct MP4/WebM file detected, using native playback without proxy');
          setStreamInfo({ type: 'mp4' });
          video.src = src; // Use original URL, not proxied
          setIsLoading(false);
          if (autoPlay) video.play().catch(() => setIsPlaying(false));
          return;
        }

        // If it obviously looks like HLS
        if (looksLikeHls) {
          console.log('HLS URL detected by extension');
          setStreamInfo({ type: 'hls' });
          await initHls(streamUrl, video);
          return;
        }

        // Para streams MPEG-TS diretos (.ts ou live streams), tentar URL direta PRIMEIRO
        // Isso evita problemas com proxy e funciona melhor com servidores IPTV
        if (looksLikeMpegTs) {
          console.log('MPEG-TS stream detected, trying direct URL first');
          setStreamInfo({ type: 'mpegts' });

          try {
            // Tentar URL ORIGINAL primeiro (sem proxy) - funciona melhor!
            console.log('Attempting direct URL without proxy...');
            await initMpegts(src, video, 'mpegts');
            return;
          } catch (directError: any) {
            console.log('Direct URL failed:', directError?.message);
            cleanup();
            
            // Se erro é de codec, tentar reprodução nativa diretamente
            if (directError?.message?.includes('Codec not supported')) {
              console.log('Codec not supported, trying native video element...');
              setStreamInfo({ type: 'mp4' });
              try {
                video.src = src;
                video.load();
                
                // Add error handler
                const errorHandler = (e: Event) => {
                  console.error('Native video error:', video.error);
                  video.removeEventListener('error', errorHandler);
                };
                video.addEventListener('error', errorHandler);
                
                // Add canplay handler
                const canplayHandler = () => {
                  console.log('Native video can play');
                  video.removeEventListener('canplay', canplayHandler);
                  setIsLoading(false);
                };
                video.addEventListener('canplay', canplayHandler, { once: true });
                
                await video.play();
                setIsPlaying(true);
                return;
              } catch (nativeError) {
                console.log('Native playback also failed:', nativeError);
              }
            }
            
            try {
              console.log('Trying with proxy...');
              await initMpegts(streamUrl, video, 'mpegts');
              return;
            } catch (proxyError: any) {
              console.log('Proxy failed too:', proxyError?.message);
              cleanup();
              
              // Tentar reprodução nativa com URL original
              console.log('Trying native video element as last resort...');
              setStreamInfo({ type: 'mp4' });
              try {
                video.src = src;
                video.load();
                const playPromise = video.play();
                if (playPromise) {
                  await playPromise;
                }
                setIsLoading(false);
                setIsPlaying(true);
                return;
              } catch (nativeError) {
                console.log('Native playback failed, trying HLS fallback...');
                setStreamInfo({ type: 'hls' });
                await initHls(streamUrl, video);
                return;
              }
            }
          }
        }

        // Para outros endpoints, tentar HLS primeiro
        console.log('Unknown endpoint, trying HLS first');
        setStreamInfo({ type: 'hls' });
        await initHls(streamUrl, video);
        return;
      } catch (err) {
        if (abortController.signal.aborted) return;
        console.error('Player init error:', err);
        setError('Erro ao inicializar o player. Tente novamente.');
        setIsLoading(false);
      }
    };

    const initHls = async (url: string, videoEl: HTMLVideoElement) => {
      if (Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: false,
          fragLoadingMaxRetry: 3,
          manifestLoadingMaxRetry: 3,
          levelLoadingMaxRetry: 3,
          xhrSetup: (xhr) => {
            xhr.timeout = 15000;
          },
        });
        
        hlsRef.current = hls;
        hls.loadSource(url);
        hls.attachMedia(videoEl);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          setIsLoading(false);
          if (autoPlay) videoEl.play().catch(() => setIsPlaying(false));
        });

        hls.on(Hls.Events.ERROR, (_event, data) => {
          console.error('HLS Error:', data);
          
          if (!data.fatal) return;

          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
            if (data.details === Hls.ErrorDetails.MANIFEST_LOAD_TIMEOUT || 
                data.details === Hls.ErrorDetails.MANIFEST_LOAD_ERROR) {
              console.log('HLS manifest load failed, trying mpegts.js');
              hls.destroy();
              hlsRef.current = null;
              // This might be an MPEG-TS stream misidentified as HLS
              initMpegts(url, videoEl, 'mpegts').catch(() => {
                setError('Não foi possível carregar o stream. O formato pode não ser compatível com o navegador.');
                setIsLoading(false);
              });
              return;
            }
          }

          hls.destroy();
          hlsRef.current = null;
          setError(`Erro HLS: ${data.details || 'Falha na reprodução'}`);
          setIsLoading(false);
        });
      } else if (videoEl.canPlayType('application/vnd.apple.mpegurl')) {
        // Safari native HLS
        videoEl.src = url;
        videoEl.addEventListener('loadedmetadata', () => {
          setIsLoading(false);
          if (autoPlay) videoEl.play().catch(() => setIsPlaying(false));
        }, { once: true });
        videoEl.addEventListener('error', () => {
          setError('Erro ao carregar o stream HLS.');
          setIsLoading(false);
        }, { once: true });
      } else {
        setError('Seu navegador não suporta reprodução de HLS.');
        setIsLoading(false);
      }
    };

    const initMpegts = async (url: string, videoEl: HTMLVideoElement, type: 'mpegts' | 'flv') => {
      try {
        // Test URL accessibility first
        console.log('Testing URL accessibility:', url);
        try {
          const testResponse = await fetch(url, {
            method: 'HEAD',
            mode: 'no-cors',
          });
          console.log('URL test response:', testResponse);
        } catch (testErr) {
          console.warn('HEAD request failed (this is OK for some servers):', testErr);
          // Continue anyway - some servers don't support HEAD
        }

        // Dynamic import for mpegts.js
        const mpegts = await import('mpegts.js');
        
        if (!mpegts.default.isSupported()) {
          throw new Error('mpegts.js não é suportado neste navegador');
        }

        console.log('Initializing mpegts.js player for URL:', url);
        
        const player = mpegts.default.createPlayer({
          type: type === 'flv' ? 'flv' : 'mpegts',
          isLive: true,
          url: url,
          cors: true,
          withCredentials: false,
        }, {
          enableWorker: true,
          enableStashBuffer: true,
          stashInitialSize: 256 * 1024, // Aumentado para 256KB
          lazyLoad: false,
          lazyLoadMaxDuration: 0,
          deferLoadAfterSourceOpen: false,
          // Evita Range header (alguns servidores retornam 403 com Range)
          seekType: 'param',
          rangeLoadZeroStart: false,
          reuseRedirectedURL: true,
          autoCleanupSourceBuffer: true,
          autoCleanupMaxBackwardDuration: 30,
          autoCleanupMinBackwardDuration: 10,
          // Adiciona configurações para melhor compatibilidade
          fixAudioTimestampGap: true,
          accurateSeek: false,
        });

        mpegtsPlayerRef.current = player;
        player.attachMediaElement(videoEl);
        
        let errorOccurred = false;
        let mediaInfoReceived = false;

        player.on(mpegts.default.Events.ERROR, (errorType: string, errorDetail: string, errorInfo: any) => {
          console.error('mpegts.js error:', { errorType, errorDetail, errorInfo });
          console.error('Stream URL was:', url);
          errorOccurred = true;
          
          // Check if it's a codec error
          if (errorInfo?.msg?.includes('codec') || errorDetail?.includes('codec')) {
            setError(`Codec não suportado pelo navegador. Este stream pode usar H.265/HEVC que não é suportado no Chrome.`);
          } else if (errorDetail?.includes('NetworkError') || errorType?.includes('NetworkError')) {
            setError(`Erro de rede ao carregar o stream. Verifique sua conexão.`);
          } else if (errorDetail?.includes('HttpStatusCodeInvalid')) {
            const statusMatch = errorInfo?.msg?.match(/(\d{3})/);
            const statusCode = statusMatch ? statusMatch[1] : 'desconhecido';
            setError(`Servidor retornou erro ${statusCode}. O stream pode estar offline ou bloqueado.`);
          } else {
            setError(`Erro de reprodução: ${errorDetail || errorType}`);
          }
          setIsLoading(false);
        });

        player.on(mpegts.default.Events.LOADING_COMPLETE, () => {
          console.log('mpegts.js loading complete');
        });

        player.on(mpegts.default.Events.MEDIA_INFO, (info: any) => {
          console.log('mpegts.js media info:', info);
          mediaInfoReceived = true;
          setIsLoading(false);
        });

        // Start loading
        player.load();

        // Wait a bit for media info or error
        await new Promise((resolve) => setTimeout(resolve, 2000));

        if (errorOccurred) {
          throw new Error('mpegts.js failed to load stream');
        }

        // Try to play
        try {
          await videoEl.play();
          setIsLoading(false);
          setIsPlaying(true);
          console.log('mpegts.js playback started successfully');
        } catch (playErr: any) {
          console.error('Autoplay failed:', playErr);
          
          // Se o erro for "no supported sources", significa codec não suportado
          if (playErr?.message?.includes('no supported sources') || 
              playErr?.name === 'NotSupportedError') {
            console.error('Stream codec not supported by mpegts.js - likely H.265/HEVC');
            throw new Error('Codec not supported');
          }
          
          setIsPlaying(false);
          setIsLoading(false);
          // Don't throw - user can click play manually
        }

        // Set a timeout for loading if media info not received
        setTimeout(() => {
          if (!mediaInfoReceived && !errorOccurred) {
            console.log('mpegts.js: No media info received after 10s, but continuing...');
            setIsLoading(false);
          }
        }, 10000);

      } catch (err) {
        console.error('mpegts.js init error:', err);
        throw err;
      }
    };

    initPlayer();

    return () => {
      abortController.abort();
      cleanup();
    };
  }, [src, autoPlay, cleanup]);

  useEffect(() => {
    let timeout: NodeJS.Timeout;
    const handleMouseMove = () => {
      setShowControls(true);
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        if (isPlaying) setShowControls(false);
      }, 3000);
    };

    const container = containerRef.current;
    container?.addEventListener('mousemove', handleMouseMove);
    
    return () => {
      container?.removeEventListener('mousemove', handleMouseMove);
      clearTimeout(timeout);
    };
  }, [isPlaying]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.pause();
    } else {
      video.play();
    }
    setIsPlaying(!isPlaying);
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const toggleFullscreen = () => {
    const container = containerRef.current;
    if (!container) return;

    if (!isFullscreen) {
      if (container.requestFullscreen) {
        container.requestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
    setIsFullscreen(!isFullscreen);
  };

  // Picture-in-Picture
  const togglePiP = async () => {
    const video = videoRef.current;
    if (!video) return;

    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
        setIsPiP(false);
      } else if (document.pictureInPictureEnabled) {
        await video.requestPictureInPicture();
        setIsPiP(true);
        toast.success('Picture-in-Picture ativado');
      } else {
        toast.error('Picture-in-Picture não suportado');
      }
    } catch (err) {
      console.error('PiP error:', err);
      toast.error('Erro ao ativar Picture-in-Picture');
    }
  };

  // AirPlay for Safari/iOS
  const startAirPlay = () => {
    const video = videoRef.current;
    if (!video) return;

    if ((video as any).webkitShowPlaybackTargetPicker) {
      (video as any).webkitShowPlaybackTargetPicker();
    } else {
      toast.error('AirPlay não suportado neste navegador');
    }
  };

  // Check AirPlay availability
  const isAirPlayAvailable = () => {
    const video = videoRef.current;
    return video && (video as any).webkitShowPlaybackTargetPicker !== undefined;
  };

  // Request Remote Playback (Chromecast/Cast)
  const startCast = async () => {
    const video = videoRef.current;
    if (!video) return;

    try {
      if ((video as any).remote && (video as any).remote.watchAvailability) {
        const remote = (video as any).remote;
        await remote.prompt();
        toast.success('Conectando ao dispositivo...');
        setIsCasting(true);
      } else {
        // Fallback: copy stream URL for external player
        await navigator.clipboard.writeText(src);
        toast.success('Link copiado! Cole em um player externo ou Smart TV.');
      }
    } catch (err) {
      console.error('Cast error:', err);
      // If remote playback not supported, copy URL as fallback
      try {
        await navigator.clipboard.writeText(src);
        toast.info('Link copiado para usar em outro dispositivo');
      } catch {
        toast.error('Espelhamento não disponível');
      }
    }
  };

  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video) return;
    setCurrentTime(video.currentTime);
    setProgress((video.currentTime / video.duration) * 100);
    
    // Check if we should show next episode prompt (50 seconds before end)
    if (nextEpisode && onPlayNext && isFinite(video.duration) && video.duration > 60) {
      const timeRemaining = video.duration - video.currentTime;
      if (timeRemaining <= 50 && timeRemaining > 0 && !showNextEpisode) {
        setShowNextEpisode(true);
        setNextEpisodeCountdown(Math.ceil(timeRemaining));
      } else if (showNextEpisode && timeRemaining > 0) {
        setNextEpisodeCountdown(Math.ceil(timeRemaining));
      }
      
      // Auto-play next episode when video ends
      if (timeRemaining <= 0 && showNextEpisode) {
        handlePlayNext();
      }
    }
  };

  const handlePlayNext = () => {
    if (nextEpisode && onPlayNext) {
      setShowNextEpisode(false);
      onPlayNext(nextEpisode);
    }
  };

  const handleLoadedMetadata = () => {
    const video = videoRef.current;
    if (!video) return;
    setDuration(video.duration);
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const video = videoRef.current;
    if (!video) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    video.currentTime = percent * video.duration;
  };

  const skip = (seconds: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime += seconds;
  };

  const formatTime = (time: number) => {
    if (!isFinite(time) || isNaN(time)) return '--:--';
    const hours = Math.floor(time / 3600);
    const minutes = Math.floor((time % 3600) / 60);
    const secs = Math.floor(time % 60);
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const getStreamTypeLabel = (type: StreamType): string => {
    switch (type) {
      case 'hls': return 'HLS';
      case 'mpegts': return 'MPEG-TS';
      case 'mp4': return 'MP4/WebM';
      case 'flv': return 'FLV';
      default: return 'Desconhecido';
    }
  };

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 bg-background flex items-center justify-center"
    >
      {/* Loading Screen with Poster Animation */}
      {isLoading && !error && (
        <div className="absolute inset-0 z-10 overflow-hidden">
          {/* Animated Poster Background */}
          {poster ? (
            <div className="absolute inset-0 animate-poster-zoom">
              <img
                src={poster}
                alt={title || 'Loading'}
                className="h-full w-full object-cover"
              />
              {/* Gradient overlay for readability */}
              <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-background/30" />
            </div>
          ) : (
            <div className="absolute inset-0 bg-background" />
          )}
          
          {/* Loading indicator */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="relative">
              <div className="h-16 w-16 border-4 border-primary/30 rounded-full" />
              <div className="absolute inset-0 h-16 w-16 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
            <p className="mt-6 text-lg font-medium text-foreground/90">Carregando...</p>
            {title && (
              <h2 className="mt-2 text-2xl md:text-4xl font-display text-center px-4 text-gradient">
                {title}
              </h2>
            )}
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-10 p-8">
          <div className="bg-destructive/20 border border-destructive/50 rounded-lg p-6 max-w-lg text-center">
            <AlertTriangle className="h-10 w-10 text-destructive mx-auto mb-4" />
            <p className="text-destructive-foreground mb-4">{error}</p>
            
            {/* Diagnostic info for admins */}
            {isAdmin && streamInfo && (
              <div className="mb-4 p-3 bg-secondary/50 rounded-lg text-left">
                <p className="text-xs text-muted-foreground mb-1">Diagnóstico:</p>
                <p className="text-sm">Tipo detectado: <strong>{getStreamTypeLabel(streamInfo.type)}</strong></p>
                {streamInfo.contentType && (
                  <p className="text-sm">Content-Type: <code className="text-xs">{streamInfo.contentType}</code></p>
                )}
              </div>
            )}
            
            {/* Stream URLs for admins in error state */}
            {isAdmin && (
              <div className="mb-4 space-y-2 text-left">
                <div className="flex items-center gap-2 bg-secondary/80 backdrop-blur-sm rounded-lg p-3">
                  <div className="flex-1 min-w-0">
                    <span className="text-xs text-muted-foreground block mb-1">Link Original:</span>
                    <code className="text-xs text-foreground break-all font-mono block">
                      {src}
                    </code>
                  </div>
                  <button
                    onClick={copyStreamUrl}
                    className="p-2 hover:bg-background/50 rounded-md transition-colors shrink-0"
                    title="Copiar link original"
                  >
                    {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
                <div className="flex items-center gap-2 bg-secondary/80 backdrop-blur-sm rounded-lg p-3">
                  <div className="flex-1 min-w-0">
                    <span className="text-xs text-muted-foreground block mb-1">Link Proxied:</span>
                    <code className="text-xs text-foreground break-all font-mono block">
                      {proxiedUrl}
                    </code>
                  </div>
                  <button
                    onClick={copyProxiedUrl}
                    className="p-2 hover:bg-background/50 rounded-md transition-colors shrink-0"
                    title="Copiar link proxied"
                  >
                    {copiedProxied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            )}
            
            <button 
              onClick={onClose}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
            >
              Fechar
            </button>
          </div>
        </div>
      )}

      {/* Resume Prompt */}
      {showResumePrompt && savedProgress && !isLoading && !error && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-card border border-border rounded-xl p-6 max-w-md text-center shadow-2xl">
            <h3 className="text-xl font-semibold mb-2">Continuar assistindo?</h3>
            <p className="text-muted-foreground mb-6">
              Você parou em {formatTime(savedProgress)}. Deseja continuar de onde parou?
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={startFromBeginning}
                className="px-4 py-2 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:border-foreground transition-colors"
              >
                Do início
              </button>
              <button
                onClick={resumeFromSaved}
                className="px-6 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Continuar
              </button>
            </div>
          </div>
        </div>
      )}

      <video
        ref={videoRef}
        poster={poster}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onClick={togglePlay}
        className="h-full w-full object-contain"
        playsInline
      />

      {/* Controls Overlay */}
      <div
        className={cn(
          "absolute inset-0 transition-opacity duration-300",
          showControls ? "opacity-100" : "opacity-0"
        )}
      >
        {/* Top Bar */}
        <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-background/80 to-transparent">
          <div className="flex items-center justify-between">
            <button onClick={onClose} className="p-2 hover:bg-secondary/50 rounded-full transition-colors">
              <X className="h-6 w-6" />
            </button>
            <div className="flex items-center gap-4">
              {title && <h2 className="font-display text-xl tracking-wide">{title}</h2>}
              {streamInfo && (
                <span className="text-xs px-2 py-1 bg-secondary/50 rounded-full text-muted-foreground">
                  {getStreamTypeLabel(streamInfo.type)}
                </span>
              )}
              {isAdmin && (
                <button 
                  onClick={() => setShowStreamUrl(!showStreamUrl)}
                  className={cn(
                    "p-2 rounded-full transition-colors",
                    showStreamUrl ? "bg-primary text-primary-foreground" : "hover:bg-secondary/50"
                  )}
                  title="Ver link do stream"
                >
                  <Link className="h-5 w-5" />
                </button>
              )}
            </div>
            <div className="w-10" />
          </div>
          
          {/* Stream URL for admins */}
          {isAdmin && showStreamUrl && (
            <div className="mt-3 flex items-center gap-2 bg-secondary/80 backdrop-blur-sm rounded-lg p-3">
              <code className="flex-1 text-sm text-foreground break-all font-mono">
                {src}
              </code>
              <button
                onClick={copyStreamUrl}
                className="p-2 hover:bg-background/50 rounded-md transition-colors shrink-0"
                title="Copiar link"
              >
                {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
          )}
        </div>

        {/* Center Play Button */}
        {!isPlaying && !isLoading && !error && !showNextEpisode && (
          <button
            onClick={togglePlay}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-20 w-20 rounded-full bg-primary/90 flex items-center justify-center transition-transform hover:scale-110"
          >
            <Play className="h-10 w-10 fill-current ml-1" />
          </button>
        )}

        {/* Next Episode Prompt */}
        {showNextEpisode && nextEpisode && (
          <div className="absolute bottom-24 right-4 md:right-8 animate-fade-in z-20">
            <div className="bg-card/95 backdrop-blur-md border border-border rounded-xl p-4 shadow-2xl max-w-sm">
              <p className="text-sm text-muted-foreground mb-2">Próximo episódio em {nextEpisodeCountdown}s</p>
              <div className="flex items-center gap-3">
                {nextEpisode.poster && (
                  <img 
                    src={nextEpisode.poster} 
                    alt={nextEpisode.name}
                    className="w-16 h-10 object-cover rounded"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm line-clamp-1">
                    S{nextEpisode.season}:E{nextEpisode.episode}
                  </p>
                  <p className="text-xs text-muted-foreground line-clamp-1">{nextEpisode.name}</p>
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => setShowNextEpisode(false)}
                  className="flex-1 px-3 py-2 text-sm rounded-lg border border-border text-muted-foreground hover:text-foreground hover:border-foreground transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handlePlayNext}
                  className="flex-1 px-3 py-2 text-sm rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
                >
                  <SkipForward className="h-4 w-4" />
                  Próximo
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Bottom Controls */}
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-background/80 to-transparent">
          {/* Progress Bar */}
          <div
            onClick={handleSeek}
            className="w-full h-1 bg-muted/50 rounded-full cursor-pointer mb-4 group"
          >
            <div
              className="h-full bg-primary rounded-full relative"
              style={{ width: `${progress}%` }}
            >
              <div className="absolute right-0 top-1/2 -translate-y-1/2 h-3 w-3 rounded-full bg-primary opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>

          {/* Control Buttons */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button onClick={togglePlay} className="p-2 hover:bg-secondary/50 rounded-full transition-colors">
                {isPlaying ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6" />}
              </button>
              <button onClick={() => skip(-10)} className="p-2 hover:bg-secondary/50 rounded-full transition-colors">
                <SkipBack className="h-6 w-6" />
              </button>
              <button onClick={() => skip(10)} className="p-2 hover:bg-secondary/50 rounded-full transition-colors">
                <SkipForward className="h-6 w-6" />
              </button>
              <div className="flex items-center gap-2">
                <button onClick={toggleMute} className="p-2 hover:bg-secondary/50 rounded-full transition-colors">
                  {isMuted ? <VolumeX className="h-6 w-6" /> : <Volume2 className="h-6 w-6" />}
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={isMuted ? 0 : volume}
                  onChange={(e) => {
                    const newVolume = parseFloat(e.target.value);
                    setVolume(newVolume);
                    if (videoRef.current) {
                      videoRef.current.volume = newVolume;
                      setIsMuted(newVolume === 0);
                    }
                  }}
                  className="w-20 accent-primary"
                />
              </div>
              <span className="text-sm text-muted-foreground">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </div>

            <div className="flex items-center gap-2 md:gap-4">
              {/* Cast/Mirror Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button 
                    className={cn(
                      "p-2 hover:bg-secondary/50 rounded-full transition-colors",
                      isCasting && "text-primary"
                    )}
                    title="Espelhar tela"
                  >
                    <Cast className="h-5 w-5 md:h-6 md:w-6" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={togglePiP} className="gap-2">
                    <MonitorSmartphone className="h-4 w-4" />
                    {isPiP ? 'Sair do PiP' : 'Picture-in-Picture'}
                  </DropdownMenuItem>
                  {isAirPlayAvailable() && (
                    <DropdownMenuItem onClick={startAirPlay} className="gap-2">
                      <Airplay className="h-4 w-4" />
                      AirPlay
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={startCast} className="gap-2">
                    <Cast className="h-4 w-4" />
                    {isCasting ? 'Parar Cast' : 'Transmitir / Copiar Link'}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              
              <button onClick={toggleFullscreen} className="p-2 hover:bg-secondary/50 rounded-full transition-colors">
                {isFullscreen ? <Minimize className="h-5 w-5 md:h-6 md:w-6" /> : <Maximize className="h-5 w-5 md:h-6 md:w-6" />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
