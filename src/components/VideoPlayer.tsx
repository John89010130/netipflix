import { useEffect, useRef, useState } from 'react';
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
  Link
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

// Use proxy for all stream URLs to avoid CORS issues
const getProxiedUrl = (url: string): string => {
  // Only proxy HTTP/HTTPS URLs
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return url;
  }
  // Use our edge function proxy for all external streams
  return `${SUPABASE_URL}/functions/v1/stream-proxy?url=${encodeURIComponent(url)}`;
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
  const [fragmentErrors, setFragmentErrors] = useState(0);
  
  const { isAdmin } = useAuth();
  
  // Get the proxied URL for display
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

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    
    setError(null);
    setIsLoading(true);

    // Use proxy for HTTP URLs to avoid mixed content issues
    const streamUrl = getProxiedUrl(src);

    if (Hls.isSupported() && src.includes('.m3u8')) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        xhrSetup: (xhr) => {
          xhr.timeout = 30000;
        }
      });
      
      hls.loadSource(streamUrl);
      hls.attachMedia(video);
      
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setIsLoading(false);
        if (autoPlay) video.play().catch(() => setIsPlaying(false));
      });
      
      hls.on(Hls.Events.ERROR, (event, data) => {
        console.error('HLS Error:', data);
        
        // Track fragment load errors
        if (data.details === 'fragLoadError') {
          setFragmentErrors(prev => {
            const newCount = prev + 1;
            // After 3 fragment errors, show a warning
            if (newCount === 3) {
              toast.warning('Dificuldade ao carregar segmentos do stream...');
            }
            return newCount;
          });
        }
        
        if (data.fatal) {
          setIsLoading(false);
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              if (data.details === 'fragLoadError') {
                setError('Não foi possível carregar os segmentos do stream. O servidor pode estar bloqueando o acesso ou o stream está offline.');
              } else {
                setError('Erro de rede ao carregar o stream. O servidor pode estar offline ou inacessível.');
              }
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              setError('Erro de mídia. O formato do stream pode não ser compatível.');
              hls.recoverMediaError();
              break;
            default:
              setError('Não foi possível reproduzir este stream. Ele pode estar offline.');
              break;
          }
        }
      });

      return () => {
        hls.destroy();
      };
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = streamUrl;
      video.addEventListener('loadeddata', () => setIsLoading(false));
      video.addEventListener('error', () => {
        setIsLoading(false);
        setError('Não foi possível carregar o vídeo.');
      });
      if (autoPlay) video.play().catch(() => setIsPlaying(false));
    } else {
      // Try direct source for non-HLS
      video.src = streamUrl;
      video.addEventListener('loadeddata', () => setIsLoading(false));
      video.addEventListener('error', () => {
        setIsLoading(false);
        setError('Formato de vídeo não suportado pelo navegador.');
      });
      if (autoPlay) video.play().catch(() => setIsPlaying(false));
    }
  }, [src, autoPlay]);

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
    const hours = Math.floor(time / 3600);
    const minutes = Math.floor((time % 3600) / 60);
    const secs = Math.floor(time % 60);
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 bg-background flex items-center justify-center"
    >
      {/* Loading Spinner */}
      {isLoading && !error && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <div className="h-12 w-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-10 p-8">
          <div className="bg-destructive/20 border border-destructive/50 rounded-lg p-6 max-w-lg text-center">
            <p className="text-destructive-foreground mb-4">{error}</p>
            
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
        {!isPlaying && (
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
