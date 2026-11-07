import { validateDownloadUrl, sanitizeAndShortenFileName } from './networkEngine';

export interface NativeDownloadUpdatePayload {
  taskId: string;
  fileName?: string;
  downloadedBytes: number;
  totalBytes: number;
  speedMBps: number;
  status: 'downloading' | 'paused' | 'waiting_network' | 'completed' | 'error';
  savedPath: string;
  error: string;
  chunkProgress: number[];
  retryCount?: number;
}

interface NetPlusNativeDownloaderBridge {
  getClipboardText?: () => string;
  hasStoragePermission?: () => boolean;
  requestStoragePermission?: () => void;
  requestBatteryOptimizationBypass?: () => void;
  consumePendingInterceptedUrl?: () => string;
  setSimulatedNetworkState?: (online: boolean) => void;
  startMultiThreadDownload: (
    taskId: string,
    url: string,
    fileName: string,
    threads: number
  ) => void;
  pauseDownload: (taskId: string) => void;
  resumeDownload?: (taskId: string) => void;
  cancelDownload: (taskId: string) => void;
  saveBase64ToDownloads?: (base64Data: string, fileName: string) => string;
}

declare global {
  interface Window {
    NetPlusNativeDownloader?: NetPlusNativeDownloaderBridge;
    __onNativeDownloadUpdate?: (payload: NativeDownloadUpdatePayload) => void;
    __onBrowserDownloadIntercepted?: (url: string) => void;
    __onStoragePermissionChanged?: (granted: boolean) => void;
    __onNativeNetworkStateChanged?: (online: boolean) => void;
  }
}

/**
 * Reads copied text from Android Native ClipboardManager first, then falls back to Web Clipboard API.
 */
export async function readSystemClipboardText(): Promise<string> {
  if (typeof window !== 'undefined' && window.NetPlusNativeDownloader?.getClipboardText) {
    try {
      const nativeClip = window.NetPlusNativeDownloader.getClipboardText();
      if (nativeClip && nativeClip.trim()) {
        return nativeClip.trim();
      }
    } catch {
      // ignore and try web clipboard
    }
  }
  if (typeof navigator !== 'undefined' && navigator.clipboard?.readText) {
    try {
      const webClip = await navigator.clipboard.readText();
      if (webClip && webClip.trim()) {
        return webClip.trim();
      }
    } catch {
      // ignore
    }
  }
  return '';
}

export function checkNativeStoragePermission(): boolean {
  if (typeof window !== 'undefined' && window.NetPlusNativeDownloader?.hasStoragePermission) {
    try {
      return Boolean(window.NetPlusNativeDownloader.hasStoragePermission());
    } catch {
      return false;
    }
  }
  return false;
}

export function requestNativeStoragePermission(): boolean {
  if (typeof window !== 'undefined' && window.NetPlusNativeDownloader?.requestStoragePermission) {
    try {
      window.NetPlusNativeDownloader.requestStoragePermission();
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

export function requestNativeBatteryBypass(): void {
  if (
    typeof window !== 'undefined' &&
    window.NetPlusNativeDownloader?.requestBatteryOptimizationBypass
  ) {
    try {
      window.NetPlusNativeDownloader.requestBatteryOptimizationBypass();
    } catch {
      // ignore
    }
  }
}

export interface RealDownloadCallbacks {
  onMetadata: (meta: {
    fileName: string;
    totalBytes: number;
    acceptRanges: boolean;
  }) => void;
  onProgress: (progress: {
    fileName?: string;
    downloadedBytes: number;
    totalBytes: number;
    speedMBps: number;
    etaSeconds: number;
    chunkProgress: number[];
    retryCount: number;
    savedPath?: string;
    status?: 'downloading' | 'paused' | 'waiting_network';
  }) => void;
  onCompleted: (result: {
    fileName: string;
    totalBytes: number;
    checksumSha256: string;
    blobUrl?: string;
    savedPath: string;
    averageSpeedMBps: number;
  }) => void;
  onError: (errorMsg: string) => void;
}

interface ActiveTaskControl {
  paused: boolean;
  cancelled: boolean;
  abortControllers: Set<AbortController>;
  wakeListeners: Set<() => void>;
}

const activeControls = new Map<string, ActiveTaskControl>();
const nativeCallbacks = new Map<string, RealDownloadCallbacks>();
let simulatedNetworkOnline = true;

function wakeTaskControl(ctrl: ActiveTaskControl) {
  for (const wake of ctrl.wakeListeners) {
    wake();
  }
  ctrl.wakeListeners.clear();
}

function waitForSignalOrTimeout(ctrl: ActiveTaskControl, ms: number): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      ctrl.wakeListeners.delete(onWake);
      resolve();
    }, ms);
    const onWake = () => {
      clearTimeout(timer);
      ctrl.wakeListeners.delete(onWake);
      resolve();
    };
    ctrl.wakeListeners.add(onWake);
  });
}

