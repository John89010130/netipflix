import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, range',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Content-Type, Accept-Ranges, X-Stream-Type',
};

serve(async (req) => {
  // Handle CORS preflight
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
    
    console.log('Proxying stream:', decodedUrl);

    // Forward headers for proper streaming.
    // Some IPTV providers behave differently based on User-Agent and Range usage.
    // We'll try a few safe combinations (VLC-like + browser UA, with/without Range) before giving up.

    const incomingUA = req.headers.get('user-agent') || '';
    const incomingAcceptLanguage = req.headers.get('accept-language') || 'en-US,en;q=0.9';
    const incomingReferer = req.headers.get('referer');
    const incomingOrigin = req.headers.get('origin');

    const rangeHeader = req.headers.get('range');
    const looksLikeTs = /\.ts(\?|$)/i.test(decodedUrl);
    const looksLikeMp4 = /\.(mp4|webm|ogg|mov)(\?|$)/i.test(decodedUrl);

    const buildHeaders = (opts: { userAgent: string; includeRange: boolean; forceRange: boolean }): HeadersInit => {
      const h: Record<string, string> = {
        'User-Agent': opts.userAgent,
        'Accept': '*/*',
        'Accept-Language': incomingAcceptLanguage,
        'Connection': 'keep-alive',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        // Helps with certain servers that misbehave with gzip/br on binary streams
        'Accept-Encoding': 'identity',
      };

      if (incomingReferer) h['Referer'] = incomingReferer;
      if (incomingOrigin) h['Origin'] = incomingOrigin;

      // NUNCA use Range com .ts (streams ao vivo)
      if (opts.includeRange && !looksLikeTs) {
        if (rangeHeader) h['Range'] = rangeHeader;
        else if (opts.forceRange && looksLikeMp4) h['Range'] = 'bytes=0-';
      }

      return h;
    };

    const attempts: Array<{ name: string; headers: HeadersInit }> = [
      {
        name: 'vlc_no_range',
        headers: buildHeaders({ userAgent: 'VLC/3.0.20 LibVLC/3.0.20', includeRange: false, forceRange: false }),
      },
    ];

    // Apenas adicionar tentativa com Range se NÃO for .ts
    if (!looksLikeTs) {
      attempts.unshift({
        name: 'vlc_with_range',
        headers: buildHeaders({ userAgent: 'VLC/3.0.20 LibVLC/3.0.20', includeRange: true, forceRange: true }),
      });

      if (incomingUA) {
        attempts.push({
          name: 'browser_with_range',
          headers: buildHeaders({ userAgent: incomingUA, includeRange: true, forceRange: true }),
        });
        attempts.push({
          name: 'browser_no_range',
          headers: buildHeaders({ userAgent: incomingUA, includeRange: false, forceRange: false }),
        });
      }
    }

    let response: Response | null = null;
    const attemptResults: Array<{ name: string; status: number }> = [];

    for (const attempt of attempts) {
      try {
        console.log(
          `Fetch attempt (${attempt.name}) range=${rangeHeader ?? 'none'} url=${decodedUrl}`,
        );

        const r = await fetch(decodedUrl, {
          headers: attempt.headers,
          redirect: 'follow',
        });

        attemptResults.push({ name: attempt.name, status: r.status });

        // If success, stop.
        if (r.ok) {
          response = r;
          break;
        }

        // Most important fallbacks are for 403/404 (some providers mask blocks as 404).
        // For other status codes, don't keep retrying.
        if (![403, 404].includes(r.status)) {
          response = r;
          break;
        }
      } catch (err) {
        console.error(`Fetch attempt failed (${attempt.name}):`, err);
      }
    }

    if (!response || !response.ok) {
      const status = response?.status ?? 502;
      console.error('Stream fetch failed:', status, response?.statusText ?? '', 'attempts:', attemptResults);
      return new Response(
        JSON.stringify({ error: `Failed to fetch stream: ${status}`, attempts: attemptResults }),
        { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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
    
    // Detect full M3U catalog requests (large channel lists) - these should NOT be proxied
    // They're used for imports and are too large to buffer in memory
    const isFullM3uCatalog = decodedUrl.includes('type=m3u_plus') || 
                             decodedUrl.includes('type=m3u') ||
                             decodedUrl.includes('get.php') ||
                             decodedUrl.includes('output=m3u') ||
                             decodedUrl.includes('output=ts');
    
    if (isFullM3uCatalog) {
      console.log('Detected full M3U catalog request - streaming directly without rewriting');
      // Stream the response directly without buffering
      const responseHeaders: HeadersInit = {
        ...corsHeaders,
        'Content-Type': headerContentType || 'audio/x-mpegurl',
        'X-Stream-Type': 'catalog',
      };
      return new Response(response.body, {
        status: response.status,
        headers: responseHeaders,
      });
    }

    // For direct MP4/video files, stream without buffering/rewriting
    if ((isMp4ByUrl || isMp4ByHeader) && !isM3u8ByUrl && !isM3u8ByHeader) {
      console.log('Direct MP4/video file detected - streaming without buffering');
      const responseHeaders: HeadersInit = {
        ...corsHeaders,
        'Content-Type': headerContentType || 'video/mp4',
        'X-Stream-Type': 'mp4',
      };
      
      const contentLength = response.headers.get('content-length');
      if (contentLength) responseHeaders['Content-Length'] = contentLength;
      
      const contentRange = response.headers.get('content-range');
      if (contentRange) responseHeaders['Content-Range'] = contentRange;
      
      const acceptRanges = response.headers.get('accept-ranges');
      if (acceptRanges) responseHeaders['Accept-Ranges'] = acceptRanges;
      else responseHeaders['Accept-Ranges'] = 'bytes';

      return new Response(response.body, {
        status: response.status,
        headers: responseHeaders,
      });
    }

    // For direct TS streams (live TV), stream without buffering
    if (isTsByUrl && !isM3u8ByUrl && !isM3u8ByHeader) {
      console.log('Direct TS stream detected - streaming without buffering');
      const responseHeaders: HeadersInit = {
        ...corsHeaders,
        'Content-Type': 'video/mp2t',
        'X-Stream-Type': 'mpegts',
        'Accept-Ranges': 'none', // Live streams don't support ranges
      };
      
      const contentLength = response.headers.get('content-length');
      if (contentLength) responseHeaders['Content-Length'] = contentLength;

      return new Response(response.body, {
        status: response.status,
        headers: responseHeaders,
      });
    }

    // Some providers serve HLS playlists without a .m3u8 suffix and with a generic content-type.
    // We sniff the first chunk to detect "#EXTM3U" and rewrite the playlist URLs when needed.
    let playlistText: string | null = null;

    if (isM3u8ByUrl || isM3u8ByHeader) {
      playlistText = await response.text();
      contentType = 'application/vnd.apple.mpegurl';
      detectedStreamType = 'hls';
    } else if (response.body) {
      const reader = response.body.getReader();
      const first = await reader.read();

      const firstBytes = first.value ?? new Uint8Array();
      
      // Try to detect stream type from first bytes
      let isHlsPlaylist = false;
      let isMpegTs = false;
      
      // Check for HLS playlist (text-based)
      if (firstBytes.length > 0) {
        const firstText = new TextDecoder().decode(firstBytes.slice(0, 512));
        isHlsPlaylist = firstText.trimStart().startsWith('#EXTM3U') || firstText.includes('#EXT-X-');
        
        if (isHlsPlaylist) {
          // Read the rest of the playlist
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
        if (firstBytes.length > 0 && firstBytes[0] === 0x47) {
          isMpegTs = true;
          // Double check with second packet if we have enough data
          if (firstBytes.length >= 188) {
            isMpegTs = firstBytes[188] === 0x47;
          }
        }
        
        // Also check a few positions in case of padding
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
            firstBytes[0] === 0x46 && // F
            firstBytes[1] === 0x4C && // L
            firstBytes[2] === 0x56) { // V
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

        // Not a playlist: stream back the original bytes (including the first chunk we already read)
        const responseHeaders: HeadersInit = {
          ...corsHeaders,
          'Content-Type': contentType,
          'X-Stream-Type': detectedStreamType,
        };

        const contentLength = response.headers.get('content-length');
        if (contentLength) {
          responseHeaders['Content-Length'] = contentLength;
        }

        const contentRange = response.headers.get('content-range');
        if (contentRange) {
          responseHeaders['Content-Range'] = contentRange;
        }

        const acceptRanges = response.headers.get('accept-ranges');
        if (acceptRanges) {
          responseHeaders['Accept-Ranges'] = acceptRanges;
        } else {
          // For live streams, indicate we don't support ranges
          responseHeaders['Accept-Ranges'] = 'none';
        }

        // Create a stream that first emits the bytes we already read, then continues with the rest.
        // Use `pull` to respect backpressure (prevents memory growth on slow clients).
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
              try {
                controller.error(err);
              } catch {
                // ignore
              }
            }
          },
          cancel(reason) {
            try {
              reader.cancel(reason);
            } catch {
              // ignore
            }
          },
        });

        console.log('Streaming binary content, type:', detectedStreamType, 'content-type:', contentType);

        return new Response(stream, {
          status: response.status,
          headers: responseHeaders,
        });
      }
    }

    // For m3u8 playlists, we need to rewrite the URLs inside to also go through the proxy
    if (playlistText !== null) {
      const baseUrl = finalUrl.substring(0, finalUrl.lastIndexOf('/') + 1);

      // Use the correct public endpoint path (prefer forwarded headers; default to HTTPS)
      const forwardedProto = req.headers.get('x-forwarded-proto')?.split(',')[0]?.trim();
      const forwardedHost = req.headers.get('x-forwarded-host')?.split(',')[0]?.trim();
      const proxyOrigin = `${forwardedProto || 'https'}://${forwardedHost || url.host}`.replace(/^http:\/\//i, 'https://');
      const proxyBaseUrl = `${proxyOrigin}/functions/v1/stream-proxy?url=`;

      console.log('Rewriting m3u8 playlist, proxy base URL:', proxyBaseUrl);

      // Rewrite relative URLs in the playlist to go through our proxy
      const rewrittenText = playlistText.split('\n').map(line => {
        const trimmedLine = line.trim();

        // Handle EXT-X-KEY with URI (encryption keys)
        if (trimmedLine.includes('URI="')) {
          return trimmedLine.replace(/URI="([^"]+)"/g, (_match, uri) => {
            if (uri.startsWith('http://') || uri.startsWith('https://')) {
              return `URI="${proxyBaseUrl}${encodeURIComponent(uri)}"`;
            }
            return `URI="${proxyBaseUrl}${encodeURIComponent(baseUrl + uri)}"`;
          });
        }

        // Skip empty lines and comment lines
        if (!trimmedLine || trimmedLine.startsWith('#')) {
          return line;
        }

        // If it's an absolute URL
        if (trimmedLine.startsWith('http://') || trimmedLine.startsWith('https://')) {
          return proxyBaseUrl + encodeURIComponent(trimmedLine);
        }

        // Relative URL - make it absolute and proxy it
        return proxyBaseUrl + encodeURIComponent(baseUrl + trimmedLine);
      }).join('\n');

      console.log('Rewritten playlist (first 500 chars):', rewrittenText.substring(0, 500));

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

    // For binary content, stream directly
    const responseHeaders: HeadersInit = {
      ...corsHeaders,
      'Content-Type': contentType,
      'X-Stream-Type': detectedStreamType,
    };

    const contentLength = response.headers.get('content-length');
    if (contentLength) {
      responseHeaders['Content-Length'] = contentLength;
    }

    const contentRange = response.headers.get('content-range');
    if (contentRange) {
      responseHeaders['Content-Range'] = contentRange;
    }

    const acceptRanges = response.headers.get('accept-ranges');
    if (acceptRanges) {
      responseHeaders['Accept-Ranges'] = acceptRanges;
    }

    return new Response(response.body, {
      status: response.status,
      headers: responseHeaders,
    });

  } catch (error) {
    console.error('Proxy error:', error);
    return new Response(
      JSON.stringify({ error: 'Proxy error: ' + (error instanceof Error ? error.message : 'Unknown error') }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
