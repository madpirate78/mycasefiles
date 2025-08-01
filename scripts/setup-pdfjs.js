#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Setup script to copy PDF.js assets to public directory
 * This ensures complete offline functionality for PDF rendering
 */

// Use the version bundled with react-pdf to avoid version mismatches
let sourceDir = path.join(__dirname, '..', 'node_modules', 'react-pdf', 'node_modules', 'pdfjs-dist');

// Fallback to main pdfjs-dist if react-pdf doesn't bundle it
if (!fs.existsSync(sourceDir)) {
  sourceDir = path.join(__dirname, '..', 'node_modules', 'pdfjs-dist');
  console.log('Using fallback pdfjs-dist location');
}

const targetDir = path.join(__dirname, '..', 'public', 'pdfjs-dist');

// Directories to copy
const assetDirs = ['build', 'cmaps', 'standard_fonts'];

function copyRecursiveSync(src, dest) {
  const exists = fs.existsSync(src);
  const stats = exists && fs.statSync(src);
  const isDirectory = exists && stats.isDirectory();

  if (isDirectory) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    fs.readdirSync(src).forEach(childItemName => {
      copyRecursiveSync(
        path.join(src, childItemName),
        path.join(dest, childItemName)
      );
    });
  } else {
    fs.copyFileSync(src, dest);
  }
}

console.log('Setting up PDF.js assets for offline use...');

// Create target directory
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

// Copy each asset directory
assetDirs.forEach(dir => {
  const srcPath = path.join(sourceDir, dir);
  const destPath = path.join(targetDir, dir);
  
  if (fs.existsSync(srcPath)) {
    console.log(`Copying ${dir}...`);
    copyRecursiveSync(srcPath, destPath);
  } else {
    console.warn(`Warning: ${dir} not found in pdfjs-dist`);
  }
});

console.log('PDF.js assets setup complete!');
console.log('Assets available at:', targetDir);