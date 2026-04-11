// check-unused-keys.js
//
// Usage:
//   node check-unused-keys.js                        → check all namespaces
//   node check-unused-keys.js dfd                    → check single namespace
//   node check-unused-keys.js dfd threats assets     → check multiple namespaces
//   node check-unused-keys.js --src ./src/features/dfd  → limit source scan to a directory
//
// Namespace files are expected at:
//   ./src/i18n/locales/en/<namespace>.json
//
// Falls back to legacy monolithic file if no namespace directory exists:
//   ./src/i18n/locales/en.json

import fs from 'fs';
import path from 'path';

// ── CLI args ─────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);

// --src <dir> overrides the source directory to scan
const srcFlagIndex = args.indexOf('--src');
let srcDir = './src';
if (srcFlagIndex !== -1 && args[srcFlagIndex + 1]) {
  srcDir = args[srcFlagIndex + 1];
  args.splice(srcFlagIndex, 2);
}

// Remaining args are namespace names (empty = all)
const requestedNamespaces = args.filter(a => !a.startsWith('--'));

// ── Known namespaces ─────────────────────────────────────────────────────────

const ALL_NAMESPACES = [
  'common',
  'dfd',
  'assets',
  'threats',
  'risks',
  'attacktree',
  'doc',
  'audit',
];

const LOCALES_DIR = './src/i18n/locales';
const LEGACY_FILE = path.join(LOCALES_DIR, 'en.json');
const NAMESPACE_DIR = path.join(LOCALES_DIR, 'en');

// ── Helpers ──────────────────────────────────────────────────────────────────

function getAllFiles(dirPath, arrayOfFiles = []) {
  if (!fs.existsSync(dirPath)) {
    console.error(`❌  Source directory not found: ${dirPath}`);
    process.exit(1);
  }
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

function loadNamespace(ns) {
  const nsFile = path.join(NAMESPACE_DIR, `${ns}.json`);
  if (!fs.existsSync(nsFile)) {
    console.warn(`⚠️   Namespace file not found, skipping: ${nsFile}`);
    return null;
  }
  return JSON.parse(fs.readFileSync(nsFile, 'utf8'));
}

function loadLegacy() {
  if (!fs.existsSync(LEGACY_FILE)) {
    console.error(`❌  Neither namespace directory (${NAMESPACE_DIR}) nor legacy file (${LEGACY_FILE}) found.`);
    process.exit(1);
  }
  console.log(`ℹ️   Namespace directory not found — falling back to legacy ${LEGACY_FILE}\n`);
  return { legacy: JSON.parse(fs.readFileSync(LEGACY_FILE, 'utf8')) };
}

// ── Resolve which namespaces to check ────────────────────────────────────────

function resolveNamespaces() {
  const useNamespacedFiles = fs.existsSync(NAMESPACE_DIR);

  if (!useNamespacedFiles) {
    return loadLegacy();
  }

  const toCheck = requestedNamespaces.length > 0 ? requestedNamespaces : ALL_NAMESPACES;

  const invalid = toCheck.filter(ns => !ALL_NAMESPACES.includes(ns));
  if (invalid.length > 0) {
    console.error(`❌  Unknown namespace(s): ${invalid.join(', ')}`);
    console.error(`    Available: ${ALL_NAMESPACES.join(', ')}`);
    process.exit(1);
  }

  const result = {};
  for (const ns of toCheck) {
    const data = loadNamespace(ns);
    if (data) result[ns] = data;
  }
  return result;
}

// ── Main ─────────────────────────────────────────────────────────────────────

const namespaceMap = resolveNamespaces();
const sourceFiles = getAllFiles(srcDir);

console.log(`\n🔍  Scanning ${sourceFiles.length} source files in: ${srcDir}`);
console.log(`📦  Namespaces: ${Object.keys(namespaceMap).join(', ')}\n`);

let grandTotalKeys = 0;
let grandTotalUnused = 0;

for (const [ns, translations] of Object.entries(namespaceMap)) {
  const allKeys = flattenKeys(translations);
  const unused = [];

  for (const key of allKeys) {
    let found = false;
    for (const file of sourceFiles) {
      const content = fs.readFileSync(file, 'utf8');
      if (content.includes(`"${key}"`) || content.includes(`'${key}'`)) {
        found = true;
        break;
      }
    }
    if (!found) unused.push(key);
  }

  grandTotalKeys += allKeys.length;
  grandTotalUnused += unused.length;

  const label = ns === 'legacy' ? 'All keys' : `[${ns}]`;
  if (unused.length === 0) {
    console.log(`✅  ${label}  — all ${allKeys.length} keys used`);
  } else {
    console.log(`\n${label}  ${unused.length} unused / ${allKeys.length} total:`);
    unused.forEach(key => console.log(`    ❌ ${key}`));
  }
}

console.log(`\n${'─'.repeat(60)}`);
console.log(`📈  Total: ${grandTotalUnused} unused / ${grandTotalKeys} keys across ${Object.keys(namespaceMap).length} namespace(s)\n`);