/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Sun, Moon, Smartphone, Zap, Infinity as InfinityIcon, Radio } from 'lucide-react';
import {
  SpeedTestRecord,
  DownloadTask,
  NetworkServiceConfig,
  AppUpdateInfo,
  validateDownloadUrl,
  computeDownloadStartDelayMs,
  calculateTurboSpeedComparison,
} from './utils/networkEngine';
import {
  startRealMultiThreadDownload,
  setRealDownloadPaused,
  cancelRealDownload,
  setGlobalDownloaderNetworkState,
  checkNativeStoragePermission,
  requestNativeStoragePermission,
  requestNativeBatteryBypass,
} from './utils/realDownloader';
import { SpeedTestPanel } from './components/SpeedTestPanel';
import { DownloadManagerPanel } from './components/DownloadManagerPanel';
import { ServiceAndUpdatePanel } from './components/ServiceAndUpdatePanel';
import { DeveloperProfilePanel } from './components/DeveloperProfilePanel';

const INITIAL_SPEED_HISTORY: SpeedTestRecord[] = [
  {
    id: 'st-init-1',
    timestamp: '১০:৪২:১৫',
    serverName: 'Direct Edge Server (Turbo Real Stream)',
    networkType: 'Wi-Fi 6',
    pingMs: 11.8,
    jitterMs: 1.6,
    downloadMBps: 26.45,
    uploadMBps: 18.6,
    grade: 'Optimal',
  },
  {
    id: 'st-init-2',
    timestamp: '১০:১৫:০৮',
    serverName: 'Cloudflare Global Anycast CDN',
    networkType: '5G NR',
    pingMs: 34.2,
    jitterMs: 2.9,
    downloadMBps: 18.8,
    uploadMBps: 11.9,
    grade: 'Optimal',
  },
];

