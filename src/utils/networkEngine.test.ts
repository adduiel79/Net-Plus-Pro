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
  detectSocialVideoUrl,
  formatRemainingTimeBn,
  computeResumedProgressState,
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

test('detectSocialVideoUrl and validateDownloadUrl recognize YouTube and Facebook links as .mp4 videos', () => {
  const yt = validateDownloadUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  assert.equal(yt.valid, true);
  assert.equal(yt.isSocialVideo, true);
  assert.equal(yt.socialPlatform, 'youtube');
  assert.equal(yt.fileName, 'YouTube_Video_dQw4w9WgXcQ.mp4');

  const fb = detectSocialVideoUrl('https://www.facebook.com/reel/9876543210');
  assert.equal(fb.isSocialVideo, true);
  assert.equal(fb.platform, 'facebook');
  assert.equal(fb.suggestedFileName, 'Facebook_Video_9876543210.mp4');
});

test('formatRemainingTimeBn formats seconds into minutes and seconds in Bengali', () => {
  assert.equal(formatRemainingTimeBn(45), '০ মিনিট 45 সেকেন্ড বাকি');
  assert.equal(formatRemainingTimeBn(135), '2 মিনিট 15 সেকেন্ড বাকি');
  assert.equal(formatRemainingTimeBn(3665), '1 ঘণ্টা 1 মিনিট 5 সেকেন্ড বাকি');
});

test('computeResumedProgressState preserves downloaded bytes and chunk progress across network drops', () => {
  const afterDrop = computeResumedProgressState(15728640, 0, [50, 60, 40, 55], [0]);
  assert.equal(afterDrop.downloadedBytes, 15728640);
  assert.deepEqual(afterDrop.chunkProgress, [50, 60, 40, 55]);

  const afterResume = computeResumedProgressState(15728640, 20971520, [50, 60, 40, 55], [68, 75, 58, 70]);
  assert.equal(afterResume.downloadedBytes, 20971520);
  assert.deepEqual(afterResume.chunkProgress, [68, 75, 58, 70]);
});


