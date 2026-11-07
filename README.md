# NetPulse Pro — Android Download & Speed Test Suite

রিয়েল-টাইম **Speed Test (Download MB/s, Upload MB/s, Ping ও Jitter)**, **লিমিটবিহীন অটো-রিট্রাই (`∞ Unlimited Retry`)**, **Android ব্যাটারি রেস্ট্রিকশন বাইপাস (`0ms Instant Start`)**, **রিয়েল-টাইম নেটওয়ার্ক ফোরগ্রাউন্ড সার্ভিস**, **ডার্ক মোড** এবং **অটোমেটিক আপডেট চেকিং** সমৃদ্ধ পূর্ণাঙ্গ অ্যাপ।

---

## GitHub-এ আপলোড করে Android APK বিল্ড করার নিয়ম

এই প্রজেক্টে **GitHub Actions** স্বয়ংক্রিয় APK বিল্ডার (`.github/workflows/build-android-apk.yml`) এবং **Capacitor Android** কনফিগারেশন (`capacitor.config.json`) যুক্ত করা আছে। কোনো কম্পিউটার বা Android Studio ছাড়াই সরাসরি GitHub থেকে `.apk` ফাইল বিল্ড ও ডাউনলোড করতে পারবেন:

1. এই প্রজেক্টটি আপনার **GitHub Repository**-তে আপলোড বা Push করুন (`main` অথবা `master` ব্রাঞ্চে)।
2. আপনার GitHub রিপোজিটরির **`Actions`** ট্যাবে যান।
3. সেখানে **"Build Android APK (NetPulse Pro)"** ওয়ার্কফ্লোটি দেখতে পাবেন (প্রয়োজনে **Run workflow** বাটনে ক্লিক করুন)।
4. ১–২ মিনিটের মধ্যে বিল্ড সম্পন্ন হলে ঐ ওয়ার্কফ্লো রানের নিচে **`Artifacts`** সেকশন থেকে **`NetPulse-Pro-Android-APK`** ফাইলটি ডাউনলোড করুন।
5. ডাউনলোড করা `.zip` ফাইলটি আনজিপ করলেই **`NetPulse-Pro-Android.apk`** পাবেন, যা সরাসরি আপনার Android ফোনে ইনস্টল করতে পারবেন।

---

## লোকাল ডেভেলপমেন্ট ও টেস্ট

```bash
# ডিপেন্ডেন্সি ইনস্টল
npm install

# ডেভেলপমেন্ট সার্ভার চালু (Port 3000)
npm run dev

# ইউনিট টেস্ট রান
npx tsx --test src/utils/networkEngine.test.ts

# প্রোডাকশন বিল্ড
npm run build
```
