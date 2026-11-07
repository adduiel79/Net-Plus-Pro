import express, { RequestHandler } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import crypto from 'crypto';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Enable raw binary upload parsing for real upload speed measurement
  app.use('/api/speedtest/upload', express.raw({ type: '*/*', limit: '50mb' }));
  app.use(express.json());

  // 1. Real Ping / RTT Endpoint
  app.get('/api/speedtest/ping', (_req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.json({
      ok: true,
      serverTime: Date.now(),
    });
  });

  // 2. Real Binary Stream Download Endpoint
  const chunkPool = crypto.randomBytes(64 * 1024); // 64 KB high-entropy buffer
  app.get('/api/speedtest/download', (req, res) => {
    const requestedBytes = Math.min(
      10 * 1024 * 1024,
      Math.max(256 * 1024, parseInt(String(req.query.bytes || '2097152'), 10) || 2097152)
    );

    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Length', String(requestedBytes));
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

    let sent = 0;
    const sendNext = () => {
      while (sent < requestedBytes) {
        const remaining = requestedBytes - sent;
        const slice = remaining >= chunkPool.length ? chunkPool : chunkPool.subarray(0, remaining);
        sent += slice.length;
        const canContinue = res.write(slice);
        if (!canContinue) {
          res.once('drain', sendNext);
          return;
        }
      }
      res.end();
    };

    sendNext();
  });

  // 3. Real Binary Payload Upload Endpoint
  app.post('/api/speedtest/upload', (req, res) => {
    const bodyLength = Buffer.isBuffer(req.body)
      ? req.body.length
      : parseInt(String(req.headers['content-length'] || '0'), 10) || 0;

    res.setHeader('Cache-Control', 'no-store');
    res.json({
      ok: true,
      receivedBytes: bodyLength,
      timestamp: Date.now(),
    });
  });

  // Delegate non-API traffic to Vite middleware once initialized
  let viteMiddleware: RequestHandler | null = null;
  app.use((req, res, next) => {
    if (viteMiddleware) {
      return viteMiddleware(req, res, next);
    }
    next();
  });

  // Bind port 3000 immediately so dev server readiness checks never time out on cold start
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Net Plus Pro Server listening on http://0.0.0.0:${PORT}`);
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    viteMiddleware = vite.middlewares as unknown as RequestHandler;
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }
}

startServer();
