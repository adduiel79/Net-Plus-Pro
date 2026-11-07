import fs from 'node:fs';
import path from 'node:path';

const manifestPath = path.join(process.cwd(), 'android', 'app', 'src', 'main', 'AndroidManifest.xml');

if (fs.existsSync(manifestPath)) {
  let xml = fs.readFileSync(manifestPath, 'utf8');

  const requiredPermissions = [
    'android.permission.INTERNET',
    'android.permission.ACCESS_NETWORK_STATE',
    'android.permission.CHANGE_NETWORK_STATE',
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
    xml = xml.replace('<application', '<application\n        android:usesCleartextTraffic="true"');
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
            <intent-filter android:label="Net Plus Pro দিয়ে ডাউনলোড করুন">
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

// Copy the custom Net Plus Pro logo into Android mipmap launcher icon directories
const logoPath = path.join(
  process.cwd(),
  'public',
  'assets',
  'aistudio',
  'file_000000008b70821197eef6b1e7f14a65_b0bafffc.png'
);
const resDir = path.join(process.cwd(), 'android', 'app', 'src', 'main', 'res');

if (fs.existsSync(logoPath) && fs.existsSync(resDir)) {
  const mipmapDirs = [
    'mipmap-mdpi',
    'mipmap-hdpi',
    'mipmap-xhdpi',
    'mipmap-xxhdpi',
    'mipmap-xxxhdpi',
  ];
  for (const dir of mipmapDirs) {
    const targetDir = path.join(resDir, dir);
    if (fs.existsSync(targetDir)) {
      fs.copyFileSync(logoPath, path.join(targetDir, 'ic_launcher.png'));
      fs.copyFileSync(logoPath, path.join(targetDir, 'ic_launcher_round.png'));
      fs.copyFileSync(logoPath, path.join(targetDir, 'ic_launcher_foreground.png'));
    }
  }
  console.log('Successfully configured Net Plus Pro custom launcher icon for Android APK.');
}
