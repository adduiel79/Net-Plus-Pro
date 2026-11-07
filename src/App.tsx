/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
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

const INITIAL_DOWNLOADS: DownloadTask[] = [
  {
    id: 'dl-1',
    fileName: 'android-15-system-image-arm64.zip',
    url: 'https://dl.google.com/android/repository/sys-img/android-15-arm64-v8a.zip',
    totalBytes: 420 * 1024 * 1024,
    downloadedBytes: 248 * 1024 * 1024,
    speedMBps: 24.8,
    browserBaselineMBps: 4.6,
    speedMultiplier: 5.4,
    status: 'downloading',
    retryCount: 2,
    unlimitedRetry: true,
    instantStartEnabled: true,
    startLatencyMs: 0,
    threads: 16,
    etaSeconds: 7,
    addedAt: '১০:৪০ AM',
    checksumSha256: '8f9d2a7c...e41b',
    sourceBrowser: 'Google Chrome -> Net Plus Pro Turbo',
  },
  {
    id: 'dl-2',
    fileName: 'bangladesh-offline-routing-v4.pak',
    url: 'https://mirror.bdix.net/maps/bangladesh-offline-routing-v4.pak',
    totalBytes: 165 * 1024 * 1024,
    downloadedBytes: 18 * 1024 * 1024,
    speedMBps: 0,
    browserBaselineMBps: 4.6,
    speedMultiplier: 4.8,
    status: 'queued_doze',
    retryCount: 0,
    unlimitedRetry: true,
    instantStartEnabled: false,
    startLatencyMs: 14500,
    threads: 16,
    etaSeconds: 10,
    addedAt: '১০:৪৩ AM',
    checksumSha256: '3c11b09e...90a2',
    sourceBrowser: 'Chrome Custom Tab',
  },
  {
    id: 'dl-3',
    fileName: 'netpulse-core-codecs-arm64.apk',
    url: 'https://cdn.netpulse.app/releases/netpulse-core-codecs-arm64.apk',
    totalBytes: 64 * 1024 * 1024,
    downloadedBytes: 64 * 1024 * 1024,
    speedMBps: 0,
    browserBaselineMBps: 4.5,
    speedMultiplier: 4.8,
    status: 'completed',
    retryCount: 1,
    unlimitedRetry: true,
    instantStartEnabled: true,
    startLatencyMs: 0,
    threads: 16,
    etaSeconds: 0,
    addedAt: '১০:২০ AM',
    checksumSha256: 'e74a19f0...7c11',
    sourceBrowser: 'Google Chrome -> Net Plus Pro Turbo',
  },
];

