import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const manifestPath = path.join(process.cwd(), 'android', 'app', 'src', 'main', 'AndroidManifest.xml');

if (fs.existsSync(manifestPath)) {
  let xml = fs.readFileSync(manifestPath, 'utf8');

  const requiredPermissions = [
    'android.permission.INTERNET',
    'android.permission.ACCESS_NETWORK_STATE',
    'android.permission.CHANGE_NETWORK_STATE',
    'android.permission.WRITE_EXTERNAL_STORAGE',
    'android.permission.READ_EXTERNAL_STORAGE',
    'android.permission.MANAGE_EXTERNAL_STORAGE',
    'android.permission.READ_MEDIA_IMAGES',
    'android.permission.READ_MEDIA_VIDEO',
    'android.permission.READ_MEDIA_AUDIO',
    'android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS',
    'android.permission.WAKE_LOCK',
    'android.permission.FOREGROUND_SERVICE',
    'android.permission.FOREGROUND_SERVICE_DATA_SYNC',
    'android.permission.POST_NOTIFICATIONS',
    'android.permission.REQUEST_INSTALL_PACKAGES',
  ];

  const missingPermissionsXml = requiredPermissions
    .filter((perm) => !xml.includes(perm))
    .map((perm) => `    <uses-permission android:name="${perm}" />`)
    .join('\n');

  if (missingPermissionsXml) {
    xml = xml.replace('</manifest>', `${missingPermissionsXml}\n</manifest>`);
  }

  if (!xml.includes('android:usesCleartextTraffic')) {
    xml = xml.replace(
      '<application',
      '<application\n        android:usesCleartextTraffic="true"\n        android:requestLegacyExternalStorage="true"\n        android:preserveLegacyExternalStorage="true"'
    );
  }

  // Inject Browser Download Interceptor Intent Filters so Chrome & any browser
  // automatically offer "Net Plus Pro" when clicking a download link
  const downloadIntentFilters = `
            <!-- Browser Download Interceptor: Shows Net Plus Pro in Android "Download with..." App Chooser -->
            <intent-filter android:label="Net Plus Pro (Turbo Download)">
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                <data android:scheme="http" />
                <data android:scheme="https" />
                <data android:host="*" />
                <data android:pathPattern=".*\\\\.apk" />
                <data android:pathPattern=".*\\\\.zip" />
                <data android:pathPattern=".*\\\\.rar" />
                <data android:pathPattern=".*\\\\.7z" />
                <data android:pathPattern=".*\\\\.mp4" />
                <data android:pathPattern=".*\\\\.mkv" />
                <data android:pathPattern=".*\\\\.mp3" />
                <data android:pathPattern=".*\\\\.pdf" />
                <data android:pathPattern=".*\\\\.iso" />
                <data android:pathPattern=".*\\\\.bin" />
                <data android:pathPattern=".*\\\\.pak" />
                <data android:pathPattern=".*\\\\.obb" />
                <data android:pathPattern=".*\\\\.xapk" />
            </intent-filter>

            <!-- MIME-Type Download Interceptor for dynamic download streams from Chrome/Browsers -->
            <intent-filter android:label="Net Plus Pro (High-Speed Download)">
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                <data android:scheme="http" />
                <data android:scheme="https" />
                <data android:mimeType="application/vnd.android.package-archive" />
                <data android:mimeType="application/octet-stream" />
                <data android:mimeType="application/zip" />
                <data android:mimeType="application/x-rar-compressed" />
                <data android:mimeType="application/pdf" />
                <data android:mimeType="video/*" />
                <data android:mimeType="audio/*" />
            </intent-filter>

            <!-- Share Link to Net Plus Pro from Chrome menu -->
            <intent-filter android:label="Net Plus Pro Turbo Download">
                <action android:name="android.intent.action.SEND" />
                <category android:name="android.intent.category.DEFAULT" />
                <data android:mimeType="text/plain" />
            </intent-filter>`;

  if (!xml.includes('Browser Download Interceptor')) {
    xml = xml.replace('</activity>', `${downloadIntentFilters}\n        </activity>`);
  }

  fs.writeFileSync(manifestPath, xml, 'utf8');
  console.log('Successfully injected Net Plus Pro permissions & Browser Download Interceptor into AndroidManifest.xml');
}

// Inject Native Multi-Thread Internal Storage Downloader & Permission Manager into MainActivity.java
const mainActivityDir = path.join(
  process.cwd(),
  'android',
  'app',
  'src',
  'main',
  'java',
  'com',
  'netplus',
  'pro'
);
const mainActivityPath = path.join(mainActivityDir, 'MainActivity.java');

