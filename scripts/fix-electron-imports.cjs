const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, '../dist-electron/electron');
const targetDir = path.join(__dirname, '../dist-electron');

// Recursive function to rename .js to .cjs
function renameJsFiles(dir) {
  const items = fs.readdirSync(dir, { withFileTypes: true });
  
  items.forEach(item => {
    const fullPath = path.join(dir, item.name);
    
    if (item.isDirectory()) {
      renameJsFiles(fullPath); // Recurse into subdirectories
    } else if (item.name.endsWith('.js')) {
      const newPath = fullPath.replace('.js', '.cjs');
      fs.renameSync(fullPath, newPath);
      console.log(`Renamed: ${item.name} → ${item.name.replace('.js', '.cjs')}`);
    }
  });
}

// Recursive function to fix require() statements in .cjs files
function fixRequires(dir) {
  const items = fs.readdirSync(dir, { withFileTypes: true });
  
  items.forEach(item => {
    const fullPath = path.join(dir, item.name);
    
    if (item.isDirectory()) {
      fixRequires(fullPath); // Recurse
    } else if (item.name.endsWith('.cjs')) {
      let content = fs.readFileSync(fullPath, 'utf-8');
      content = content.replace(/require\(["'](\.[^"']+)["']\)/g, 'require("$1.cjs")');
      fs.writeFileSync(fullPath, content);
      console.log(`Fixed imports: ${item.name}`);
    }
  });
}

// Recursive function to move directory contents
function moveContents(srcDir, destDir) {
  if (!fs.existsSync(srcDir)) return;
  
  const items = fs.readdirSync(srcDir);
  
  items.forEach(item => {
    const srcPath = path.join(srcDir, item);
    const destPath = path.join(destDir, item);
    
    fs.renameSync(srcPath, destPath);
    console.log(`Moved: ${item} to ${path.basename(destDir)}/`);
  });
}

// 1. Rename all .js to .cjs recursively
console.log('Step 1: Renaming .js to .cjs...');
renameJsFiles(distDir);

// 2. Fix require() statements recursively
console.log('\nStep 2: Fixing require() statements...');
fixRequires(distDir);

// 3. Move everything from electron/ to root
console.log('\nStep 3: Moving files to dist-electron/...');
moveContents(distDir, targetDir);

// 4. Clean up
console.log('\nStep 4: Cleaning up...');
if (fs.existsSync(distDir)) {
  fs.rmSync(distDir, { recursive: true });
}
const srcDir = path.join(targetDir, 'src');
if (fs.existsSync(srcDir)) {
  fs.rmSync(srcDir, { recursive: true });
}

console.log('\n✅ Electron build fixed!');