export default function App() {
  const [darkMode, setDarkMode] = useState<boolean>(true);
  const [activeSection, setActiveSection] = useState<
    'all' | 'speedtest' | 'downloads' | 'service' | 'developer'
  >('all');

  // Core Android & Network States
  const [batteryRestrictionDisabled, setBatteryRestrictionDisabled] = useState<boolean>(false);
  const [unlimitedRetryGlobal, setUnlimitedRetryGlobal] = useState<boolean>(true);
  const [networkConnected, setNetworkConnected] = useState<boolean>(true);
  const [networkTransport, setNetworkTransport] = useState<'Wi-Fi 6' | '5G NR' | '4G LTE' | 'Ethernet'>('Wi-Fi 6');
  const [browserInterceptorEnabled, setBrowserInterceptorEnabled] = useState<boolean>(true);
  const [turboBoostEnabled, setTurboBoostEnabled] = useState<boolean>(true);

  const [speedHistory, setSpeedHistory] = useState<SpeedTestRecord[]>(INITIAL_SPEED_HISTORY);
  const [downloads, setDownloads] = useState<DownloadTask[]>(INITIAL_DOWNLOADS);

  const [serviceConfig, setServiceConfig] = useState<NetworkServiceConfig>({
    foregroundServiceEnabled: true,
    autoResumeOnReconnect: true,
    instantWakeLock: true,
    networkCallbackMode: 'RealTime_Validated',
    keepAliveIntervalSec: 15,
    meterAwareness: 'All_Networks',
    parallelChunks: 16,
    bufferSizeKb: 128,
  });

  const [networkLogs, setNetworkLogs] = useState<
    { id: string; time: string; event: string; detail: string }[]
  >([
    {
      id: 'log-1',
      time: '১০:৪৪:০১',
      event: 'TURBO_ENGINE',
      detail: '16-32 Thread HTTP 206 Multi-Range Accelerator সক্রিয় (Chrome-এর চেয়ে 5x দ্রুত)',
    },
    {
      id: 'log-2',
      time: '১০:৪৪:০২',
      event: 'BROWSER_INTERCEPTOR',
      detail: 'Chrome ও সকল ব্রাউজার ডাউনলোড লিংক অটো-অপশন (Intent.ACTION_VIEW) সক্রিয়',
    },
    {
      id: 'log-3',
      time: '১০:৪৪:০৪',
      event: 'RETRY_ENGINE',
      detail: 'রিট্রাই লিমিট বিহীন (∞ Unlimited) অটো-রিজিউম সক্রিয়',
    },
  ]);

  const [updateInfo] = useState<AppUpdateInfo>({
    currentVersion: 'v2.4.0',
    latestVersion: 'v2.5.0-stable',
    updateAvailable: true,
    releaseDate: 'নভেম্বর ২০২৬',
    apkSizeMb: 28.4,
    downloadUrl: 'https://updates.netpulse.app/android/netpulse-pro-v2.5.0-stable.apk',
    mandatory: false,
    changelog: [
      'Chrome বা সাধারণ ব্রাউজারের চেয়ে ৫ গুণ দ্রুত ১৬–৩২ থ্রেড টার্বো ডাউনলোড ইঞ্জিন যুক্ত',
      'Chrome বা অন্য যেকোনো ব্রাউজারে ডাউনলোড ক্লিক করলে Net Plus Pro অটো-অপশন পপআপ',
      'Upload Speed, Download Speed (MB/s), Ping ও Jitter-সহ ১ সেকেন্ডে রিয়েল Speed Test',
      'ডাউনলোড Retry Limit তুলে দিয়ে ∞ Unlimited Auto-Retry এবং 0ms ইনস্ট্যান্ট স্টার্ট',
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

  const appendNetworkLog = (event: string, detail: string) => {
    const time = new Date().toLocaleTimeString('bn-BD', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    setNetworkLogs((prev) => [
      { id: `log-${Date.now()}-${Math.random()}`, time, event, detail },
      ...prev.slice(0, 19),
    ]);
  };

  // Real-time progress ticker for active downloads in MB/s
  useEffect(() => {
    const interval = window.setInterval(() => {
      setDownloads((prev) =>
        prev.map((task) => {
          if (!networkConnected) {
            if (task.status === 'downloading') {
              return {
                ...task,
                status: 'waiting_network',
                speedMBps: 0,
                retryCount: task.retryCount + 1,
              };
            }
            if (task.status === 'waiting_network' && task.unlimitedRetry) {
              return {
                ...task,
                retryCount: task.retryCount + 1,
              };
            }
            return task;
          }

          if (task.status === 'waiting_network' && serviceConfig.autoResumeOnReconnect) {
            const comp = calculateTurboSpeedComparison(
              task.browserBaselineMBps,
              task.threads,
              turboBoostEnabled
            );
            return {
              ...task,
              status: 'downloading',
              speedMBps: comp.netPlusTurboMBps,
              speedMultiplier: comp.multiplier,
            };
          }

          if (task.status === 'downloading') {
            const comp = calculateTurboSpeedComparison(
              task.browserBaselineMBps,
              task.threads,
              turboBoostEnabled
            );
            const stepBytes = comp.netPlusTurboMBps * 1024 * 1024 * 0.9;
            const nextBytes = Math.min(task.totalBytes, task.downloadedBytes + stepBytes);
            const isDone = nextBytes >= task.totalBytes;
            return {
              ...task,
              downloadedBytes: nextBytes,
              speedMBps: isDone ? 0 : comp.netPlusTurboMBps,
              speedMultiplier: comp.multiplier,
              status: isDone ? 'completed' : 'downloading',
              etaSeconds: isDone
                ? 0
                : Math.max(
                    1,
                    Math.round((task.totalBytes - nextBytes) / (comp.netPlusTurboMBps * 1024 * 1024))
                  ),
            };
          }

          return task;
        })
      );
    }, 900);

    return () => window.clearInterval(interval);
  }, [networkConnected, serviceConfig.autoResumeOnReconnect, turboBoostEnabled]);

  const handleToggleBatteryRestriction = () => {
    setBatteryRestrictionDisabled((prev) => {
      const next = !prev;
      if (next) {
        appendNetworkLog(
          'BATTERY_BYPASS',
          'ব্যাটারি রেস্ট্রিকশন ডিসএবল করা হয়েছে -> 0ms ইনস্ট্যান্ট ডাউনলোড সক্রিয়'
        );
        setDownloads((curr) =>
          curr.map((t) =>
            t.status === 'queued_doze'
              ? {
                  ...t,
                  status: networkConnected ? 'downloading' : 'waiting_network',
                  instantStartEnabled: true,
                  startLatencyMs: 0,
                  speedMBps: networkConnected ? 24.8 : 0,
                }
              : { ...t, instantStartEnabled: true, startLatencyMs: 0 }
          )
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

  const handleAddDownload = (url: string, threads: number, sourceBrowser = 'Google Chrome') => {
    const { fileName } = validateDownloadUrl(url);
    const delayMs = computeDownloadStartDelayMs(
      batteryRestrictionDisabled,
      serviceConfig.foregroundServiceEnabled
    );
    const comp = calculateTurboSpeedComparison(4.6, threads, turboBoostEnabled);

    const newTask: DownloadTask = {
      id: `dl-${Date.now()}`,
      fileName,
      url,
      totalBytes: 220 * 1024 * 1024,
      downloadedBytes: batteryRestrictionDisabled ? 22 * 1024 * 1024 : 0,
      speedMBps: batteryRestrictionDisabled && networkConnected ? comp.netPlusTurboMBps : 0,
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
      etaSeconds: 8,
      addedAt: new Date().toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' }),
      checksumSha256: '9a44c81d...b712',
      sourceBrowser,
    };

    setDownloads((prev) => [newTask, ...prev]);
    appendNetworkLog(
      'TURBO_DOWNLOAD',
      `${fileName} যুক্ত হয়েছে (${threads} Threads · ${comp.netPlusTurboMBps} MB/s · ${comp.multiplier}x Faster than Browser)`
    );

    if (!batteryRestrictionDisabled) {
      window.setTimeout(() => {
        setDownloads((curr) =>
          curr.map((t) =>
            t.id === newTask.id && t.status === 'queued_doze'
              ? {
                  ...t,
                  status: 'downloading',
                  speedMBps: comp.netPlusTurboMBps,
                }
              : t
          )
        );
      }, 4200);
    }
  };

  const handleForceInstantStartTask = (id: string) => {
    setBatteryRestrictionDisabled(true);
    setDownloads((prev) =>
      prev.map((t) =>
        t.id === id || t.status === 'queued_doze'
          ? {
              ...t,
              status: networkConnected ? 'downloading' : 'waiting_network',
              instantStartEnabled: true,
              startLatencyMs: 0,
              speedMBps: networkConnected ? 24.8 : 0,
            }
          : t
      )
    );
    appendNetworkLog(
      'INSTANT_START',
      'ব্যাটারি রেস্ট্রিকশন ডিসএবল করে ডাউনলোড 0ms-এ ইনস্ট্যান্ট শুরু করা হয়েছে!'
    );
  };

  const handleTogglePauseTask = (id: string) => {
    setDownloads((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t;
        const nextStatus = t.status === 'paused' ? 'downloading' : 'paused';
        const comp = calculateTurboSpeedComparison(
          t.browserBaselineMBps,
          t.threads,
          turboBoostEnabled
        );
        return {
          ...t,
          status: nextStatus,
          speedMBps: nextStatus === 'downloading' ? comp.netPlusTurboMBps : 0,
        };
      })
    );
  };

  const handleRemoveTask = (id: string) => {
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
      `${updateInfo.latestVersion} আপডেট ডাউনলোড ও ইনস্টল সম্পন্ন হয়েছে।`
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col">
      {/* 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-6 py-3.5 flex items-center justify-between gap-8">
        {/* Zone 1: Single text element wordmark */}
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            setActiveSection('all');
          }}
          className="text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100 whitespace-nowrap shrink-0"
        >
          Net Plus Pro
        </a>

        {/* Zone 2: 5 concise single-line navigation links */}
        <nav
          aria-label="প্রধান নেভিগেশন"
          className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600 dark:text-slate-300"
        >
          <button
            type="button"
            onClick={() => setActiveSection('all')}
            className={`hover:text-blue-600 dark:hover:text-blue-400 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeSection === 'all'
                ? 'text-blue-600 dark:text-blue-400 font-semibold underline underline-offset-8'
                : ''
            }`}
          >
            ড্যাশবোর্ড ওভারভিউ
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('speedtest')}
            className={`hover:text-blue-600 dark:hover:text-blue-400 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeSection === 'speedtest'
                ? 'text-blue-600 dark:text-blue-400 font-semibold underline underline-offset-8'
                : ''
            }`}
          >
            Speed Test (MB/s)
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('downloads')}
            className={`hover:text-blue-600 dark:hover:text-blue-400 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeSection === 'downloads'
                ? 'text-blue-600 dark:text-blue-400 font-semibold underline underline-offset-8'
                : ''
            }`}
          >
            টার্বো ডাউনলোডার
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('service')}
            className={`hover:text-blue-600 dark:hover:text-blue-400 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeSection === 'service'
                ? 'text-blue-600 dark:text-blue-400 font-semibold underline underline-offset-8'
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
                ? 'text-blue-600 dark:text-blue-400 font-semibold underline underline-offset-8'
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
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full overflow-hidden border-2 border-blue-600 dark:border-blue-500 bg-slate-900 shrink-0 flex items-center justify-center">
              <img
                src="/assets/aistudio/file_000000008b70821197eef6b1e7f14a65_b0bafffc.png"
                alt="Net Plus Pro Official Logo"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            </div>
            <div>
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                <span>ডেভেলপার: মোঃ জুয়েল</span>
                <span className="mx-1.5" aria-hidden="true">·</span>
                <span>মোবাইল ও WhatsApp: ০১৬৩৩৩৬৪৪৮৭</span>
                <span className="mx-1.5" aria-hidden="true">·</span>
                <span>Chrome Auto-Download Interceptor</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100 mt-1">
                Net Plus Pro — 5x হাই-স্পিড টার্বো ডাউনলোডার ও রিয়েল Speed Test
              </h1>
            </div>
          </div>

          {/* 3 Key Status Indicators */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 shrink-0">
            <div className="px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800">
              <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                <InfinityIcon className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span>টার্বো বুস্ট ও রিট্রাই</span>
              </div>
              <div className="text-xs font-bold text-slate-900 dark:text-slate-100 mt-0.5 font-mono">
                5x Speed · ∞ Unlimited
              </div>
            </div>

            <div className="px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800">
              <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                <Zap className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>ব্রাউজার অটো-অপশন</span>
              </div>
              <div className="text-xs font-bold text-slate-900 dark:text-slate-100 mt-0.5 font-mono">
                {browserInterceptorEnabled ? 'Chrome Auto-Popup: ON' : 'Manual Mode'}
              </div>
            </div>

            <div className="px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800">
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

        {/* Mobile Segmented Filter Bar */}
        <div className="flex md:hidden items-center gap-1 p-1 bg-slate-200/70 dark:bg-slate-900 rounded-xl overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveSection('all')}
            className={`px-3 py-2 text-xs font-semibold rounded-lg whitespace-nowrap shrink-0 ${
              activeSection === 'all'
                ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            সব ফিচার
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('speedtest')}
            className={`px-3 py-2 text-xs font-semibold rounded-lg whitespace-nowrap shrink-0 ${
              activeSection === 'speedtest'
                ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            Speed Test (MB/s)
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('downloads')}
            className={`px-3 py-2 text-xs font-semibold rounded-lg whitespace-nowrap shrink-0 ${
              activeSection === 'downloads'
                ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            টার্বো ডাউনলোডার
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('service')}
            className={`px-3 py-2 text-xs font-semibold rounded-lg whitespace-nowrap shrink-0 ${
              activeSection === 'service'
                ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            সার্ভিস ও আপডেট
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('developer')}
            className={`px-3 py-2 text-xs font-semibold rounded-lg whitespace-nowrap shrink-0 ${
              activeSection === 'developer'
                ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            ডেভেলপার পরিচিতি
          </button>
        </div>

        {/* Section 1: Real Speed Test Suite (Download MB/s, Upload MB/s, Ping, Jitter) */}
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

        {/* Section 2: Smart Turbo Download Manager (5x High Speed + Chrome Auto-Interceptor + Unlimited Retry) */}
        {(activeSection === 'all' || activeSection === 'downloads') && (
          <DownloadManagerPanel
            tasks={downloads}
            batteryRestrictionDisabled={batteryRestrictionDisabled}
            unlimitedRetryGlobal={unlimitedRetryGlobal}
            networkConnected={networkConnected}
            foregroundServiceEnabled={serviceConfig.foregroundServiceEnabled}
            browserInterceptorEnabled={browserInterceptorEnabled}
            turboBoostEnabled={turboBoostEnabled}
            onToggleBatteryRestriction={handleToggleBatteryRestriction}
            onToggleUnlimitedRetry={handleToggleUnlimitedRetry}
            onToggleNetworkConnection={handleToggleNetworkConnection}
            onToggleBrowserInterceptor={() => {
              setBrowserInterceptorEnabled((v) => {
                const next = !v;
                appendNetworkLog(
                  'BROWSER_INTERCEPTOR',
                  next
                    ? 'Chrome ও সকল ব্রাউজার ডাউনলোড লিংক অটো-অপশন চালু করা হয়েছে'
                    : 'ব্রাউজার অটো-অপশন বন্ধ করা হয়েছে'
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
