import React, { useState } from 'react';
import { Phone, MessageCircle, Mail, Copy, Check, Award, ShieldCheck } from 'lucide-react';

export const DeveloperProfilePanel: React.FC = () => {
  const [copiedField, setCopiedField] = useState<'phone' | 'whatsapp' | 'email' | null>(null);

  const handleCopy = (field: 'phone' | 'whatsapp' | 'email', value: string) => {
    navigator.clipboard?.writeText(value);
    setCopiedField(field);
    window.setTimeout(() => {
      setCopiedField((prev) => (prev === field ? null : prev));
    }, 1800);
  };

  return (
    <section
      aria-label="অ্যাপ ডেভেলপার পরিচিতি"
      data-testid="developer-profile-section"
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6"
    >
      {/* Section Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>অফিসিয়াল ডেভেলপার প্রোফাইল</span>
            <span className="mx-1.5" aria-hidden="true">·</span>
            <span>Net Plus Pro</span>
            <span className="mx-1.5" aria-hidden="true">·</span>
            <span>সার্বক্ষণিক সাপোর্ট ও যোগাযোগ</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-1">
            অ্যাপ ডেভেলপার পরিচিতি (Developer Profile)
          </h2>
        </div>

        <div className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
          <ShieldCheck className="w-4 h-4 shrink-0" />
          <span>ভেরিফায়েড অ্যাপ ডেভেলপার</span>
        </div>
      </div>

      {/* Main Profile Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-6 items-center">
        {/* Left 5 Cols: Developer Photo & Identity Card */}
        <div className="lg:col-span-5 flex flex-col sm:flex-row lg:flex-col items-center text-center sm:text-left lg:text-center gap-5 p-5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80">
          <div className="w-36 h-36 sm:w-40 sm:h-40 rounded-full overflow-hidden border-4 border-blue-600 dark:border-blue-500 bg-slate-900 shrink-0 shadow-md">
            <img
              src="/assets/aistudio/file_000000008b70821197eef6b1e7f14a65_b0bafffc.png"
              alt="ডেভেলপার মোঃ জুয়েল - Net Plus Pro"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
          </div>

          <div className="min-w-0">
            <div className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 dark:text-blue-400">
              <Award className="w-3.5 h-3.5 shrink-0" />
              <span>লিড ডেভেলপার ও ফাউন্ডার</span>
            </div>
            <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">
              মোঃ জুয়েল
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-1.5 leading-relaxed">
              অ্যান্ড্রয়েড নেটওয়ার্ক অপ্টিমাইজেশন, হাই-স্পিড মাল্টি-থ্রেড ডাউনলোড ইঞ্জিন এবং রিয়েল-টাইম Speed Test সিস্টেম ডেভেলপার।
            </p>
            <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
              <span>Fast Speed</span>
              <span className="mx-1.5" aria-hidden="true">·</span>
              <span>Safe &amp; Secure</span>
              <span className="mx-1.5" aria-hidden="true">·</span>
              <span>Stable Connection</span>
            </div>
          </div>
        </div>

        {/* Right 7 Cols: Direct Contact Channels (Mobile, WhatsApp, Email) */}
        <div className="lg:col-span-7 space-y-3.5">
          {/* 1. Mobile Number */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-blue-600/10 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                <Phone className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  মোবাইল নম্বর (Direct Call)
                </div>
                <div className="text-base font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100 mt-0.5">
                  ০১৬৩৩৩৬৪৪৮৭
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => handleCopy('phone', '01633364487')}
                aria-label="মোবাইল নম্বর কপি করুন"
                className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[38px] rounded-xl text-xs font-medium bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer whitespace-nowrap"
              >
                {copiedField === 'phone' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                    <span>কপি হয়েছে</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>কপি</span>
                  </>
                )}
              </button>

              <a
                href="tel:+8801633364487"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[38px] rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-colors whitespace-nowrap"
              >
                <Phone className="w-3.5 h-3.5" />
                <span>কল করুন</span>
              </a>
            </div>
          </div>

          {/* 2. WhatsApp Number */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-emerald-600/10 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <MessageCircle className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  হোয়াটসঅ্যাপ (WhatsApp Support)
                </div>
                <div className="text-base font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100 mt-0.5">
                  ০১৬৩৩৩৬৪৪৮৭
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => handleCopy('whatsapp', '01633364487')}
                aria-label="হোয়াটসঅ্যাপ নম্বর কপি করুন"
                className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[38px] rounded-xl text-xs font-medium bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer whitespace-nowrap"
              >
                {copiedField === 'whatsapp' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                    <span>কপি হয়েছে</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>কপি</span>
                  </>
                )}
              </button>

              <a
                href="https://wa.me/8801633364487"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[38px] rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors whitespace-nowrap"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span>WhatsApp মেসেজ</span>
              </a>
            </div>
          </div>

          {/* 3. Email Address */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-indigo-600/10 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                <Mail className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  ইমেইল অ্যাড্রেস (Official Email)
                </div>
                <div className="text-sm sm:text-base font-bold font-mono text-slate-900 dark:text-slate-100 mt-0.5 truncate">
                  adzuiel79@gmail.com
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => handleCopy('email', 'adzuiel79@gmail.com')}
                aria-label="ইমেইল অ্যাড্রেস কপি করুন"
                className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[38px] rounded-xl text-xs font-medium bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer whitespace-nowrap"
              >
                {copiedField === 'email' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                    <span>কপি হয়েছে</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>কপি</span>
                  </>
                )}
              </button>

              <a
                href="mailto:adzuiel79@gmail.com"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[38px] rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white transition-colors whitespace-nowrap"
              >
                <Mail className="w-3.5 h-3.5" />
                <span>ইমেইল পাঠান</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
