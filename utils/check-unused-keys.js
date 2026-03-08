// check-unused-keys.js
import fs from 'fs';
import path from 'path';

// Rekursiv alle .ts/.tsx Dateien finden
function getAllFiles(dirPath, arrayOfFiles = []) {
  const files = fs.readdirSync(dirPath);

  files.forEach(file => {
    const filePath = path.join(dirPath, file);
    if (fs.statSync(filePath).isDirectory()) {
      arrayOfFiles = getAllFiles(filePath, arrayOfFiles);
    } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
      arrayOfFiles.push(filePath);
    }
  });

  return arrayOfFiles;
}

// Extrahiere alle Keys (flatten nested object)
function flattenKeys(obj, prefix = '') {
  let keys = [];
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      keys = keys.concat(flattenKeys(value, fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys;
}

// 1. Lade en.json
const translations = JSON.parse(fs.readFileSync('./src/i18n/locales/en.json', 'utf8'));
const allKeys = flattenKeys(translations);

// 2. Finde alle TypeScript Dateien
const files = getAllFiles('./src');

// 3. Suche jeden Key im Codebase
const unused = [];

for (const key of allKeys) {
  let found = false;
  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    if (content.includes(`"${key}"`) || content.includes(`'${key}'`)) {
      found = true;
      break;
    }
  }
  if (!found) {
    unused.push(key);
  }
}

console.log('\n📊 Unused Translation Keys:\n');
unused.forEach(key => console.log(`  ❌ ${key}`));
console.log(`\n📈 Total: ${unused.length} unused / ${allKeys.length} total keys\n`);