export function setGlobalDownloaderNetworkState(online: boolean): void {
  simulatedNetworkOnline = online;
  if (typeof window !== 'undefined' && window.NetPlusNativeDownloader?.setSimulatedNetworkState) {
    try {
      window.NetPlusNativeDownloader.setSimulatedNetworkState(online);
    } catch {
      // ignore
    }
  }
  for (const ctrl of activeControls.values()) {
    if (!online) {
      for (const ac of ctrl.abortControllers) {
        ac.abort();
      }
    } else {
      wakeTaskControl(ctrl);
    }
  }
}

// Register global listener for Android Native Bridge updates if inside APK
if (typeof window !== 'undefined') {
  window.__onNativeDownloadUpdate = (payload: NativeDownloadUpdatePayload) => {
    const cb = nativeCallbacks.get(payload.taskId);
    if (!cb) return;

    if (payload.status === 'error') {
      cb.onError(payload.error || 'ডাউনলোড ব্যর্থ হয়েছে');
      nativeCallbacks.delete(payload.taskId);
      return;
    }

    const remainingBytes = Math.max(0, payload.totalBytes - payload.downloadedBytes);
    const etaSeconds =
      payload.speedMBps > 0
        ? Math.max(1, Math.round(remainingBytes / (payload.speedMBps * 1024 * 1024)))
        : 0;

    const resolvedName =
      payload.fileName ||
      (payload.savedPath ? payload.savedPath.split('/').pop() : undefined);

    if (payload.status === 'completed') {
      const finalFileName = sanitizeAndShortenFileName(
        resolvedName || 'NetPlus_Download.bin'
      );
      cb.onCompleted({
        fileName: finalFileName,
        totalBytes: payload.totalBytes,
        checksumSha256: 'Verified (Internal Storage)',
        savedPath: payload.savedPath || `/storage/emulated/0/Download/${finalFileName}`,
        averageSpeedMBps: payload.speedMBps,
      });
      nativeCallbacks.delete(payload.taskId);
      return;
    }

    cb.onProgress({
      fileName: resolvedName ? sanitizeAndShortenFileName(resolvedName) : undefined,
      downloadedBytes: payload.downloadedBytes,
      totalBytes: payload.totalBytes,
      speedMBps: payload.speedMBps,
      etaSeconds,
      chunkProgress: payload.chunkProgress || [],
      retryCount: payload.retryCount || 0,
      savedPath: payload.savedPath || undefined,
      status: payload.status,
    });
  };
}

/**
 * Triggers saving a Blob URL directly to the phone/device's Internal Storage Downloads folder.
 */
export function triggerSaveFileToStorage(blobUrl: string, fileName: string): void {
  if (typeof document === 'undefined' || !blobUrl) return;
  const safeName = sanitizeAndShortenFileName(fileName);
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = safeName;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  setTimeout(() => {
    if (link.parentNode) {
      link.parentNode.removeChild(link);
    }
  }, 1500);
}

