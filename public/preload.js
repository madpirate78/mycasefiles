const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  parsePDF: (pdfBuffer) => ipcRenderer.invoke('parse-pdf', pdfBuffer),
  ocrPDF: (pdfBuffer) => ipcRenderer.invoke('ocr-pdf', pdfBuffer),
  
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