if (fs.existsSync(mainActivityDir)) {
  const javaCode = `package com.netplus.pro;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.media.MediaScannerConnection;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.os.PowerManager;
import android.provider.Settings;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.webkit.URLUtil;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.RandomAccessFile;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicLong;

public class MainActivity extends BridgeActivity {
    private final ExecutorService downloadPool = Executors.newCachedThreadPool();
    private final Map<String, AtomicBoolean> pausedTasks = new ConcurrentHashMap<>();
    private final Map<String, AtomicBoolean> cancelledTasks = new ConcurrentHashMap<>();
    private String pendingInterceptedUrl = null;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        handleIncomingIntent(getIntent());
        requestInitialRuntimePermissions();

        if (getBridge() != null && getBridge().getWebView() != null) {
            WebView webView = getBridge().getWebView();
            webView.getSettings().setJavaScriptEnabled(true);
            webView.getSettings().setDomStorageEnabled(true);
            webView.addJavascriptInterface(new NativeDownloadBridge(), "NetPlusNativeDownloader");
        }
    }

    @Override
    public void onResume() {
        super.onResume();
        notifyPermissionStateToJs();
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleIncomingIntent(intent);
    }

    private void requestInitialRuntimePermissions() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            List<String> needed = new ArrayList<>();
            if (Build.VERSION.SDK_INT <= 32) {
                if (checkSelfPermission(Manifest.permission.WRITE_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED) {
                    needed.add(Manifest.permission.WRITE_EXTERNAL_STORAGE);
                }
                if (checkSelfPermission(Manifest.permission.READ_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED) {
                    needed.add(Manifest.permission.READ_EXTERNAL_STORAGE);
                }
            }
            if (Build.VERSION.SDK_INT >= 33) {
                if (checkSelfPermission("android.permission.POST_NOTIFICATIONS") != PackageManager.PERMISSION_GRANTED) {
                    needed.add("android.permission.POST_NOTIFICATIONS");
                }
            }
            if (!needed.isEmpty()) {
                requestPermissions(needed.toArray(new String[0]), 1001);
            }
        }
    }

    private boolean checkHasStoragePermissionInternal() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            return Environment.isExternalStorageManager();
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            return checkSelfPermission(Manifest.permission.WRITE_EXTERNAL_STORAGE) == PackageManager.PERMISSION_GRANTED;
        }
        return true;
    }

    private void notifyPermissionStateToJs() {
        if (getBridge() == null || getBridge().getWebView() == null) return;
        final WebView webView = getBridge().getWebView();
        final boolean granted = checkHasStoragePermissionInternal();
        webView.post(() -> webView.evaluateJavascript(
            "if (window.__onStoragePermissionChanged) { window.__onStoragePermissionChanged(" + granted + "); }",
            null
        ));
    }

    private void handleIncomingIntent(Intent intent) {
        if (intent == null) return;
        String action = intent.getAction();
        String url = null;
        if (Intent.ACTION_VIEW.equals(action) && intent.getDataString() != null) {
            url = intent.getDataString();
        } else if (Intent.ACTION_SEND.equals(action)) {
            String sharedText = intent.getStringExtra(Intent.EXTRA_TEXT);
            if (sharedText != null && (sharedText.contains("http://") || sharedText.contains("https://"))) {
                url = sharedText.trim();
            }
        }
        if (url != null) {
            pendingInterceptedUrl = url;
            dispatchInterceptedUrlToJs(url);
        }
    }

    private void dispatchInterceptedUrlToJs(final String url) {
        if (getBridge() == null || getBridge().getWebView() == null) return;
        final WebView webView = getBridge().getWebView();
        webView.post(() -> {
            String escaped = JSONObject.quote(url);
            webView.evaluateJavascript(
                "if (window.__onBrowserDownloadIntercepted) { window.__onBrowserDownloadIntercepted(" + escaped + "); }",
                null
            );
        });
    }

    private static String resolveExtension(String name, String contentType) {
        if (name != null) {
            int dot = name.lastIndexOf('.');
            if (dot > 0 && dot >= name.length() - 7) {
                String ext = name.substring(dot).toLowerCase();
                if (ext.matches("^\\\\.[a-z0-9]{1,6}$") && !".bin".equals(ext)) {
                    return ext;
                }
            }
        }
        String ct = contentType != null ? contentType.toLowerCase() : "";
        if (ct.contains("android.package-archive")) return ".apk";
        if (ct.contains("zip")) return ".zip";
        if (ct.contains("rar")) return ".rar";
        if (ct.contains("7z")) return ".7z";
        if (ct.contains("pdf")) return ".pdf";
        if (ct.contains("mp4") || ct.contains("video")) return ".mp4";
        if (ct.contains("mpeg") || ct.contains("mp3") || ct.contains("audio")) return ".mp3";
        if (ct.contains("jpeg") || ct.contains("jpg")) return ".jpg";
        if (ct.contains("png")) return ".png";
        if (ct.contains("iso")) return ".iso";
        return ".bin";
    }

    /**
     * Strictly caps the filename at <= 50 characters so Linux/Android FUSE/ext4 NEVER throws ENAMETOOLONG.
     */
    private static String buildShortSafeFileName(String requestedName, String guessedName, String contentType) {
        String candidate = (guessedName != null && !guessedName.isEmpty() && !"downloadfile.bin".equalsIgnoreCase(guessedName))
            ? guessedName
            : (requestedName != null && !requestedName.isEmpty() ? requestedName : "NetPlus_Download.bin");

        candidate = candidate.replaceAll("[^a-zA-Z0-9._-]", "_").replaceAll("_+", "_");
        String ext = resolveExtension(candidate, contentType);

        int dot = candidate.lastIndexOf('.');
        String base = (dot > 0 && dot >= candidate.length() - 8) ? candidate.substring(0, dot) : candidate;
        if (base.isEmpty()) base = "NetPlus_File";

        if (base.length() > 38) {
            String prefix = base.substring(0, 16);
            String suffix = base.substring(base.length() - 8);
            base = "NetPlus_" + prefix + "_" + suffix;
        }
        if (base.length() > 38) {
            base = base.substring(0, 38);
        }
        return base + ext;
    }

    private static File createUniqueOutputFile(File dir, String safeFileName) {
        File candidate = new File(dir, safeFileName);
        if (!candidate.exists()) return candidate;

        int dot = safeFileName.lastIndexOf('.');
        String base = dot > 0 ? safeFileName.substring(0, dot) : safeFileName;
        String ext = dot > 0 ? safeFileName.substring(dot) : "";
        for (int i = 1; i < 1000; i++) {
            File next = new File(dir, base + "_" + i + ext);
            if (!next.exists()) return next;
        }
        return new File(dir, base + "_" + (System.currentTimeMillis() % 10000) + ext);
    }

    public class NativeDownloadBridge {
        @JavascriptInterface
        public boolean hasStoragePermission() {
            return checkHasStoragePermissionInternal();
        }

        @JavascriptInterface
        public void requestStoragePermission() {
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                    if (!Environment.isExternalStorageManager()) {
                        try {
                            Intent intent = new Intent(Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION);
                            intent.setData(Uri.parse("package:" + getPackageName()));
                            startActivity(intent);
                        } catch (Exception e) {
                            Intent intent = new Intent(Settings.ACTION_MANAGE_ALL_FILES_ACCESS_PERMISSION);
                            startActivity(intent);
                        }
                    } else {
                        notifyPermissionStateToJs();
                    }
                } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    requestPermissions(
                        new String[]{
                            Manifest.permission.WRITE_EXTERNAL_STORAGE,
                            Manifest.permission.READ_EXTERNAL_STORAGE
                        },
                        1002
                    );
                }
            } catch (Exception e) {
                try {
                    Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
                    intent.setData(Uri.parse("package:" + getPackageName()));
                    startActivity(intent);
                } catch (Exception ignored) {}
            }
        }

        @JavascriptInterface
        public void requestBatteryOptimizationBypass() {
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
                    if (pm != null && !pm.isIgnoringBatteryOptimizations(getPackageName())) {
                        Intent intent = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
                        intent.setData(Uri.parse("package:" + getPackageName()));
                        startActivity(intent);
                    }
                }
            } catch (Exception ignored) {}
        }

        @JavascriptInterface
        public String consumePendingInterceptedUrl() {
            String u = pendingInterceptedUrl;
            pendingInterceptedUrl = null;
            return u != null ? u : "";
        }

        @JavascriptInterface
        public void pauseDownload(String taskId) {
            AtomicBoolean flag = pausedTasks.get(taskId);
            if (flag != null) flag.set(true);
        }

        @JavascriptInterface
        public void cancelDownload(String taskId) {
            AtomicBoolean flag = cancelledTasks.get(taskId);
            if (flag != null) flag.set(true);
        }

        @JavascriptInterface
        public String saveBase64ToDownloads(String base64Data, String fileName) {
            try {
                File dir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
                if (!dir.exists()) dir.mkdirs();
                String safeName = buildShortSafeFileName(fileName, fileName, "application/octet-stream");
                File outFile = createUniqueOutputFile(dir, safeName);
                byte[] bytes = Base64.decode(base64Data, Base64.DEFAULT);
                try (FileOutputStream fos = new FileOutputStream(outFile)) {
                    fos.write(bytes);
                    fos.flush();
                }
                MediaScannerConnection.scanFile(
                    getApplicationContext(),
                    new String[]{ outFile.getAbsolutePath() },
                    null,
                    null
                );
                return outFile.getAbsolutePath();
            } catch (Exception e) {
                return "";
            }
        }

        @JavascriptInterface
        public void startMultiThreadDownload(final String taskId, final String urlStr, final String requestedName, final int threadCount) {
            pausedTasks.put(taskId, new AtomicBoolean(false));
            cancelledTasks.put(taskId, new AtomicBoolean(false));

            downloadPool.submit(() -> {
                try {
                    int threads = Math.max(1, Math.min(32, threadCount));
                    // 1. Probe URL with Range: bytes=0-0
                    HttpURLConnection probeConn = (HttpURLConnection) new URL(urlStr).openConnection();
                    probeConn.setInstanceFollowRedirects(true);
                    probeConn.setConnectTimeout(15000);
                    probeConn.setReadTimeout(20000);
                    probeConn.setRequestProperty("User-Agent", "Mozilla/5.0 (Linux; Android 15) Chrome/131.0.0.0 Mobile NetPlusPro/2.5");
                    probeConn.setRequestProperty("Range", "bytes=0-0");
                    int status = probeConn.getResponseCode();
                    String finalUrl = probeConn.getURL().toString();
                    String contentRange = probeConn.getHeaderField("Content-Range");
                    String acceptRanges = probeConn.getHeaderField("Accept-Ranges");
                    String contentDisposition = probeConn.getHeaderField("Content-Disposition");
                    String contentType = probeConn.getContentType();

                    long totalBytes = -1;
                    boolean supportsRanges = (status == 206) || (acceptRanges != null && acceptRanges.toLowerCase().contains("bytes"));

                    if (contentRange != null && contentRange.contains("/")) {
                        String totalPart = contentRange.substring(contentRange.lastIndexOf('/') + 1).trim();
                        if (!"*".equals(totalPart)) {
                            totalBytes = Long.parseLong(totalPart);
                            supportsRanges = true;
                        }
                    }
                    if (totalBytes <= 0) {
                        totalBytes = probeConn.getContentLengthLong();
                    }
                    probeConn.disconnect();

                    String guessedName = URLUtil.guessFileName(finalUrl, contentDisposition, contentType);
                    String safeName = buildShortSafeFileName(requestedName, guessedName, contentType);

                    File downloadDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
                    if (!downloadDir.exists()) {
                        downloadDir.mkdirs();
                    }
                    File outFile = createUniqueOutputFile(downloadDir, safeName);

                    // Verify we can write to public Download folder; if restricted, fallback to app-accessible external Download dir
                    try {
                        try (RandomAccessFile testRaf = new RandomAccessFile(outFile, "rw")) {
                            testRaf.seek(0);
                        }
                    } catch (Exception permEx) {
                        File fallbackDir = getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
                        if (fallbackDir != null) {
                            if (!fallbackDir.exists()) fallbackDir.mkdirs();
                            outFile = createUniqueOutputFile(fallbackDir, safeName);
                        }
                    }

                    final File targetFile = outFile;
                    final AtomicLong downloadedBytes = new AtomicLong(0);
                    final long startTimeMs = System.currentTimeMillis();
                    final long finalTotalBytes = totalBytes;
                    final int activeThreads = (supportsRanges && totalBytes > 256 * 1024) ? threads : 1;
                    final long[] chunkDone = new long[activeThreads];
                    final long[] chunkSize = new long[activeThreads];

                    if (activeThreads > 1) {
                        try (RandomAccessFile raf = new RandomAccessFile(targetFile, "rw")) {
                            raf.setLength(totalBytes);
                        }
                        long partSize = totalBytes / activeThreads;
                        Future<?>[] futures = new Future<?>[activeThreads];

                        for (int i = 0; i < activeThreads; i++) {
                            final int idx = i;
                            final long startByte = i * partSize;
                            final long endByte = (i == activeThreads - 1) ? (totalBytes - 1) : ((i + 1) * partSize - 1);
                            chunkSize[idx] = endByte - startByte + 1;

                            futures[i] = downloadPool.submit(() -> {
                                long offset = startByte;
                                while (offset <= endByte) {
                                    if (cancelledTasks.get(taskId).get()) return;
                                    if (pausedTasks.get(taskId).get()) {
                                        try { Thread.sleep(300); } catch (InterruptedException ignored) {}
                                        continue;
                                    }
                                    HttpURLConnection partConn = null;
                                    try {
                                        partConn = (HttpURLConnection) new URL(finalUrl).openConnection();
                                        partConn.setInstanceFollowRedirects(true);
                                        partConn.setConnectTimeout(15000);
                                        partConn.setReadTimeout(20000);
                                        partConn.setRequestProperty("User-Agent", "Mozilla/5.0 (Linux; Android 15) Chrome/131.0.0.0 Mobile NetPlusPro/2.5");
                                        partConn.setRequestProperty("Range", "bytes=" + offset + "-" + endByte);

                                        try (InputStream is = partConn.getInputStream();
                                             RandomAccessFile partFile = new RandomAccessFile(targetFile, "rw")) {
                                            partFile.seek(offset);
                                            byte[] buffer = new byte[64 * 1024];
                                            int read;
                                            while ((read = is.read(buffer)) != -1) {
                                                if (cancelledTasks.get(taskId).get()) return;
                                                while (pausedTasks.get(taskId).get()) {
                                                    Thread.sleep(250);
                                                }
                                                partFile.write(buffer, 0, read);
                                                offset += read;
                                                chunkDone[idx] += read;
                                                downloadedBytes.addAndGet(read);
                                            }
                                        }
                                    } catch (Exception retryEx) {
                                        try { Thread.sleep(1000); } catch (InterruptedException ignored) {}
                                    } finally {
                                        if (partConn != null) partConn.disconnect();
                                    }
                                }
                            });
                        }

                        boolean allFinished = false;
                        while (!allFinished && !cancelledTasks.get(taskId).get()) {
                            allFinished = true;
                            for (Future<?> f : futures) {
                                if (!f.isDone()) {
                                    allFinished = false;
                                    break;
                                }
                            }
                            emitProgress(taskId, targetFile.getName(), downloadedBytes.get(), finalTotalBytes, startTimeMs, chunkDone, chunkSize, "downloading", targetFile.getAbsolutePath(), "");
                            try { Thread.sleep(200); } catch (InterruptedException ignored) {}
                        }
                    } else {
                        HttpURLConnection conn = (HttpURLConnection) new URL(finalUrl).openConnection();
                        conn.setInstanceFollowRedirects(true);
                        conn.setRequestProperty("User-Agent", "Mozilla/5.0 (Linux; Android 15) Chrome/131.0.0.0 Mobile NetPlusPro/2.5");
                        try (InputStream is = conn.getInputStream();
                             FileOutputStream fos = new FileOutputStream(targetFile)) {
                            byte[] buf = new byte[64 * 1024];
                            int read;
                            long lastEmit = 0;
                            while ((read = is.read(buf)) != -1) {
                                if (cancelledTasks.get(taskId).get()) return;
                                while (pausedTasks.get(taskId).get()) {
                                    Thread.sleep(250);
                                }
                                fos.write(buf, 0, read);
                                long curr = downloadedBytes.addAndGet(read);
                                chunkDone[0] = curr;
                                chunkSize[0] = finalTotalBytes > 0 ? finalTotalBytes : curr;
                                long now = System.currentTimeMillis();
                                if (now - lastEmit >= 200) {
                                    lastEmit = now;
                                    emitProgress(taskId, targetFile.getName(), curr, finalTotalBytes > 0 ? finalTotalBytes : curr, startTimeMs, chunkDone, chunkSize, "downloading", targetFile.getAbsolutePath(), "");
                                }
                            }
                        } finally {
                            conn.disconnect();
                        }
                    }

                    if (!cancelledTasks.get(taskId).get()) {
                        MediaScannerConnection.scanFile(
                            getApplicationContext(),
                            new String[]{ targetFile.getAbsolutePath() },
                            null,
                            null
                        );
                        long finalBytes = downloadedBytes.get();
                        emitProgress(taskId, targetFile.getName(), finalBytes, finalTotalBytes > 0 ? finalTotalBytes : finalBytes, startTimeMs, chunkDone, chunkSize, "completed", targetFile.getAbsolutePath(), "");
                    }
                } catch (Exception e) {
                    emitProgress(taskId, "", 0, 0, System.currentTimeMillis(), new long[]{0}, new long[]{1}, "error", "", e.getMessage() != null ? e.getMessage() : "Download error");
                }
            });
        }

        private void emitProgress(String taskId, String resolvedName, long dlBytes, long totalBytes, long startMs, long[] chunkDone, long[] chunkSize, String status, String savedPath, String error) {
            if (getBridge() == null || getBridge().getWebView() == null) return;
            final WebView webView = getBridge().getWebView();
            long elapsedMs = Math.max(100, System.currentTimeMillis() - startMs);
            double speedMBps = (dlBytes / (1024.0 * 1024.0)) / (elapsedMs / 1000.0);

            try {
                JSONObject payload = new JSONObject();
                payload.put("taskId", taskId);
                payload.put("fileName", resolvedName);
                payload.put("downloadedBytes", dlBytes);
                payload.put("totalBytes", totalBytes > 0 ? totalBytes : dlBytes);
                payload.put("speedMBps", Math.round(speedMBps * 100.0) / 100.0);
                payload.put("status", status);
                payload.put("savedPath", savedPath);
                payload.put("error", error);

                JSONArray chunksArr = new JSONArray();
                for (int i = 0; i < chunkDone.length; i++) {
                    long cs = Math.max(1, chunkSize[i]);
                    int pct = (int) Math.min(100, Math.round((chunkDone[i] * 100.0) / cs));
                    chunksArr.put(pct);
                }
                payload.put("chunkProgress", chunksArr);

                final String jsonStr = payload.toString();
                webView.post(() -> webView.evaluateJavascript(
                    "if (window.__onNativeDownloadUpdate) { window.__onNativeDownloadUpdate(" + jsonStr + "); }",
                    null
                ));
            } catch (Exception ignored) {}
        }
    }
}
`;
  fs.writeFileSync(mainActivityPath, javaCode, 'utf8');
  console.log('Successfully generated native multi-thread Internal Storage downloader & permission manager in MainActivity.java');
}

