// Proxy Server Local - Simples e Transparente
const http = require('http');
const https = require('https');
const { URL } = require('url');

const PORT = 3000;

const server = http.createServer((req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Content-Type, Accept-Ranges');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  const urlParam = new URL(req.url, `http://localhost:${PORT}`).searchParams.get('url');
  
  if (!urlParam) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Missing url parameter' }));
    return;
  }

  const targetUrl = new URL(urlParam);
  const isHttps = targetUrl.protocol === 'https:';
  const client = isHttps ? https : http;

  const headers = {
    'User-Agent': 'VLC/3.0.20 LibVLC/3.0.20',
    'Accept': '*/*',
    'Connection': 'keep-alive',
  };

  // Passar Range header se existir (exceto para .ts)
  if (req.headers.range && !urlParam.endsWith('.ts')) {
    headers['Range'] = req.headers.range;
  }

  const proxyReq = client.request(targetUrl, {
    method: req.method,
    headers: headers,
  }, (proxyRes) => {
    // Copiar headers da resposta
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res);
  });

  proxyReq.on('error', (err) => {
    console.error('Proxy error:', err.message);
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Proxy error', details: err.message }));
  });

  proxyReq.end();
});

server.listen(PORT, () => {
  console.log(`✅ Proxy rodando em http://localhost:${PORT}`);
  console.log(`   Pronto para fazer proxy de streams IPTV`);
});
