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

// Inject High-Speed Native Multi-Thread Downloader, Auto-Reconnect & Auto Storage Permission Prompt into MainActivity.java
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
import android.app.AlertDialog;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.media.MediaScannerConnection;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
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

import java.io.BufferedInputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.RandomAccessFile;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;

public class MainActivity extends BridgeActivity {
    private final ExecutorService downloadPool = Executors.newCachedThreadPool();
    private final Map<String, AtomicBoolean> pausedTasks = new ConcurrentHashMap<>();
    private final Map<String, AtomicBoolean> cancelledTasks = new ConcurrentHashMap<>();
    private final Map<String, Set<HttpURLConnection>> activeTaskConnections = new ConcurrentHashMap<>();
    private final Object stateLock = new Object();
    private final AtomicBoolean isNetworkAvailable = new AtomicBoolean(true);
    private final AtomicBoolean isSimulatedOnline = new AtomicBoolean(true);
    private boolean promptedStorageThisSession = false;
    private String pendingInterceptedUrl = null;
    private volatile String cachedClipboardText = "";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        handleIncomingIntent(getIntent());
        registerRealTimeNetworkMonitor();

        if (getBridge() != null && getBridge().getWebView() != null) {
            WebView webView = getBridge().getWebView();
            webView.getSettings().setJavaScriptEnabled(true);
            webView.getSettings().setDomStorageEnabled(true);
            webView.addJavascriptInterface(new NativeDownloadBridge(), "NetPlusNativeDownloader");
        }

