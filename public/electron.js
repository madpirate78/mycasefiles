/**
 * Electron main process entry point.
 *
 * Thin orchestrator that:
 *  - Creates the application window and menu
 *  - Manages app lifecycle (ready, quit, activate)
 *  - Initializes service modules that register their own IPC handlers
 *
 * Service modules (in public/electron/):
 *  - pdfService:    parse-pdf, extract-page-count, get-resource-stats
 *  - ocrService:    ocr-pdf
 *  - bundleService: create-pdf-bundle
 */
const { app, BrowserWindow, ipcMain, Menu, shell, globalShortcut } = require('electron');
const path = require('path');
const isDev = process.env.NODE_ENV === 'development' || process.env.ELECTRON_IS_DEV === 'true';

// Set UK locale for proper date formatting
app.commandLine.appendSwitch('lang', 'en-GB');

// Service modules
const pdfService = require('./electron/pdfService');
const ocrService = require('./electron/ocrService');
const bundleService = require('./electron/bundleService');

// Resource monitoring
const ResourceMonitor = require('./services/resourceMonitor');
let resourceMonitor;

// ─── Window creation ──────────────────────────────────────────────

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, 'icon-512.png'),
    title: 'My Case Files - Legal Document Management'
  });

  const startUrl = isDev
    ? 'http://localhost:3000'
    : `file://${path.join(__dirname, '../build/index.html')}`;

  mainWindow.loadURL(startUrl);

  if (isDev) {
    mainWindow.webContents.openDevTools();

    // Create custom menu for legal document management
    const menuTemplate = [
      {
        label: 'File',
        submenu: [
          {
            label: 'Import Documents...',
            accelerator: 'CmdOrCtrl+O',
            click: () => {
              mainWindow.webContents.send('menu-import-documents');
            }
          },
          {
            label: 'Export Case Bundle...',
            accelerator: 'CmdOrCtrl+E',
            click: () => {
              mainWindow.webContents.send('menu-export-bundle');
            }
          },
          { type: 'separator' },
          {
            label: 'Exit',
            accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
            click: () => {
              app.quit();
            }
          }
        ]
      },
      {
        label: 'Documents',
        submenu: [
          {
            label: 'Organize Document...',
            accelerator: 'CmdOrCtrl+D',
            click: () => {
              mainWindow.webContents.send('menu-organize-document');
            }
          },
          {
            label: 'Search Documents...',
            accelerator: 'CmdOrCtrl+F',
            click: () => {
              mainWindow.webContents.send('menu-search-documents');
            }
          }
        ]
      },
      {
        label: 'View',
        submenu: [
          { role: 'reload' },
          { role: 'forceReload' },
          { role: 'toggleDevTools' },
          { type: 'separator' },
          { role: 'resetZoom' },
          { role: 'zoomIn' },
          { role: 'zoomOut' },
          { type: 'separator' },
          { role: 'togglefullscreen' }
        ]
      },
      {
        label: 'Help',
        submenu: [
          {
            label: 'About My Case Files',
            click: () => {
              mainWindow.webContents.send('menu-about');
            }
          }
        ]
      },
      {
        label: 'Developer',
        submenu: [
          { role: 'toggleDevTools' },
          { type: 'separator' },
          {
            label: 'Test PDF Parser',
            click: () => {
              console.log('Testing PDF parser...');
            }
          }
        ]
      }
    ];

    const menu = Menu.buildFromTemplate(menuTemplate);
    Menu.setApplicationMenu(menu);
  } else {
    // No menu in production
    Menu.setApplicationMenu(null);
  }
}

// ─── App lifecycle ────────────────────────────────────────────────

app.whenReady().then(async () => {
  // Initialize resource monitoring
  resourceMonitor = new ResourceMonitor();

  // Register IPC handlers from service modules
  pdfService.init({ ipcMain, resourceMonitor });
  ocrService.init({ ipcMain, resourceMonitor });
  bundleService.init({ ipcMain, shell });

  createWindow();

  // Register global shortcuts
  globalShortcut.register('CommandOrControl+Shift+I', () => {
    const focusedWindow = BrowserWindow.getFocusedWindow();
    if (focusedWindow) {
      focusedWindow.webContents.toggleDevTools();
    }
  });

  console.log('✅ Electron app initialized successfully');
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();

  if (resourceMonitor) {
    resourceMonitor.stopMonitoring();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
