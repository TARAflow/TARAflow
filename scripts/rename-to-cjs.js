import { renameSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = join(__dirname, '..');

try {
  renameSync(join(root, 'dist-electron/main.js'), join(root, 'dist-electron/main.cjs'));
  renameSync(join(root, 'dist-electron/preload.js'), join(root, 'dist-electron/preload.cjs'));
  console.log('✓ Renamed .js files to .cjs');
} catch (err) {
  console.error('Error renaming files:', err);
}