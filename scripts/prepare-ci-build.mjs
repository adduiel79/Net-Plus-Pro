import fs from 'node:fs';
import path from 'node:path';

const pkgPath = path.join(process.cwd(), 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

// Normalize dependencies to verified public npm registry (registry.npmjs.org) versions
// so GitHub Actions builds never fail on AI Studio internal mirror version numbers.
pkg.dependencies = {
  '@capacitor/android': '^7.0.0',
  '@capacitor/cli': '^7.0.0',
  '@capacitor/core': '^7.0.0',
  'lucide-react': '^0.475.0',
  react: '^19.0.0',
  'react-dom': '^19.0.0',
};

pkg.devDependencies = {
  '@tailwindcss/vite': '^4.0.9',
  '@types/node': '^22.10.0',
  '@types/react': '^19.0.0',
  '@types/react-dom': '^19.0.0',
  '@vitejs/plugin-react': '^4.3.4',
  tailwindcss: '^4.0.9',
  typescript: '~5.7.3',
  vite: '^6.2.0',
};

fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
console.log('Normalized package.json for GitHub Actions public npm registry build.');
