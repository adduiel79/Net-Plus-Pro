import React, { useState } from 'react';
import {
  Download,
  Pause,
  Play,
  Trash2,
  Infinity as InfinityIcon,
  Zap,
  ShieldAlert,
  CheckCircle2,
  Plus,
  WifiOff,
  Wifi,
  RefreshCw,
  Globe,
  Layers,
  HardDrive,
  AlertCircle,
  ClipboardPaste,
  FolderCheck,
  X,
} from 'lucide-react';
import {
  DownloadTask,
  validateDownloadUrl,
  formatBytes,
  computeRetrySchedule,
  computeDownloadStartDelayMs,
  calculateTurboSpeedComparison,
} from '../utils/networkEngine';
import { triggerSaveFileToStorage } from '../utils/realDownloader';

interface BrowserInterceptCandidate {
  fileName: string;
  url: string;
  sizeBytes?: number;
  sourceBrowser: string;
}

interface DownloadManagerPanelProps {
  tasks: DownloadTask[];
  storagePermissionGranted: boolean;
  batteryRestrictionDisabled: boolean;
  unlimitedRetryGlobal: boolean;
  networkConnected: boolean;
  foregroundServiceEnabled: boolean;
  browserInterceptorEnabled: boolean;
  turboBoostEnabled: boolean;
  onRequestStoragePermission: () => void;
  onToggleBatteryRestriction: () => void;
  onToggleUnlimitedRetry: () => void;
  onToggleNetworkConnection: () => void;
  onToggleBrowserInterceptor: () => void;
  onToggleTurboBoost: () => void;
  onAddDownload: (url: string, threads: number, sourceBrowser?: string) => void;
  onTogglePauseTask: (id: string) => void;
  onRemoveTask: (id: string) => void;
  onForceInstantStartTask: (id: string) => void;
}

const REAL_SAMPLE_FILES = [
  {
    label: 'NetPlus Pro Codec Pack (6 MB রিয়েল APK)',
    url: '/api/download/sample/NetPlus-Pro-Codec-Pack.apk?sizeMB=6',
    sizeBytes: 6 * 1024 * 1024,
    browser: 'Google Chrome',
  },
  {
    label: 'Android Turbo Drivers (10 MB রিয়েল ZIP)',
    url: '/api/download/sample/Android-Turbo-Network-Drivers.zip?sizeMB=10',
    sizeBytes: 10 * 1024 * 1024,
    browser: 'Chrome Custom Tab',
  },
  {
    label: 'UHD Sample Stream (4 MB রিয়েল MP4)',
    url: '/api/download/sample/NetPlus-UHD-Test-Stream.mp4?sizeMB=4',
    sizeBytes: 4 * 1024 * 1024,
    browser: 'Samsung Internet / Chrome',
  },
];