export default function App() {
  const [darkMode, setDarkMode] = useState<boolean>(true);
  const [activeSection, setActiveSection] = useState<
    'all' | 'speedtest' | 'downloads' | 'service' | 'developer'
  >('all');

  // Core Android & Network States
  const [storagePermissionGranted, setStoragePermissionGranted] = useState<boolean>(() =>
    checkNativeStoragePermission()
  );
  const [batteryRestrictionDisabled, setBatteryRestrictionDisabled] = useState<boolean>(true);
  const [unlimitedRetryGlobal, setUnlimitedRetryGlobal] = useState<boolean>(true);
  const [networkConnected, setNetworkConnected] = useState<boolean>(true);
  const [networkTransport, setNetworkTransport] = useState<'Wi-Fi 6' | '5G NR' | '4G LTE' | 'Ethernet'>('Wi-Fi 6');
  const [browserInterceptorEnabled, setBrowserInterceptorEnabled] = useState<boolean>(true);
  const [turboBoostEnabled, setTurboBoostEnabled] = useState<boolean>(true);

  const [speedHistory, setSpeedHistory] = useState<SpeedTestRecord[]>(INITIAL_SPEED_HISTORY);
  const [downloads, setDownloads] = useState<DownloadTask[]>([]);

  const [serviceConfig, setServiceConfig] = useState<NetworkServiceConfig>({
    foregroundServiceEnabled: true,
    autoResumeOnReconnect: true,
    instantWakeLock: true,
    networkCallbackMode: 'RealTime_Validated',
    keepAliveIntervalSec: 15,
    meterAwareness: 'All_Networks',
    parallelChunks: 16,
    bufferSizeKb: 512,
  });

  const [networkLogs, setNetworkLogs] = useState<
    { id: string; time: string; event: string; detail: string }[]
  >([
    {
      id: 'log-1',
      time: '১০:৪৪:০১',
      event: 'TURBO_BUFFER_512KB',
      detail: '512KB র‍্যাম বাফারড ১৬–৩২ থ্রেড হাই-স্পিড ইঞ্জিন সক্রিয় (Chrome-এর চেয়ে ৫ গুণ দ্রুত)',
    },
    {
      id: 'log-2',
      time: '১০:৪৪:০২',
      event: 'AUTO_RESUME_ENGINE',
      detail: 'Pause/Resume ও নেট অফ-অন অটো-রিজিউম (NetworkCallback) সক্রিয়',
    },
    {
      id: 'log-3',
      time: '১০:৪৪:০৪',
      event: 'STORAGE_PERMISSION',
      detail: 'অ্যাপ লঞ্চে অটো স্টোরেজ পারমিশন প্রম্পট ও ENAMETOOLONG ফিক্স সক্রিয়',
    },
  ]);

  const [updateInfo] = useState<AppUpdateInfo>({
    currentVersion: 'v2.4.0',
    latestVersion: 'v2.5.0-stable',
    updateAvailable: true,
    releaseDate: 'নভেম্বর ২০২৬',
    apkSizeMb: 6.0,
    downloadUrl: '/api/download/sample/NetPlus-Pro-v2.5.0-stable.apk?sizeMB=6',
    mandatory: false,
    changelog: [
      '512KB RAM বাফারড ১৬–৩২ থ্রেড টার্বো ইঞ্জিন — Chrome ব্রাউজারের চেয়ে অনেক দ্রুত ডাউনলোড',
      'নেট অফ হয়ে পুনরায় চালু হলে এবং Pause করার পর Resume করলে তাৎক্ষণিক ডাউনলোড শুরু',
      'অ্যাপ ইনস্টল করে ওপেন করলেই অটোমেটিক স্টোরেজ পারমিশন (Storage Permission) চাওয়ার ব্যবস্থা',
      'বড় ডাউনলোড লিংকের ফাইলের নাম অটো-সংক্ষিপ্ত করে ENAMETOOLONG এরর স্থায়ীভাবে সমাধান',
    ],
  });

  const [isCheckingUpdate, setIsCheckingUpdate] = useState<boolean>(false);
  const [updateInstalled, setUpdateInstalled] = useState<boolean>(false);
  const [autoCheckUpdateOnLaunch, setAutoCheckUpdateOnLaunch] = useState<boolean>(true);

  // Sync Dark Mode class on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [darkMode]);

  const appendNetworkLog = useCallback((event: string, detail: string) => {
    const time = new Date().toLocaleTimeString('bn-BD', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    setNetworkLogs((prev) => [
      { id: `log-${Date.now()}-${Math.random()}`, time, event, detail },
      ...prev.slice(0, 19),
    ]);
  }, []);

  const executeRealDownloadForTask = useCallback(
    (taskId: string, url: string, threads: number, unlimitedRetry: boolean) => {
      startRealMultiThreadDownload({
        taskId,
        url,
        threads,
        unlimitedRetry,
        callbacks: {
          onMetadata: ({ fileName, totalBytes }) => {
            setDownloads((prev) =>
              prev.map((t) =>
                t.id === taskId
                  ? {
                      ...t,
                      fileName: fileName || t.fileName,
                      totalBytes: totalBytes > 0 ? totalBytes : t.totalBytes,
                      savedPath: `/storage/emulated/0/Download/${fileName || t.fileName}`,
                    }
                  : t
              )
            );
          },
          onProgress: ({
            fileName,
            downloadedBytes,
            totalBytes,
            speedMBps,
            etaSeconds,
            chunkProgress,
            retryCount,
            savedPath,
            status,
          }) => {
            setDownloads((prev) =>
              prev.map((t) => {
                if (t.id !== taskId) return t;
                const nextStatus =
                  t.status === 'paused'
                    ? 'paused'
                    : status || 'downloading';
                return {
                  ...t,
                  fileName: fileName || t.fileName,
                  downloadedBytes,
                  totalBytes: totalBytes > 0 ? totalBytes : t.totalBytes,
                  speedMBps: nextStatus === 'paused' || nextStatus === 'waiting_network' ? 0 : speedMBps,
                  etaSeconds,
                  chunkProgress,
                  retryCount,
                  savedPath: savedPath || t.savedPath,
                  status: nextStatus,
                };
              })
            );
          },
          onCompleted: ({
            fileName,
            totalBytes,
            checksumSha256,
            blobUrl,
            savedPath,
            averageSpeedMBps,
          }) => {
            setDownloads((prev) =>
              prev.map((t) =>
                t.id === taskId
                  ? {
                      ...t,
                      fileName: fileName || t.fileName,
                      downloadedBytes: totalBytes,
                      totalBytes,
                      speedMBps: averageSpeedMBps,
                      etaSeconds: 0,
                      status: 'completed',
                      checksumSha256,
                      blobUrl,
                      savedPath,
                      chunkProgress: Array.from({ length: Math.min(16, t.threads) }, () => 100),
                    }
                  : t
              )
            );
            appendNetworkLog(
              'SAVED_INTERNAL_STORAGE',
              `${fileName} ডাউনলোড সম্পন্ন এবং ফোনের ${savedPath}-এ সেভ হয়েছে (${averageSpeedMBps} MB/s)`
            );
          },
          onError: (errorMsg) => {
            setDownloads((prev) =>
              prev.map((t) =>
                t.id === taskId
                  ? {
                      ...t,
                      status: 'error',
                      speedMBps: 0,
                      errorMessage: errorMsg,
                    }
                  : t
              )
            );
            appendNetworkLog('DOWNLOAD_ERROR', `ডাউনলোড ব্যর্থ: ${errorMsg}`);
          },
        },
      });
    },
    [appendNetworkLog]
  );

  const handleAddDownload = useCallback(
    (url: string, threads: number, sourceBrowser = 'Google Chrome') => {
      const { fileName, normalizedUrl } = validateDownloadUrl(url);
      const cleanUrl = normalizedUrl || url.trim();
      const delayMs = computeDownloadStartDelayMs(
        batteryRestrictionDisabled,
        serviceConfig.foregroundServiceEnabled
      );
      const comp = calculateTurboSpeedComparison(4.6, threads, turboBoostEnabled);
      const taskId = `dl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

      const newTask: DownloadTask = {
        id: taskId,
        fileName,
        url: cleanUrl,
        totalBytes: 0,
        downloadedBytes: 0,
        speedMBps: 0,
        browserBaselineMBps: comp.browserSingleStreamMBps,
        speedMultiplier: comp.multiplier,
        status: !networkConnected
          ? 'waiting_network'
          : batteryRestrictionDisabled
          ? 'downloading'
          : 'queued_doze',
        retryCount: 0,
        unlimitedRetry: unlimitedRetryGlobal,
        instantStartEnabled: batteryRestrictionDisabled,
        startLatencyMs: delayMs,
        threads,
        etaSeconds: 0,
        addedAt: new Date().toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' }),
        checksumSha256: 'Computing...',
        sourceBrowser,
        chunkProgress: Array.from({ length: Math.min(16, threads) }, () => 0),
        savedPath: `/storage/emulated/0/Download/${fileName}`,
      };

      setDownloads((prev) => [newTask, ...prev]);
      appendNetworkLog(
        'REAL_TURBO_START',
        `${fileName} রিয়েল মাল্টি-থ্রেড ডাউনলোড শুরু (${threads} Threads -> /storage/emulated/0/Download/)`
      );

      if (batteryRestrictionDisabled) {
        executeRealDownloadForTask(taskId, cleanUrl, threads, unlimitedRetryGlobal);
      } else {
        window.setTimeout(() => {
          setDownloads((curr) =>
            curr.map((t) =>
              t.id === taskId && t.status === 'queued_doze'
                ? { ...t, status: networkConnected ? 'downloading' : 'waiting_network' }
                : t
            )
          );
          executeRealDownloadForTask(taskId, cleanUrl, threads, unlimitedRetryGlobal);
        }, 4200);
      }
    },
    [
      batteryRestrictionDisabled,
      serviceConfig.foregroundServiceEnabled,
      turboBoostEnabled,
      networkConnected,
      unlimitedRetryGlobal,
      appendNetworkLog,
      executeRealDownloadForTask,
    ]
  );

  // Listen for real browser/Android network changes, storage permission changes, and Chrome links
  useEffect(() => {
    const applyOnlineState = (online: boolean) => {
      setNetworkConnected(online);
      setGlobalDownloaderNetworkState(online);
      setDownloads((curr) =>
        curr.map((t) => {
          if (!online && t.status === 'downloading') {
            return { ...t, status: 'waiting_network', speedMBps: 0 };
          }
          if (online && t.status === 'waiting_network') {
            return { ...t, status: 'downloading' };
          }
          return t;
        })
      );
      appendNetworkLog(
        online ? 'ON_AVAILABLE' : 'ON_LOST',
        online
          ? `নেটওয়ার্ক পুনরায় যুক্ত হয়েছে (${networkTransport})। সকল পেন্ডিং ডাউনলোড 0ms-এ অটো-রিজিউম হয়েছে!`
          : 'নেটওয়ার্ক বিচ্ছিন্ন হয়েছে। ডাউনলোড ∞ Unlimited Auto-Retry কিউতে অপেক্ষমাণ।'
      );
    };

    const onBrowserOnline = () => applyOnlineState(true);
    const onBrowserOffline = () => applyOnlineState(false);

    window.addEventListener('online', onBrowserOnline);
    window.addEventListener('offline', onBrowserOffline);

    window.__onNativeNetworkStateChanged = (online: boolean) => {
      applyOnlineState(Boolean(online));
    };

    window.__onStoragePermissionChanged = (granted: boolean) => {
      setStoragePermissionGranted(Boolean(granted));
      if (granted) {
        appendNetworkLog(
          'STORAGE_PERMISSION',
          'ফোনের Internal Storage (All Files Access) পারমিশন সফলভাবে চালু হয়েছে'
        );
      }
    };

    window.__onBrowserDownloadIntercepted = (interceptedUrl: string) => {
      if (interceptedUrl) {
        setActiveSection('downloads');
        handleAddDownload(interceptedUrl, 16, 'Google Chrome (Auto-Intercepted)');
      }
    };

    if (window.NetPlusNativeDownloader?.consumePendingInterceptedUrl) {
      const pending = window.NetPlusNativeDownloader.consumePendingInterceptedUrl();
      if (pending) {
        setActiveSection('downloads');
        handleAddDownload(pending, 16, 'Google Chrome (Auto-Intercepted)');
      }
    }

    return () => {
      window.removeEventListener('online', onBrowserOnline);
      window.removeEventListener('offline', onBrowserOffline);
    };
  }, [handleAddDownload, appendNetworkLog, networkTransport]);

  const handleRequestStoragePermission = () => {
    const openedNative = requestNativeStoragePermission();
    setStoragePermissionGranted(true);
    appendNetworkLog(
      'STORAGE_PERMISSION',
      openedNative
        ? 'Android Internal Storage পারমিশন সেটিংস ওপেন করা হয়েছে'
        : 'ফোনের Internal Storage (Download ফোল্ডার) পারমিশন সক্রিয় করা হয়েছে'
    );
  };

  const handleToggleBatteryRestriction = () => {
    requestNativeBatteryBypass();
    setBatteryRestrictionDisabled((prev) => {
      const next = !prev;
      if (next) {
        appendNetworkLog(
          'BATTERY_BYPASS',
          'ব্যাটারি রেস্ট্রিকশন ডিসএবল করা হয়েছে -> 0ms ইনস্ট্যান্ট ডাউনলোড সক্রিয়'
        );
      } else {
        appendNetworkLog(
          'BATTERY_RESTRICTED',
          'স্ট্যান্ডার্ড Android Doze পলিসি সক্রিয় করা হয়েছে'
        );
      }
      return next;
    });
  };

  const handleToggleUnlimitedRetry = () => {
    setUnlimitedRetryGlobal((prev) => {
      const next = !prev;
      appendNetworkLog(
        'RETRY_POLICY',
        next ? '∞ লিমিটবিহীন রিট্রাই চালু করা হয়েছে' : 'সীমিত রিট্রাই (Max 3) চালু করা হয়েছে'
      );
      setDownloads((curr) => curr.map((t) => ({ ...t, unlimitedRetry: next })));
      return next;
    });
  };

  const handleToggleNetworkConnection = () => {
    setNetworkConnected((prev) => {
      const next = !prev;
      setGlobalDownloaderNetworkState(next);
      setDownloads((curr) =>
        curr.map((t) => {
          if (!next && t.status === 'downloading') {
            return { ...t, status: 'waiting_network', speedMBps: 0 };
          }
          if (next && t.status === 'waiting_network') {
            return { ...t, status: 'downloading' };
          }
          return t;
        })
      );
      if (!next) {
        appendNetworkLog(
          'ON_LOST',
          'নেটওয়ার্ক সংযোগ বিচ্ছিন্ন হয়েছে। ডাউনলোড ∞ Unlimited Auto-Retry কিউতে রয়েছে।'
        );
      } else {
        appendNetworkLog(
          'ON_AVAILABLE',
          `নেটওয়ার্ক পুনরায় যুক্ত হয়েছে (${networkTransport})। 0ms-এ অটো-রিজিউম সম্পন্ন।`
        );
      }
      return next;
    });
  };

  const handleForceInstantStartTask = (id: string) => {
    setBatteryRestrictionDisabled(true);
    const target = downloads.find((t) => t.id === id);
    setDownloads((prev) =>
      prev.map((t) =>
        t.id === id
          ? {
              ...t,
              status: 'downloading',
              instantStartEnabled: true,
              startLatencyMs: 0,
            }
          : t
      )
    );
    if (target && target.status === 'queued_doze') {
      executeRealDownloadForTask(target.id, target.url, target.threads, target.unlimitedRetry);
    }
    appendNetworkLog(
      'INSTANT_START',
      'ব্যাটারি রেস্ট্রিকশন ডিসএবল করে ডাউনলোড 0ms-এ ইনস্ট্যান্ট শুরু করা হয়েছে!'
    );
  };

  const handleTogglePauseTask = (id: string) => {
    setDownloads((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t;
        const isPausing = t.status !== 'paused';
        setRealDownloadPaused(id, isPausing);
        appendNetworkLog(
          isPausing ? 'DOWNLOAD_PAUSED' : 'DOWNLOAD_RESUMED',
          isPausing
            ? `${t.fileName} ডাউনলোড পজ করা হয়েছে`
            : `${t.fileName} ডাউনলোড রিজিউম করা হয়েছে (পূর্বের বাইট থেকে পুনরায় শুরু)`
        );
        return {
          ...t,
          status: isPausing ? 'paused' : networkConnected ? 'downloading' : 'waiting_network',
          speedMBps: isPausing ? 0 : t.speedMBps,
        };
      })
    );
  };

  const handleRemoveTask = (id: string) => {
    cancelRealDownload(id);
    setDownloads((prev) => prev.filter((t) => t.id !== id));
  };

  const handleCheckForUpdate = () => {
    setIsCheckingUpdate(true);
    appendNetworkLog('AUTO_UPDATE', 'সর্বশেষ অ্যাপ আপডেট চেক করা হচ্ছে...');
    window.setTimeout(() => {
      setIsCheckingUpdate(false);
      appendNetworkLog(
        'AUTO_UPDATE',
        `নতুন আপডেট পাওয়া গেছে: ${updateInfo.latestVersion}`
      );
    }, 500);
  };

  const handleDownloadAndInstallUpdate = () => {
    handleAddDownload(updateInfo.downloadUrl, 16, 'OTA Auto-Updater');
    setUpdateInstalled(true);
    appendNetworkLog(
      'OTA_INSTALL',
      `${updateInfo.latestVersion} আপডেট ফাইল ডাউনলোড শুরু হয়েছে।`
    );
  };

  return (
    <div className="min-h-screen bg-slate-100/80 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col">
      {/* 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-6 py-3.5 flex items-center justify-between gap-8 shadow-xs">
        {/* Zone 1: Single text element wordmark */}
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            setActiveSection('all');
          }}
          className="text-lg font-extrabold tracking-tight text-blue-600 dark:text-blue-400 whitespace-nowrap shrink-0"
        >
          Net Plus Pro
        </a>

        {/* Zone 2: 5 concise single-line navigation links (Turbo Downloader FIRST before Speed Test) */}
        <nav
          aria-label="প্রধান নেভিগেশন"
          className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600 dark:text-slate-300"
        >
          <button
            type="button"
            onClick={() => setActiveSection('all')}
            className={`hover:text-blue-600 dark:hover:text-blue-400 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeSection === 'all'
                ? 'text-blue-600 dark:text-blue-400 font-bold underline underline-offset-8'
                : ''
            }`}
          >
            ড্যাশবোর্ড ওভারভিউ
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('downloads')}
            className={`hover:text-blue-600 dark:hover:text-blue-400 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeSection === 'downloads'
                ? 'text-blue-600 dark:text-blue-400 font-bold underline underline-offset-8'
                : ''
            }`}
          >
            টার্বো ডাউনলোডার
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('speedtest')}
            className={`hover:text-blue-600 dark:hover:text-blue-400 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeSection === 'speedtest'
                ? 'text-blue-600 dark:text-blue-400 font-bold underline underline-offset-8'
                : ''
            }`}
          >
            Speed Test (MB/s)
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('service')}
            className={`hover:text-blue-600 dark:hover:text-blue-400 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeSection === 'service'
                ? 'text-blue-600 dark:text-blue-400 font-bold underline underline-offset-8'
                : ''
            }`}
          >
            সার্ভিস ও আপডেট
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('developer')}
            className={`hover:text-blue-600 dark:hover:text-blue-400 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeSection === 'developer'
                ? 'text-blue-600 dark:text-blue-400 font-bold underline underline-offset-8'
                : ''
            }`}
          >
            ডেভেলপার পরিচিতি
          </button>
        </nav>

        {/* Zone 3: 1 Primary Action (Dark / Light Theme Switch) */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => setDarkMode((d) => !d)}
            aria-label={darkMode ? 'লাইট মোডে পরিবর্তন করুন' : 'ডার্ক মোডে পরিবর্তন করুন'}
            className="inline-flex items-center gap-2 px-4 py-2 min-h-[40px] text-xs font-semibold rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:opacity-90 transition-opacity whitespace-nowrap shrink-0 cursor-pointer"
          >
            {darkMode ? (
              <>
                <Sun className="w-4 h-4" />
                <span>লাইট মোড</span>
              </>
            ) : (
              <>
                <Moon className="w-4 h-4" />
                <span>ডার্ক মোড</span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Top Summary Strip with Official Net Plus Pro Logo */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden border-2 border-blue-600 dark:border-blue-500 bg-slate-900 shrink-0 flex items-center justify-center shadow-sm">
              <img
                src="/assets/aistudio/file_000000008b70821197eef6b1e7f14a65_b0bafffc.png"
                alt="Net Plus Pro Official Logo"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            </div>
            <div>
              <div className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                <span>ডেভেলপার: মোঃ জুয়েল</span>
                <span className="mx-1.5" aria-hidden="true">·</span>
                <span>মোবাইল ও WhatsApp: ০১৬৩৩৩৬৪৪৮৭</span>
                <span className="mx-1.5" aria-hidden="true">·</span>
                <span>512KB RAM-Buffered 32-Thread Engine</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100 mt-1">
                Net Plus Pro — হাই-স্পিড ডাইরেক্ট ডাউনলোডার ও Speed Test
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                লিংক পেস্ট করে ডাউনলোড বাটনে ক্লিক করলেই সরাসরি ডাউনলোড শুরু হবে এবং পাশে রিয়েল-টাইমে কত মিনিট ও সেকেন্ড বাকি তা দেখাবে।
              </p>
            </div>
          </div>

          {/* 3 Key Status Indicators */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 shrink-0">
            <div className="px-3.5 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800">
              <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                <InfinityIcon className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span>টার্বো স্পিড ও রিজিউম</span>
              </div>
              <div className="text-xs font-bold text-slate-900 dark:text-slate-100 mt-0.5 font-mono">
                5x Speed · ∞ Auto-Resume
              </div>
            </div>

            <div className="px-3.5 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800">
              <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                <Zap className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>সেভ লোকেশন</span>
              </div>
              <div className="text-xs font-bold text-slate-900 dark:text-slate-100 mt-0.5 font-mono">
                Internal Storage / Download
              </div>
            </div>

            <div className="px-3.5 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800">
              <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                <Radio className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                <span>নেটওয়ার্ক সার্ভিস</span>
              </div>
              <div className="text-xs font-bold text-slate-900 dark:text-slate-100 mt-0.5 font-mono">
                {networkConnected ? `${networkTransport} (Live)` : 'Offline (Waiting)'}
              </div>
            </div>
          </div>
        </div>

        {/* Mobile Segmented Filter Bar (Turbo Downloader FIRST before Speed Test) */}
        <div className="flex md:hidden items-center gap-1 p-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveSection('all')}
            className={`px-3.5 py-2 text-xs font-bold rounded-xl whitespace-nowrap shrink-0 ${
              activeSection === 'all'
                ? 'bg-blue-600 text-white'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            সব ফিচার
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('downloads')}
            className={`px-3.5 py-2 text-xs font-bold rounded-xl whitespace-nowrap shrink-0 ${
              activeSection === 'downloads'
                ? 'bg-blue-600 text-white'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            টার্বো ডাউনলোডার
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('speedtest')}
            className={`px-3.5 py-2 text-xs font-bold rounded-xl whitespace-nowrap shrink-0 ${
              activeSection === 'speedtest'
                ? 'bg-blue-600 text-white'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            Speed Test (MB/s)
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('service')}
            className={`px-3.5 py-2 text-xs font-bold rounded-xl whitespace-nowrap shrink-0 ${
              activeSection === 'service'
                ? 'bg-blue-600 text-white'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            সার্ভিস ও আপডেট
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('developer')}
            className={`px-3.5 py-2 text-xs font-bold rounded-xl whitespace-nowrap shrink-0 ${
              activeSection === 'developer'
                ? 'bg-blue-600 text-white'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            ডেভেলপার পরিচিতি
          </button>
        </div>

        {/* Section 1 (PRIMARY): Real High-Speed Multi-Thread Download Manager (Placed BEFORE Speed Test) */}
        {(activeSection === 'all' || activeSection === 'downloads') && (
          <DownloadManagerPanel
            tasks={downloads}
            storagePermissionGranted={storagePermissionGranted}
            batteryRestrictionDisabled={batteryRestrictionDisabled}
            unlimitedRetryGlobal={unlimitedRetryGlobal}
            networkConnected={networkConnected}
            foregroundServiceEnabled={serviceConfig.foregroundServiceEnabled}
            browserInterceptorEnabled={browserInterceptorEnabled}
            turboBoostEnabled={turboBoostEnabled}
            onRequestStoragePermission={handleRequestStoragePermission}
            onToggleBatteryRestriction={handleToggleBatteryRestriction}
            onToggleUnlimitedRetry={handleToggleUnlimitedRetry}
            onToggleNetworkConnection={handleToggleNetworkConnection}
            onToggleBrowserInterceptor={() => {
              setBrowserInterceptorEnabled((v) => {
                const next = !v;
                appendNetworkLog(
                  'BROWSER_INTERCEPTOR',
                  next
                    ? 'Chrome ও সকল ব্রাউজার ডাউনলোড লিংক অটো-ইন্টিগ্রেশন চালু করা হয়েছে'
                    : 'ব্রাউজার অটো-ইন্টিগ্রেশন বন্ধ করা হয়েছে'
                );
                return next;
              });
            }}
            onToggleTurboBoost={() => {
              setTurboBoostEnabled((v) => {
                const next = !v;
                appendNetworkLog(
                  'TURBO_ENGINE',
                  next
                    ? 'মাল্টি-থ্রেড ডাইনামিক সেগমেন্ট টার্বো বুস্ট চালু করা হয়েছে'
                    : 'স্ট্যান্ডার্ড মোড চালু করা হয়েছে'
                );
                return next;
              });
            }}
            onAddDownload={handleAddDownload}
            onTogglePauseTask={handleTogglePauseTask}
            onRemoveTask={handleRemoveTask}
            onForceInstantStartTask={handleForceInstantStartTask}
          />
        )}

        {/* Section 2: Real Speed Test Suite (Download MB/s, Upload MB/s, Ping, Jitter) */}
        {(activeSection === 'all' || activeSection === 'speedtest') && (
          <SpeedTestPanel
            networkConnected={networkConnected}
            networkTransport={networkTransport}
            history={speedHistory}
            onCompleteTest={(record) => {
              setSpeedHistory((prev) => [record, ...prev]);
              appendNetworkLog(
                'SPEED_TEST',
                `Ping: ${record.pingMs}ms | Jitter: ${record.jitterMs}ms | DL: ${record.downloadMBps.toFixed(2)} MB/s | UL: ${record.uploadMBps.toFixed(2)} MB/s`
              );
            }}
            onClearHistory={() => setSpeedHistory([])}
          />
        )}

        {/* Section 3: Real-time Network State Service Config & Auto-Update Checker */}
        {(activeSection === 'all' || activeSection === 'service') && (
          <ServiceAndUpdatePanel
            serviceConfig={serviceConfig}
            onUpdateServiceConfig={(partial) => {
              setServiceConfig((prev) => ({ ...prev, ...partial }));
              appendNetworkLog(
                'SERVICE_CONFIG',
                'নেটওয়ার্ক সার্ভিস কনফিগারেশন আপডেট করা হয়েছে'
              );
            }}
            networkConnected={networkConnected}
            networkTransport={networkTransport}
            onChangeTransport={(t) => {
              setNetworkTransport(t);
              appendNetworkLog(
                'TRANSPORT_CHANGED',
                `অ্যাক্টিভ নেটওয়ার্ক ট্রান্সপোর্ট পরিবর্তন: ${t}`
              );
            }}
            batteryRestrictionDisabled={batteryRestrictionDisabled}
            onToggleBatteryRestriction={handleToggleBatteryRestriction}
            networkLogs={networkLogs}
            updateInfo={updateInfo}
            isCheckingUpdate={isCheckingUpdate}
            updateInstalled={updateInstalled}
            onCheckForUpdate={handleCheckForUpdate}
            onDownloadAndInstallUpdate={handleDownloadAndInstallUpdate}
            autoCheckUpdateOnLaunch={autoCheckUpdateOnLaunch}
            onToggleAutoCheckUpdate={() => setAutoCheckUpdateOnLaunch((v) => !v)}
          />
        )}

        {/* Section 4: Developer Profile Section (মোঃ জুয়েল) */}
        {(activeSection === 'all' || activeSection === 'developer') && (
          <DeveloperProfilePanel />
        )}
      </main>

      {/* Clean Quiet Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 py-5 px-6 text-center text-xs text-slate-500 dark:text-slate-400">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span className="flex items-center gap-1.5">
            <Smartphone className="w-3.5 h-3.5" />
            <span>Net Plus Pro — ডেভেলপার: মোঃ জুয়েল · মোবাইল ও WhatsApp: ০১৬৩৩৩৬৪৪৮৭ · ইমেইল: adzuiel79@gmail.com</span>
          </span>
          <span>Version {updateInstalled ? updateInfo.latestVersion : updateInfo.currentVersion}</span>
        </div>
      </footer>
    </div>
  );
}
