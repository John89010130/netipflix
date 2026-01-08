import http from 'http';
import https from 'https';
import { URL } from 'url';

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

const server = http.createServer(async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  const targetUrl = req.url.slice(1); // Remove leading /
  
  if (!targetUrl) {
    res.writeHead(400);
    res.end('URL necessária: http://localhost:3000/http://seu-stream.ts');
    return;
  }

  // Remove http:// ou https:// duplicados
  const cleanUrl = targetUrl.replace(/^(https?:\/\/)+(https?:\/\/)/, '$1');

  console.log(`📡 Proxy: ${cleanUrl}`);

  try {
    const parsedUrl = new URL(cleanUrl);
    const protocol = parsedUrl.protocol === 'https:' ? https : http;
    
    console.log(`🔗 Protocol: ${parsedUrl.protocol}, Host: ${parsedUrl.host}`);
    
    const proxyReq = protocol.request(cleanUrl, {
      method: req.method,
      headers: {
        ...req.headers,
        host: parsedUrl.host,
      },
      rejectUnauthorized: false, // Ignora erros SSL
    }, (proxyRes) => {
      console.log(`✅ Response: ${proxyRes.statusCode}, Content-Length: ${proxyRes.headers['content-length']}`);
      
      // FORÇA video/mp2t para evitar download
      const contentType = 'video/mp2t';
      
      // Remove Content-Disposition que força download
      const headers = { ...proxyRes.headers };
      delete headers['content-disposition'];
      delete headers['content-type'];
      
      // Copia status e headers com Content-Type FORÇADO
      res.writeHead(proxyRes.statusCode || 200, {
        ...headers,
        'content-type': contentType,
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Expose-Headers': '*',
      });
      
      proxyRes.pipe(res);
    });

    proxyReq.on('error', (err) => {
      console.error('❌ Erro proxy:', err.message);
      res.writeHead(500);
      res.end(`Erro: ${err.message}`);
    });

    req.pipe(proxyReq);
  } catch (err) {
    console.error('❌ URL inválida:', err.message);
    res.writeHead(400);
    res.end(`URL inválida: ${err.message}`);
  }
});

server.listen(PORT, () => {
  console.log(`✅ Proxy rodando em http://localhost:${PORT}`);
  console.log(`📖 Uso: http://localhost:${PORT}/http://seu-stream.m3u8`);
});
