import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, range',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Content-Type, Accept-Ranges',
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

    // Forward range header if present (for seeking)
    const headers: HeadersInit = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    };
    
    const rangeHeader = req.headers.get('range');
    if (rangeHeader) {
      headers['Range'] = rangeHeader;
    }

    const response = await fetch(decodedUrl, {
      headers,
      redirect: 'follow',
    });

    if (!response.ok) {
      console.error('Stream fetch failed:', response.status, response.statusText);
      return new Response(
        JSON.stringify({ error: `Failed to fetch stream: ${response.status}` }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get content type from response or infer from URL
    const headerContentType = response.headers.get('content-type') || '';
    let contentType = headerContentType || 'application/octet-stream';

    const finalUrl = response.url || decodedUrl;
    const isM3u8ByUrl = decodedUrl.includes('.m3u8') || finalUrl.includes('.m3u8');
    const isM3u8ByHeader = /mpegurl/i.test(headerContentType);

    // Some providers serve HLS playlists without a .m3u8 suffix and with a generic content-type.
    // We sniff the first chunk to detect "#EXTM3U" and rewrite the playlist URLs when needed.
    let playlistText: string | null = null;

    if (isM3u8ByUrl || isM3u8ByHeader) {
      playlistText = await response.text();
      contentType = 'application/vnd.apple.mpegurl';
    } else if (
      response.body &&
      (!headerContentType || headerContentType.includes('text') || headerContentType.includes('application/octet-stream'))
    ) {
      const reader = response.body.getReader();
      const first = await reader.read();

      const firstBytes = first.value ?? new Uint8Array();
      const firstText = new TextDecoder().decode(firstBytes);
      const looksLikePlaylist = firstText.trimStart().startsWith('#EXTM3U') || firstText.includes('#EXT-X-');

      if (looksLikePlaylist) {
        let text = firstText;
        while (true) {
          const r = await reader.read();
          if (r.done) break;
          text += new TextDecoder().decode(r.value);
        }
        playlistText = text;
        contentType = 'application/vnd.apple.mpegurl';
      } else {
        // Not a playlist: stream back the original bytes (including the first chunk we already read)
        if (decodedUrl.includes('.ts')) {
          contentType = 'video/mp2t';
        }

        const responseHeaders: HeadersInit = {
          ...corsHeaders,
          'Content-Type': contentType,
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

        const stream = new ReadableStream<Uint8Array>({
          start(controller) {
            if (!first.done) controller.enqueue(firstBytes);

            const pump = (): void => {
              reader.read().then(({ done, value }) => {
                if (done) {
                  controller.close();
                  return;
                }
                controller.enqueue(value!);
                pump();
              }).catch((err) => {
                console.error('Proxy stream error:', err);
                controller.error(err);
              });
            };

            pump();
          },
          cancel(reason) {
            try {
              reader.cancel(reason);
            } catch {
              // ignore
            }
          },
        });

        return new Response(stream, {
          status: response.status,
          headers: responseHeaders,
        });
      }
    }

    // For m3u8 playlists, we need to rewrite the URLs inside to also go through the proxy
    if (playlistText !== null) {
      const baseUrl = finalUrl.substring(0, finalUrl.lastIndexOf('/') + 1);

      // CRITICAL FIX: Use the full path including /functions/v1/
      // The url.pathname only contains '/stream-proxy', not the full edge function path
      // We need to use the correct public endpoint path
      const proxyOrigin = url.origin.replace('http://', 'https://');
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
          'Cache-Control': 'no-cache',
        },
      });
    }

    // For binary content, stream directly
    const responseHeaders: HeadersInit = {
      ...corsHeaders,
      'Content-Type': contentType,
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
