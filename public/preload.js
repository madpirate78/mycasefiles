const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  parsePDF: (pdfBuffer) => ipcRenderer.invoke('parse-pdf', pdfBuffer),
  ocrPDF: (pdfBuffer) => ipcRenderer.invoke('ocr-pdf', pdfBuffer),
  generateDescription: (text, filename) => ipcRenderer.invoke('ai:generate-description', text, filename),
  summarizeDocument: (text) => ipcRenderer.invoke('ai:summarize', text),
  
  // Add other APIs here as needed
  platform: process.platform,
  versions: process.versions
});

// Keep backward compatibility
contextBridge.exposeInMainWorld('electron', {
  parsePDF: (pdfBuffer) => ipcRenderer.invoke('parse-pdf', pdfBuffer),
  generateDescription: (text, filename) => ipcRenderer.invoke('ai:generate-description', text, filename),
  summarize: (text) => ipcRenderer.invoke('ai:summarize', text),
  
  // Add other APIs here as needed
  platform: process.platform,
  versions: process.versions
});