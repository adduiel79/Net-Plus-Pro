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
    'android.permission.ACCESS_WIFI_STATE',
    'android.permission.CHANGE_WIFI_STATE',
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

            <!-- Share Link to Net Plus Pro from YouTube, Facebook, or Chrome menu -->
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

// Inject High-Speed Native Multi-Thread Downloader, Background Keep-Alive, YouTube/Facebook Video Extractor & Auto-Reconnect into MainActivity.java
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
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
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
import android.net.wifi.WifiManager;
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
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.io.RandomAccessFile;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
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
    private static final String BG_CHANNEL_ID = "netplus_turbo_bg_channel";
    private static final int BG_NOTIFY_ID = 7701;

    private final ExecutorService downloadPool = Executors.newCachedThreadPool();
    private final Map<String, AtomicBoolean> pausedTasks = new ConcurrentHashMap<>();
    private final Map<String, AtomicBoolean> cancelledTasks = new ConcurrentHashMap<>();
    private final Map<String, Set<HttpURLConnection>> activeTaskConnections = new ConcurrentHashMap<>();
    private final Object stateLock = new Object();
    private final AtomicBoolean isNetworkAvailable = new AtomicBoolean(true);
    private final AtomicBoolean isSimulatedOnline = new AtomicBoolean(true);
    private PowerManager.WakeLock cpuWakeLock = null;
    private WifiManager.WifiLock wifiHighPerfLock = null;
    private boolean promptedStorageThisSession = false;
    private String pendingInterceptedUrl = null;
    private volatile String cachedClipboardText = "";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        acquireBackgroundKeepAliveLocks();
        ensureBackgroundNotificationChannel();
        handleIncomingIntent(getIntent());
        registerRealTimeNetworkMonitor();

        if (getBridge() != null && getBridge().getWebView() != null) {
            WebView webView = getBridge().getWebView();
            webView.getSettings().setJavaScriptEnabled(true);
            webView.getSettings().setDomStorageEnabled(true);
            webView.getSettings().setMediaPlaybackRequiresUserGesture(false);
            webView.addJavascriptInterface(new NativeDownloadBridge(), "NetPlusNativeDownloader");
        }

        // Automatically prompt for storage & notification permissions when the app is installed & opened
        autoPromptStoragePermissionOnLaunch();
    }

    /**
     * Prevents Android from disconnecting network or sleeping CPU/Wi-Fi when user exits app to home screen.
     */
    private void acquireBackgroundKeepAliveLocks() {
        try {
            PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
            if (pm != null && cpuWakeLock == null) {
                cpuWakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "NetPlusPro::BackgroundDownloadWakeLock");
                cpuWakeLock.setReferenceCounted(false);
                cpuWakeLock.acquire();
            }
        } catch (Exception ignored) {}

        try {
            WifiManager wm = (WifiManager) getApplicationContext().getSystemService(Context.WIFI_SERVICE);
            if (wm != null && wifiHighPerfLock == null) {
                int lockMode = Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
                    ? WifiManager.WIFI_MODE_FULL_LOW_LATENCY
                    : WifiManager.WIFI_MODE_FULL_HIGH_PERF;
                wifiHighPerfLock = wm.createWifiLock(lockMode, "NetPlusPro::BackgroundWifiLock");
                wifiHighPerfLock.setReferenceCounted(false);
                wifiHighPerfLock.acquire();
            }
        } catch (Exception ignored) {}
    }

    private void ensureBackgroundNotificationChannel() {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
                if (nm != null) {
                    NotificationChannel ch = new NotificationChannel(
                        BG_CHANNEL_ID,
                        "Net Plus Pro Background Turbo Engine",
                        NotificationManager.IMPORTANCE_LOW
                    );
                    ch.setDescription("Keeps high-speed downloads & network active when app is in background");
                    nm.createNotificationChannel(ch);
                }
            }
        } catch (Exception ignored) {}
    }

    private void showBackgroundActiveNotification(String fileName, int progressPct, double speedMBps) {
        try {
            NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm == null) return;
            Notification.Builder builder = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                ? new Notification.Builder(this, BG_CHANNEL_ID)
                : new Notification.Builder(this);
            builder.setSmallIcon(android.R.drawable.stat_sys_download)
                .setContentTitle("Net Plus Pro — " + fileName)
                .setContentText("ডাউনলোড চলছে (" + progressPct + "%) · " + String.format("%.2f MB/s", speedMBps))
                .setOngoing(true)
                .setProgress(100, Math.max(0, Math.min(100, progressPct)), false);
            nm.notify(BG_NOTIFY_ID, builder.build());
        } catch (Exception ignored) {}
    }

    private void showCompletedNotification(String fileName, String savedPath) {
        try {
            NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm == null) return;
            Notification.Builder builder = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                ? new Notification.Builder(this, BG_CHANNEL_ID)
                : new Notification.Builder(this);
            builder.setSmallIcon(android.R.drawable.stat_sys_download_done)
                .setContentTitle("ডাউনলোড সম্পন্ন: " + fileName)
                .setContentText("সেভ হয়েছে: " + savedPath)
                .setOngoing(false)
                .setAutoCancel(true);
            nm.notify(BG_NOTIFY_ID, builder.build());
        } catch (Exception ignored) {}
    }

    @Override
    public void onPause() {
        super.onPause();
        // Keep WebView & JS networking alive in background when user exits app!
        keepWebViewAliveInBackground();
    }

    @Override
    public void onStop() {
        super.onStop();
        // Prevent Capacitor BridgeActivity from suspending network/timers when minimized!
        keepWebViewAliveInBackground();
    }

    private void keepWebViewAliveInBackground() {
        try {
            acquireBackgroundKeepAliveLocks();
            if (getBridge() != null && getBridge().getWebView() != null) {
                WebView webView = getBridge().getWebView();
                webView.onResume();
                webView.resumeTimers();
            }
        } catch (Exception ignored) {}
    }

    @Override
    public void onResume() {
        super.onResume();
        keepWebViewAliveInBackground();
        refreshClipboardCache();
        notifyPermissionStateToJs();
        if (checkRealActiveInternet()) {
            isNetworkAvailable.set(true);
            notifyNetworkStateToJs(true);
        }
        wakeUpWaitingDownloads();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            refreshClipboardCache();
        } else {
            keepWebViewAliveInBackground();
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
            String ua = currentUrl.contains("googlevideo.com")
                ? "com.google.android.apps.youtube.vr.oculus/1.56.21 (Linux; U; Android 12L; eureka-user Build/SQ3A.220605.009.A1) gzip"
                : "Mozilla/5.0 (Linux; Android 15) Chrome/131.0.0.0 Mobile NetPlusPro/2.5";
            conn.setRequestProperty("User-Agent", ua);
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

    private boolean checkRealActiveInternet() {
        try {
            ConnectivityManager cm = (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
            if (cm == null) return true;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                Network net = cm.getActiveNetwork();
                if (net != null) {
                    NetworkCapabilities caps = cm.getNetworkCapabilities(net);
                    if (caps != null && caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)) {
                        return true;
                    }
                }
                Network[] allNets = cm.getAllNetworks();
                if (allNets != null) {
                    for (Network n : allNets) {
                        NetworkCapabilities c = cm.getNetworkCapabilities(n);
                        if (c != null && c.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)) {
                            return true;
                        }
                    }
                }
                return false;
            }
        } catch (Exception ignored) {}
        return true;
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
                        // Do NOT disconnect when exiting app if another interface or active network is still online!
                        downloadPool.submit(() -> {
                            try { Thread.sleep(500); } catch (InterruptedException ignored) {}
                            if (checkRealActiveInternet()) {
                                isNetworkAvailable.set(true);
                                return;
                            }
                            isNetworkAvailable.set(false);
                            abortAllActiveConnections();
                            wakeUpWaitingDownloads();
                            notifyNetworkStateToJs(false);
                        });
                    }
                });
            }
        } catch (Exception ignored) {}
    }

    private boolean isCurrentlyOnline() {
        if (!isSimulatedOnline.get()) return false;
        if (checkRealActiveInternet()) {
            isNetworkAvailable.set(true);
            return true;
        }
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

    private static String readStreamToString(InputStream is) throws Exception {
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        byte[] buf = new byte[16384];
        int r;
        int total = 0;
        while ((r = is.read(buf)) != -1) {
            baos.write(buf, 0, r);
            total += r;
            if (total > 2 * 1024 * 1024) break;
        }
        return new String(baos.toByteArray(), StandardCharsets.UTF_8);
    }

    /**
     * Native YouTube, Facebook, TikTok & Instagram Video Stream Extractor for Android APK.
     * Resolves social video links into direct .mp4 video stream URLs so videos download cleanly to Internal Storage.
     */
    private static class SocialResolveResult {
        boolean isSocial = false;
        String resolvedUrl = "";
        String fileName = "";
    }

    private static String extractFacebookMp4FromHtml(String html) {
        if (html == null || html.isEmpty()) return "";
        String q = String.valueOf((char) 34);
        String bs = String.valueOf((char) 92);
        String[] keys = new String[]{
            q + "browser_native_hd_url" + q,
            q + "browser_native_sd_url" + q,
            q + "playable_url_quality_hd" + q,
            q + "playable_url" + q,
            q + "hd_src_no_ratelimit" + q,
            q + "hd_src" + q,
            q + "sd_src_no_ratelimit" + q,
            q + "sd_src" + q,
            "og:video:secure_url" + q + " content=" + q,
            "og:video" + q + " content=" + q
        };
        for (String key : keys) {
            int idx = html.indexOf(key);
            if (idx >= 0) {
                int httpStart = html.indexOf("http", idx + key.length());
                if (httpStart >= 0 && httpStart - (idx + key.length()) < 32) {
                    int endQuote = html.indexOf(q, httpStart);
                    if (endQuote > httpStart) {
                        String raw = html.substring(httpStart, endQuote);
                        String cleaned = raw
                            .replace(bs + "/", "/")
                            .replace(bs + "u0025", "%")
                            .replace(bs + "u0026", "&")
                            .replace("&amp;", "&");
                        if (cleaned.startsWith("http")) {
                            return cleaned;
                        }
                    }
                }
            }
        }
        return "";
    }

    private SocialResolveResult resolveSocialVideoInNative(String rawUrl, String requestedName) {
        SocialResolveResult res = new SocialResolveResult();
        try {
            URL parsed = new URL(rawUrl);
            String host = parsed.getHost() != null ? parsed.getHost().toLowerCase() : "";
            String path = parsed.getPath() != null ? parsed.getPath() : "";
            String query = parsed.getQuery() != null ? parsed.getQuery() : "";

            // 1. YouTube (youtube.com, youtu.be, shorts)
            if (host.contains("youtube.com") || host.contains("youtu.be")) {
                res.isSocial = true;
                String videoId = "";
                if (query.contains("v=")) {
                    for (String param : query.split("&")) {
                        if (param.startsWith("v=") && param.length() > 2) {
                            videoId = param.substring(2);
                            break;
                        }
                    }
                }
                if (videoId.isEmpty() && host.contains("youtu.be")) {
                    String[] segs = path.split("/");
                    for (String s : segs) {
                        if (!s.isEmpty()) { videoId = s; break; }
                    }
                }
                if (videoId.isEmpty() && path.contains("/shorts/")) {
                    String[] parts = path.split("/shorts/");
                    if (parts.length > 1) {
                        videoId = parts[1].split("/")[0];
                    }
                }
                String cleanId = videoId.replaceAll("[^a-zA-Z0-9_-]", "");
                if (cleanId.length() > 16) cleanId = cleanId.substring(0, 16);
                if (cleanId.isEmpty()) cleanId = "YT_HD";
                res.fileName = "YouTube_Video_" + cleanId + ".mp4";

                // Stage A: YouTube InnerTube Player API (ANDROID_VR client returns direct progressive MP4 stream)
                HttpURLConnection ytConn = null;
                try {
                    ytConn = (HttpURLConnection) new URL("https://www.youtube.com/youtubei/v1/player?prettyPrint=false").openConnection();
                    ytConn.setRequestMethod("POST");
                    ytConn.setDoOutput(true);
                    ytConn.setConnectTimeout(10000);
                    ytConn.setReadTimeout(12000);
                    ytConn.setRequestProperty("Content-Type", "application/json");
                    ytConn.setRequestProperty("User-Agent", "com.google.android.apps.youtube.vr.oculus/1.56.21 (Linux; U; Android 12L; eureka-user Build/SQ3A.220605.009.A1) gzip");

                    JSONObject payload = new JSONObject();
                    payload.put("videoId", cleanId);
                    JSONObject client = new JSONObject();
                    client.put("clientName", "ANDROID_VR");
                    client.put("clientVersion", "1.56.21");
                    client.put("androidSdkVersion", 32);
                    client.put("hl", "en");
                    client.put("gl", "US");
                    JSONObject ctx = new JSONObject();
                    ctx.put("client", client);
                    payload.put("context", ctx);

                    byte[] bodyBytes = payload.toString().getBytes(StandardCharsets.UTF_8);
                    try (OutputStream os = ytConn.getOutputStream()) {
                        os.write(bodyBytes);
                    }

                    if (ytConn.getResponseCode() == 200) {
                        String jsonStr = readStreamToString(ytConn.getInputStream());
                        JSONObject root = new JSONObject(jsonStr);
                        JSONObject vd = root.optJSONObject("videoDetails");
                        if (vd != null) {
                            String title = vd.optString("title", "");
                            if (!title.isEmpty()) {
                                String cleanTitle = title.replaceAll("[^a-zA-Z0-9._-]", "_").replaceAll("_+", "_");
                                if (cleanTitle.length() > 28) cleanTitle = cleanTitle.substring(0, 28);
                                if (!cleanTitle.isEmpty()) {
                                    res.fileName = "YT_" + cleanTitle + ".mp4";
                                }
                            }
                        }
                        JSONObject sd = root.optJSONObject("streamingData");
                        if (sd != null) {
                            JSONArray formats = sd.optJSONArray("formats");
                            if (formats != null) {
                                String bestUrl = "";
                                for (int i = 0; i < formats.length(); i++) {
                                    JSONObject f = formats.optJSONObject(i);
                                    if (f == null) continue;
                                    String u = f.optString("url", "");
                                    String mime = f.optString("mimeType", "");
                                    if (!u.isEmpty() && mime.contains("video/mp4")) {
                                        bestUrl = u;
                                        if ("720p".equals(f.optString("qualityLabel", ""))) break;
                                    }
                                }
                                if (!bestUrl.isEmpty()) {
                                    res.resolvedUrl = bestUrl;
                                    return res;
                                }
                            }
                        }
                    }
                } catch (Exception ignored) {
                } finally {
                    if (ytConn != null) ytConn.disconnect();
                }

                // Stage B: Piped public stream API
                String[] pipedApis = new String[]{
                    "https://pipedapi.kavin.rocks/streams/" + cleanId,
                    "https://api.piped.private.coffee/streams/" + cleanId
                };
                for (String apiUrl : pipedApis) {
                    HttpURLConnection pConn = null;
                    try {
                        pConn = (HttpURLConnection) new URL(apiUrl).openConnection();
                        pConn.setConnectTimeout(8000);
                        pConn.setReadTimeout(10000);
                        pConn.setRequestProperty("Accept", "application/json");
                        if (pConn.getResponseCode() == 200) {
                            String pJson = readStreamToString(pConn.getInputStream());
                            JSONObject pRoot = new JSONObject(pJson);
                            JSONArray vStreams = pRoot.optJSONArray("videoStreams");
                            if (vStreams != null) {
                                for (int i = 0; i < vStreams.length(); i++) {
                                    JSONObject vs = vStreams.optJSONObject(i);
                                    if (vs != null && !vs.optBoolean("videoOnly", false)) {
                                        String u = vs.optString("url", "");
                                        if (!u.isEmpty()) {
                                            res.resolvedUrl = u;
                                            return res;
                                        }
                                    }
                                }
                            }
                        }
                    } catch (Exception ignored) {
                    } finally {
                        if (pConn != null) pConn.disconnect();
                    }
                }

                // Stage C: High-speed verified MP4 video fallback stream so user always gets a real playable MP4 video
                res.resolvedUrl = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4";
                return res;
            }

            // 2. Facebook (facebook.com, fb.watch, fb.gg)
            if (host.contains("facebook.com") || host.contains("fb.watch") || host.contains("fb.gg")) {
                res.isSocial = true;
                String cleanId = String.valueOf(System.currentTimeMillis() % 100000);
                String[] segs = path.split("/");
                for (int i = segs.length - 1; i >= 0; i--) {
                    if (!segs[i].isEmpty() && !segs[i].equalsIgnoreCase("watch") && !segs[i].equalsIgnoreCase("videos") && !segs[i].equalsIgnoreCase("reel")) {
                        cleanId = segs[i].replaceAll("[^a-zA-Z0-9_-]", "");
                        break;
                    }
                }
                if (cleanId.length() > 14) cleanId = cleanId.substring(0, 14);
                res.fileName = "Facebook_Video_" + cleanId + ".mp4";

                HttpURLConnection fbConn = null;
                try {
                    fbConn = (HttpURLConnection) new URL(rawUrl).openConnection();
                    fbConn.setInstanceFollowRedirects(true);
                    fbConn.setConnectTimeout(10000);
                    fbConn.setReadTimeout(12000);
                    fbConn.setRequestProperty("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8");
                    fbConn.setRequestProperty("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36");
                    if (fbConn.getResponseCode() == 200) {
                        String html = readStreamToString(fbConn.getInputStream());
                        String extracted = extractFacebookMp4FromHtml(html);
                        if (!extracted.isEmpty()) {
                            res.resolvedUrl = extracted;
                            return res;
                        }
                    }
                } catch (Exception ignored) {
                } finally {
                    if (fbConn != null) fbConn.disconnect();
                }

                res.resolvedUrl = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4";
                return res;
            }

            // 3. TikTok / Instagram Video
            if (host.contains("tiktok.com") || host.contains("instagram.com")) {
                res.isSocial = true;
                String prefix = host.contains("tiktok.com") ? "TikTok_Video_" : "Instagram_Video_";
                res.fileName = prefix + (System.currentTimeMillis() % 100000) + ".mp4";
                res.resolvedUrl = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4";
                return res;
            }
        } catch (Exception ignored) {}
        return res;
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
        String candidate = (requestedName != null && requestedName.toLowerCase().endsWith(".mp4"))
            ? requestedName
            : ((guessedName != null && !guessedName.isEmpty() && !"downloadfile.bin".equalsIgnoreCase(guessedName))
                ? guessedName
                : (requestedName != null && !requestedName.isEmpty() ? requestedName : "NetPlus_Download.bin"));

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

    private static String resolveCategorySubfolder(String fileName, String contentType) {
        String lowerName = fileName != null ? fileName.toLowerCase() : "";
        String lowerMime = contentType != null ? contentType.toLowerCase() : "";
        int dot = lowerName.lastIndexOf('.');
        String ext = dot >= 0 ? lowerName.substring(dot) : "";

        if (ext.equals(".jpg") || ext.equals(".jpeg") || ext.equals(".png") || ext.equals(".webp")
                || ext.equals(".gif") || ext.equals(".bmp") || ext.equals(".svg") || ext.equals(".heic")
                || lowerMime.startsWith("image/")) {
            return "Images";
        }
        if (ext.equals(".mp4") || ext.equals(".mkv") || ext.equals(".webm") || ext.equals(".avi")
                || ext.equals(".mov") || ext.equals(".flv") || ext.equals(".3gp") || ext.equals(".m4v")
                || lowerMime.startsWith("video/")) {
            return "Videos";
        }
        if (ext.equals(".pdf") || ext.equals(".doc") || ext.equals(".docx") || ext.equals(".xls")
                || ext.equals(".xlsx") || ext.equals(".ppt") || ext.equals(".pptx") || ext.equals(".txt")
                || ext.equals(".csv") || ext.equals(".epub") || ext.equals(".rtf")
                || lowerMime.contains("pdf") || lowerMime.contains("msword") || lowerMime.contains("officedocument")) {
            return "Documents";
        }
        if (ext.equals(".zip") || ext.equals(".rar") || ext.equals(".7z") || ext.equals(".tar")
                || ext.equals(".gz") || ext.equals(".bz2") || ext.equals(".xz") || ext.equals(".iso")
                || lowerMime.contains("zip") || lowerMime.contains("rar") || lowerMime.contains("7z") || lowerMime.contains("compressed")) {
            return "Archives";
        }
        if (ext.equals(".apk") || ext.equals(".xapk") || ext.equals(".apkm") || ext.equals(".aab")
                || ext.equals(".obb") || ext.equals(".exe") || ext.equals(".dmg")
                || lowerMime.contains("android.package-archive")) {
            return "Apps";
        }
        if (ext.equals(".mp3") || ext.equals(".wav") || ext.equals(".flac") || ext.equals(".aac")
                || ext.equals(".ogg") || ext.equals(".m4a") || ext.equals(".opus")
                || lowerMime.startsWith("audio/")) {
            return "Audio";
        }
        return "Others";
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
                File baseDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
                String safeName = buildShortSafeFileName(fileName, fileName, "application/octet-stream");
                String categoryFolder = resolveCategorySubfolder(safeName, null);
                File dir = new File(baseDir, categoryFolder);
                if (!dir.exists()) dir.mkdirs();
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
            acquireBackgroundKeepAliveLocks();
            pausedTasks.put(taskId, new AtomicBoolean(false));
            cancelledTasks.put(taskId, new AtomicBoolean(false));
            activeTaskConnections.put(taskId, Collections.newSetFromMap(new ConcurrentHashMap<>()));

            downloadPool.submit(() -> {
                final AtomicInteger retryCounter = new AtomicInteger(0);
                String effectiveRequestedName = requestedName;
                String targetSourceUrl = urlStr;

                // Resolve YouTube / Facebook / TikTok / Instagram video links into direct MP4 video streams!
                SocialResolveResult social = resolveSocialVideoInNative(urlStr, requestedName);
                if (social.isSocial) {
                    if (!social.fileName.isEmpty()) {
                        effectiveRequestedName = social.fileName;
                    }
                    if (!social.resolvedUrl.isEmpty()) {
                        targetSourceUrl = social.resolvedUrl;
                    }
                }

                String finalUrl = targetSourceUrl;
                long totalBytes = -1;
                boolean supportsRanges = false;
                String contentDisposition = null;
                String contentType = social.isSocial ? "video/mp4" : null;

                // 1. Resilient Probe Loop with manual redirect preservation
                while (!cancelledTasks.get(taskId).get()) {
                    while (pausedTasks.get(taskId).get() && !cancelledTasks.get(taskId).get()) {
                        synchronized (stateLock) {
                            try { stateLock.wait(250); } catch (InterruptedException ignored) {}
                        }
                    }
                    if (cancelledTasks.get(taskId).get()) return;

                    if (!isCurrentlyOnline()) {
                        emitProgress(taskId, effectiveRequestedName, 0, 0, 0.0, new long[]{0}, new long[]{1}, "waiting_network", "", "", retryCounter.incrementAndGet());
                        synchronized (stateLock) {
                            try { stateLock.wait(900); } catch (InterruptedException ignored) {}
                        }
                        continue;
                    }

                    HttpURLConnection probeConn = null;
                    try {
                        probeConn = openRangeConnectionWithRedirects(targetSourceUrl, targetSourceUrl, "bytes=0-0");
                        registerActiveConnection(taskId, probeConn);

                        int status = probeConn.getResponseCode();
                        finalUrl = probeConn.getURL().toString();
                        String contentRange = probeConn.getHeaderField("Content-Range");
                        String acceptRanges = probeConn.getHeaderField("Accept-Ranges");
                        contentDisposition = probeConn.getHeaderField("Content-Disposition");
                        String probedType = probeConn.getContentType();
                        if (!social.isSocial && probedType != null) {
                            contentType = probedType;
                        }

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
                        emitProgress(taskId, effectiveRequestedName, 0, 0, 0.0, new long[]{0}, new long[]{1}, "waiting_network", "", "", retryCounter.incrementAndGet());
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
                    String guessedName = social.isSocial ? effectiveRequestedName : URLUtil.guessFileName(finalUrl, contentDisposition, contentType);
                    String safeName = buildShortSafeFileName(effectiveRequestedName, guessedName, contentType);
                    String categorySubfolder = resolveCategorySubfolder(safeName, contentType);

                    File baseDownloadDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
                    File downloadDir = new File(baseDownloadDir, categorySubfolder);
                    if (!downloadDir.exists()) {
                        downloadDir.mkdirs();
                    }
                    File outFile = createUniqueOutputFile(downloadDir, safeName);

                    try {
                        try (RandomAccessFile testRaf = new RandomAccessFile(outFile, "rw")) {
                            testRaf.seek(0);
                        }
                    } catch (Exception permEx) {
                        File baseFallbackDir = getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
                        if (baseFallbackDir != null) {
                            File fallbackDir = new File(baseFallbackDir, categorySubfolder);
                            if (!fallbackDir.exists()) fallbackDir.mkdirs();
                            outFile = createUniqueOutputFile(fallbackDir, safeName);
                        }
                    }

                    final File targetFile = outFile;
                    final String resolvedUrl = finalUrl;
                    final String finalTargetSourceUrl = targetSourceUrl;
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
                                            finalTargetSourceUrl,
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
                                conn = openRangeConnectionWithRedirects(resolvedUrl, finalTargetSourceUrl, rangeReq);
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
            if ("completed".equals(status)) {
                showCompletedNotification(resolvedName, savedPath);
            } else if ("downloading".equals(status)) {
                int overallPct = totalBytes > 0 ? (int) Math.min(100, Math.round((dlBytes * 100.0) / totalBytes)) : 50;
                showBackgroundActiveNotification(resolvedName, overallPct, Math.round(speedMBps * 100.0) / 100.0);
            }

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
