const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const path = require('path');
const isDev = require('electron-is-dev');
const pdfParse = require('pdf-parse');
const fs = require('fs');
const { LegalDocumentAI } = require('./ai/summarizer');

// Initialize AI instance
const ai = new LegalDocumentAI();

function createWindow() {
  // Create the browser window
  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, 'favicon.ico'), // App icon
    title: 'My Case Files - Legal Document Management'
  });

  // Load the app
  const startUrl = isDev 
    ? 'http://localhost:3000' 
    : `file://${path.join(__dirname, '../build/index.html')}`;
  
  mainWindow.loadURL(startUrl);

  // Create custom menu for legal document management
  const menuTemplate = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Import Documents...',
          accelerator: 'CmdOrCtrl+O',
          click: () => {
            // TODO: Implement file import dialog
            mainWindow.webContents.send('menu-import-documents');
          }
        },
        {
          label: 'Export Case Bundle...',
          accelerator: 'CmdOrCtrl+E',
          click: () => {
            // TODO: Implement bundle export
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
    }
  ];

  // Add developer menu in development
  if (isDev) {
    menuTemplate.push({
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
    });
  }

  const menu = Menu.buildFromTemplate(menuTemplate);
  Menu.setApplicationMenu(menu);

  // Open DevTools in development
  if (isDev) {
    mainWindow.webContents.openDevTools();
  }
}

// This method will be called when Electron has finished initialization
app.whenReady().then(async () => {
  createWindow();
  
  // Initialize AI on app ready
  try {
    console.log('🤖 Initializing Local LLM...');
    await ai.initialize();
    console.log('✅ AI initialized successfully');
  } catch (error) {
    console.error('❌ AI initialization failed:', error);
  }
});

// Quit when all windows are closed
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// IPC handler for PDF parsing
ipcMain.handle('parse-pdf', async (event, pdfBuffer) => {
  try {
    console.log('Parsing PDF buffer of size:', pdfBuffer.length);
    
    // Enhanced pdf-parse options for better text extraction
    const options = {
      // Normalize whitespace and line breaks
      normalizeWhitespace: true,
      // Don't combine text items too aggressively
      disableCombineTextItems: false,
      // Maximum pages to parse (for performance)
      max: 3
    };
    
    const data = await pdfParse(Buffer.from(pdfBuffer), options);
    console.log('PDF parsing successful, text length:', data.text.length);
    console.log('PDF info:', data.info);
    console.log('First 300 chars:', data.text.substring(0, 300));
    
    return {
      success: true,
      text: data.text,
      pages: data.numpages,
      info: data.info
    };
  } catch (error) {
    console.error('PDF parsing failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

// IPC handler for AI description generation
ipcMain.handle('ai:generate-description', async (event, text, filename = '') => {
  try {
    console.log('🧠 Generating AI description for document:', filename);
    
    if (!ai.initialized) {
      console.warn('⚠️ AI not initialized, using basic description');
      return {
        success: true,
        description: ai.generateBasicDescription(filename, text)
      };
    }
    
    const description = await ai.generateDescription(text, filename);
    
    return {
      success: true,
      description: description
    };
  } catch (error) {
    console.error('❌ AI description generation failed:', error);
    
    // Fallback to basic description
    return {
      success: true,
      description: ai.generateBasicDescription(filename, text),
      fallback: true
    };
  }
});

// IPC handler for AI summarization (for longer documents)
ipcMain.handle('ai:summarize', async (event, text) => {
  try {
    console.log('📝 Generating AI summary...');
    
    if (!ai.initialized) {
      throw new Error('AI not initialized');
    }
    
    const summary = await ai.generateDescription(text, '', 200); // Longer summary
    
    return {
      success: true,
      summary: summary
    };
  } catch (error) {
    console.error('❌ AI summarization failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
});