import React, { useState, useRef } from 'react';
import {
  Download,
  Pause,
  Play,
  Trash2,
  Infinity as InfinityIcon,
  Zap,
  ShieldAlert,
  CheckCircle2,
  WifiOff,
  Wifi,
  RefreshCw,
  HardDrive,
  AlertCircle,
  ClipboardPaste,
  FolderCheck,
  Clock,
  Sparkles,
  Gauge,
} from 'lucide-react';
import {
  DownloadTask,
  validateDownloadUrl,
  formatBytes,
  formatRemainingTimeBn,
  computeRetrySchedule,
  computeDownloadStartDelayMs,
  calculateTurboSpeedComparison,
} from '../utils/networkEngine';
import {
  triggerSaveFileToStorage,
  readSystemClipboardText,
} from '../utils/realDownloader';

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
    label: 'NetPlus Codec Pack (6 MB APK)',
    url: '/api/download/sample/NetPlus-Pro-Codec-Pack.apk?sizeMB=6',
  },
  {
    label: 'Android Turbo Drivers (10 MB ZIP)',
    url: '/api/download/sample/Android-Turbo-Network-Drivers.zip?sizeMB=10',
  },
  {
    label: 'UHD Video Sample (4 MB MP4)',
    url: '/api/download/sample/NetPlus-UHD-Test-Stream.mp4?sizeMB=4',
  },
];