        // Automatically prompt for storage & notification permissions when the app is installed & opened
        autoPromptStoragePermissionOnLaunch();
    }

    @Override
    public void onResume() {
        super.onResume();
        refreshClipboardCache();
        notifyPermissionStateToJs();
        wakeUpWaitingDownloads();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            refreshClipboardCache();
        }
    }

    private String refreshClipboardCache() {
        try {
            ClipboardManager cm = (ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE);
            if (cm != null && cm.hasPrimaryClip()) {
                ClipData clip = cm.getPrimaryClip();
                if (clip != null && clip.getItemCount() > 0) {
                    CharSequence text = clip.getItemAt(0).coerceToText(this);
                    if (text != null && text.length() > 0) {
                        cachedClipboardText = text.toString().trim();
                        return cachedClipboardText;
                    }
                }
            }
        } catch (Exception ignored) {}
        return cachedClipboardText;
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleIncomingIntent(intent);
    }

    private void wakeUpWaitingDownloads() {
        synchronized (stateLock) {
            stateLock.notifyAll();
        }
    }

    private void registerActiveConnection(String taskId, HttpURLConnection conn) {
        if (conn == null) return;
        Set<HttpURLConnection> set = activeTaskConnections.get(taskId);
        if (set != null) {
            set.add(conn);
        }
    }

    private void unregisterActiveConnection(String taskId, HttpURLConnection conn) {
        if (conn == null) return;
        Set<HttpURLConnection> set = activeTaskConnections.get(taskId);
        if (set != null) {
            set.remove(conn);
        }
    }

    private void abortTaskConnections(String taskId) {
        Set<HttpURLConnection> set = activeTaskConnections.get(taskId);
        if (set == null) return;
        for (HttpURLConnection conn : set.toArray(new HttpURLConnection[0])) {
            downloadPool.submit(() -> {
                try {
                    if (conn != null) conn.disconnect();
                } catch (Exception ignored) {}
            });
        }
    }

    private void abortAllActiveConnections() {
        for (String taskId : activeTaskConnections.keySet()) {
            abortTaskConnections(taskId);
        }
    }

    /**
     * Opens an HttpURLConnection that manually follows up to 10 redirects (including http <-> https
     * and cross-domain CDN redirects) while strictly preserving the HTTP Range header on every hop!
     * If primaryUrl fails (e.g. expired signed CDN URL after IP change on network reconnect),
     * it automatically re-resolves from fallbackOriginalUrl with the exact same Range header.
     */
    private HttpURLConnection openRangeConnectionWithRedirects(
            String primaryUrl,
            String fallbackOriginalUrl,
            String rangeHeader
    ) throws Exception {
        try {
            return openSingleRedirectChain(primaryUrl, rangeHeader);
        } catch (Exception firstEx) {
            if (fallbackOriginalUrl != null && !fallbackOriginalUrl.isEmpty() && !fallbackOriginalUrl.equals(primaryUrl)) {
                return openSingleRedirectChain(fallbackOriginalUrl, rangeHeader);
            }
            throw firstEx;
        }
    }

    private HttpURLConnection openSingleRedirectChain(String startUrl, String rangeHeader) throws Exception {
        String currentUrl = startUrl;
        for (int hop = 0; hop < 10; hop++) {
            HttpURLConnection conn = (HttpURLConnection) new URL(currentUrl).openConnection();
            conn.setInstanceFollowRedirects(false);
            conn.setUseCaches(false);
            conn.setConnectTimeout(10000);
            conn.setReadTimeout(12000);
            conn.setRequestProperty("User-Agent", "Mozilla/5.0 (Linux; Android 15) Chrome/131.0.0.0 Mobile NetPlusPro/2.5");
            conn.setRequestProperty("Accept-Encoding", "identity");
            conn.setRequestProperty("Connection", "keep-alive");
            if (rangeHeader != null && !rangeHeader.isEmpty()) {
                conn.setRequestProperty("Range", rangeHeader);
            }

            int code = conn.getResponseCode();
            if (code == 301 || code == 302 || code == 303 || code == 307 || code == 308) {
                String location = conn.getHeaderField("Location");
                conn.disconnect();
                if (location == null || location.isEmpty()) {
                    throw new Exception("Redirect missing Location header");
                }
                currentUrl = new URL(new URL(currentUrl), location).toString();
                continue;
            }
            if (code >= 400) {
                conn.disconnect();
                throw new Exception("HTTP " + code);
            }
            return conn;
        }
        throw new Exception("Too many redirects");
    }

    private void registerRealTimeNetworkMonitor() {
        try {
            ConnectivityManager cm = (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
            if (cm != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                cm.registerDefaultNetworkCallback(new ConnectivityManager.NetworkCallback() {
                    @Override
                    public void onAvailable(Network network) {
                        isNetworkAvailable.set(true);
                        wakeUpWaitingDownloads();
                        notifyNetworkStateToJs(true);
                    }

                    @Override
                    public void onLost(Network network) {
                        isNetworkAvailable.set(false);
                        // Immediately close dead sockets so workers flush RAM buffers to disk and wait cleanly
                        abortAllActiveConnections();
                        wakeUpWaitingDownloads();
                        notifyNetworkStateToJs(false);
                    }
                });
            }
        } catch (Exception ignored) {}
    }

    private boolean isCurrentlyOnline() {
        if (!isSimulatedOnline.get()) return false;
        try {
            ConnectivityManager cm = (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
            if (cm == null) return true;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                Network net = cm.getActiveNetwork();
                if (net == null) return false;
                NetworkCapabilities caps = cm.getNetworkCapabilities(net);
                return caps != null && caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET);
            }
        } catch (Exception ignored) {}
        return isNetworkAvailable.get();
    }

    private void notifyNetworkStateToJs(final boolean online) {
        if (getBridge() == null || getBridge().getWebView() == null) return;
        final WebView webView = getBridge().getWebView();
        webView.post(() -> webView.evaluateJavascript(
            "if (window.__onNativeNetworkStateChanged) { window.__onNativeNetworkStateChanged(" + online + "); }",
            null
        ));
    }

    private void autoPromptStoragePermissionOnLaunch() {
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
                if (checkSelfPermission("android.permission.READ_MEDIA_VIDEO") != PackageManager.PERMISSION_GRANTED) {
                    needed.add("android.permission.READ_MEDIA_VIDEO");
                }
                if (checkSelfPermission("android.permission.READ_MEDIA_AUDIO") != PackageManager.PERMISSION_GRANTED) {
                    needed.add("android.permission.READ_MEDIA_AUDIO");
                }
                if (checkSelfPermission("android.permission.READ_MEDIA_IMAGES") != PackageManager.PERMISSION_GRANTED) {
                    needed.add("android.permission.READ_MEDIA_IMAGES");
                }
            }
            if (!needed.isEmpty()) {
                requestPermissions(needed.toArray(new String[0]), 1001);
            }
        }

        // On Android 11+ (API 30+), automatically show a friendly prompt on first launch if All Files Access is not yet enabled
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R && !Environment.isExternalStorageManager() && !promptedStorageThisSession) {
            promptedStorageThisSession = true;
            runOnUiThread(() -> {
                try {
                    new AlertDialog.Builder(MainActivity.this)
                        .setTitle("স্টোরেজ পারমিশন প্রয়োজন (Storage Permission)")
                        .setMessage("ফোনের Internal Storage (Download ফোল্ডার)-এ হাই-স্পিডে সকল ফাইল ডাউনলোড ও সেভ করার জন্য 'Allow access to manage all files' পারমিশনটি চালু করে দিন।")
                        .setCancelable(true)
                        .setPositiveButton("পারমিশন চালু করুন (Allow)", (dialog, which) -> openAllFilesAccessSettings())
                        .setNegativeButton("পরে", (dialog, which) -> dialog.dismiss())
                        .show();
                } catch (Exception ignored) {}
            });
        }
    }

    private void openAllFilesAccessSettings() {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                try {
                    Intent intent = new Intent(Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION);
                    intent.setData(Uri.parse("package:" + getPackageName()));
                    startActivity(intent);
                    return;
                } catch (Exception e) {
                    Intent intent = new Intent(Settings.ACTION_MANAGE_ALL_FILES_ACCESS_PERMISSION);
                    startActivity(intent);
                    return;
                }
            } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                requestPermissions(
                    new String[]{
                        Manifest.permission.WRITE_EXTERNAL_STORAGE,
                        Manifest.permission.READ_EXTERNAL_STORAGE
                    },
                    1002
                );
                return;
            }
        } catch (Exception ignored) {}

        try {
            Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
            intent.setData(Uri.parse("package:" + getPackageName()));
            startActivity(intent);
        } catch (Exception ignored) {}
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
        public String getClipboardText() {
            final String[] result = new String[]{ cachedClipboardText };
            try {
                String direct = refreshClipboardCache();
                if (direct != null && !direct.isEmpty()) {
                    return direct;
                }
                runOnUiThread(() -> {
                    result[0] = refreshClipboardCache();
                });
            } catch (Exception ignored) {}
            return result[0] != null ? result[0] : "";
        }

        @JavascriptInterface
        public boolean hasStoragePermission() {
            return checkHasStoragePermissionInternal();
        }

        @JavascriptInterface
        public void requestStoragePermission() {
            openAllFilesAccessSettings();
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
        public void setSimulatedNetworkState(boolean online) {
            isSimulatedOnline.set(online);
            if (!online) {
                abortAllActiveConnections();
            }
            wakeUpWaitingDownloads();
        }

        @JavascriptInterface
        public void pauseDownload(String taskId) {
            AtomicBoolean flag = pausedTasks.get(taskId);
            if (flag != null) {
                flag.set(true);
            }
            abortTaskConnections(taskId);
            wakeUpWaitingDownloads();
        }

        @JavascriptInterface
        public void resumeDownload(String taskId) {
            AtomicBoolean flag = pausedTasks.get(taskId);
            if (flag != null) {
                flag.set(false);
            }
            wakeUpWaitingDownloads();
        }

        @JavascriptInterface
        public void cancelDownload(String taskId) {
            AtomicBoolean flag = cancelledTasks.get(taskId);
            if (flag != null) {
                flag.set(true);
            }
            abortTaskConnections(taskId);
            wakeUpWaitingDownloads();
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
            activeTaskConnections.put(taskId, Collections.newSetFromMap(new ConcurrentHashMap<>()));

            downloadPool.submit(() -> {
                final AtomicInteger retryCounter = new AtomicInteger(0);
                String finalUrl = urlStr;
                long totalBytes = -1;
                boolean supportsRanges = false;
                String contentDisposition = null;
                String contentType = null;

                // 1. Resilient Probe Loop with manual redirect preservation
                while (!cancelledTasks.get(taskId).get()) {
                    while (pausedTasks.get(taskId).get() && !cancelledTasks.get(taskId).get()) {
                        synchronized (stateLock) {
                            try { stateLock.wait(250); } catch (InterruptedException ignored) {}
                        }
                    }
                    if (cancelledTasks.get(taskId).get()) return;

                    if (!isCurrentlyOnline()) {
                        emitProgress(taskId, requestedName, 0, 0, 0.0, new long[]{0}, new long[]{1}, "waiting_network", "", "", retryCounter.incrementAndGet());
                        synchronized (stateLock) {
                            try { stateLock.wait(900); } catch (InterruptedException ignored) {}
                        }
                        continue;
                    }

                    HttpURLConnection probeConn = null;
                    try {
                        probeConn = openRangeConnectionWithRedirects(urlStr, urlStr, "bytes=0-0");
                        registerActiveConnection(taskId, probeConn);

                        int status = probeConn.getResponseCode();
                        finalUrl = probeConn.getURL().toString();
                        String contentRange = probeConn.getHeaderField("Content-Range");
                        String acceptRanges = probeConn.getHeaderField("Accept-Ranges");
                        contentDisposition = probeConn.getHeaderField("Content-Disposition");
                        contentType = probeConn.getContentType();

                        supportsRanges = (status == 206) || (acceptRanges != null && acceptRanges.toLowerCase().contains("bytes"));

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
                        break; // Probe succeeded!
                    } catch (Exception probeEx) {
                        emitProgress(taskId, requestedName, 0, 0, 0.0, new long[]{0}, new long[]{1}, "waiting_network", "", "", retryCounter.incrementAndGet());
                        synchronized (stateLock) {
                            try { stateLock.wait(1000); } catch (InterruptedException ignored) {}
                        }
                    } finally {
                        unregisterActiveConnection(taskId, probeConn);
                        if (probeConn != null) probeConn.disconnect();
                    }
                }

                if (cancelledTasks.get(taskId).get()) return;

                try {
                    int threads = Math.max(1, Math.min(32, threadCount));
                    String guessedName = URLUtil.guessFileName(finalUrl, contentDisposition, contentType);
                    String safeName = buildShortSafeFileName(requestedName, guessedName, contentType);

                    File downloadDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
                    if (!downloadDir.exists()) {
                        downloadDir.mkdirs();
                    }
                    File outFile = createUniqueOutputFile(downloadDir, safeName);

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
                    final String resolvedUrl = finalUrl;
                    final AtomicLong downloadedBytes = new AtomicLong(0);
                    final long finalTotalBytes = totalBytes;
                    final int activeThreads = (supportsRanges && totalBytes > 128 * 1024) ? threads : 1;
                    final long[] chunkDone = new long[activeThreads];
                    final long[] chunkSize = new long[activeThreads];
                    final AtomicBoolean anyWorkerWaitingNetwork = new AtomicBoolean(false);

                    long lastTickMs = System.currentTimeMillis();
                    long lastTickBytes = 0;
                    double rollingSpeedMBps = 0.0;

                    if (activeThreads > 1) {
                        long partSize = totalBytes / activeThreads;
                        Future<?>[] futures = new Future<?>[activeThreads];

                        for (int i = 0; i < activeThreads; i++) {
                            final int idx = i;
                            final long startByte = i * partSize;
                            final long endByte = (i == activeThreads - 1) ? (totalBytes - 1) : ((i + 1) * partSize - 1);
                            chunkSize[idx] = endByte - startByte + 1;

                            futures[i] = downloadPool.submit(() -> {
                                final int FLUSH_THRESHOLD = 512 * 1024;
                                byte[] ramWriteBuffer = new byte[FLUSH_THRESHOLD + 131072];
                                byte[] netReadBuffer = new byte[128 * 1024];

                                while (chunkDone[idx] < chunkSize[idx] && !cancelledTasks.get(taskId).get()) {
                                    while (pausedTasks.get(taskId).get() && !cancelledTasks.get(taskId).get()) {
                                        synchronized (stateLock) {
                                            try { stateLock.wait(200); } catch (InterruptedException ignored) {}
                                        }
                                    }
                                    if (cancelledTasks.get(taskId).get()) return;

                                    if (!isCurrentlyOnline()) {
                                        anyWorkerWaitingNetwork.set(true);
                                        retryCounter.incrementAndGet();
                                        synchronized (stateLock) {
                                            try { stateLock.wait(800); } catch (InterruptedException ignored) {}
                                        }
                                        continue;
                                    }

                                    HttpURLConnection partConn = null;
                                    int bufferedCount = 0;
                                    long writeStartOffset = startByte + chunkDone[idx];

                                    try (RandomAccessFile partFile = new RandomAccessFile(targetFile, "rw")) {
                                        // Resume from the exact byte offset where this thread stopped!
                                        long currentOffset = startByte + chunkDone[idx];
                                        writeStartOffset = currentOffset;

                                        partConn = openRangeConnectionWithRedirects(
                                            resolvedUrl,
                                            urlStr,
                                            "bytes=" + currentOffset + "-" + endByte
                                        );
                                        registerActiveConnection(taskId, partConn);

                                        int code = partConn.getResponseCode();
                                        if (code != 206 && code != 200) {
                                            throw new Exception("HTTP " + code);
                                        }

                                        // If server ignored Range header and sent 200 from byte 0, skip up to currentOffset instead of resetting!
                                        long bytesToSkipFromStream = (code == 200) ? currentOffset : 0;

                                        anyWorkerWaitingNetwork.set(false);

                                        try (InputStream is = new BufferedInputStream(partConn.getInputStream(), 256 * 1024)) {
                                            int read;
                                            while ((read = is.read(netReadBuffer)) != -1) {
                                                if (cancelledTasks.get(taskId).get()) return;
                                                if (read <= 0) continue;

                                                int sliceOffset = 0;
                                                int sliceLen = read;
                                                if (bytesToSkipFromStream > 0) {
                                                    if (read <= bytesToSkipFromStream) {
                                                        bytesToSkipFromStream -= read;
                                                        continue;
                                                    }
                                                    sliceOffset = (int) bytesToSkipFromStream;
                                                    sliceLen = read - sliceOffset;
                                                    bytesToSkipFromStream = 0;
                                                }

                                                long remainingNeeded = chunkSize[idx] - (chunkDone[idx] + bufferedCount);
                                                int bytesToTake = (int) Math.min((long) sliceLen, remainingNeeded);
                                                if (bytesToTake <= 0) break;

                                                System.arraycopy(netReadBuffer, sliceOffset, ramWriteBuffer, bufferedCount, bytesToTake);
                                                bufferedCount += bytesToTake;

                                                // Flush to disk in 512 KB blocks or when pausing/finishing/disconnecting
                                                if (
                                                    bufferedCount >= FLUSH_THRESHOLD ||
                                                    pausedTasks.get(taskId).get() ||
                                                    !isCurrentlyOnline() ||
                                                    (chunkDone[idx] + bufferedCount) >= chunkSize[idx]
                                                ) {
                                                    partFile.seek(writeStartOffset);
                                                    partFile.write(ramWriteBuffer, 0, bufferedCount);
                                                    writeStartOffset += bufferedCount;
                                                    chunkDone[idx] += bufferedCount;
                                                    downloadedBytes.addAndGet(bufferedCount);
                                                    bufferedCount = 0;
                                                }

                                                if (pausedTasks.get(taskId).get() || !isCurrentlyOnline() || chunkDone[idx] >= chunkSize[idx]) {
                                                    break;
                                                }
                                            }
                                        } finally {
                                            // CRITICAL: Always flush any remaining bytes in ramWriteBuffer to disk even if is.read() threw IOException on network disconnect!
                                            if (bufferedCount > 0 && !cancelledTasks.get(taskId).get()) {
                                                partFile.seek(writeStartOffset);
                                                partFile.write(ramWriteBuffer, 0, bufferedCount);
                                                writeStartOffset += bufferedCount;
                                                chunkDone[idx] += bufferedCount;
                                                downloadedBytes.addAndGet(bufferedCount);
                                                bufferedCount = 0;
                                            }
                                        }
                                    } catch (Exception retryEx) {
                                        anyWorkerWaitingNetwork.set(true);
                                        retryCounter.incrementAndGet();
                                        synchronized (stateLock) {
                                            try { stateLock.wait(800); } catch (InterruptedException ignored) {}
                                        }
                                    } finally {
                                        unregisterActiveConnection(taskId, partConn);
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

                            long now = System.currentTimeMillis();
                            long currBytes = downloadedBytes.get();
                            long dt = now - lastTickMs;
                            if (dt >= 200) {
                                double instantMBps = ((currBytes - lastTickBytes) / (1024.0 * 1024.0)) / (dt / 1000.0);
                                if (pausedTasks.get(taskId).get() || !isCurrentlyOnline()) {
                                    rollingSpeedMBps = 0.0;
                                } else if (instantMBps > 0) {
                                    rollingSpeedMBps = rollingSpeedMBps > 0
                                        ? (instantMBps * 0.7 + rollingSpeedMBps * 0.3)
                                        : instantMBps;
                                }
                                lastTickMs = now;
                                lastTickBytes = currBytes;
                            }

                            String currentStatus = "downloading";
                            if (pausedTasks.get(taskId).get()) {
                                currentStatus = "paused";
                            } else if (!isCurrentlyOnline() || (anyWorkerWaitingNetwork.get() && rollingSpeedMBps < 0.05)) {
                                currentStatus = "waiting_network";
                            }

                            emitProgress(taskId, targetFile.getName(), currBytes, finalTotalBytes, rollingSpeedMBps, chunkDone, chunkSize, currentStatus, targetFile.getAbsolutePath(), "", retryCounter.get());
                            try { Thread.sleep(200); } catch (InterruptedException ignored) {}
                        }
                    } else {
                        // Single-stream resilient range-resume fallback (NEVER resets downloadedBytes to 0!)
                        byte[] netReadBuffer = new byte[128 * 1024];
                        while (!cancelledTasks.get(taskId).get()) {
                            while (pausedTasks.get(taskId).get() && !cancelledTasks.get(taskId).get()) {
                                emitProgress(taskId, targetFile.getName(), downloadedBytes.get(), finalTotalBytes > 0 ? finalTotalBytes : downloadedBytes.get(), 0.0, chunkDone, chunkSize, "paused", targetFile.getAbsolutePath(), "", retryCounter.get());
                                synchronized (stateLock) {
                                    try { stateLock.wait(200); } catch (InterruptedException ignored) {}
                                }
                            }
                            if (cancelledTasks.get(taskId).get()) return;

                            if (!isCurrentlyOnline()) {
                                emitProgress(taskId, targetFile.getName(), downloadedBytes.get(), finalTotalBytes > 0 ? finalTotalBytes : downloadedBytes.get(), 0.0, chunkDone, chunkSize, "waiting_network", targetFile.getAbsolutePath(), "", retryCounter.incrementAndGet());
                                synchronized (stateLock) {
                                    try { stateLock.wait(800); } catch (InterruptedException ignored) {}
                                }
                                continue;
                            }

                            HttpURLConnection conn = null;
                            try (RandomAccessFile raf = new RandomAccessFile(targetFile, "rw")) {
                                long currentOffset = downloadedBytes.get();
                                String rangeReq = currentOffset > 0 ? ("bytes=" + currentOffset + "-") : null;
                                conn = openRangeConnectionWithRedirects(resolvedUrl, urlStr, rangeReq);
                                registerActiveConnection(taskId, conn);

                                int respCode = conn.getResponseCode();
                                // If server ignored Range and returned 200 OK from byte 0, fast-forward/skip currentOffset bytes instead of resetting to 0!
                                long bytesToSkip = (respCode == 200 && currentOffset > 0) ? currentOffset : 0;
                                raf.seek(currentOffset);

                                try (InputStream is = new BufferedInputStream(conn.getInputStream(), 256 * 1024)) {
                                    int read;
                                    while ((read = is.read(netReadBuffer)) != -1) {
                                        if (cancelledTasks.get(taskId).get()) return;
                                        if (read <= 0) continue;

                                        int offset = 0;
                                        int len = read;
                                        if (bytesToSkip > 0) {
                                            if (read <= bytesToSkip) {
                                                bytesToSkip -= read;
                                                continue;
                                            }
                                            offset = (int) bytesToSkip;
                                            len = read - offset;
                                            bytesToSkip = 0;
                                        }

                                        raf.write(netReadBuffer, offset, len);
                                        long curr = downloadedBytes.addAndGet(len);
                                        chunkDone[0] = curr;
                                        chunkSize[0] = finalTotalBytes > 0 ? finalTotalBytes : curr;

                                        long now = System.currentTimeMillis();
                                        long dt = now - lastTickMs;
                                        if (dt >= 200) {
                                            double instantMBps = ((curr - lastTickBytes) / (1024.0 * 1024.0)) / (dt / 1000.0);
                                            rollingSpeedMBps = rollingSpeedMBps > 0
                                                ? (instantMBps * 0.7 + rollingSpeedMBps * 0.3)
                                                : instantMBps;
                                            lastTickMs = now;
                                            lastTickBytes = curr;
                                            emitProgress(taskId, targetFile.getName(), curr, finalTotalBytes > 0 ? finalTotalBytes : curr, rollingSpeedMBps, chunkDone, chunkSize, "downloading", targetFile.getAbsolutePath(), "", retryCounter.get());
                                        }

                                        if (pausedTasks.get(taskId).get() || !isCurrentlyOnline()) {
                                            break;
                                        }
                                    }
                                }

                                if (
                                    !pausedTasks.get(taskId).get() &&
                                    isCurrentlyOnline() &&
                                    ((finalTotalBytes > 0 && downloadedBytes.get() >= finalTotalBytes) ||
                                     (finalTotalBytes <= 0 && downloadedBytes.get() > 0))
                                ) {
                                    break;
                                }
                            } catch (Exception e) {
                                emitProgress(taskId, targetFile.getName(), downloadedBytes.get(), finalTotalBytes > 0 ? finalTotalBytes : downloadedBytes.get(), 0.0, chunkDone, chunkSize, "waiting_network", targetFile.getAbsolutePath(), "", retryCounter.incrementAndGet());
                                synchronized (stateLock) {
                                    try { stateLock.wait(900); } catch (InterruptedException ignored) {}
                                }
                            } finally {
                                unregisterActiveConnection(taskId, conn);
                                if (conn != null) conn.disconnect();
                            }
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
                        emitProgress(taskId, targetFile.getName(), finalBytes, finalTotalBytes > 0 ? finalTotalBytes : finalBytes, rollingSpeedMBps, chunkDone, chunkSize, "completed", targetFile.getAbsolutePath(), "", retryCounter.get());
                    }
                } catch (Exception e) {
                    emitProgress(taskId, "", 0, 0, 0.0, new long[]{0}, new long[]{1}, "error", "", e.getMessage() != null ? e.getMessage() : "Download error", retryCounter.get());
                } finally {
                    activeTaskConnections.remove(taskId);
                }
            });
        }

        private void emitProgress(String taskId, String resolvedName, long dlBytes, long totalBytes, double speedMBps, long[] chunkDone, long[] chunkSize, String status, String savedPath, String error, int retryCount) {
            if (getBridge() == null || getBridge().getWebView() == null) return;
            final WebView webView = getBridge().getWebView();

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
                payload.put("retryCount", retryCount);

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
  console.log('Successfully generated high-speed 512KB-buffered multi-thread downloader, pause/resume, auto-reconnect & launch permission manager in MainActivity.java');
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