// Resize and copy the custom Net Plus Pro logo into Android mipmap launcher icon directories
const logoPath = path.join(
  process.cwd(),
  'public',
  'assets',
  'aistudio',
  'file_000000008b70821197eef6b1e7f14a65_b0bafffc.png'
);
const resDir = path.join(process.cwd(), 'android', 'app', 'src', 'main', 'res');

function copyOrResizeIcon(src, dest, sizePx) {
  try {
    execFileSync('convert', [src, '-resize', `${sizePx}x${sizePx}`, dest], { stdio: 'ignore' });
    return;
  } catch {
    // Fallback to ffmpeg if ImageMagick convert is not available
  }
  try {
    execFileSync('ffmpeg', ['-y', '-i', src, '-vf', `scale=${sizePx}:${sizePx}`, dest], { stdio: 'ignore' });
    return;
  } catch {
    // Fallback to direct copy
    fs.copyFileSync(src, dest);
  }
}

if (fs.existsSync(logoPath) && fs.existsSync(resDir)) {
  const mipmapSpecs = [
    { dir: 'mipmap-mdpi', launcher: 48, foreground: 108 },
    { dir: 'mipmap-hdpi', launcher: 72, foreground: 162 },
    { dir: 'mipmap-xhdpi', launcher: 96, foreground: 216 },
    { dir: 'mipmap-xxhdpi', launcher: 144, foreground: 324 },
    { dir: 'mipmap-xxxhdpi', launcher: 192, foreground: 432 },
  ];

  for (const dirSpec of mipmapSpecs) {
    const targetDir = path.join(resDir, dirSpec.dir);
    if (fs.existsSync(targetDir)) {
      copyOrResizeIcon(logoPath, path.join(targetDir, 'ic_launcher.png'), dirSpec.launcher);
      copyOrResizeIcon(logoPath, path.join(targetDir, 'ic_launcher_round.png'), dirSpec.launcher);
      copyOrResizeIcon(logoPath, path.join(targetDir, 'ic_launcher_foreground.png'), dirSpec.foreground);
    }
  }
  console.log('Successfully configured Net Plus Pro custom launcher icons for Android APK.');
}