export const DownloadManagerPanel: React.FC<DownloadManagerPanelProps> = ({
  tasks,
  storagePermissionGranted,
  batteryRestrictionDisabled,
  unlimitedRetryGlobal,
  networkConnected,
  foregroundServiceEnabled,
  turboBoostEnabled,
  onRequestStoragePermission,
  onToggleBatteryRestriction,
  onToggleUnlimitedRetry,
  onToggleNetworkConnection,
  onToggleTurboBoost,
  onAddDownload,
  onTogglePauseTask,
  onRemoveTask,
  onForceInstantStartTask,
}) => {
  const [urlInput, setUrlInput] = useState<string>('');
  const [threads, setThreads] = useState<number>(32);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [pasteNotice, setPasteNotice] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'completed'>('all');
  const inputRef = useRef<HTMLInputElement | null>(null);

  const currentStartDelayMs = computeDownloadStartDelayMs(
    batteryRestrictionDisabled,
    foregroundServiceEnabled
  );

  const liveSpeedComparison = calculateTurboSpeedComparison(4.6, threads, turboBoostEnabled);

  // Direct Instant Download without any intermediate chooser popup
  const startDirectDownload = (rawUrl: string, sourceLabel = 'Direct Turbo Engine') => {
    const validation = validateDownloadUrl(rawUrl);
    if (!validation.valid) {
      setUrlError(validation.error || 'অনুগ্রহ করে একটি বৈধ ডাউনলোড লিংক দিন।');
      return;
    }
    setUrlError(null);
    setPasteNotice(null);
    const cleanUrl = validation.normalizedUrl || rawUrl.trim();
    onAddDownload(cleanUrl, threads, sourceLabel);
    setUrlInput('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim()) {
      const clipText = await readSystemClipboardText();
      if (clipText) {
        setUrlInput(clipText);
        startDirectDownload(clipText, 'Clipboard Auto-Start');
        return;
      }
    }
    startDirectDownload(urlInput, 'Direct Turbo Engine');
  };

  const handlePasteFromClipboard = async () => {
    setUrlError(null);
    const clipText = await readSystemClipboardText();
    if (clipText) {
      setUrlInput(clipText);
      setPasteNotice('ক্লিপবোর্ড থেকে লিংক অটো-পেস্ট করা হয়েছে!');
      window.setTimeout(() => setPasteNotice(null), 2500);
      return;
    }
    if (inputRef.current) {
      inputRef.current.focus();
      try {
        document.execCommand('paste');
      } catch {
        // ignore
      }
    }
    setUrlError('ক্লিপবোর্ডে কোনো কপি করা লিংক পাওয়া যায়নি। প্রথমে লিংক কপি করুন।');
  };

  const filteredTasks = tasks.filter((t) => {
    if (filterStatus === 'active') return t.status !== 'completed';
    if (filterStatus === 'completed') return t.status === 'completed';
    return true;
  });

  return (
    <section
      aria-label="হাই-স্পিড রিয়েল ডাউনলোড ম্যানেজার"
      className="bg-white dark:bg-slate-900/95 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-5 sm:p-7 shadow-sm"
    >
      {/* Top Section Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-slate-200/80 dark:border-slate-800/80">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-semibold text-blue-600 dark:text-blue-400">
            <Sparkles className="w-3.5 h-3.5" />
            <span>৫১২KB র‍্যাম বাফারড মাল্টি-থ্রেড ইঞ্জিন ({threads} Chunks)</span>
            <span aria-hidden="true">·</span>
            <span>Chrome-এর চেয়ে {liveSpeedComparison.multiplier}x দ্রুত</span>
            <span aria-hidden="true">·</span>
            <span>
              স্টার্ট: {currentStartDelayMs === 0 ? '0ms ইনস্ট্যান্ট' : `${currentStartDelayMs}ms`}
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white mt-1">
            হাই-স্পিড টার্বো ডাউনলোডার (Direct Internal Storage)
          </h2>
        </div>

        {/* Quick Engine Toggles */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onToggleTurboBoost}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[38px] rounded-xl text-xs font-semibold border transition-colors cursor-pointer whitespace-nowrap ${
              turboBoostEnabled
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
            }`}
          >
            <Gauge className="w-3.5 h-3.5" />
            <span>{turboBoostEnabled ? `Turbo ${liveSpeedComparison.multiplier}x: ON` : 'Turbo: OFF'}</span>
          </button>

          <button
            type="button"
            onClick={onToggleUnlimitedRetry}
            aria-pressed={unlimitedRetryGlobal}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[38px] rounded-xl text-xs font-semibold border transition-colors cursor-pointer whitespace-nowrap ${
              unlimitedRetryGlobal
                ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
            }`}
          >
            <InfinityIcon className="w-4 h-4" />
            <span>{unlimitedRetryGlobal ? 'Auto-Retry: ∞ Unlimited' : 'Retry: 3x'}</span>
          </button>

          <button
            type="button"
            onClick={onToggleNetworkConnection}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[38px] rounded-xl text-xs font-semibold border transition-colors cursor-pointer whitespace-nowrap ${
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

      {/* HERO COMMAND BAR: Paste Link & Direct Download */}
      <form
        onSubmit={handleSubmit}
        className="mt-5 p-4 sm:p-5 rounded-2xl bg-slate-50 dark:bg-slate-950/90 border border-slate-200/90 dark:border-slate-800"
        noValidate
      >
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
          <label
            htmlFor="download-url-input"
            className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-100"
          >
            ডাউনলোড লিংক দিন (ক্লিক করলেই সরাসরি ফোনের Internal Storage / Download ফোল্ডারে ডাউনলোড শুরু হবে)
          </label>
          <span className="text-xs font-mono text-emerald-600 dark:text-emerald-400">
            টার্গেট স্পিড: ~{liveSpeedComparison.netPlusTurboMBps.toFixed(2)} MB/s
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
          {/* Input + Auto Paste Button */}
          <div className="lg:col-span-7 flex items-stretch gap-2">
            <input
              ref={inputRef}
              id="download-url-input"
              type="url"
              value={urlInput}
              onChange={(e) => {
                setUrlInput(e.target.value);
                if (urlError) setUrlError(null);
              }}
              placeholder="এখানে যেকোনো ফাইল ডাউনলোড লিংক (https://...) পেস্ট করুন..."
              className="flex-1 min-w-0 px-4 py-3 rounded-xl text-xs sm:text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
            <button
              type="button"
              onClick={handlePasteFromClipboard}
              aria-label="ক্লিপবোর্ড থেকে লিংক পেস্ট করুন"
              className="inline-flex items-center gap-1.5 px-4 py-3 min-h-[44px] rounded-xl text-xs font-bold bg-indigo-50 dark:bg-indigo-950/70 hover:bg-indigo-100 dark:hover:bg-indigo-900/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 transition-colors cursor-pointer shrink-0"
            >
              <ClipboardPaste className="w-4 h-4" />
              <span>পেস্ট</span>
            </button>
          </div>

          {/* Parallel Chunks Selector */}
          <div className="lg:col-span-2">
            <select
              id="download-threads-select"
              aria-label="টার্বো প্যারালাল থ্রেড"
              value={threads}
              onChange={(e) => setThreads(Number(e.target.value))}
              className="w-full h-full min-h-[44px] px-3.5 py-3 rounded-xl text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              <option value={8}>8 Chunks (3.8x Speed)</option>
              <option value={16}>16 Chunks (4.8x Turbo)</option>
              <option value={32}>32 Chunks (5.8x Max Turbo)</option>
            </select>
          </div>

          {/* Direct Start Download Button */}
          <div className="lg:col-span-3">
            <button
              type="submit"
              className="w-full h-full min-h-[44px] inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-xs sm:text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-colors cursor-pointer whitespace-nowrap"
            >
              <Download className="w-4 h-4" />
              <span>হাই-স্পিড ডাউনলোড শুরু করুন</span>
            </button>
          </div>
        </div>

        {urlError && (
          <p role="alert" className="mt-2.5 text-xs font-medium text-red-600 dark:text-red-400">
            {urlError}
          </p>
        )}

        {pasteNotice && (
          <p className="mt-2.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
            {pasteNotice}
          </p>
        )}

        {/* 1-Click Direct Real Test Files (Starts Immediately Without Any Popup) */}
        <div className="mt-3.5 pt-3 border-t border-slate-200/80 dark:border-slate-800/80 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-slate-500 dark:text-slate-400 font-medium">
            ১-ক্লিকে সরাসরি রিয়েল ডাউনলোড টেস্ট:
          </span>
          {REAL_SAMPLE_FILES.map((preset) => (
            <button
              key={preset.url}
              type="button"
              onClick={() => startDirectDownload(preset.url, '1-Click Direct Test')}
              className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-blue-600 dark:text-blue-400 hover:border-blue-500 font-semibold transition-colors cursor-pointer"
            >
              {preset.label}
            </button>
          ))}
        </div>
      </form>

      {/* Storage Permission & Battery Instant Mode Bar */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 mt-4">
        <div
          data-testid="storage-permission-card"
          className={`lg:col-span-6 p-3.5 rounded-2xl border flex items-center justify-between gap-3 ${
            storagePermissionGranted
              ? 'bg-emerald-50/60 dark:bg-emerald-950/25 border-emerald-200 dark:border-emerald-900/70'
              : 'bg-blue-50/70 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800/70'
          }`}
        >
          <div className="flex items-center gap-3 min-w-0">
            {storagePermissionGranted ? (
              <FolderCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            ) : (
              <HardDrive className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0" />
            )}
            <div className="min-w-0">
              <div className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                {storagePermissionGranted
                  ? 'Internal Storage পারমিশন সক্রিয় আছে'
                  : 'ফোনের Internal Storage পারমিশন'}
              </div>
              <div className="text-xs text-slate-600 dark:text-slate-400 truncate">
                লোকেশন: /storage/emulated/0/Download/
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onRequestStoragePermission}
            className={`px-3.5 py-2 min-h-[38px] rounded-xl text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              storagePermissionGranted
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            {storagePermissionGranted ? 'পারমিশন দেওয়া আছে' : 'স্টোরেজ পারমিশন দিন'}
          </button>
        </div>

        <div
          data-testid="battery-restriction-card"
          className={`lg:col-span-6 p-3.5 rounded-2xl border flex items-center justify-between gap-3 ${
            batteryRestrictionDisabled
              ? 'bg-emerald-50/60 dark:bg-emerald-950/25 border-emerald-200 dark:border-emerald-900/70'
              : 'bg-amber-50/70 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800/70'
          }`}
        >
          <div className="flex items-center gap-3 min-w-0">
            {batteryRestrictionDisabled ? (
              <Zap className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            ) : (
              <ShieldAlert className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
            )}
            <div className="min-w-0">
              <div className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                {batteryRestrictionDisabled
                  ? 'ইনস্ট্যান্ট ডাউনলোড মোড (0ms Start)'
                  : 'ব্যাটারি রেস্ট্রিকশন চালু আছে'}
              </div>
              <div className="text-xs text-slate-600 dark:text-slate-400 truncate">
                {batteryRestrictionDisabled
                  ? 'ব্যাকগ্রাউন্ডে কোনো দেরি ছাড়াই ডাউনলোড চলবে'
                  : 'ডিসএবল করলে 0ms-এ ইনস্ট্যান্ট শুরু হবে'}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onToggleBatteryRestriction}
            className={`px-3.5 py-2 min-h-[38px] rounded-xl text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              batteryRestrictionDisabled
                ? 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700'
                : 'bg-amber-600 hover:bg-amber-700 text-white'
            }`}
          >
            {batteryRestrictionDisabled ? 'Instant: ON' : 'ডিসএবল করুন'}
          </button>
        </div>
      </div>

      {/* Queue Filter Header */}
      <div className="mt-6 pt-5 border-t border-slate-200/80 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800/90 rounded-xl">
          <button
            type="button"
            onClick={() => setFilterStatus('all')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
              filterStatus === 'all'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            সব ডাউনলোড ({tasks.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterStatus('active')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
              filterStatus === 'active'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            চলমান ({tasks.filter((t) => t.status !== 'completed').length})
          </button>
          <button
            type="button"
            onClick={() => setFilterStatus('completed')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
              filterStatus === 'completed'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            সম্পন্ন ({tasks.filter((t) => t.status === 'completed').length})
          </button>
        </div>

        <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
          পাশে রিয়েল-টাইমে কত মিনিট ও সেকেন্ডে ডাউনলোড হবে তা লাইভ দেখা যাবে
        </div>
      </div>

      {/* Download Tasks Queue with Real-Time Remaining Time on the Side */}
      <div className="mt-4 space-y-3">
        {filteredTasks.length === 0 ? (
          <div className="py-10 px-4 rounded-2xl bg-slate-50/70 dark:bg-slate-950/50 border border-dashed border-slate-200 dark:border-slate-800 text-center text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            বর্তমানে কোনো ডাউনলোড চলছে না। উপরে যেকোনো লিংক পেস্ট করে <strong>হাই-স্পিড ডাউনলোড শুরু করুন</strong> বাটনে ক্লিক করুন।
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
            const remainingTimeText =
              task.status === 'completed'
                ? 'ডাউনলোড সম্পন্ন হয়েছে (০ সেকেন্ড)'
                : task.status === 'paused'
                ? 'বিরতি দেওয়া হয়েছে (Paused)'
                : task.status === 'waiting_network'
                ? 'নেটওয়ার্ক এলেই অটো-রিজিউম হবে'
                : formatRemainingTimeBn(task.etaSeconds);

            return (
              <div
                key={task.id}
                className="p-4 sm:p-5 rounded-2xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200/90 dark:border-slate-800 transition-all"
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Left Info Column */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-blue-600/10 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                        <Download className="w-4 h-4" />
                      </div>
                      <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white truncate">
                        {task.fileName}
                      </h3>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-slate-600 dark:text-slate-400 break-words">
                      <span className="font-mono tabular-nums font-semibold text-slate-800 dark:text-slate-200">
                        {formatBytes(task.downloadedBytes)} /{' '}
                        {task.totalBytes > 0 ? formatBytes(task.totalBytes) : 'সাইজ নির্ণয় হচ্ছে...'}{' '}
                        ({pct}%)
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{task.threads} Parallel Streams</span>
                      {task.savedPath && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono text-emerald-700 dark:text-emerald-400 break-all">
                            {task.savedPath}
                          </span>
                        </>
                      )}
                    </div>

                    {task.status === 'waiting_network' && (
                      <div className="mt-1.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
                        নেটওয়ার্ক সংযোগ বিচ্ছিন্ন — অটো-রিট্রাই সক্রিয় ({retryInfo.policyLabel})
                      </div>
                    )}
                    {task.status === 'error' && (
                      <div className="mt-1.5 text-xs font-semibold text-red-600 dark:text-red-400 break-all">
                        ত্রুটি: {task.errorMessage || 'ডাউনলোড ব্যর্থ'}
                      </div>
                    )}
                  </div>

                  {/* Right Side: Real-Time Speed + Minutes/Seconds Remaining + Action Controls */}
                  <div className="flex flex-wrap sm:flex-nowrap items-center justify-between lg:justify-end gap-3 shrink-0 pt-3 lg:pt-0 border-t lg:border-t-0 border-slate-200/70 dark:border-slate-800/70">
                    {/* Prominent Real-Time ETA & Live Speed Box */}
                    <div className="px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center gap-3">
                      <div>
                        <div className="flex items-center gap-1 text-[11px] font-semibold text-blue-600 dark:text-blue-400">
                          <Clock className="w-3.5 h-3.5 shrink-0" />
                          <span>{remainingTimeText}</span>
                        </div>
                        <div className="text-xs sm:text-sm font-mono tabular-nums font-bold text-slate-900 dark:text-white mt-0.5">
                          {task.status === 'downloading'
                            ? `${task.speedMBps.toFixed(2)} MB/s`
                            : task.status === 'completed'
                            ? `সম্পন্ন (${task.speedMBps.toFixed(2)} MB/s)`
                            : '0.00 MB/s'}
                        </div>
                      </div>
                    </div>

                    {/* Control Buttons */}
                    <div className="flex items-center gap-2">
                      {task.status === 'queued_doze' && (
                        <button
                          type="button"
                          onClick={() => onForceInstantStartTask(task.id)}
                          className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[38px] rounded-xl text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white transition-colors cursor-pointer"
                        >
                          <Zap className="w-3.5 h-3.5" />
                          <span>ইনস্ট্যান্ট শুরু</span>
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
                          className={`inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[38px] rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                            task.status === 'paused'
                              ? 'bg-blue-600 hover:bg-blue-700 text-white'
                              : 'bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200'
                          }`}
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
                              className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[38px] rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors cursor-pointer"
                            >
                              <HardDrive className="w-3.5 h-3.5" />
                              <span>ফোনে সেভ করুন</span>
                            </button>
                          )}
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400 px-1.5">
                            <CheckCircle2 className="w-4 h-4" />
                            <span>সেভড</span>
                          </span>
                        </div>
                      )}

                      {task.status === 'error' && (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 dark:text-red-400 px-2">
                          <AlertCircle className="w-4 h-4" />
                          <span>ব্যর্থ</span>
                        </span>
                      )}

                      <button
                        type="button"
                        onClick={() => onRemoveTask(task.id)}
                        aria-label={`মুছে ফেলুন ${task.fileName}`}
                        className="p-2 min-h-[38px] min-w-[38px] inline-flex items-center justify-center rounded-xl text-slate-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-slate-200/70 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Overall Smooth Progress Bar + Multi-Chunk Visualizer */}
                <div className="mt-3.5 space-y-1.5">
                  <div className="w-full h-2.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-150 rounded-full ${
                        task.status === 'completed'
                          ? 'bg-emerald-500'
                          : task.status === 'error'
                          ? 'bg-red-500'
                          : task.status === 'waiting_network' || task.status === 'paused'
                          ? 'bg-amber-500'
                          : 'bg-blue-600'
                      }`}
                      style={{ width: `${task.status === 'completed' ? 100 : pct}%` }}
                    />
                  </div>

                  <div className="grid grid-cols-8 sm:grid-cols-16 gap-1">
                    {Array.from({ length: segmentCount }).map((_, idx) => {
                      const realSegFill =
                        task.chunkProgress && task.chunkProgress[idx] !== undefined
                          ? task.chunkProgress[idx]
                          : pct;
                      return (
                        <div
                          key={idx}
                          className="h-1.5 bg-slate-200/80 dark:bg-slate-800/90 rounded-xs overflow-hidden"
                          title={`Chunk #${idx + 1}: ${realSegFill}%`}
                        >
                          <div
                            className={`h-full transition-all duration-150 ${
                              task.status === 'completed'
                                ? 'bg-emerald-500'
                                : task.status === 'error'
                                ? 'bg-red-500'
                                : task.status === 'waiting_network' || task.status === 'paused'
                                ? 'bg-amber-500'
                                : 'bg-indigo-500'
                            }`}
                            style={{ width: `${task.status === 'completed' ? 100 : realSegFill}%` }}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
};
