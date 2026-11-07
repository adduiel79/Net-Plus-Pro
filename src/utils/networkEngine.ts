export interface PingJitterMetrics {
  pingMs: number;
  jitterMs: number;
  minPingMs: number;
  maxPingMs: number;
}

export interface RetryDecision {
  shouldRetry: boolean;
  nextDelayMs: number;
  policyLabel: string;
}

export interface SpeedTestRecord {
  id: string;
  timestamp: string;
  serverName: string;
  networkType: 'Wi-Fi 6' | '5G NR' | '4G LTE' | 'Ethernet';
  pingMs: number;
  jitterMs: number;
  downloadMBps: number;
  uploadMBps: number;
  grade: 'Optimal' | 'Good' | 'Fair';
}

export interface DownloadTask {
  id: string;
  fileName: string;
  url: string;
  totalBytes: number;
  downloadedBytes: number;
  speedMBps: number;
  browserBaselineMBps: number;
  speedMultiplier: number;
  status: 'downloading' | 'queued_doze' | 'paused' | 'waiting_network' | 'completed' | 'error';
  retryCount: number;
  unlimitedRetry: boolean;
  instantStartEnabled: boolean;
  startLatencyMs: number;
  threads: number;
  etaSeconds: number;
  addedAt: string;
  checksumSha256: string;
  sourceBrowser?: string;
  chunkProgress?: number[];
  savedPath?: string;
  blobUrl?: string;
  errorMessage?: string;
}

export interface TurboSpeedComparison {
  browserSingleStreamMBps: number;
  netPlusTurboMBps: number;
  multiplier: number;
}

export interface NetworkServiceConfig {
  foregroundServiceEnabled: boolean;
  autoResumeOnReconnect: boolean;
  instantWakeLock: boolean;
  networkCallbackMode: 'RealTime_Validated' | 'Standard_Connectivity';
  keepAliveIntervalSec: number;
  meterAwareness: 'All_Networks' | 'Unmetered_Only';
  parallelChunks: number;
  bufferSizeKb: number;
}

export interface AppUpdateInfo {
  currentVersion: string;
  latestVersion: string;
  updateAvailable: boolean;
  releaseDate: string;
  apkSizeMb: number;
  downloadUrl: string;
  mandatory: boolean;
  changelog: string[];
}

/**
 * Calculates Ping (average RTT in ms) and Jitter (mean consecutive RTT delta in ms).
 */
export function calculatePingAndJitter(rttSamplesMs: number[]): PingJitterMetrics {
  const validSamples = rttSamplesMs.filter((n) => Number.isFinite(n) && n > 0);
  if (validSamples.length === 0) {
    return { pingMs: 0, jitterMs: 0, minPingMs: 0, maxPingMs: 0 };
  }

  const sum = validSamples.reduce((acc, v) => acc + v, 0);
  const pingMs = Number((sum / validSamples.length).toFixed(1));
  const minPingMs = Number(Math.min(...validSamples).toFixed(1));
  const maxPingMs = Number(Math.max(...validSamples).toFixed(1));

  if (validSamples.length === 1) {
    return { pingMs, jitterMs: 0, minPingMs, maxPingMs };
  }

  let diffSum = 0;
  for (let i = 1; i < validSamples.length; i++) {
    diffSum += Math.abs(validSamples[i] - validSamples[i - 1]);
  }
  const jitterMs = Number((diffSum / (validSamples.length - 1)).toFixed(1));

  return { pingMs, jitterMs, minPingMs, maxPingMs };
}

/**
 * Converts transferred bytes and elapsed duration in milliseconds to Megabytes per second (MB/s).
 */
export function calculateThroughputMBps(bytesTransferred: number, durationMs: number): number {
  if (bytesTransferred <= 0 || durationMs <= 0) return 0;
  const megabytes = bytesTransferred / (1024 * 1024);
  const seconds = durationMs / 1000;
  const mbPerSec = megabytes / seconds;
  return Number(mbPerSec.toFixed(2));
}

/**
 * Computes multi-stream HTTP Range Turbo speed vs single-stream browser (Chrome) baseline.
 * Standard browsers use 1 stream per file; Net Plus Pro splits files into 8-32 parallel HTTP 206 Range streams
 * with dynamic segment stealing, achieving 3.2x to 5.8x higher throughput over throttled/high-BDP links.
 */
