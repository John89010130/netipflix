// Cloudflare Worker - Stream Proxy
export default {
  async fetch(request, env, ctx) {
    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': 'Range, Content-Type',
      'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Content-Type, Accept-Ranges',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    const streamUrl = url.searchParams.get('url');

    if (!streamUrl) {
      return new Response(JSON.stringify({ error: 'Missing url parameter' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const decodedUrl = decodeURIComponent(streamUrl);
    const looksLikeTs = /\.ts(\?|$)/i.test(decodedUrl);

    // Capturar IP do cliente enviado pelo Cloudflare
    const clientIp =
      request.headers.get('cf-connecting-ip') ||
      request.headers.get('x-real-ip') ||
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      '';

    const headers = {
      'User-Agent': 'VLC/3.0.20 LibVLC/3.0.20',
      'Accept': '*/*',
      'Connection': 'keep-alive',
    };

    // Repassar IP real para provedores que validam origem
    if (clientIp) {
      headers['X-Forwarded-For'] = clientIp;
      headers['X-Real-IP'] = clientIp;
      headers['CF-Connecting-IP'] = clientIp;
      headers['True-Client-IP'] = clientIp;
    }

    // Nunca usar Range com .ts
    const rangeHeader = request.headers.get('range');
    if (rangeHeader && !looksLikeTs) {
      headers['Range'] = rangeHeader;
    }

    try {
      const response = await fetch(decodedUrl, { headers });
      
      const newHeaders = new Headers(response.headers);
      Object.keys(corsHeaders).forEach(key => {
        newHeaders.set(key, corsHeaders[key]);
      });

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders
      });
    } catch (error) {
      return new Response(JSON.stringify({ 
        error: 'Proxy error', 
        details: error.message 
      }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }
};
