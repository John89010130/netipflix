import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface StreamTestResult {
  url: string;
  status: 'online' | 'offline' | 'error';
  statusCode?: number;
  responseTime?: number;
  error?: string;
}

async function testStream(url: string): Promise<StreamTestResult> {
  const startTime = Date.now();
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
    
    // Always use GET request to properly test if stream is actually accessible
    // HEAD requests often return 200 even when the actual content is 404
    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': '*/*',
      },
    });
    
    clearTimeout(timeoutId);
    const responseTime = Date.now() - startTime;
    
    // For m3u8 files, verify the content is actually a valid playlist
    if (url.includes('.m3u8')) {
      if (!response.ok) {
        return {
          url,
          status: 'offline',
          statusCode: response.status,
          responseTime,
          error: `HTTP ${response.status}`,
        };
      }
      
      const text = await response.text();
      // Valid m3u8 playlists start with #EXTM3U
      if (text.includes('#EXTM3U') || text.includes('#EXT-X-')) {
        return {
          url,
          status: 'online',
          statusCode: response.status,
          responseTime,
        };
      } else {
        return {
          url,
          status: 'offline',
          statusCode: response.status,
          responseTime,
          error: 'Invalid playlist content',
        };
      }
    }
    
    // For regular streams, check if we got actual content
    // Read just the first few bytes to verify it's not an error page
    if (response.ok) {
      const contentType = response.headers.get('content-type') || '';
      const contentLength = response.headers.get('content-length');
      
      // Check if it looks like video content
      const isVideoContent = 
        contentType.includes('video') || 
        contentType.includes('mpegurl') ||
        contentType.includes('octet-stream') ||
        contentType.includes('application/x-mpegURL') ||
        (contentLength && parseInt(contentLength) > 1000);
      
      if (isVideoContent) {
        return {
          url,
          status: 'online',
          statusCode: response.status,
          responseTime,
        };
      }
      
      // Read a bit of content to check if it's valid
      const reader = response.body?.getReader();
      if (reader) {
        const { value } = await reader.read();
        reader.cancel();
        
        // Check if we got actual data
        if (value && value.length > 100) {
          return {
            url,
            status: 'online',
            statusCode: response.status,
            responseTime,
          };
        }
      }
    }
    
    return {
      url,
      status: response.ok ? 'online' : 'offline',
      statusCode: response.status,
      responseTime,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Check if it's a timeout
    if (errorMessage.includes('abort') || errorMessage.includes('timeout')) {
      return {
        url,
        status: 'offline',
        error: 'Timeout - stream took too long to respond',
      };
    }
    
    return {
      url,
      status: 'error',
      error: errorMessage,
    };
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { urls } = await req.json();
    
    if (!urls || !Array.isArray(urls)) {
      return new Response(
        JSON.stringify({ error: 'urls array is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Testing ${urls.length} streams...`);
    
    // Test streams in parallel batches of 5
    const batchSize = 5;
    const results: StreamTestResult[] = [];
    
    for (let i = 0; i < urls.length; i += batchSize) {
      const batch = urls.slice(i, i + batchSize);
      const batchResults = await Promise.all(batch.map(testStream));
      results.push(...batchResults);
      console.log(`Tested ${Math.min(i + batchSize, urls.length)}/${urls.length} streams`);
    }
    
    const online = results.filter(r => r.status === 'online').length;
    const offline = results.filter(r => r.status === 'offline').length;
    const errors = results.filter(r => r.status === 'error').length;
    
    console.log(`Results: ${online} online, ${offline} offline, ${errors} errors`);

    return new Response(
      JSON.stringify({ results, summary: { online, offline, errors, total: urls.length } }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error testing streams:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to test streams: ' + (error instanceof Error ? error.message : 'Unknown error') }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
