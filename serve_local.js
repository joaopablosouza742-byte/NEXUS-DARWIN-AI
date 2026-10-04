const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png'
};

const server = http.createServer((req, res) => {
  let p = req.url.split('?')[0];

  // Roteamento de APIs
  if (p === '/api/safe-shutdown' || p.startsWith('/api/safe-shutdown')) {
    try {
      delete require.cache[require.resolve('./api/safe-shutdown.js')];
      const handler = require('./api/safe-shutdown.js');
      if (req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
          req.body = body;
          handler(req, res);
        });
        return;
      } else {
        return handler(req, res);
      }
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
      return;
    }
  }

  if (p === '/api/telegram-config' || p.startsWith('/api/telegram-config')) {
    try {
      delete require.cache[require.resolve('./api/telegram-config.js')];
      const handler = require('./api/telegram-config.js');
      if (req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
          req.body = body;
          handler(req, res);
        });
        return;
      } else {
        return handler(req, res);
      }
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
      return;
    }
  }

  if (p === '/') p = '/index.html';
  const file = path.join(__dirname, p);
  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Arquivo não encontrado');
      return;
    }
    const ext = path.extname(file);
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'text/plain',
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    res.end(data);
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[PAINEL LOCAL] Acesse no seu navegador: http://localhost:${PORT}`);
});
