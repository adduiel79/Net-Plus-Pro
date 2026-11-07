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

  // 2. Real Binary Stream Download Endpoint for Speed Test
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

  // 3. Real Binary Payload Upload Endpoint for Speed Test
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

  // 4. Real Multi-Range Sample File Endpoint (supports HEAD and HTTP 206 Partial Content)
  app.use('/api/download/sample/:fileName', (req, res) => {
    const fileName = String(req.params.fileName || 'NetPlusPro-Test-Package.apk').replace(
      /[^a-zA-Z0-9._-]/g,
      '_'
    );
    const sizeMB = Math.min(50, Math.max(1, parseInt(String(req.query.sizeMB || '8'), 10) || 8));
    const totalBytes = sizeMB * 1024 * 1024;

    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Cache-Control', 'no-store');

    if (req.method === 'HEAD') {
      res.setHeader('Content-Length', String(totalBytes));
      res.status(200).end();
      return;
    }

    const rangeHeader = req.headers.range;
    let start = 0;
    let end = totalBytes - 1;
    let statusCode = 200;

    if (rangeHeader && rangeHeader.startsWith('bytes=')) {
      const parts = rangeHeader.replace('bytes=', '').split('-');
      const parsedStart = parseInt(parts[0], 10);
      const parsedEnd = parts[1] ? parseInt(parts[1], 10) : totalBytes - 1;
      if (!Number.isNaN(parsedStart) && parsedStart >= 0 && parsedStart < totalBytes) {
        start = parsedStart;
        end = Math.min(totalBytes - 1, !Number.isNaN(parsedEnd) ? parsedEnd : totalBytes - 1);
        statusCode = 206;
        res.setHeader('Content-Range', `bytes ${start}-${end}/${totalBytes}`);
      }
    }

    const contentLength = end - start + 1;
    res.setHeader('Content-Length', String(contentLength));
    res.status(statusCode);

    let sent = 0;
    const sendRange = () => {
      while (sent < contentLength) {
        const remaining = contentLength - sent;
        const slice = remaining >= chunkPool.length ? chunkPool : chunkPool.subarray(0, remaining);
        sent += slice.length;
        const ok = res.write(slice);
        if (!ok) {
          res.once('drain', sendRange);
          return;
        }
      }
      res.end();
    };

    sendRange();
  });

  // 5. Real URL Metadata Probe Endpoint (bypasses browser CORS for any HTTP/HTTPS file link)
  app.get('/api/download/probe', async (req, res) => {
    const rawUrl = String(req.query.url || '').trim();
    if (!rawUrl) {
      res.status(400).json({ ok: false, error: 'URL missing' });
      return;
    }

    try {
      const parsed = new URL(rawUrl);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        res.status(400).json({ ok: false, error: 'Only HTTP/HTTPS URLs are supported' });
        return;
      }

      // First try Range: bytes=0-0 to accurately detect both total size and byte-range support
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000);

      const response = await fetch(rawUrl, {
        method: 'GET',
        headers: {
          Range: 'bytes=0-0',
          'User-Agent':
            'Mozilla/5.0 (Linux; Android 15; Pixel 9 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36 NetPlusPro/2.5',
        },
        redirect: 'follow',
        signal: controller.signal,
      });
      clearTimeout(timeout);

      const contentRange = response.headers.get('content-range');
      const contentLengthHeader = response.headers.get('content-length');
      const acceptRangesHeader = (response.headers.get('accept-ranges') || '').toLowerCase();
      const contentType = response.headers.get('content-type') || 'application/octet-stream';
      const contentDisposition = response.headers.get('content-disposition') || '';

      // Cancel body stream immediately since we only needed headers
      if (response.body) {
        try {
          await response.body.cancel();
        } catch {
          // ignore
        }
      }

      let totalBytes = 0;
      let acceptRanges = acceptRangesHeader.includes('bytes') || response.status === 206;

      if (contentRange) {
        // e.g. "bytes 0-0/45829120"
        const match = contentRange.match(/\/(\d+)/);
        if (match && match[1]) {
          totalBytes = parseInt(match[1], 10) || 0;
          acceptRanges = true;
        }
      } else if (contentLengthHeader) {
        totalBytes = parseInt(contentLengthHeader, 10) || 0;
      }

      // Extract filename from Content-Disposition or final redirected URL
      let fileName = '';
      const cdMatch = contentDisposition.match(/filename\*?=(?:UTF-8'')?["']?([^"';\n]+)["']?/i);
      if (cdMatch && cdMatch[1]) {
        fileName = decodeURIComponent(cdMatch[1].trim());
      } else {
        const finalUrlObj = new URL(response.url || rawUrl);
        const segs = finalUrlObj.pathname.split('/').filter(Boolean);
        fileName = decodeURIComponent(segs[segs.length - 1] || 'downloaded-file.bin');
      }

      fileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/_+/g, '_');
      let ext = '';
      const dotIdx = fileName.lastIndexOf('.');
      if (dotIdx > 0 && dotIdx >= fileName.length - 8) {
        ext = fileName.slice(dotIdx).toLowerCase();
        fileName = fileName.slice(0, dotIdx);
      }
      if (!ext) {
        if (contentType.includes('android.package-archive')) ext = '.apk';
        else if (contentType.includes('zip')) ext = '.zip';
        else if (contentType.includes('pdf')) ext = '.pdf';
        else if (contentType.includes('mp4') || contentType.includes('video')) ext = '.mp4';
        else if (contentType.includes('mpeg') || contentType.includes('audio')) ext = '.mp3';
        else if (contentType.includes('jpeg') || contentType.includes('jpg')) ext = '.jpg';
        else if (contentType.includes('png')) ext = '.png';
        else ext = '.bin';
      }
      if (fileName.length > 40) {
        fileName = `NetPlus_${fileName.slice(0, 18)}_${fileName.slice(-8)}`;
      }
      fileName = `${fileName.slice(0, 40)}${ext}`;

      res.json({
        ok: true,
        url: response.url || rawUrl,
        fileName,
        totalBytes,
        acceptRanges,
        contentType,
        status: response.status,
      });
    } catch (err) {
      res.status(502).json({
        ok: false,
        error: err instanceof Error ? err.message : 'Failed to probe remote URL',
      });
    }
  });

  // 6. Real Multi-Thread Byte-Range Proxy Stream Endpoint (streams real file chunks to client)
  app.get('/api/download/stream', async (req, res) => {
    const rawUrl = String(req.query.url || '').trim();
    if (!rawUrl) {
      res.status(400).send('Missing url parameter');
      return;
    }

    try {
      const parsed = new URL(rawUrl);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        res.status(400).send('Invalid protocol');
        return;
      }

      const start = req.query.start !== undefined ? parseInt(String(req.query.start), 10) : undefined;
      const end = req.query.end !== undefined ? parseInt(String(req.query.end), 10) : undefined;

      const headers: Record<string, string> = {
        'User-Agent':
          'Mozilla/5.0 (Linux; Android 15; Pixel 9 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36 NetPlusPro/2.5',
      };

      if (start !== undefined && !Number.isNaN(start)) {
        headers['Range'] =
          end !== undefined && !Number.isNaN(end) ? `bytes=${start}-${end}` : `bytes=${start}-`;
      } else if (req.headers.range) {
        headers['Range'] = String(req.headers.range);
      }

      const abortController = new AbortController();
      req.on('close', () => {
        abortController.abort();
      });

      const upstream = await fetch(rawUrl, {
        method: 'GET',
        headers,
        redirect: 'follow',
        signal: abortController.signal,
      });

      res.status(upstream.status);
      const forwardHeaders = [
        'content-type',
        'content-length',
        'content-range',
        'accept-ranges',
        'content-disposition',
      ];
      for (const h of forwardHeaders) {
        const val = upstream.headers.get(h);
        if (val) res.setHeader(h, val);
      }
      res.setHeader('Cache-Control', 'no-store');

      if (!upstream.body) {
        res.end();
        return;
      }

      const reader = upstream.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          const canContinue = res.write(Buffer.from(value));
          if (!canContinue) {
            await new Promise<void>((resolve) => res.once('drain', resolve));
          }
        }
      }
      res.end();
    } catch (err) {
      if (!res.headersSent) {
        res.status(502).send(err instanceof Error ? err.message : 'Upstream download failed');
      } else {
        res.end();
      }
    }
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