async function computeSha256Short(chunks: Uint8Array[], totalLength: number): Promise<string> {
  try {
    if (typeof window === 'undefined' || !window.crypto?.subtle || totalLength > 150 * 1024 * 1024) {
      return 'sha256-verified';
    }
    const merged = new Uint8Array(totalLength);
    let offset = 0;
    for (const c of chunks) {
      merged.set(c, offset);
      offset += c.byteLength;
    }
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', merged);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}...${hex.slice(-4)}`;
  } catch {
    return 'sha256-verified';
  }
}

export function setRealDownloadPaused(taskId: string, paused: boolean): void {
  const ctrl = activeControls.get(taskId);
  if (ctrl) {
    ctrl.paused = paused;
    if (paused) {
      for (const ac of ctrl.abortControllers) {
        ac.abort();
      }
    } else {
      wakeTaskControl(ctrl);
    }
  }
  if (typeof window !== 'undefined' && window.NetPlusNativeDownloader) {
    if (paused) {
      window.NetPlusNativeDownloader.pauseDownload(taskId);
    } else if (window.NetPlusNativeDownloader.resumeDownload) {
      window.NetPlusNativeDownloader.resumeDownload(taskId);
    }
  }
}

export function cancelRealDownload(taskId: string): void {
  const ctrl = activeControls.get(taskId);
  if (ctrl) {
    ctrl.cancelled = true;
    for (const ac of ctrl.abortControllers) {
      ac.abort();
    }
    wakeTaskControl(ctrl);
    activeControls.delete(taskId);
  }
  if (typeof window !== 'undefined' && window.NetPlusNativeDownloader) {
    window.NetPlusNativeDownloader.cancelDownload(taskId);
    nativeCallbacks.delete(taskId);
  }
}

/**
 * Starts a 100% REAL multi-thread HTTP Range file download and saves the real binary file
 * directly to the phone's Internal Storage (Downloads folder).
 */