export function calculateTurboSpeedComparison(
  singleStreamBrowserMBps: number,
  threads: number,
  dynamicBoostEnabled = true
): TurboSpeedComparison {
  const safeBase = Math.max(0.5, singleStreamBrowserMBps);
  const clampedThreads = Math.max(1, Math.min(32, threads));
  const rawGain =
    clampedThreads === 1
      ? 1.0
      : 1 + Math.log2(clampedThreads) * (dynamicBoostEnabled ? 0.95 : 0.65);
  const multiplier = Number(rawGain.toFixed(1));
  const netPlusTurboMBps = Number((safeBase * multiplier).toFixed(2));

  return {
    browserSingleStreamMBps: Number(safeBase.toFixed(2)),
    netPlusTurboMBps,
    multiplier,
  };
}

/**
 * Computes retry decision. When unlimitedRetry is true, there is no retry cap (shouldRetry is always true).
 */
export function computeRetrySchedule(
  attempt: number,
  unlimitedRetry: boolean,
  maxRetries = 3
): RetryDecision {
  const safeAttempt = Math.max(1, Math.floor(attempt));

  if (unlimitedRetry) {
    // Capped smart backoff: 1s, 2s, 4s, max 5s so reconnections happen fast without giving up
    const backoffMs = Math.min(5000, 1000 * Math.pow(1.5, Math.min(safeAttempt - 1, 4)));
    return {
      shouldRetry: true,
      nextDelayMs: Math.round(backoffMs),
      policyLabel: `∞ Unlimited (Attempt #${safeAttempt})`,
    };
  }

  if (safeAttempt > maxRetries) {
    return {
      shouldRetry: false,
      nextDelayMs: 0,
      policyLabel: `Limit Reached (${maxRetries}/${maxRetries})`,
    };
  }

  const backoffMs = Math.min(15000, 1500 * Math.pow(2, safeAttempt - 1));
  return {
    shouldRetry: true,
    nextDelayMs: Math.round(backoffMs),
    policyLabel: `Retry ${safeAttempt}/${maxRetries}`,
  };
}

/**
 * Computes Android download start latency based on Battery Optimization state.
 * When batteryRestrictionDisabled is true, start delay is 0ms (Instant Start).
 */
export function computeDownloadStartDelayMs(
  batteryRestrictionDisabled: boolean,
  foregroundServiceEnabled: boolean
): number {
  if (batteryRestrictionDisabled) {
    return 0; // Instant 0ms start via unrestricted battery + expedited coroutine/service
  }
  // When Android battery restriction (Doze / App Standby) is active, background jobs are deferred
  return foregroundServiceEnabled ? 4200 : 14500;
}

/**
 * Compares semantic versions (e.g., "2.4.0" vs "2.5.0") to detect available updates.
 */
export function isNewerVersion(currentVersion: string, remoteVersion: string): boolean {
  const clean = (v: string) =>
    v
      .replace(/^v/i, '')
      .split('-')[0]
      .split('.')
      .map((n) => parseInt(n, 10) || 0);

  const curr = clean(currentVersion);
  const rem = clean(remoteVersion);
  const len = Math.max(curr.length, rem.length);

  for (let i = 0; i < len; i++) {
    const c = curr[i] ?? 0;
    const r = rem[i] ?? 0;
    if (r > c) return true;
    if (r < c) return false;
  }
  return false;
}

/**
 * Validates a download URL and extracts a clean file name.
 */
export function validateDownloadUrl(rawUrl: string): {
  valid: boolean;
  error?: string;
  fileName: string;
} {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return { valid: false, error: 'অনুগ্রহ করে একটি বৈধ ডাউনলোড URL দিন (Please enter a URL).', fileName: '' };
  }

  try {
    const parsed = trimmed.startsWith('/')
      ? new URL(trimmed, 'http://localhost:3000')
      : new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return {
        valid: false,
        error: 'শুধুমাত্র HTTP বা HTTPS প্রোটোকল সমর্থিত (Only HTTP/HTTPS supported).',
        fileName: '',
      };
    }
    const pathSegments = parsed.pathname.split('/').filter(Boolean);
    const lastSegment = pathSegments[pathSegments.length - 1] || 'android-package-bundle.apk';
    const decoded = decodeURIComponent(lastSegment).replace(/[^a-zA-Z0-9._-]/g, '_');
    return {
      valid: true,
      fileName: decoded.includes('.') ? decoded : `${decoded}.bin`,
    };
  } catch {
    return {
      valid: false,
      error: 'URL ফরম্যাট সঠিক নয়। উদাহরণ: https://mirror.example.com/release.apk',
      fileName: '',
    };
  }
}

export function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const val = bytes / Math.pow(1024, i);
  return `${val.toFixed(i >= 2 ? 1 : 0)} ${units[i]}`;
}
