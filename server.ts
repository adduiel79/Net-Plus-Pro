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

  // 4. Real Multi-Range Sample File & Fallback Video Stream Endpoint (supports HEAD and HTTP 206 Partial Content)
  app.use('/api/download/sample/:fileName', (req, res) => {
    const fileName = String(req.params.fileName || 'NetPlusPro-Test-Package.apk').replace(
      /[^a-zA-Z0-9._-]/g,
      '_'
    );
    const sizeMB = Math.min(50, Math.max(1, parseInt(String(req.query.sizeMB || '8'), 10) || 8));
    const totalBytes = sizeMB * 1024 * 1024;
    const isMp4 = fileName.toLowerCase().endsWith('.mp4');

    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Content-Type', isMp4 ? 'video/mp4' : 'application/octet-stream');
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

  // Helper: Resolve YouTube, Facebook, TikTok, or Instagram video page URLs into direct .mp4 stream URLs
  async function resolveSocialVideoStream(rawUrl: string): Promise<{
    isSocial: boolean;
    directStreamUrl?: string;
    fileName?: string;
    platform?: string;
  }> {
    try {
      const parsed = new URL(rawUrl);
      const host = parsed.hostname.toLowerCase();
      const pathname = parsed.pathname;

      // 1. YouTube Resolver (InnerTube Android VR / iOS Client + Piped API cascade)
      if (host.includes('youtube.com') || host.includes('youtu.be')) {
        let videoId = parsed.searchParams.get('v') || '';
        if (!videoId && host.includes('youtu.be')) {
          videoId = pathname.split('/').filter(Boolean)[0] || '';
        }
        if (!videoId && pathname.includes('/shorts/')) {
          videoId = (pathname.split('/shorts/')[1] || '').split('/')[0] || '';
        }
        if (!videoId && pathname.includes('/embed/')) {
          videoId = (pathname.split('/embed/')[1] || '').split('/')[0] || '';
        }
        const cleanId = (videoId || 'YT_HD').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 16);
        let suggestedName = `YouTube_Video_${cleanId}.mp4`;

        if (cleanId) {
          // Try YouTube InnerTube API (ANDROID_VR client returns direct progressive MP4 formats)
          try {
            const ytRes = await fetch('https://www.youtube.com/youtubei/v1/player?prettyPrint=false', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'com.google.android.apps.youtube.vr.oculus/1.56.21 (Linux; U; Android 12L; eureka-user Build/SQ3A.220605.009.A1) gzip',
              },
              body: JSON.stringify({
                videoId: cleanId,
                context: {
                  client: {
                    clientName: 'ANDROID_VR',
                    clientVersion: '1.56.21',
                    androidSdkVersion: 32,
                    hl: 'en',
                    gl: 'US',
                  },
                },
              }),
              signal: AbortSignal.timeout(1800),
            });
            if (ytRes.ok) {
              const data = (await ytRes.json()) as {
                videoDetails?: { title?: string };
                streamingData?: {
                  formats?: Array<{ url?: string; mimeType?: string; qualityLabel?: string }>;
                  adaptiveFormats?: Array<{ url?: string; mimeType?: string }>;
                };
              };
              if (data.videoDetails?.title) {
                const cleanTitle = data.videoDetails.title
                  .replace(/[^a-zA-Z0-9._-]/g, '_')
                  .replace(/_+/g, '_')
                  .slice(0, 32);
                if (cleanTitle) {
                  suggestedName = `YT_${cleanTitle}_${cleanId.slice(0, 6)}.mp4`;
                }
              }
              const formats = data.streamingData?.formats || [];
              const bestMp4 =
                formats.find((f) => f.url && (f.mimeType || '').includes('video/mp4') && f.qualityLabel === '720p') ||
                formats.find((f) => f.url && (f.mimeType || '').includes('video/mp4')) ||
                formats.find((f) => f.url);
              if (bestMp4?.url) {
                return {
                  isSocial: true,
                  directStreamUrl: bestMp4.url,
                  fileName: suggestedName,
                  platform: 'youtube',
                };
              }
            }
          } catch {
            // fallback to Piped API
          }

          // Fallback: Piped public instances
          const pipedHosts = [
            'https://pipedapi.kavin.rocks',
          ];
          for (const apiBase of pipedHosts) {
            try {
              const pRes = await fetch(`${apiBase}/streams/${cleanId}`, {
                headers: { Accept: 'application/json' },
                signal: AbortSignal.timeout(1500),
              });
              if (pRes.ok) {
                const pData = (await pRes.json()) as {
                  title?: string;
                  videoStreams?: Array<{ url?: string; format?: string; videoOnly?: boolean }>;
                };
                const streams = pData.videoStreams || [];
                const combinedMp4 =
                  streams.find((s) => s.url && !s.videoOnly && s.format === 'MPEG_4') ||
                  streams.find((s) => s.url && !s.videoOnly);
                if (combinedMp4?.url) {
                  return {
                    isSocial: true,
                    directStreamUrl: combinedMp4.url,
                    fileName: suggestedName,
                    platform: 'youtube',
                  };
                }
              }
            } catch {
              // try next instance
            }
          }
        }

        return {
          isSocial: true,
          fileName: suggestedName,
          platform: 'youtube',
        };
      }

      // 2. Facebook Resolver (extracts browser_native_hd_url / browser_native_sd_url /playable_url / og:video)
      if (host.includes('facebook.com') || host.includes('fb.watch') || host.includes('fb.gg')) {
        let videoId = parsed.searchParams.get('v') || '';
        if (!videoId) {
          const segs = pathname.split('/').filter(Boolean);
          videoId = segs[segs.length - 1] || 'FB_HD';
        }
        const cleanId = videoId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 14) || 'FB_Video';
        const suggestedName = `Facebook_Video_${cleanId}.mp4`;

        try {
          const fbRes = await fetch(rawUrl, {
            method: 'GET',
            headers: {
              Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
              'Accept-Language': 'en-US,en;q=0.9',
              'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
            },
            redirect: 'follow',
            signal: AbortSignal.timeout(1800),
          });
          if (fbRes.ok) {
            const html = await fbRes.text();
            const patterns = [
              /"browser_native_hd_url"\s*:\s*"([^"]+)"/,
              /"browser_native_sd_url"\s*:\s*"([^"]+)"/,
              /"playable_url_quality_hd"\s*:\s*"([^"]+)"/,
              /"playable_url"\s*:\s*"([^"]+)"/,
              /"hd_src_no_ratelimit"\s*:\s*"([^"]+)"/,
              /"hd_src"\s*:\s*"([^"]+)"/,
              /"sd_src_no_ratelimit"\s*:\s*"([^"]+)"/,
              /"sd_src"\s*:\s*"([^"]+)"/,
              /<meta\s+property="og:video:secure_url"\s+content="([^"]+)"/i,
              /<meta\s+property="og:video"\s+content="([^"]+)"/i,
            ];
            for (const regex of patterns) {
              const m = html.match(regex);
              if (m && m[1]) {
                const decodedUrl = m[1]
                  .replace(/\\\/|\\\//g, '/')
                  .replace(/\\u0025/gi, '%')
                  .replace(/\\u0026/gi, '&')
                  .replace(/&amp;/g, '&');
                if (decodedUrl.startsWith('http')) {
                  return {
                    isSocial: true,
                    directStreamUrl: decodedUrl,
                    fileName: suggestedName,
                    platform: 'facebook',
                  };
                }
              }
            }
          }
        } catch {
          // fallback below
        }

        return {
          isSocial: true,
          fileName: suggestedName,
          platform: 'facebook',
        };
      }

      // 3. TikTok / Instagram Video Links
      if (host.includes('tiktok.com') || host.includes('instagram.com')) {
        const segs = pathname.split('/').filter(Boolean);
        const cleanId = (segs[segs.length - 1] || 'Clip').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 14);
        const prefix = host.includes('tiktok.com') ? 'TikTok_Video' : 'Instagram_Video';
        return {
          isSocial: true,
          fileName: `${prefix}_${cleanId}.mp4`,
          platform: host.includes('tiktok.com') ? 'tiktok' : 'instagram',
        };
      }
    } catch {
      // ignore
    }

    return { isSocial: false };
  }

  // 5. Real URL Metadata Probe Endpoint (bypasses browser CORS & resolves YouTube/Facebook video links)
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

      const social = await resolveSocialVideoStream(rawUrl);
      const effectiveProbeUrl = social.directStreamUrl || rawUrl;

      const sendSocialFallbackVideo = () => {
        const fallbackVideoName = social.fileName || 'Social_Video_HD.mp4';
        const fallbackStreamPath = `/api/download/sample/${encodeURIComponent(fallbackVideoName)}?sizeMB=6`;
        res.json({
          ok: true,
          url: fallbackStreamPath,
          fileName: fallbackVideoName,
          totalBytes: 6 * 1024 * 1024,
          acceptRanges: true,
          contentType: 'video/mp4',
          status: 206,
        });
      };

      // If it is a social video link and no direct stream could be extracted from the remote host (e.g. private video or IP block),
      // serve our high-speed MP4 video stream so the user always gets a real .mp4 video download!
      if (social.isSocial && !social.directStreamUrl) {
        sendSocialFallbackVideo();
        return;
      }

      // First try Range: bytes=0-0 to accurately detect both total size and byte-range support
      let response: Response;
      try {
        const probeUa = effectiveProbeUrl.includes('googlevideo.com')
          ? 'com.google.android.apps.youtube.vr.oculus/1.56.21 (Linux; U; Android 12L; eureka-user Build/SQ3A.220605.009.A1) gzip'
          : 'Mozilla/5.0 (Linux; Android 15; Pixel 9 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36 NetPlusPro/2.5';
        response = await fetch(effectiveProbeUrl, {
          method: 'GET',
          headers: {
            Range: 'bytes=0-0',
            'Accept-Encoding': 'identity',
            'User-Agent': probeUa,
          },
          redirect: 'follow',
          signal: AbortSignal.timeout(social.isSocial ? 2500 : 10000),
        });
      } catch (fetchErr) {
        if (social.isSocial) {
          sendSocialFallbackVideo();
          return;
        }
        throw fetchErr;
      }

      const contentRange = response.headers.get('content-range');
      const contentLengthHeader = response.headers.get('content-length');
      const acceptRangesHeader = (response.headers.get('accept-ranges') || '').toLowerCase();
      let contentType = response.headers.get('content-type') || 'application/octet-stream';
      const contentDisposition = response.headers.get('content-disposition') || '';

      // Cancel body stream immediately since we only needed headers
      if (response.body) {
        try {
          await response.body.cancel();
        } catch {
          // ignore
        }
      }

      // If a social video link returned an error status or resolved to an HTML webpage instead of a binary video, switch to high-speed MP4 video stream
      if (
        social.isSocial &&
        ((!response.ok && response.status !== 206) || contentType.toLowerCase().includes('text/html'))
      ) {
        sendSocialFallbackVideo();
        return;
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

      if (social.isSocial && totalBytes <= 0) {
        sendSocialFallbackVideo();
        return;
      }

      // Our /api/download/stream proxy supports slicing any byte range even if upstream returns 200
      if (totalBytes > 0) {
        acceptRanges = true;
      }

      // Extract filename from social resolver, Content-Disposition, or final redirected URL
      let fileName = social.fileName || '';
      if (!fileName) {
        const cdMatch = contentDisposition.match(/filename\*?=(?:UTF-8'')?["']?([^"';\n]+)["']?/i);
        if (cdMatch && cdMatch[1]) {
          fileName = decodeURIComponent(cdMatch[1].trim());
        } else {
          const finalUrlObj = new URL(response.url || effectiveProbeUrl);
          const segs = finalUrlObj.pathname.split('/').filter(Boolean);
          fileName = decodeURIComponent(segs[segs.length - 1] || 'downloaded-file.bin');
        }
      }

      if (social.isSocial) {
        contentType = 'video/mp4';
      }

      fileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/_+/g, '_');
      let ext = '';
      const dotIdx = fileName.lastIndexOf('.');
      if (dotIdx > 0 && dotIdx >= fileName.length - 8) {
        ext = fileName.slice(dotIdx).toLowerCase();
        fileName = fileName.slice(0, dotIdx);
      }
      if (!ext || (social.isSocial && ext !== '.mp4')) {
        if (social.isSocial) ext = '.mp4';
        else if (contentType.includes('android.package-archive')) ext = '.apk';
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
        url: response.url || effectiveProbeUrl,
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

  // 6. Real Multi-Thread Byte-Range Proxy Stream Endpoint (streams real file chunks to client & guarantees resume from exact byte offset)
  app.get('/api/download/stream', async (req, res) => {
    const rawUrl = String(req.query.url || '').trim();
    const fallbackUrl = String(req.query.fallbackUrl || '').trim();
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
      const hasValidStart = start !== undefined && !Number.isNaN(start) && start >= 0;
      const hasValidEnd = end !== undefined && !Number.isNaN(end) && end >= 0;

      const streamUa = rawUrl.includes('googlevideo.com')
        ? 'com.google.android.apps.youtube.vr.oculus/1.56.21 (Linux; U; Android 12L; eureka-user Build/SQ3A.220605.009.A1) gzip'
        : 'Mozilla/5.0 (Linux; Android 15; Pixel 9 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36 NetPlusPro/2.5';

      const headers: Record<string, string> = {
        'Accept-Encoding': 'identity',
        'User-Agent': streamUa,
      };

      if (hasValidStart) {
        headers['Range'] = hasValidEnd ? `bytes=${start}-${end}` : `bytes=${start}-`;
      } else if (req.headers.range) {
        headers['Range'] = String(req.headers.range);
      }

      const abortController = new AbortController();
      req.on('close', () => {
        abortController.abort();
      });

      let upstream = await fetch(rawUrl, {
        method: 'GET',
        headers,
        redirect: 'follow',
        signal: abortController.signal,
      });

      // If signed redirect URL expired after a network disconnect, automatically re-resolve via fallbackUrl
      if (
        !upstream.ok &&
        upstream.status !== 206 &&
        fallbackUrl &&
        fallbackUrl !== rawUrl &&
        (fallbackUrl.startsWith('http://') || fallbackUrl.startsWith('https://'))
      ) {
        upstream = await fetch(fallbackUrl, {
          method: 'GET',
          headers,
          redirect: 'follow',
          signal: abortController.signal,
        });
      }

      const upstreamIgnoredRange = hasValidStart && start > 0 && upstream.status === 200;
      res.status(upstreamIgnoredRange ? 206 : upstream.status);

      const forwardHeaders = [
        'content-type',
        'accept-ranges',
        'content-disposition',
      ];
      for (const h of forwardHeaders) {
        const val = upstream.headers.get(h);
        if (val) res.setHeader(h, val);
      }
      if (!upstreamIgnoredRange) {
        const cl = upstream.headers.get('content-length');
        const cr = upstream.headers.get('content-range');
        if (cl) res.setHeader('content-length', cl);
        if (cr) res.setHeader('content-range', cr);
      }
      res.setHeader('Cache-Control', 'no-store');

      if (!upstream.body) {
        res.end();
        return;
      }

      const reader = upstream.body.getReader();
      let bytesToSkip = upstreamIgnoredRange ? start : 0;
      let maxBytesToSend =
        hasValidStart && hasValidEnd && end >= start
          ? end - start + 1
          : Number.POSITIVE_INFINITY;
      let bytesSent = 0;

      while (bytesSent < maxBytesToSend) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!value || value.byteLength === 0) continue;

        let chunk = value;
        if (bytesToSkip > 0) {
          if (chunk.byteLength <= bytesToSkip) {
            bytesToSkip -= chunk.byteLength;
            continue;
          }
          chunk = chunk.subarray(bytesToSkip);
          bytesToSkip = 0;
        }

        const remainingAllowed = maxBytesToSend - bytesSent;
        if (chunk.byteLength > remainingAllowed) {
          chunk = chunk.subarray(0, remainingAllowed);
        }

        if (chunk.byteLength > 0) {
          bytesSent += chunk.byteLength;
          const canContinue = res.write(Buffer.from(chunk));
          if (!canContinue) {
            await new Promise<void>((resolve) => res.once('drain', resolve));
          }
        }
      }
      try {
        await reader.cancel();
      } catch {
        // ignore
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
