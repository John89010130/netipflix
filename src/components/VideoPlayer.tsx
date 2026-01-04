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
  AlertTriangle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

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
const getProxiedUrl = (url: string): string => {
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return url;
  }
  
  // Check if URL is already proxied
  if (
    url.includes('/functions/v1/stream-proxy') ||
    url.includes('.supabase.co/stream-proxy') ||
    url.includes('/stream-proxy?url=')
  ) {
    return url;
  }
  
  return `${SUPABASE_URL}/functions/v1/stream-proxy?url=${encodeURIComponent(url)}`;
};

// Extract underlying URL from proxied URL
const getUnderlyingUrl = (maybeProxied: string): string => {
  try {
    const parsed = new URL(maybeProxied);
    if (parsed.pathname.includes('/functions/v1/stream-proxy')) {
      const u = parsed.searchParams.get('url');
      if (u) return decodeURIComponent(u);
    }
  } catch {
    // ignore
  }
  return maybeProxied;
};

interface VideoPlayerProps {
  src: string;
  title?: string;
  poster?: string;
  onClose?: () => void;
  autoPlay?: boolean;
}

export const VideoPlayer = ({ src, title, poster, onClose, autoPlay = true }: VideoPlayerProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const mpegtsPlayerRef = useRef<any>(null);
  
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
  
  const { isAdmin } = useAuth();
  
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

    const initPlayer = async () => {
      try {
        // If it obviously looks like an MP4/WebM, skip probing
        if (looksLikeDirectFile) {
          console.log('Direct file detected, using native playback');
          setStreamInfo({ type: 'mp4' });
          video.src = streamUrl;
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

        // Para streams diretos (sem .m3u8), alguns servidores limitam conexões simultâneas.
        // O probe faz uma requisição extra e pode causar 403; então tentamos MPEG-TS primeiro.
        console.log('Direct stream endpoint detected, trying mpegts.js first (no probe)');
        setStreamInfo({ type: 'mpegts' });

        try {
          await initMpegts(streamUrl, video, 'mpegts');
        } catch (mpegtsError) {
          console.log('mpegts.js init failed, trying HLS fallback');
          cleanup();
          setStreamInfo({ type: 'hls' });
          await initHls(streamUrl, video);
        }
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
        // Dynamic import for mpegts.js
        const mpegts = await import('mpegts.js');
        
        if (!mpegts.default.isSupported()) {
          throw new Error('mpegts.js não é suportado neste navegador');
        }

        console.log('Initializing mpegts.js player');
        
        const player = mpegts.default.createPlayer({
          type: type === 'flv' ? 'flv' : 'mpegts',
          isLive: true,
          url: url,
        }, {
          enableWorker: true,
          enableStashBuffer: true,
          stashInitialSize: 128 * 1024,
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
        });

        mpegtsPlayerRef.current = player;
        player.attachMediaElement(videoEl);
        player.load();

        player.on(mpegts.default.Events.ERROR, (errorType: string, errorDetail: string, errorInfo: any) => {
          console.error('mpegts.js error:', errorType, errorDetail, errorInfo);
          
          // Check if it's a codec error
          if (errorInfo?.msg?.includes('codec') || errorDetail?.includes('codec')) {
            setError(`Codec não suportado pelo navegador. Este stream pode usar H.265/HEVC que não é suportado no Chrome.`);
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
          setIsLoading(false);
        });

        // Try to play
        const playPromise = videoEl.play();
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              setIsLoading(false);
              setIsPlaying(true);
            })
            .catch((err) => {
              console.error('Autoplay failed:', err);
              setIsPlaying(false);
              setIsLoading(false);
            });
        }

        // Set a timeout for loading
        setTimeout(() => {
          if (isLoading && !error) {
            setIsLoading(false);
          }
        }, 5000);

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

  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video) return;
    setCurrentTime(video.currentTime);
    setProgress((video.currentTime / video.duration) * 100);
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
      {/* Loading Spinner */}
      {isLoading && !error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
          <div className="h-12 w-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="mt-4 text-muted-foreground">Detectando tipo de stream...</p>
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
        {!isPlaying && !isLoading && !error && (
          <button
            onClick={togglePlay}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-20 w-20 rounded-full bg-primary/90 flex items-center justify-center transition-transform hover:scale-110"
          >
            <Play className="h-10 w-10 fill-current ml-1" />
          </button>
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

            <div className="flex items-center gap-4">
              <button onClick={toggleFullscreen} className="p-2 hover:bg-secondary/50 rounded-full transition-colors">
                {isFullscreen ? <Minimize className="h-6 w-6" /> : <Maximize className="h-6 w-6" />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
