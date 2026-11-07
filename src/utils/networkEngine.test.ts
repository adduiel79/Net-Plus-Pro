import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculatePingAndJitter,
  calculateThroughputMBps,
  calculateTurboSpeedComparison,
  computeRetrySchedule,
  computeDownloadStartDelayMs,
  isNewerVersion,
  validateDownloadUrl,
} from './networkEngine';

test('calculatePingAndJitter computes accurate Ping and Jitter from RTT samples', () => {
  const metrics = calculatePingAndJitter([18, 22, 19, 25, 21]);
  assert.equal(metrics.pingMs, 21);
  assert.equal(metrics.jitterMs, 4.3);
  assert.equal(metrics.minPingMs, 18);
  assert.equal(metrics.maxPingMs, 25);
});

test('calculateThroughputMBps converts bytes and duration to MB/s accurately', () => {
  const mbps = calculateThroughputMBps(20 * 1024 * 1024, 2000);
  assert.equal(mbps, 10);
});

test('calculateTurboSpeedComparison boosts multi-thread speed significantly over 1-thread Chrome baseline', () => {
  const comparison16 = calculateTurboSpeedComparison(5.0, 16, true);
  assert.ok(comparison16.netPlusTurboMBps > comparison16.browserSingleStreamMBps * 4);
  assert.equal(comparison16.browserSingleStreamMBps, 5.0);
  assert.equal(comparison16.multiplier, 4.8);
});

test('computeRetrySchedule never stops retrying when unlimitedRetry is enabled', () => {
  const retry1 = computeRetrySchedule(1, true);
  const retry50 = computeRetrySchedule(50, true);
  const retry999 = computeRetrySchedule(999, true);

  assert.equal(retry1.shouldRetry, true);
  assert.equal(retry50.shouldRetry, true);
  assert.equal(retry999.shouldRetry, true);
  assert.ok(retry999.nextDelayMs <= 5000);

  const boundedFail = computeRetrySchedule(4, false, 3);
  assert.equal(boundedFail.shouldRetry, false);
});

test('computeDownloadStartDelayMs returns 0ms instant start when battery restriction is disabled', () => {
  assert.equal(computeDownloadStartDelayMs(true, true), 0);
  assert.equal(computeDownloadStartDelayMs(true, false), 0);
  assert.ok(computeDownloadStartDelayMs(false, true) > 0);
});

test('isNewerVersion detects semantic version upgrades accurately', () => {
  assert.equal(isNewerVersion('2.4.0', '2.5.0'), true);
  assert.equal(isNewerVersion('v2.4.0', 'v2.4.1-stable'), true);
  assert.equal(isNewerVersion('2.5.0', '2.5.0'), false);
  assert.equal(isNewerVersion('2.6.0', '2.5.9'), false);
});

test('validateDownloadUrl validates HTTP/HTTPS URLs and extracts filenames', () => {
  const empty = validateDownloadUrl('   ');
  assert.equal(empty.valid, false);

  const valid = validateDownloadUrl('https://dl.google.com/android/studio/netpulse-v2.5.0.apk');
  assert.equal(valid.valid, true);
  assert.equal(valid.fileName, 'netpulse-v2.5.0.apk');

  // Verify 400+ character token URLs never exceed 55 chars (prevents ENAMETOOLONG on Android)
  const hugeToken =
    'ADGPM2nsoPKIX4TrS7tME9LiX59DV5xx4Iwgj_bD7ppOi2mxnoj8dI5WEoPfGlBx_RS6cECfajD_szMRB8FJrzZvKyXWsRzOF9qb4G196F1gzbgCp1yQnDopVJAlIxUpJXrJnyk4YtxzmzgkUmzEX3g_UcQVCChSe1W6Aa34YIv2jjFyIwH3fJU4lMOQww0zmMwhrTg2rte_vTkYO8Byd7XWrWbYOltTLJ26YanXgojiancJh6WZrjIR44NIbAfsFiws25RtUMkZlmlaas9ZJl3HEd2LkzzIrAGkQSCeS7IzPgzYzbkjBTVUOzkdrILK3EskBUwKVjBZJuBldvPFvR9WneZ9IqnXhuahHf1uupOWBYWkO0YX75EEUJHTpf7riISrbZ0MDdScXM_Zr7tnGKZMjXckYGvw';
  const longUrlRes = validateDownloadUrl(`https://doc-0s-4g-docs.googleusercontent.com/docs/securesc/${hugeToken}`);
  assert.equal(longUrlRes.valid, true);
  assert.ok(longUrlRes.fileName.length <= 55, `Expected <= 55 chars, got ${longUrlRes.fileName.length}: ${longUrlRes.fileName}`);
});
