import React from 'react';
import { CheckCircle2, AlertCircle, Info, X, HardDriveDownload } from 'lucide-react';

export interface ToastNotificationItem {
  id: string;
  type: 'success' | 'error' | 'info';
  title: string;
  message: string;
  subDetail?: string;
}

interface ToastContainerProps {
  toasts: ToastNotificationItem[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div
      data-testid="toast-container"
      role="region"
      aria-label="সিস্টেম নোটিফিকেশন"
      aria-live="polite"
      className="fixed bottom-5 right-5 z-50 flex flex-col gap-3 max-w-md w-[calc(100vw-2.5rem)] pointer-events-none"
    >
      {toasts.map((toast) => {
        const isSuccess = toast.type === 'success';
        const isError = toast.type === 'error';

        return (
          <div
            key={toast.id}
            role="status"
            className={`pointer-events-auto flex items-start gap-3.5 p-4 rounded-2xl border shadow-xl backdrop-blur-md transition-all ${
              isSuccess
                ? 'bg-emerald-950/95 dark:bg-emerald-950/95 border-emerald-500/50 text-emerald-50'
                : isError
                ? 'bg-rose-950/95 dark:bg-rose-950/95 border-rose-500/50 text-rose-50'
                : 'bg-slate-900/95 dark:bg-slate-900/95 border-blue-500/50 text-slate-50'
            }`}
          >
            <div
              className={`p-2 rounded-xl shrink-0 mt-0.5 ${
                isSuccess
                  ? 'bg-emerald-500/20 text-emerald-300'
                  : isError
                  ? 'bg-rose-500/20 text-rose-300'
                  : 'bg-blue-500/20 text-blue-300'
              }`}
            >
              {isSuccess ? (
                <CheckCircle2 className="w-5 h-5" />
              ) : isError ? (
                <AlertCircle className="w-5 h-5" />
              ) : (
                <Info className="w-5 h-5" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold tracking-tight flex items-center gap-1.5">
                <span>{toast.title}</span>
              </div>
              <p className="text-xs opacity-90 mt-1 break-words leading-relaxed">
                {toast.message}
              </p>
              {toast.subDetail && (
                <div className="mt-1.5 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-black/25 text-[11px] font-mono opacity-85 truncate max-w-full">
                  <HardDriveDownload className="w-3 h-3 shrink-0" />
                  <span className="truncate">{toast.subDetail}</span>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => onDismiss(toast.id)}
              aria-label="নোটিফিকেশন বন্ধ করুন"
              className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors shrink-0 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