export const DownloadManagerPanel: React.FC<DownloadManagerPanelProps> = ({
  tasks,
  storagePermissionGranted,
  batteryRestrictionDisabled,
  unlimitedRetryGlobal,
  networkConnected,
  foregroundServiceEnabled,
  browserInterceptorEnabled,
  turboBoostEnabled,
  onRequestStoragePermission,
  onToggleBatteryRestriction,
  onToggleUnlimitedRetry,
  onToggleNetworkConnection,
  onToggleBrowserInterceptor,
  onToggleTurboBoost,
  onAddDownload,
  onTogglePauseTask,
  onRemoveTask,
  onForceInstantStartTask,
}) => {
  const [urlInput, setUrlInput] = useState<string>('');
  const [threads, setThreads] = useState<number>(16);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'completed'>('all');

  // State for Android Browser Download App Chooser Modal ("Net Plus Pro vs Chrome")
  const [interceptCandidate, setInterceptCandidate] = useState<BrowserInterceptCandidate | null>(
    null
  );

  const currentStartDelayMs = computeDownloadStartDelayMs(
    batteryRestrictionDisabled,
    foregroundServiceEnabled
  );

  // Calculate live comparison between standard 1-stream Chrome and Net Plus Pro Multi-Stream Turbo
  const liveSpeedComparison = calculateTurboSpeedComparison(4.6, threads, turboBoostEnabled);

  const startOrInterceptUrl = (rawUrl: string) => {
    const validation = validateDownloadUrl(rawUrl);
    if (!validation.valid) {
      setUrlError(validation.error || 'অবৈধ URL');
      return;
    }
    setUrlError(null);
    const cleanUrl = validation.normalizedUrl || rawUrl.trim();

    if (browserInterceptorEnabled) {
      setInterceptCandidate({
        fileName: validation.fileName,
        url: cleanUrl,
        sourceBrowser: 'Google Chrome',
      });
    } else {
      onAddDownload(cleanUrl, threads, 'Direct Real Download');
      setUrlInput('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim() && typeof navigator !== 'undefined' && navigator.clipboard?.readText) {
      try {
        const clipText = await navigator.clipboard.readText();
        if (clipText && clipText.trim()) {
          setUrlInput(clipText.trim());
          startOrInterceptUrl(clipText.trim());
          return;
        }
      } catch {
        // Clipboard read permission not granted; proceed to normal validation
      }
    }
    startOrInterceptUrl(urlInput);
  };

  const handlePasteFromClipboard = async () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.readText) {
      try {
        const clipText = await navigator.clipboard.readText();
        if (clipText && clipText.trim()) {
          setUrlInput(clipText.trim());
          setUrlError(null);
        }
      } catch {
        setUrlError('ক্লিপবোর্ড থেকে লিংক পেস্ট করতে ইনপুট বক্সে চেপে ধরে Paste করুন।');
      }
    }
  };

  const handleTriggerBrowserPopupDemo = (preset = REAL_SAMPLE_FILES[0]) => {
    const validation = validateDownloadUrl(preset.url);
    setInterceptCandidate({
      fileName: validation.fileName,
      url: preset.url,
      sizeBytes: preset.sizeBytes,
      sourceBrowser: preset.browser,
    });
  };

  const handleConfirmChooserDownload = (useNetPlusTurbo: boolean) => {
    if (!interceptCandidate) return;
    if (useNetPlusTurbo) {
      onAddDownload(
        interceptCandidate.url,
        threads,
        `${interceptCandidate.sourceBrowser} -> Net Plus Pro Turbo`
      );
    } else {
      onAddDownload(
        interceptCandidate.url,
        1,
        `${interceptCandidate.sourceBrowser} (1-Stream Normal)`
      );
    }
    setInterceptCandidate(null);
    setUrlInput('');
  };

  const filteredTasks = tasks.filter((t) => {
    if (filterStatus === 'active') return t.status !== 'completed';
    if (filterStatus === 'completed') return t.status === 'completed';
    return true;
  });

  return (
    <section
      aria-label="স্মার্ট হাই-স্পিড ডাউনলোড ম্যানেজার ও ব্রাউজার ইন্টারসেপ্টর"
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6"
    >
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>রিয়েল মাল্টি-থ্রেড ডাউনলোড ইঞ্জিন ({threads} Chunks)</span>
            <span className="mx-1.5" aria-hidden="true">·</span>
            <span>ফোনের Internal Storage (Download ফোল্ডার)-এ সরাসরি সেভ</span>
            <span className="mx-1.5" aria-hidden="true">·</span>
            <span>
              স্টার্ট লেটেন্সি: {currentStartDelayMs === 0 ? '0ms (ইনস্ট্যান্ট)' : `${currentStartDelayMs}ms (Doze বিলম্ব)`}
            </span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-1">
            হাই-স্পিড রিয়েল ফাইল ডাউনলোডার (Internal Storage) ও ব্রাউজার অটো-অপশন
          </h2>
        </div>

        {/* Network & Retry Quick Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={onToggleUnlimitedRetry}
            aria-pressed={unlimitedRetryGlobal}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] rounded-xl text-xs font-semibold border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              unlimitedRetryGlobal
                ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
            }`}
          >
            <InfinityIcon className="w-4 h-4" />
            <span>{unlimitedRetryGlobal ? 'Retry Limit: ∞ নেই (Unlimited)' : 'Retry Limit: 3 বার'}</span>
          </button>

          <button
            type="button"
            onClick={onToggleNetworkConnection}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] rounded-xl text-xs font-semibold border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              networkConnected
                ? 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700'
                : 'bg-amber-600 text-white border-amber-600 hover:bg-amber-700'
            }`}
          >
            {networkConnected ? (
              <>
                <WifiOff className="w-3.5 h-3.5" />
                <span>নেটওয়ার্ক ড্রপ টেস্ট করুন</span>
              </>
            ) : (
              <>
                <Wifi className="w-3.5 h-3.5" />
                <span>নেটওয়ার্ক রিকানেক্ট করুন</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Turbo Speed Comparison Card + Browser Download Interceptor Card */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mt-5">
        {/* Left 6 Cols: Chrome vs Net Plus Pro High-Speed Comparison */}
        <div className="lg:col-span-6 p-4 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80 flex flex-col justify-between gap-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400">
                <Layers className="w-4 h-4 shrink-0" />
                <span>মাল্টি-কানেকশন হাই-স্পিড বুস্টার (Real HTTP 206 Byte-Range)</span>
              </div>
              <div className="text-sm font-bold text-slate-900 dark:text-slate-100 mt-1">
                Chrome বা সাধারণ ব্রাউজারের চেয়ে {liveSpeedComparison.multiplier}x দ্রুত রিয়েল ডাউনলোড
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5 leading-relaxed">
                যেকোনো ডাউনলোড লিংক দিলে ফাইলটিকে {threads}টি প্যারালাল চ্যাঙ্কে ভাগ করে ডাউনলোড করে সরাসরি ফোনের Internal Storage (Download ফোল্ডার)-এ সেভ করে।
              </p>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={turboBoostEnabled}
              onClick={onToggleTurboBoost}
              className={`px-3 py-1.5 min-h-[36px] rounded-lg text-xs font-semibold transition-colors cursor-pointer shrink-0 ${
                turboBoostEnabled
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
              }`}
            >
              {turboBoostEnabled ? 'Turbo Boost: ON' : 'Normal'}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-200 dark:border-slate-800 text-xs">
            <div>
              <span className="text-slate-500 dark:text-slate-400">Chrome / সাধারণ ব্রাউজার (1 Stream):</span>
              <div className="font-mono tabular-nums font-semibold text-slate-700 dark:text-slate-300 mt-0.5">
                ~{liveSpeedComparison.browserSingleStreamMBps.toFixed(2)} MB/s
              </div>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400">Net Plus Pro ({threads} Streams):</span>
              <div className="font-mono tabular-nums font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                ~{liveSpeedComparison.netPlusTurboMBps.toFixed(2)} MB/s ({liveSpeedComparison.multiplier}x High Speed)
              </div>
            </div>
          </div>
        </div>

        {/* Right 6 Cols: Chrome / Browser Auto-Download Chooser Configuration */}
        <div className="lg:col-span-6 p-4 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80 flex flex-col justify-between gap-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                <Globe className="w-4 h-4 shrink-0" />
                <span>Chrome ও ব্রাউজার ডাউনলোড ইন্টারসেপ্টর (Auto App Chooser)</span>
              </div>
              <div className="text-sm font-bold text-slate-900 dark:text-slate-100 mt-1">
                ব্রাউজারে ডাউনলোড ক্লিক করলেই অটো অপশন আসবে
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5 leading-relaxed">
                Chrome বা অন্য যেকোনো ব্রাউজারে ডাউনলোড লিংকে ক্লিক করলে ইউজার ব্রাউজার দিয়ে নাকি Net Plus Pro দিয়ে ডাউনলোড করবে তার অপশন অটো পপআপ হবে।
              </p>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={browserInterceptorEnabled}
              onClick={onToggleBrowserInterceptor}
              className={`px-3 py-1.5 min-h-[36px] rounded-lg text-xs font-semibold transition-colors cursor-pointer shrink-0 ${
                browserInterceptorEnabled
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
              }`}
            >
              {browserInterceptorEnabled ? 'Auto-Option: ON' : 'OFF'}
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
            <span className="text-xs text-slate-500 dark:text-slate-400">
              সাপোর্টেড: .apk · .zip · .mp4 · .pdf · .iso · সকল ডাউনলোড লিংক
            </span>
            <button
              type="button"
              onClick={() => handleTriggerBrowserPopupDemo(REAL_SAMPLE_FILES[0])}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[36px] rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white transition-colors cursor-pointer whitespace-nowrap"
            >
              <Globe className="w-3.5 h-3.5" />
              <span>ব্রাউজার ডাউনলোড অপশন টেস্ট করুন</span>
            </button>
          </div>
        </div>
      </div>

      {/* Android Internal Storage Permission + Battery Restriction Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mt-4">
        {/* Card 1: Android Internal Storage Permission (All Files Access / WRITE_EXTERNAL_STORAGE) */}
        <div
          data-testid="storage-permission-card"
          className={`lg:col-span-6 p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
            storagePermissionGranted
              ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/80'
              : 'bg-blue-50/80 dark:bg-blue-950/40 border-blue-300 dark:border-blue-800/80'
          }`}
        >
          <div className="flex items-start gap-3 min-w-0">
            {storagePermissionGranted ? (
              <FolderCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <HardDrive className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
            )}
            <div className="min-w-0 break-words">
              <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {storagePermissionGranted
                  ? 'ফোনের Internal Storage পারমিশন দেওয়া আছে (Download ফোল্ডার সক্রিয়)'
                  : 'ফোনের Internal Storage পারমিশন (All Files Access)'}
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5 leading-relaxed">
                {storagePermissionGranted
                  ? 'যেকোনো লিংকের ফাইল সরাসরি আপনার ফোনের /storage/emulated/0/Download/ ফোল্ডারে বাধাহীনভাবে সেভ হবে।'
                  : 'ফোনের মেমোরি বা Internal Storage (Download ফোল্ডার)-এ সরাসরি বড় ফাইল সেভ করার জন্য স্টোরেজ পারমিশন চালু করুন।'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onRequestStoragePermission}
            className={`px-4 py-2.5 min-h-[42px] rounded-xl text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              storagePermissionGranted
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            {storagePermissionGranted
              ? 'স্টোরেজ পারমিশন সক্রিয় (সেটিংস)'
              : 'স্টোরেজ পারমিশন দিন (Allow Storage)'}
          </button>
        </div>

        {/* Card 2: Android Battery Restriction Bypass */}
        <div
          data-testid="battery-restriction-card"
          className={`lg:col-span-6 p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
            batteryRestrictionDisabled
              ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/80'
              : 'bg-amber-50/80 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800/80'
          }`}
        >
          <div className="flex items-start gap-3 min-w-0">
            {batteryRestrictionDisabled ? (
              <Zap className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <ShieldAlert className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            )}
            <div className="min-w-0 break-words">
              <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {batteryRestrictionDisabled
                  ? 'ব্যাটারি রেস্ট্রিকশন ডিসএবল করা আছে — ইনস্ট্যান্ট স্টার্ট (0ms)'
                  : 'Android ব্যাটারি নীতির কারণে ডাউনলোড দেরিতে শুরু হতে পারে'}
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5 leading-relaxed">
                {batteryRestrictionDisabled
                  ? 'Unrestricted ব্যাটারি মোড চালু রয়েছে। যেকোনো লিংক দিলেই 0ms লেটেন্সিতে ইনস্ট্যান্ট রিয়েল ডাউনলোড শুরু হবে।'
                  : 'ব্যাটারি রেস্ট্রিকশন চালু থাকলে ডাউনলোড শুরু হতে দেরি হতে পারে। ডিসএবল করলে ডাউনলোড ইনস্ট্যান্ট শুরু হবে।'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onToggleBatteryRestriction}
            className={`px-4 py-2.5 min-h-[42px] rounded-xl text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              batteryRestrictionDisabled
                ? 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                : 'bg-amber-600 hover:bg-amber-700 text-white'
            }`}
          >
            {batteryRestrictionDisabled
              ? 'ব্যাটারি মোড: Instant (0ms)'
              : 'ব্যাটারি রেস্ট্রিকশন ডিসএবল করুন'}
          </button>
        </div>
      </div>

      {/* Add New Real Download Form */}
      <form onSubmit={handleSubmit} className="mt-5" noValidate>
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-7">
            <label htmlFor="download-url-input" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              যেকোনো সরাসরি ফাইল ডাউনলোড লিংক দিন (ফোনের Internal Storage / Download ফোল্ডারে সেভ হবে)
            </label>
            <div className="flex items-center gap-2">
              <input
                id="download-url-input"
                type="url"
                value={urlInput}
                onChange={(e) => {
                  setUrlInput(e.target.value);
                  if (urlError) setUrlError(null);
                }}
                placeholder="https://example.com/file.apk অথবা নিচের রিয়েল টেস্ট ফাইলে ক্লিক করুন"
                className="flex-1 min-w-0 px-3.5 py-2.5 rounded-xl text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
              <button
                type="button"
                onClick={handlePasteFromClipboard}
                className="inline-flex items-center gap-1.5 px-3 py-2.5 min-h-[40px] rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer shrink-0"
              >
                <ClipboardPaste className="w-3.5 h-3.5" />
                <span>পেস্ট</span>
              </button>
            </div>
          </div>

          <div className="md:col-span-2">
            <label htmlFor="download-threads-select" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              টার্বো প্যারালাল থ্রেড
            </label>
            <select
              id="download-threads-select"
              value={threads}
              onChange={(e) => setThreads(Number(e.target.value))}
              className="w-full px-3 py-2.5 rounded-xl text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              <option value={8}>8 Chunks (3.8x Speed)</option>
              <option value={16}>16 Chunks (4.8x Turbo)</option>
              <option value={32}>32 Chunks (5.8x Max Turbo)</option>
            </select>
          </div>

          <div className="md:col-span-3 flex items-end">
            <button
              type="submit"
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 min-h-[40px] rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-colors cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span>হাই-স্পিড ডাউনলোড শুরু করুন</span>
            </button>
          </div>
        </div>

        {urlError && (
          <p role="alert" className="mt-2 text-xs font-medium text-red-600 dark:text-red-400">
            {urlError}
          </p>
        )}

        {/* Quick Real Binary File Download Links */}
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-slate-500 dark:text-slate-400">
            ১-ক্লিকে রিয়েল ফাইল ডাউনলোড টেস্ট (Internal Storage-এ সেভ হবে):
          </span>
          {REAL_SAMPLE_FILES.map((preset) => (
            <button
              key={preset.url}
              type="button"
              onClick={() => handleTriggerBrowserPopupDemo(preset)}
              className="text-blue-600 dark:text-blue-400 hover:underline font-medium cursor-pointer"
            >
              {preset.label}
            </button>
          ))}
        </div>
      </form>

      {/* Filter Bar */}
      <div className="mt-6 pt-5 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
          <button
            type="button"
            onClick={() => setFilterStatus('all')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
              filterStatus === 'all'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            সব ফাইল ({tasks.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterStatus('active')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
              filterStatus === 'active'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            চলমান ({tasks.filter((t) => t.status !== 'completed').length})
          </button>
          <button
            type="button"
            onClick={() => setFilterStatus('completed')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
              filterStatus === 'completed'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            সম্পন্ন ({tasks.filter((t) => t.status === 'completed').length})
          </button>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
          <HardDrive className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          <span>ডাউনলোড লোকেশন: /storage/emulated/0/Download/ (Internal Storage)</span>
        </div>
      </div>

      {/* Download Tasks List */}
      <div className="mt-4 divide-y divide-slate-200 dark:divide-slate-800">
        {filteredTasks.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-500 dark:text-slate-400">
            কোনো ডাউনলোড টাস্ক চলমান নেই। উপরে যেকোনো ডাউনলোড লিংক দিন অথবা নিচের রিয়েল টেস্ট ফাইলে ক্লিক করে সরাসরি ফোনের Internal Storage-এ হাই-স্পিডে ডাউনলোড করুন।
          </div>
        ) : (
          filteredTasks.map((task) => {
            const pct =
              task.totalBytes > 0
                ? Math.min(100, Math.round((task.downloadedBytes / task.totalBytes) * 100))
                : task.status === 'completed'
                ? 100
                : 0;
            const retryInfo = computeRetrySchedule(
              Math.max(1, task.retryCount),
              task.unlimitedRetry
            );
            const segmentCount = Math.min(16, Math.max(1, task.threads));

            return (
              <div key={task.id} className="py-4 first:pt-2 last:pb-1">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Download className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                        {task.fileName}
                      </h3>
                    </div>

                    {/* Metadata */}
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500 dark:text-slate-400 break-words">
                      <span className="font-mono tabular-nums">
                        {formatBytes(task.downloadedBytes)} /{' '}
                        {task.totalBytes > 0 ? formatBytes(task.totalBytes) : 'সাইজ নির্ণয় হচ্ছে...'}{' '}
                        ({pct}%)
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>
                        স্ট্যাটাস:{' '}
                        <strong
                          className={
                            task.status === 'completed'
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : task.status === 'error'
                              ? 'text-red-600 dark:text-red-400'
                              : task.status === 'waiting_network' || task.status === 'queued_doze'
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-blue-600 dark:text-blue-400'
                          }
                        >
                          {task.status === 'downloading'
                            ? `রিয়েল টার্বো ডাউনলোড চলছে (${task.speedMBps.toFixed(2)} MB/s)`
                            : task.status === 'queued_doze'
                            ? 'Android Doze ব্যাটারি কিউতে অপেক্ষমাণ'
                            : task.status === 'waiting_network'
                            ? `নেটওয়ার্কের অপেক্ষায় — অটো-রিট্রাই (${retryInfo.policyLabel})`
                            : task.status === 'paused'
                            ? 'বিরতি (Paused)'
                            : task.status === 'error'
                            ? `ত্রুটি: ${task.errorMessage || 'ডাউনলোড ব্যর্থ'}`
                            : `সম্পন্ন ও ফোনে সেভ হয়েছে (${task.speedMBps > 0 ? `${task.speedMBps.toFixed(2)} MB/s` : 'Verified'})`}
                        </strong>
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>থ্রেড: {task.threads} Parallel Streams</span>
                      {task.savedPath && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono text-emerald-700 dark:text-emerald-400 break-all">
                            ফোল্ডার: {task.savedPath}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-2 shrink-0">
                    {task.status === 'queued_doze' && (
                      <button
                        type="button"
                        onClick={() => onForceInstantStartTask(task.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[38px] rounded-lg text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white transition-colors cursor-pointer"
                      >
                        <Zap className="w-3.5 h-3.5" />
                        <span>এখনই ইনস্ট্যান্ট শুরু করুন</span>
                      </button>
                    )}

                    {task.status !== 'completed' && task.status !== 'error' && (
                      <button
                        type="button"
                        onClick={() => onTogglePauseTask(task.id)}
                        aria-label={
                          task.status === 'paused'
                            ? `রিজিউম করুন ${task.fileName}`
                            : `পজ করুন ${task.fileName}`
                        }
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[38px] rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 transition-colors cursor-pointer"
                      >
                        {task.status === 'paused' ? (
                          <>
                            <Play className="w-3.5 h-3.5" />
                            <span>রিজিউম</span>
                          </>
                        ) : task.status === 'waiting_network' ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            <span>অটো-রিট্রাই</span>
                          </>
                        ) : (
                          <>
                            <Pause className="w-3.5 h-3.5" />
                            <span>পজ</span>
                          </>
                        )}
                      </button>
                    )}

                    {task.status === 'completed' && (
                      <div className="flex items-center gap-2">
                        {task.blobUrl && (
                          <button
                            type="button"
                            onClick={() => triggerSaveFileToStorage(task.blobUrl!, task.fileName)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[36px] rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors cursor-pointer"
                          >
                            <HardDrive className="w-3.5 h-3.5" />
                            <span>ফোনে সেভ করুন</span>
                          </button>
                        )}
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400 px-1.5">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Internal Storage-এ সেভড</span>
                        </span>
                      </div>
                    )}

                    {task.status === 'error' && (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600 dark:text-red-400 px-2">
                        <AlertCircle className="w-4 h-4" />
                        <span>ব্যর্থ</span>
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={() => onRemoveTask(task.id)}
                      aria-label={`মুছে ফেলুন ${task.fileName}`}
                      className="p-2 min-h-[38px] min-w-[38px] inline-flex items-center justify-center rounded-lg text-slate-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Real Multi-Segment Parallel Chunk Progress Bar */}
                <div className="mt-3 grid grid-cols-8 sm:grid-cols-16 gap-1">
                  {Array.from({ length: segmentCount }).map((_, idx) => {
                    const realSegFill =
                      task.chunkProgress && task.chunkProgress[idx] !== undefined
                        ? task.chunkProgress[idx]
                        : pct;
                    return (
                      <div
                        key={idx}
                        className="h-2 bg-slate-100 dark:bg-slate-800 rounded-sm overflow-hidden"
                        title={`Chunk #${idx + 1}: ${realSegFill}%`}
                      >
                        <div
                          className={`h-full transition-all duration-150 ${
                            task.status === 'completed'
                              ? 'bg-emerald-600 dark:bg-emerald-500'
                              : task.status === 'error'
                              ? 'bg-red-500'
                              : task.status === 'waiting_network' || task.status === 'queued_doze'
                              ? 'bg-amber-500'
                              : 'bg-blue-600 dark:bg-blue-500'
                          }`}
                          style={{ width: `${task.status === 'completed' ? 100 : realSegFill}%` }}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Android Browser Download Interceptor App Chooser Modal ("কোন অ্যাপ দিয়ে ডাউনলোড করবেন?") */}
      {interceptCandidate && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="browser-chooser-title"
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-4"
        >
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xl">
            <div className="flex items-start justify-between gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
              <div>
                <div className="text-xs font-medium text-blue-600 dark:text-blue-400">
                  <span>{interceptCandidate.sourceBrowser} ডাউনলোড লিংক শনাক্ত হয়েছে</span>
                </div>
                <h3
                  id="browser-chooser-title"
                  className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-0.5"
                >
                  কোন অ্যাপ দিয়ে ডাউনলোড করতে চান?
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setInterceptCandidate(null)}
                aria-label="পপআপ বন্ধ করুন"
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* File Metadata Summary */}
            <div className="mt-4 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs">
              <div className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                ফাইল: {interceptCandidate.fileName}
              </div>
              <div className="text-slate-500 dark:text-slate-400 mt-1 font-mono truncate">
                {interceptCandidate.url}
              </div>
              <div className="text-slate-600 dark:text-slate-300 mt-1">
                <span>
                  {interceptCandidate.sizeBytes
                    ? `সাইজ: ${formatBytes(interceptCandidate.sizeBytes)}`
                    : 'রিয়েল ফাইল স্ট্রিম'}
                </span>
                <span className="mx-1.5" aria-hidden="true">·</span>
                <span>সেভ লোকেশন: ফোনের Internal Storage (Download ফোল্ডার)</span>
              </div>
            </div>

            {/* Choice 1: Net Plus Pro Turbo (High Speed) */}
            <div className="mt-4 space-y-3">
              <div className="p-4 rounded-xl border-2 border-blue-600 dark:border-blue-500 bg-blue-50/50 dark:bg-blue-950/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    Net Plus Pro দিয়ে ডাউনলোড ({threads} Threads Turbo)
                  </div>
                  <div className="text-xs text-emerald-700 dark:text-emerald-400 font-semibold mt-0.5 font-mono">
                    স্পিড: ~{liveSpeedComparison.netPlusTurboMBps.toFixed(2)} MB/s (Chrome-এর চেয়ে {liveSpeedComparison.multiplier}x দ্রুত + Internal Storage সেভ)
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleConfirmChooserDownload(true)}
                  className="px-4 py-2.5 min-h-[42px] rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  Net Plus Pro দিয়ে হাই-স্পিডে ডাউনলোড
                </button>
              </div>

              {/* Choice 2: Standard Browser (Chrome / Default) */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                    {interceptCandidate.sourceBrowser} (সাধারণ ব্রাউজার ডাউনলোড)
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-mono">
                    স্পিড: ~{liveSpeedComparison.browserSingleStreamMBps.toFixed(2)} MB/s (১ থ্রেড · ধীরগতি)
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleConfirmChooserDownload(false)}
                  className="px-4 py-2 min-h-[40px] rounded-xl text-xs font-medium bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  সাধারণ ব্রাউজার দিয়ে ডাউনলোড
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
