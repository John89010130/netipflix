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
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    const response = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });
    
    clearTimeout(timeoutId);
    const responseTime = Date.now() - startTime;
    
    // For m3u8 files, we might need to do a GET to check content
    if (url.includes('.m3u8') && response.status === 405) {
      const getResponse = await fetch(url, {
        method: 'GET',
        signal: AbortSignal.timeout(10000),
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      });
      
      return {
        url,
        status: getResponse.ok ? 'online' : 'offline',
        statusCode: getResponse.status,
        responseTime: Date.now() - startTime,
      };
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
