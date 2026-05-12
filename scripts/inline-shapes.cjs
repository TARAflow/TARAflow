#!/usr/bin/env node
// ==================== INLINE SHAPES SCRIPT ====================
// Updates the inlined DFD shape data in electron/main.ts
// whenever DFD_1.json or DFD_2.json change.
//
// Usage: node scripts/inline-shapes.cjs

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const MAIN_TS = path.join(ROOT, 'electron', 'main.ts');
const DFD1 = path.join(ROOT, 'src', 'features', 'dfd', 'shapes', 'DFD_1.json');
const DFD2 = path.join(ROOT, 'src', 'features', 'dfd', 'shapes', 'DFD_2.json');

// Read files
const dfd1 = JSON.stringify(JSON.parse(fs.readFileSync(DFD1, 'utf-8')));
const dfd2 = JSON.stringify(JSON.parse(fs.readFileSync(DFD2, 'utf-8')));
let main = fs.readFileSync(MAIN_TS, 'utf-8');

// Replace inlined data — matches the const declaration line
main = main.replace(
  /^const dfd1Shapes = \[.*\];$/m,
  `const dfd1Shapes = ${dfd1};`
);
main = main.replace(
  /^const dfd2Shapes = \[.*\];$/m,
  `const dfd2Shapes = ${dfd2};`
);

fs.writeFileSync(MAIN_TS, main, 'utf-8');

console.log('✅ DFD shape data inlined into electron/main.ts');
console.log('   DFD_1.json:', dfd1.length, 'chars');
console.log('   DFD_2.json:', dfd2.length, 'chars');
