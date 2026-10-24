import fs from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();
const standaloneDir = path.join(projectRoot, '.next', 'standalone');
const staticSrc = path.join(projectRoot, '.next', 'static');
const staticDest = path.join(standaloneDir, '.next', 'static');
const publicSrc = path.join(projectRoot, 'public');
const publicDest = path.join(standaloneDir, 'public');

function copyDirRecursive(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

if (fs.existsSync(standaloneDir)) {
  console.log('[postbuild] Copying .next/static to .next/standalone/.next/static...');
  copyDirRecursive(staticSrc, staticDest);

  console.log('[postbuild] Copying public/ to .next/standalone/public...');
  copyDirRecursive(publicSrc, publicDest);

  console.log('[postbuild] Standalone assets synced successfully.');
} else {
  console.log('[postbuild] Standalone directory not found. Skipping asset copy.');
}
