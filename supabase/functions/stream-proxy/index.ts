import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, range',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
  'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Content-Type, Accept-Ranges, X-Stream-Type',
};

// User agents matrix para compatibilidade máxima
const USER_AGENTS = {
  vlc: 'VLC/3.0.20 LibVLC/3.0.20',
  ffmpeg: 'Lavf/60.16.100',
  curl: 'curl/8.4.0',
  browser: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
};

serve(async (req) => {
  // Handle CORS preflight + HEAD
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const streamUrl = url.searchParams.get('url');

    if (!streamUrl) {
      return new Response(
        JSON.stringify({ error: 'Missing stream URL parameter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Decode the URL if it's encoded
    let decodedUrl = decodeURIComponent(streamUrl);
    
    // Check for recursive/double proxying - extract original URL if proxied URL was passed
    if (decodedUrl.includes('/functions/v1/stream-proxy') || decodedUrl.includes('/stream-proxy?url=')) {
      try {
        const nestedUrl = new URL(decodedUrl);
        const nestedStreamUrl = nestedUrl.searchParams.get('url');
        if (nestedStreamUrl) {
          decodedUrl = decodeURIComponent(nestedStreamUrl);
          console.log('Detected double-proxied URL, extracting original:', decodedUrl);
        }
      } catch {
        // Ignore parsing errors
      }
    }
    
    console.log('Proxying stream:', decodedUrl, 'method:', req.method);

    const rangeHeader = req.headers.get('range');
    const looksLikeTs = /\.ts(\?|$)/i.test(decodedUrl);
    const looksLikeMp4 = /\.(mp4|webm|ogg|mov)(\?|$)/i.test(decodedUrl);
    const looksLikeM3u8 = /\.m3u8(\?|$)/i.test(decodedUrl);

    // IMPORTANTE: Não repassar Origin/Referer do cliente (causa bloqueios)
    const buildHeaders = (opts: { userAgent: string; includeRange: boolean; forceRange: boolean }): HeadersInit => {
      const h: Record<string, string> = {
        'User-Agent': opts.userAgent,
        'Accept': '*/*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Connection': 'keep-alive',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Accept-Encoding': 'identity',
      };

      // Somente para MP4/arquivos, considerar Range
      if (opts.includeRange && !looksLikeTs) {
        if (rangeHeader) {
          h['Range'] = rangeHeader;
        } else if (opts.forceRange && looksLikeMp4) {
          h['Range'] = 'bytes=0-';
        }
      }

      return h;
    };

    // Matriz de tentativas baseada no tipo de arquivo
    const attempts: Array<{ name: string; headers: HeadersInit }> = [];

    if (looksLikeTs) {
      // Para .ts (live streams), tentar vários UAs sem Range
      attempts.push(
        { name: 'vlc_ts', headers: buildHeaders({ userAgent: USER_AGENTS.vlc, includeRange: false, forceRange: false }) },
        { name: 'ffmpeg_ts', headers: buildHeaders({ userAgent: USER_AGENTS.ffmpeg, includeRange: false, forceRange: false }) },
        { name: 'curl_ts', headers: buildHeaders({ userAgent: USER_AGENTS.curl, includeRange: false, forceRange: false }) },
        { name: 'browser_ts', headers: buildHeaders({ userAgent: USER_AGENTS.browser, includeRange: false, forceRange: false }) },
      );
    } else if (looksLikeMp4) {
      // Para MP4, tentar com e sem Range
      attempts.push(
        { name: 'vlc_mp4_range', headers: buildHeaders({ userAgent: USER_AGENTS.vlc, includeRange: true, forceRange: true }) },
        { name: 'vlc_mp4_no_range', headers: buildHeaders({ userAgent: USER_AGENTS.vlc, includeRange: false, forceRange: false }) },
        { name: 'browser_mp4_range', headers: buildHeaders({ userAgent: USER_AGENTS.browser, includeRange: true, forceRange: true }) },
        { name: 'browser_mp4_no_range', headers: buildHeaders({ userAgent: USER_AGENTS.browser, includeRange: false, forceRange: false }) },
      );
    } else {
      // Outros (m3u8, etc)
      attempts.push(
        { name: 'vlc_default', headers: buildHeaders({ userAgent: USER_AGENTS.vlc, includeRange: false, forceRange: false }) },
        { name: 'browser_default', headers: buildHeaders({ userAgent: USER_AGENTS.browser, includeRange: false, forceRange: false }) },
      );
    }

    let response: Response | null = null;
    let lastStatus = 0;
    let lastStatusText = '';
    const attemptResults: Array<{ name: string; status: number; statusText?: string }> = [];

    for (const attempt of attempts) {
      try {
        console.log(`Fetch attempt (${attempt.name}) range=${rangeHeader ?? 'none'} url=${decodedUrl}`);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 12000); // 12s timeout

        const r = await fetch(decodedUrl, {
          method: req.method === 'HEAD' ? 'HEAD' : 'GET',
          headers: attempt.headers,
          redirect: 'follow',
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        attemptResults.push({ name: attempt.name, status: r.status, statusText: r.statusText });
        lastStatus = r.status;
        lastStatusText = r.statusText;

        // If success, stop
        if (r.ok) {
          response = r;
          console.log(`Success with attempt (${attempt.name}): ${r.status}`);
          break;
        }

        // Para 403/404, tentar próxima estratégia
        if ([403, 404].includes(r.status)) {
          console.log(`Attempt (${attempt.name}) returned ${r.status}, trying next...`);
          continue;
        }

        // Para outros erros (500, 502, etc), não retentamos
        response = r;
        break;
      } catch (err: any) {
        const isTimeout = err.name === 'AbortError';
        console.error(`Fetch attempt failed (${attempt.name}):`, isTimeout ? 'TIMEOUT' : err.message);
        attemptResults.push({ name: attempt.name, status: isTimeout ? 408 : 0, statusText: isTimeout ? 'Timeout' : err.message });
      }
    }

    // Se nenhuma tentativa funcionou, retornar o último status (não 502)
    if (!response || !response.ok) {
      const finalStatus = lastStatus || 502;
      const hint = finalStatus === 404 ? 'Stream não encontrado no servidor' 
                 : finalStatus === 403 ? 'Acesso bloqueado pelo servidor'
                 : 'Todas as tentativas falharam';
      
      console.error('Stream fetch failed:', finalStatus, lastStatusText, 'attempts:', attemptResults);
      
      return new Response(
        JSON.stringify({ 
          error: `Falha ao buscar stream: ${finalStatus}`, 
          hint,
          attempts: attemptResults,
          url: decodedUrl,
        }),
        { status: finalStatus, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle HEAD requests
    if (req.method === 'HEAD') {
      const headersForHead: HeadersInit = { ...corsHeaders };
      const ct = response.headers.get('content-type');
      if (ct) headersForHead['Content-Type'] = ct;
      const cl = response.headers.get('content-length');
      if (cl) headersForHead['Content-Length'] = cl;
      headersForHead['Accept-Ranges'] = response.headers.get('accept-ranges') || 'bytes';
      
      return new Response(null, { status: 200, headers: headersForHead });
    }

    // Get content type from response or infer from URL
    const headerContentType = response.headers.get('content-type') || '';
    let contentType = headerContentType || 'application/octet-stream';
    let detectedStreamType = 'unknown';

    const finalUrl = response.url || decodedUrl;
    const isM3u8ByUrl = decodedUrl.includes('.m3u8') || finalUrl.includes('.m3u8');
    const isM3u8ByHeader = /mpegurl/i.test(headerContentType);
    const isTsByUrl = /\.ts(\?|$)/i.test(decodedUrl) || /\.ts(\?|$)/i.test(finalUrl);
    const isMp4ByUrl = /\.(mp4|webm|ogg|mov)(\?|$)/i.test(decodedUrl) || /\.(mp4|webm|ogg|mov)(\?|$)/i.test(finalUrl);
    const isMp4ByHeader = /video\/(mp4|webm|ogg|quicktime)/i.test(headerContentType);
    
    // Detect full M3U catalog requests
    const isFullM3uCatalog = decodedUrl.includes('type=m3u_plus') || 
                             decodedUrl.includes('type=m3u') ||
                             decodedUrl.includes('get.php') ||
                             decodedUrl.includes('output=m3u') ||
                             decodedUrl.includes('output=ts');
    
    if (isFullM3uCatalog) {
      console.log('Detected full M3U catalog request - streaming directly');
      return new Response(response.body, {
        status: response.status,
        headers: {
          ...corsHeaders,
          'Content-Type': headerContentType || 'audio/x-mpegurl',
          'X-Stream-Type': 'catalog',
        },
      });
    }

    // For direct MP4/video files
    if ((isMp4ByUrl || isMp4ByHeader) && !isM3u8ByUrl && !isM3u8ByHeader) {
      console.log('Direct MP4/video file detected - streaming');
      const responseHeaders: HeadersInit = {
        ...corsHeaders,
        'Content-Type': headerContentType || 'video/mp4',
        'X-Stream-Type': 'mp4',
      };
      
      const contentLength = response.headers.get('content-length');
      if (contentLength) responseHeaders['Content-Length'] = contentLength;
      
      const contentRange = response.headers.get('content-range');
      if (contentRange) responseHeaders['Content-Range'] = contentRange;
      
      responseHeaders['Accept-Ranges'] = response.headers.get('accept-ranges') || 'bytes';

      return new Response(response.body, {
        status: response.status,
        headers: responseHeaders,
      });
    }

    // For direct TS streams (live TV)
    if (isTsByUrl && !isM3u8ByUrl && !isM3u8ByHeader) {
      console.log('Direct TS stream detected - streaming');
      return new Response(response.body, {
        status: response.status,
        headers: {
          ...corsHeaders,
          'Content-Type': 'video/mp2t',
          'X-Stream-Type': 'mpegts',
          'Accept-Ranges': 'none',
        },
      });
    }

    // Sniff first bytes for content detection
    let playlistText: string | null = null;

    if (isM3u8ByUrl || isM3u8ByHeader) {
      playlistText = await response.text();
      contentType = 'application/vnd.apple.mpegurl';
      detectedStreamType = 'hls';
    } else if (response.body) {
      const reader = response.body.getReader();
      const first = await reader.read();
      const firstBytes = first.value ?? new Uint8Array();
      
      let isHlsPlaylist = false;
      
      if (firstBytes.length > 0) {
        const firstText = new TextDecoder().decode(firstBytes.slice(0, 512));
        isHlsPlaylist = firstText.trimStart().startsWith('#EXTM3U') || firstText.includes('#EXT-X-');
        
        if (isHlsPlaylist) {
          let text = new TextDecoder().decode(firstBytes);
          while (true) {
            const r = await reader.read();
            if (r.done) break;
            text += new TextDecoder().decode(r.value);
          }
          playlistText = text;
          contentType = 'application/vnd.apple.mpegurl';
          detectedStreamType = 'hls';
        }
      }

      if (!isHlsPlaylist) {
        // Check for MPEG-TS sync byte (0x47)
        let isMpegTs = false;
        if (firstBytes.length > 0 && firstBytes[0] === 0x47) {
          if (firstBytes.length >= 188) {
            isMpegTs = firstBytes[188] === 0x47;
          } else {
            isMpegTs = true;
          }
        }
        
        if (!isMpegTs && firstBytes.length >= 376) {
          for (let i = 0; i < Math.min(firstBytes.length - 188, 1000); i++) {
            if (firstBytes[i] === 0x47 && firstBytes[i + 188] === 0x47) {
              isMpegTs = true;
              break;
            }
          }
        }

        if (isMpegTs || isTsByUrl) {
          contentType = 'video/mp2t';
          detectedStreamType = 'mpegts';
        }

        // Check for FLV header
        if (firstBytes.length >= 3 && 
            firstBytes[0] === 0x46 && firstBytes[1] === 0x4C && firstBytes[2] === 0x56) {
          contentType = 'video/x-flv';
          detectedStreamType = 'flv';
        }

        // Check for MP4/ftyp
        if (firstBytes.length >= 8) {
          const ftypStr = String.fromCharCode(firstBytes[4], firstBytes[5], firstBytes[6], firstBytes[7]);
          if (ftypStr === 'ftyp') {
            contentType = 'video/mp4';
            detectedStreamType = 'mp4';
          }
        }

        // Stream back the bytes
        const responseHeaders: HeadersInit = {
          ...corsHeaders,
          'Content-Type': contentType,
          'X-Stream-Type': detectedStreamType,
        };

        const contentLength = response.headers.get('content-length');
        if (contentLength) responseHeaders['Content-Length'] = contentLength;

        const contentRange = response.headers.get('content-range');
        if (contentRange) responseHeaders['Content-Range'] = contentRange;

        responseHeaders['Accept-Ranges'] = response.headers.get('accept-ranges') || 'none';

        let firstChunkSent = false;
        const stream = new ReadableStream<Uint8Array>({
          async pull(controller) {
            try {
              if (!firstChunkSent) {
                firstChunkSent = true;
                if (!first.done && firstBytes.length > 0) {
                  controller.enqueue(firstBytes);
                }
                if (first.done) controller.close();
                return;
              }

              const { done, value } = await reader.read();
              if (done) {
                controller.close();
                return;
              }
              if (value) controller.enqueue(value);
            } catch (err) {
              try { controller.error(err); } catch {}
            }
          },
          cancel(reason) {
            try { reader.cancel(reason); } catch {}
          },
        });

        console.log('Streaming binary content, type:', detectedStreamType);

        return new Response(stream, {
          status: response.status,
          headers: responseHeaders,
        });
      }
    }

    // For m3u8 playlists, rewrite URLs
    if (playlistText !== null) {
      const baseUrl = finalUrl.substring(0, finalUrl.lastIndexOf('/') + 1);
      const forwardedProto = req.headers.get('x-forwarded-proto')?.split(',')[0]?.trim();
      const forwardedHost = req.headers.get('x-forwarded-host')?.split(',')[0]?.trim();
      const proxyOrigin = `${forwardedProto || 'https'}://${forwardedHost || url.host}`.replace(/^http:\/\//i, 'https://');
      const proxyBaseUrl = `${proxyOrigin}/functions/v1/stream-proxy?url=`;

      console.log('Rewriting m3u8 playlist, proxy base URL:', proxyBaseUrl);

      const rewrittenText = playlistText.split('\n').map(line => {
        const trimmedLine = line.trim();

        if (trimmedLine.includes('URI="')) {
          return trimmedLine.replace(/URI="([^"]+)"/g, (_match, uri) => {
            if (uri.startsWith('http://') || uri.startsWith('https://')) {
              return `URI="${proxyBaseUrl}${encodeURIComponent(uri)}"`;
            }
            return `URI="${proxyBaseUrl}${encodeURIComponent(baseUrl + uri)}"`;
          });
        }

        if (!trimmedLine || trimmedLine.startsWith('#')) {
          return line;
        }

        if (trimmedLine.startsWith('http://') || trimmedLine.startsWith('https://')) {
          return proxyBaseUrl + encodeURIComponent(trimmedLine);
        }

        return proxyBaseUrl + encodeURIComponent(baseUrl + trimmedLine);
      }).join('\n');

      return new Response(rewrittenText, {
        status: response.status,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/vnd.apple.mpegurl',
          'X-Stream-Type': 'hls',
          'Cache-Control': 'no-cache',
        },
      });
    }

    // Fallback: stream binary content directly
    return new Response(response.body, {
      status: response.status,
      headers: {
        ...corsHeaders,
        'Content-Type': contentType,
        'X-Stream-Type': detectedStreamType,
      },
    });

  } catch (error) {
    console.error('Proxy error:', error);
    return new Response(
      JSON.stringify({ error: 'Proxy error: ' + (error instanceof Error ? error.message : 'Unknown error') }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
