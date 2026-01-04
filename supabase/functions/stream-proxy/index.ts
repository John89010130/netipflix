import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, range',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Content-Type',
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
    const decodedUrl = decodeURIComponent(streamUrl);
    
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
    let contentType = response.headers.get('content-type') || 'application/octet-stream';
    
    if (decodedUrl.includes('.m3u8')) {
      contentType = 'application/vnd.apple.mpegurl';
    } else if (decodedUrl.includes('.ts')) {
      contentType = 'video/mp2t';
    }

    // For m3u8 playlists, we need to rewrite the URLs inside to also go through the proxy
    if (contentType.includes('mpegurl') || decodedUrl.includes('.m3u8')) {
      const text = await response.text();
      const baseUrl = decodedUrl.substring(0, decodedUrl.lastIndexOf('/') + 1);
      const proxyBaseUrl = `${url.origin}${url.pathname}?url=`;
      
      // Rewrite relative URLs in the playlist to go through our proxy
      const rewrittenText = text.split('\n').map(line => {
        const trimmedLine = line.trim();
        
        // Skip empty lines and comments (except URI in EXT-X-KEY)
        if (!trimmedLine || (trimmedLine.startsWith('#') && !trimmedLine.includes('URI="'))) {
          // Handle EXT-X-KEY with URI
          if (trimmedLine.includes('URI="')) {
            return trimmedLine.replace(/URI="([^"]+)"/, (match, uri) => {
              if (uri.startsWith('http://') || uri.startsWith('https://')) {
                return `URI="${proxyBaseUrl}${encodeURIComponent(uri)}"`;
              }
              return `URI="${proxyBaseUrl}${encodeURIComponent(baseUrl + uri)}"`;
            });
          }
          return line;
        }
        
        // If it's a URL (relative or absolute)
        if (trimmedLine.startsWith('http://') || trimmedLine.startsWith('https://')) {
          return proxyBaseUrl + encodeURIComponent(trimmedLine);
        } else if (!trimmedLine.startsWith('#')) {
          // Relative URL - make it absolute and proxy it
          return proxyBaseUrl + encodeURIComponent(baseUrl + trimmedLine);
        }
        
        return line;
      }).join('\n');

      return new Response(rewrittenText, {
        status: response.status,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/vnd.apple.mpegurl',
          'Cache-Control': 'no-cache',
        },
      });
    }

    // For binary content (ts segments), stream directly
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