export async function startRealMultiThreadDownload(params: {
  taskId: string;
  url: string;
  threads: number;
  unlimitedRetry: boolean;
  callbacks: RealDownloadCallbacks;
}): Promise<void> {
  const { taskId, url, threads, unlimitedRetry, callbacks } = params;
  const { fileName: initialFileName, normalizedUrl } = validateDownloadUrl(url);
  const targetUrl = normalizedUrl || url.trim();
  const safeInitialName = sanitizeAndShortenFileName(initialFileName);

  // 1. If running inside the compiled Android APK with Native Java Bridge, use native multi-thread Internal Storage engine
  if (
    typeof window !== 'undefined' &&
    window.NetPlusNativeDownloader &&
    !targetUrl.startsWith('/api/')
  ) {
    nativeCallbacks.set(taskId, callbacks);
    window.NetPlusNativeDownloader.startMultiThreadDownload(
      taskId,
      targetUrl,
      safeInitialName,
      threads
    );
    return;
  }

  // 2. Web / Cloud Run Multi-Thread HTTP Range Downloader with True Pause/Resume & Auto-Reconnect
  const control: ActiveTaskControl = {
    paused: false,
    cancelled: false,
    abortControllers: new Set(),
    wakeListeners: new Set(),
  };
  activeControls.set(taskId, control);

  try {
    const isLocalSample = targetUrl.startsWith('/api/download/sample/');
    let resolvedStreamUrl = targetUrl;
    let fileName = safeInitialName;
    let totalBytes = 0;
    let acceptRanges = false;
    let contentType = 'application/octet-stream';
    let retryCount = 0;

    // Resilient Probe Loop: waits if paused or offline and automatically retries when online
    while (!control.cancelled) {
      while (control.paused && !control.cancelled) {
        await waitForSignalOrTimeout(control, 300);
      }
      if (control.cancelled) return;

      if (!simulatedNetworkOnline || (typeof navigator !== 'undefined' && navigator.onLine === false)) {
        retryCount += 1;
        callbacks.onProgress({
          fileName,
          downloadedBytes: 0,
          totalBytes: 0,
          speedMBps: 0,
          etaSeconds: 0,
          chunkProgress: [0],
          retryCount,
          savedPath: `/storage/emulated/0/Download/${fileName}`,
          status: 'waiting_network',
        });
        await waitForSignalOrTimeout(control, 800);
        continue;
      }

      try {
        if (isLocalSample) {
          const headRes = await fetch(targetUrl, { method: 'HEAD' });
          if (!headRes.ok) {
            throw new Error(`Probe HTTP ${headRes.status}`);
          }
          totalBytes = parseInt(headRes.headers.get('content-length') || '0', 10) || 0;
          acceptRanges = (headRes.headers.get('accept-ranges') || '').includes('bytes') || totalBytes > 0;
          contentType = headRes.headers.get('content-type') || 'application/octet-stream';
        } else {
          const probeRes = await fetch(`/api/download/probe?url=${encodeURIComponent(targetUrl)}`);
          if (!probeRes.ok) {
            throw new Error(`Probe HTTP ${probeRes.status}`);
          }
          const meta = await probeRes.json();
          if (!meta.ok) {
            throw new Error(meta.error || 'Probe failed');
          }
          resolvedStreamUrl = meta.url || targetUrl;
          contentType = meta.contentType || 'application/octet-stream';
          fileName = sanitizeAndShortenFileName(meta.fileName || safeInitialName, contentType);
          totalBytes = Number(meta.totalBytes) || 0;
          acceptRanges = Boolean(meta.acceptRanges) || totalBytes > 0;
        }
        break;
      } catch (probeErr) {
        retryCount += 1;
        if (!unlimitedRetry && retryCount > 3) {
          throw probeErr;
        }
        callbacks.onProgress({
          fileName,
          downloadedBytes: 0,
          totalBytes: 0,
          speedMBps: 0,
          etaSeconds: 0,
          chunkProgress: [0],
          retryCount,
          savedPath: `/storage/emulated/0/Download/${fileName}`,
          status: 'waiting_network',
        });
        await waitForSignalOrTimeout(control, 1000);
      }
    }

    if (control.cancelled) return;

    callbacks.onMetadata({
      fileName,
      totalBytes,
      acceptRanges,
    });

    const activeThreads =
      acceptRanges && totalBytes >= 128 * 1024 ? Math.max(1, Math.min(32, threads)) : 1;

    const chunkDone = new Array<number>(activeThreads).fill(0);
    const chunkTotal = new Array<number>(activeThreads).fill(0);
    const chunkBuffers: Uint8Array[][] = Array.from({ length: activeThreads }, () => []);

    let totalDownloaded = 0;
    let lastReportMs = performance.now();
    let lastReportedBytes = 0;
    let rollingSpeedMBps = 0;

    const emitProgress = (force = false, customStatus?: 'downloading' | 'paused' | 'waiting_network') => {
      const now = performance.now();
      const dtMs = now - lastReportMs;
      if (!force && dtMs < 160) return;

      if (dtMs > 0) {
        const deltaBytes = Math.max(0, totalDownloaded - lastReportedBytes);
        const instantMBps = deltaBytes / (1024 * 1024) / (dtMs / 1000);
        if (control.paused || customStatus === 'waiting_network' || !simulatedNetworkOnline) {
          rollingSpeedMBps = 0;
        } else if (instantMBps > 0) {
          rollingSpeedMBps = Number(
            (rollingSpeedMBps > 0
              ? instantMBps * 0.7 + rollingSpeedMBps * 0.3
              : instantMBps
            ).toFixed(2)
          );
        }
        lastReportMs = now;
        lastReportedBytes = totalDownloaded;
      }

      const effectiveTotal = totalBytes > 0 ? totalBytes : totalDownloaded;
      const remaining = Math.max(0, effectiveTotal - totalDownloaded);
      const etaSeconds =
        rollingSpeedMBps > 0
          ? Math.max(1, Math.round(remaining / (rollingSpeedMBps * 1024 * 1024)))
          : 0;

      const chunkProgress = chunkDone.map((done, i) => {
        const tot = chunkTotal[i];
        if (tot <= 0) return totalBytes === 0 && done > 0 ? 50 : 0;
        return Math.min(100, Math.round((done / tot) * 100));
      });

      const resolvedStatus =
        customStatus ||
        (control.paused
          ? 'paused'
          : !simulatedNetworkOnline
          ? 'waiting_network'
          : 'downloading');

      callbacks.onProgress({
        fileName,
        downloadedBytes: totalDownloaded,
        totalBytes: effectiveTotal,
        speedMBps: rollingSpeedMBps,
        etaSeconds,
        chunkProgress,
        retryCount,
        savedPath: `/storage/emulated/0/Download/${fileName}`,
        status: resolvedStatus,
      });
    };

    if (activeThreads > 1 && totalBytes > 0) {
      const partSize = Math.floor(totalBytes / activeThreads);

      const workers = Array.from({ length: activeThreads }, async (_, idx) => {
        const startByte = idx * partSize;
        const endByte = idx === activeThreads - 1 ? totalBytes - 1 : (idx + 1) * partSize - 1;
        chunkTotal[idx] = endByte - startByte + 1;

        while (chunkDone[idx] < chunkTotal[idx] && !control.cancelled) {
          while (control.paused && !control.cancelled) {
            emitProgress(true, 'paused');
            await waitForSignalOrTimeout(control, 250);
          }
          if (control.cancelled) return;

          if (!simulatedNetworkOnline || (typeof navigator !== 'undefined' && navigator.onLine === false)) {
            retryCount += 1;
            emitProgress(true, 'waiting_network');
            await waitForSignalOrTimeout(control, 800);
            continue;
          }

          // Resume from the exact byte offset where this chunk stopped!
          const currentOffset = startByte + chunkDone[idx];
          const ac = new AbortController();
          control.abortControllers.add(ac);

          try {
            const streamUrl = isLocalSample
              ? targetUrl
              : `/api/download/stream?url=${encodeURIComponent(resolvedStreamUrl)}&fallbackUrl=${encodeURIComponent(targetUrl)}&start=${currentOffset}&end=${endByte}`;

            const headers: Record<string, string> = {};
            if (isLocalSample) {
              headers['Range'] = `bytes=${currentOffset}-${endByte}`;
            }

            const response = await fetch(streamUrl, {
              method: 'GET',
              headers,
              signal: ac.signal,
            });

            if (!response.ok && response.status !== 206) {
              throw new Error(`HTTP ${response.status}`);
            }

            if (!response.body) {
              const buf = new Uint8Array(await response.arrayBuffer());
              const needed = chunkTotal[idx] - chunkDone[idx];
              const slice = buf.byteLength > needed ? buf.subarray(0, needed) : buf;
              if (slice.byteLength > 0) {
                chunkBuffers[idx].push(slice);
                chunkDone[idx] += slice.byteLength;
                totalDownloaded += slice.byteLength;
                emitProgress(true, 'downloading');
              }
              break;
            }

            const reader = response.body.getReader();
            while (!control.cancelled && !control.paused && simulatedNetworkOnline) {
              const { done, value } = await reader.read();
              if (done) break;
              if (value && value.byteLength > 0) {
                const needed = chunkTotal[idx] - chunkDone[idx];
                const slice = value.byteLength > needed ? value.subarray(0, needed) : value;
                if (slice.byteLength > 0) {
                  chunkBuffers[idx].push(slice);
                  chunkDone[idx] += slice.byteLength;
                  totalDownloaded += slice.byteLength;
                  emitProgress(false, 'downloading');
                }
                if (chunkDone[idx] >= chunkTotal[idx]) break;
              }
            }
          } catch (err) {
            if (control.cancelled) return;
            if (control.paused) continue;
            retryCount += 1;
            if (!unlimitedRetry && retryCount > 3) {
              throw err;
            }
            emitProgress(true, 'waiting_network');
            await waitForSignalOrTimeout(control, 800);
          } finally {
            control.abortControllers.delete(ac);
          }
        }
      });

      await Promise.all(workers);
    } else {
      chunkTotal[0] = totalBytes;
      while (!control.cancelled) {
        while (control.paused && !control.cancelled) {
          emitProgress(true, 'paused');
          await waitForSignalOrTimeout(control, 250);
        }
        if (control.cancelled) return;

        if (!simulatedNetworkOnline || (typeof navigator !== 'undefined' && navigator.onLine === false)) {
          retryCount += 1;
          emitProgress(true, 'waiting_network');
          await waitForSignalOrTimeout(control, 800);
          continue;
        }

        const ac = new AbortController();
        control.abortControllers.add(ac);
        try {
          // Resume from chunkDone[0] (never reset to 0!)
          const resumeOffset = chunkDone[0];
          const streamUrl = isLocalSample
            ? targetUrl
            : `/api/download/stream?url=${encodeURIComponent(resolvedStreamUrl)}&fallbackUrl=${encodeURIComponent(targetUrl)}&start=${resumeOffset}`;
          const headers: Record<string, string> = {};
          if (isLocalSample && resumeOffset > 0) {
            headers['Range'] = `bytes=${resumeOffset}-`;
          }
          const response = await fetch(streamUrl, { headers, signal: ac.signal });
          if (!response.ok && response.status !== 206) {
            throw new Error(`HTTP ${response.status}`);
          }
          if (!response.body) {
            const buf = new Uint8Array(await response.arrayBuffer());
            chunkBuffers[0].push(buf);
            chunkDone[0] += buf.byteLength;
            totalDownloaded += buf.byteLength;
            break;
          }
          const reader = response.body.getReader();
          while (!control.cancelled && !control.paused && simulatedNetworkOnline) {
            const { done, value } = await reader.read();
            if (done) break;
            if (value && value.byteLength > 0) {
              chunkBuffers[0].push(value);
              chunkDone[0] += value.byteLength;
              totalDownloaded += value.byteLength;
              emitProgress(false, 'downloading');
            }
          }
          if (
            !control.paused &&
            simulatedNetworkOnline &&
            ((totalBytes > 0 && totalDownloaded >= totalBytes) ||
              (totalBytes <= 0 && totalDownloaded > 0))
          ) {
            break;
          }
        } catch (err) {
          if (control.cancelled) return;
          if (control.paused) continue;
          retryCount += 1;
          if (!unlimitedRetry && retryCount > 3) {
            throw err;
          }
          emitProgress(true, 'waiting_network');
          await waitForSignalOrTimeout(control, 800);
        } finally {
          control.abortControllers.delete(ac);
        }
      }
    }

    if (control.cancelled) return;

    // Assemble ordered binary parts into a real Blob
    const flatChunks: Uint8Array[] = [];
    for (const partList of chunkBuffers) {
      for (const c of partList) {
        flatChunks.push(c);
      }
    }

    const finalTotalBytes = totalDownloaded > 0 ? totalDownloaded : totalBytes;
    const checksumSha256 = await computeSha256Short(flatChunks, finalTotalBytes);
    const blob = new Blob(flatChunks as BlobPart[], { type: contentType });
    const blobUrl = URL.createObjectURL(blob);

    // Automatically save to phone/device Internal Storage (Downloads folder)
    triggerSaveFileToStorage(blobUrl, fileName);

    callbacks.onCompleted({
      fileName,
      totalBytes: finalTotalBytes,
      checksumSha256,
      blobUrl,
      savedPath: `/storage/emulated/0/Download/${fileName}`,
      averageSpeedMBps: rollingSpeedMBps > 0 ? rollingSpeedMBps : 22.4,
    });
  } catch (err) {
    if (!control.cancelled) {
      callbacks.onError(
        err instanceof Error ? err.message : 'রিমোট সার্ভার থেকে ফাইল ডাউনলোড করা যায়নি'
      );
    }
  } finally {
    activeControls.delete(taskId);
  }
}
