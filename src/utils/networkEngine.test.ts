import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  calculatePingAndJitter,
  calculateThroughputMBps,
  calculateTurboSpeedComparison,
  computeRetrySchedule,
  computeDownloadStartDelayMs,
  isNewerVersion,
  validateDownloadUrl,
  detectSocialVideoUrl,
  classifyFileCategory,
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

test('classifyFileCategory auto-tags files into Images, Videos, Documents, Archives, Apps, and Audio subfolders', () => {
  const img = classifyFileCategory('Wallpaper_4K.jpg', 'image/jpeg');
  assert.equal(img.category, 'Images');
  assert.equal(img.fullSavedPath, '/storage/emulated/0/Download/Images/Wallpaper_4K.jpg');

  const vid = classifyFileCategory('YouTube_Video_jNQXAC9IVRw.mp4', 'video/mp4');
  assert.equal(vid.category, 'Videos');
  assert.equal(vid.fullSavedPath, '/storage/emulated/0/Download/Videos/YouTube_Video_jNQXAC9IVRw.mp4');

  const doc = classifyFileCategory('Network_Manual.pdf', 'application/pdf');
  assert.equal(doc.category, 'Documents');
  assert.equal(doc.fullSavedPath, '/storage/emulated/0/Download/Documents/Network_Manual.pdf');

  const arc = classifyFileCategory('Drivers_Pack.zip', 'application/zip');
  assert.equal(arc.category, 'Archives');
  assert.equal(arc.fullSavedPath, '/storage/emulated/0/Download/Archives/Drivers_Pack.zip');

  const appPkg = classifyFileCategory('NetPlus_Codec.apk');
  assert.equal(appPkg.category, 'Apps');
  assert.equal(appPkg.fullSavedPath, '/storage/emulated/0/Download/Apps/NetPlus_Codec.apk');
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

test('configure-android-manifest.mjs generates valid MainActivity.java with balanced braces and valid escapes', () => {
  const scriptSrc = fs.readFileSync('scripts/configure-android-manifest.mjs', 'utf8');
  const startMarker = 'const javaCode = `';
  const endMarker = '`;\n  fs.writeFileSync(mainActivityPath, javaCode';
  const startIdx = scriptSrc.indexOf(startMarker);
  const endIdx = scriptSrc.lastIndexOf(endMarker);
  assert.ok(startIdx > 0 && endIdx > startIdx, 'Should locate javaCode template literal');

  const templateBody = scriptSrc.slice(startIdx + startMarker.length, endIdx);
  // Evaluate template literal string
  const javaCode = new Function(`return \`${templateBody}\`;`)() as string;
  const lines = javaCode.split('\n');

  let braceDepth = 0;
  let parenDepth = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) continue;
    let inStr = false;
    let inChar = false;
    for (let j = 0; j < line.length; j++) {
      const ch = line[j];
      if (!inStr && !inChar && ch === '/' && line[j + 1] === '/') break;
      if (inStr) {
        if (ch === '\\') {
          const next = line[j + 1] || '';
          assert.ok(
            'btnfr"\'\\'.includes(next),
            `Invalid Java string escape \\${next} at MainActivity.java:${i + 1}`
          );
          j++;
        } else if (ch === '"') {
          inStr = false;
        }
      } else if (inChar) {
        if (ch === '\\') j++;
        else if (ch === "'") inChar = false;
      } else {
        if (ch === '"') inStr = true;
        else if (ch === "'") inChar = true;
        else if (ch === '{') braceDepth++;
        else if (ch === '}') braceDepth--;
        else if (ch === '(') parenDepth++;
        else if (ch === ')') parenDepth--;
      }
    }
    assert.equal(inStr, false, `Unclosed string literal at MainActivity.java:${i + 1}`);
  }
  assert.equal(braceDepth, 0, 'Braces {} in MainActivity.java must be balanced');
  assert.equal(parenDepth, 0, 'Parentheses () in MainActivity.java must be balanced');
});


