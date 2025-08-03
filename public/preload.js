const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  parsePDF: (pdfBuffer) => ipcRenderer.invoke('parse-pdf', pdfBuffer),
  ocrPDF: (pdfBuffer) => ipcRenderer.invoke('ocr-pdf', pdfBuffer),
  createPDFBundle: (bundleData) => ipcRenderer.invoke('create-pdf-bundle', bundleData),
  
  // Add listener for bundle progress updates
  onBundleProgress: (callback) => ipcRenderer.on('bundle-progress', callback),
  removeBundleProgressListener: (callback) => ipcRenderer.removeListener('bundle-progress', callback),
  
  // Add other APIs here as needed
  platform: process.platform,
  versions: process.versions
});

// Keep backward compatibility
contextBridge.exposeInMainWorld('electron', {
  parsePDF: (pdfBuffer) => ipcRenderer.invoke('parse-pdf', pdfBuffer),
  
  // Add other APIs here as needed
  platform: process.platform,
  versions: process.versions
});