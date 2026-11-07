import React from 'react';
import {
  Radio,
  RefreshCw,
  DownloadCloud,
  CheckCircle2,
} from 'lucide-react';
import { NetworkServiceConfig, AppUpdateInfo } from '../utils/networkEngine';

interface ServiceAndUpdatePanelProps {
  serviceConfig: NetworkServiceConfig;
  onUpdateServiceConfig: (partial: Partial<NetworkServiceConfig>) => void;
  networkConnected: boolean;
  networkTransport: 'Wi-Fi 6' | '5G NR' | '4G LTE' | 'Ethernet';
  onChangeTransport: (t: 'Wi-Fi 6' | '5G NR' | '4G LTE' | 'Ethernet') => void;
  batteryRestrictionDisabled: boolean;
  onToggleBatteryRestriction: () => void;
  networkLogs: { id: string; time: string; event: string; detail: string }[];
  updateInfo: AppUpdateInfo;
  isCheckingUpdate: boolean;
  updateInstalled: boolean;
  onCheckForUpdate: () => void;
  onDownloadAndInstallUpdate: () => void;
  autoCheckUpdateOnLaunch: boolean;
  onToggleAutoCheckUpdate: () => void;
}

export const ServiceAndUpdatePanel: React.FC<ServiceAndUpdatePanelProps> = ({
  serviceConfig,
  onUpdateServiceConfig,
  networkConnected,
  networkTransport,
  onChangeTransport,
  batteryRestrictionDisabled,
  onToggleBatteryRestriction,
  networkLogs,
  updateInfo,
  isCheckingUpdate,
  updateInstalled,
  onCheckForUpdate,
  onDownloadAndInstallUpdate,
  autoCheckUpdateOnLaunch,
  onToggleAutoCheckUpdate,
}) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
      {/* Left 7 Cols: Real-Time Network State Service Configuration */}
      <section
        aria-label="রিয়েল-টাইম নেটওয়ার্ক স্টেট সার্ভিস কনফিগারেশন"
        className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 flex flex-col justify-between"
      >
        <div>
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
            <div>
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                <span>রিয়েল-টাইম নেটওয়ার্ক মনিটর</span>
                <span className="mx-1.5" aria-hidden="true">·</span>
                <span>ফোরগ্রাউন্ড ডেটা সিঙ্ক সার্ভিস</span>
              </div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-1">
                নেটওয়ার্ক স্টেট রিয়েল-টাইম সার্ভিস কনফিগারেশন
              </h2>
            </div>

            <div className="text-xs font-mono tabular-nums text-slate-600 dark:text-slate-300">
              স্টেট:{' '}
              <strong
                className={
                  networkConnected
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-red-600 dark:text-red-400'
                }
              >
                {networkConnected ? `ONLINE (${networkTransport})` : 'DISCONNECTED'}
              </strong>
            </div>
          </div>

          {/* Service Switches & Parameters */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-5">
            {/* Toggle 1: Foreground DataSync Service */}
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                  Foreground Network Service
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  ব্যাকগ্রাউন্ডে তাৎক্ষণিক নেটওয়ার্ক আপডেট নিশ্চিত করে
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={serviceConfig.foregroundServiceEnabled}
                aria-label="Foreground Network Service টগল করুন"
                onClick={() =>
                  onUpdateServiceConfig({
                    foregroundServiceEnabled: !serviceConfig.foregroundServiceEnabled,
                  })
                }
                className={`px-3 py-1.5 min-h-[38px] rounded-lg text-xs font-semibold transition-colors cursor-pointer shrink-0 ${
                  serviceConfig.foregroundServiceEnabled
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                }`}
              >
                {serviceConfig.foregroundServiceEnabled ? 'সক্রিয় (ON)' : 'বন্ধ (OFF)'}
              </button>
            </div>

            {/* Toggle 2: Battery Restriction Unrestricted Mode */}
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                  ব্যাটারি রেস্ট্রিকশন বাইপাস
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  ডিসএবল করলে ডাউনলোড 0ms-এ ইনস্ট্যান্ট শুরু হয়
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={batteryRestrictionDisabled}
                aria-label="ব্যাটারি রেস্ট্রিকশন বাইপাস টগল করুন"
                onClick={onToggleBatteryRestriction}
                className={`px-3 py-1.5 min-h-[38px] rounded-lg text-xs font-semibold transition-colors cursor-pointer shrink-0 ${
                  batteryRestrictionDisabled
                    ? 'bg-emerald-600 text-white'
                    : 'bg-amber-600 text-white'
                }`}
              >
                {batteryRestrictionDisabled ? 'Unrestricted (0ms)' : 'Restricted'}
              </button>
            </div>

            {/* Toggle 3: Auto-Resume on Network Reconnect */}
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                  Auto-Resume on Reconnect
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  নেটওয়ার্ক ফিরে পাওয়া মাত্র পেন্ডিং চ্যাঙ্ক শুরু করে
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={serviceConfig.autoResumeOnReconnect}
                aria-label="Auto-Resume on Reconnect টগল করুন"
                onClick={() =>
                  onUpdateServiceConfig({
                    autoResumeOnReconnect: !serviceConfig.autoResumeOnReconnect,
                  })
                }
                className={`px-3 py-1.5 min-h-[38px] rounded-lg text-xs font-semibold transition-colors cursor-pointer shrink-0 ${
                  serviceConfig.autoResumeOnReconnect
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                }`}
              >
                {serviceConfig.autoResumeOnReconnect ? 'সক্রিয় (ON)' : 'বন্ধ (OFF)'}
              </button>
            </div>

            {/* Transport Simulation Selector */}
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between gap-3">
              <div>
                <label
                  htmlFor="transport-type-select"
                  className="block text-xs font-semibold text-slate-900 dark:text-slate-100"
                >
                  অ্যাক্টিভ নেটওয়ার্ক ট্রান্সপোর্ট
                </label>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  নেটওয়ার্ক কানেকশন প্রোফাইল
                </div>
              </div>
              <select
                id="transport-type-select"
                value={networkTransport}
                onChange={(e) =>
                  onChangeTransport(
                    e.target.value as 'Wi-Fi 6' | '5G NR' | '4G LTE' | 'Ethernet'
                  )
                }
                className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-xs font-medium rounded-lg px-2.5 py-1.5 border border-slate-200 dark:border-slate-700"
              >
                <option value="Wi-Fi 6">Wi-Fi 6</option>
                <option value="5G NR">5G NR</option>
                <option value="4G LTE">4G LTE</option>
                <option value="Ethernet">Ethernet</option>
              </select>
            </div>
          </div>
        </div>

        {/* Real-time Network Callback Event Log */}
        <div className="mt-5 pt-4 border-t border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-800 dark:text-slate-200 mb-2">
            <span className="flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>রিয়েল-টাইম নেটওয়ার্ক ইভেন্ট লগ (Live Network State Stream)</span>
            </span>
            <span className="font-mono text-slate-500">Keep-Alive: {serviceConfig.keepAliveIntervalSec}s</span>
          </div>
          <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 rounded-xl p-3 max-h-36 overflow-y-auto space-y-1.5 font-mono text-xs">
            {networkLogs.map((log) => (
              <div key={log.id} className="flex items-start gap-2 text-slate-700 dark:text-slate-300">
                <span className="text-slate-400 shrink-0">[{log.time}]</span>
                <span className="font-semibold text-blue-600 dark:text-blue-400 shrink-0">
                  {log.event}
                </span>
                <span className="text-slate-600 dark:text-slate-400">{log.detail}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Right 5 Cols: Automatic Update Checker */}
      <section
        aria-label="অটোমেটিক অ্যাপ আপডেট চেকার"
        className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 flex flex-col justify-between"
      >
        <div>
          <div className="flex items-center justify-between gap-2 pb-4 border-b border-slate-200 dark:border-slate-800">
            <div>
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                <span>অটো আপডেট সিস্টেম</span>
                <span className="mx-1.5" aria-hidden="true">·</span>
                <span>OTA রিলিজ চ্যানেল</span>
              </div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-1">
                অটোমেটিক আপডেট চেকিং (Auto-Update)
              </h2>
            </div>

            <button
              type="button"
              onClick={onCheckForUpdate}
              disabled={isCheckingUpdate}
              className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[38px] rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isCheckingUpdate ? 'animate-spin' : ''}`} />
              <span>{isCheckingUpdate ? 'চেক হচ্ছে...' : 'আপডেট চেক করুন'}</span>
            </button>
          </div>

          {/* Version Comparison Block */}
          <div className="mt-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 dark:text-slate-400">বর্তমান সংস্করণ:</span>
              <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                {updateInstalled ? updateInfo.latestVersion : updateInfo.currentVersion}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs mt-2">
              <span className="text-slate-500 dark:text-slate-400">সর্বশেষ স্টেবল রিলিজ:</span>
              <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                {updateInfo.latestVersion} ({updateInfo.apkSizeMb} MB)
              </span>
            </div>

            <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-800">
              <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1.5">
                নতুন সংস্করণে যা যা যুক্ত হয়েছে:
              </div>
              <ul className="space-y-1 text-xs text-slate-600 dark:text-slate-300">
                {updateInfo.changelog.map((line, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <span aria-hidden="true">·</span>
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Auto-check on startup toggle */}
          <div className="mt-4 flex items-center justify-between text-xs">
            <span className="text-slate-600 dark:text-slate-300 font-medium">
              অ্যাপ চালুর সময় স্বয়ংক্রিয়ভাবে আপডেট চেক করুন
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={autoCheckUpdateOnLaunch}
              onClick={onToggleAutoCheckUpdate}
              className={`px-3 py-1.5 min-h-[36px] rounded-lg font-semibold transition-colors cursor-pointer ${
                autoCheckUpdateOnLaunch
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
              }`}
            >
              {autoCheckUpdateOnLaunch ? 'চালু (Auto)' : 'ম্যানুয়াল'}
            </button>
          </div>
        </div>

        <div className="mt-5 pt-4 border-t border-slate-200 dark:border-slate-800">
          {updateInstalled ? (
            <div className="w-full py-2.5 px-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300 text-xs font-semibold flex items-center justify-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              <span>সর্বশেষ সংস্করণ ({updateInfo.latestVersion}) ইনস্টল করা আছে</span>
            </div>
          ) : (
            <button
              type="button"
              onClick={onDownloadAndInstallUpdate}
              className="w-full py-2.5 px-4 min-h-[42px] rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <DownloadCloud className="w-4 h-4" />
              <span>আপডেট ডাউনলোড ও ইনস্টল করুন ({updateInfo.latestVersion})</span>
            </button>
          )}
        </div>
      </section>
    </div>
  );
};
