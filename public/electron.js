const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const path = require('path');
const isDev = process.env.NODE_ENV === 'development' || process.env.ELECTRON_IS_DEV === 'true';
const pdfParse = require('pdf-parse');
const fs = require('fs');
const Tesseract = require('tesseract.js');
const { Poppler } = require('node-poppler');
const os = require('os');
const crypto = require('crypto');

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

  // Open DevTools in development mode
  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

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
  
  // App ready
  console.log('✅ Electron app initialized successfully');
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

// Helper function to detect if PDF is scanned (minimal text content)
function isScannedPDF(text, info) {
  const textLength = text.trim().length;
  const hasMinimalText = textLength < 50; // Less than 50 characters suggests scanned
  const isEpsonScan = info && info.Producer && info.Producer.includes('EPSON Scan');
  const hasImageOnlyPages = textLength < 10; // Very minimal text suggests image-only pages
  
  console.log('🔍 Scanned PDF detected:', { textLength, producer: info?.Producer });
  
  return hasMinimalText || isEpsonScan || hasImageOnlyPages;
}

// Helper function to perform OCR on PDF pages
async function performOCROnPDF(pdfBuffer) {
  try {
    console.log('🔍 Starting OCR processing...');
    
    // Create temporary directory for images
    const tempDir = path.join(os.tmpdir(), 'mycasefiles-ocr-' + crypto.randomBytes(8).toString('hex'));
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    // Save PDF buffer to temp file (pdf-poppler needs a file path)
    const tempPdfPath = path.join(tempDir, 'temp.pdf');
    fs.writeFileSync(tempPdfPath, Buffer.from(pdfBuffer));
    
    // Convert PDF to images using node-poppler
    const poppler = new Poppler();
    const outputPath = path.join(tempDir, 'page');
    
    const options = {
      firstPageToConvert: 1,
      lastPageToConvert: 3,  // Process only first 3 pages
      pngFile: true,         // Output as PNG
      resolutionXYAxis: 300, // 300 DPI for good OCR quality
    };
    
    console.log('📄 Converting PDF to images...');
    
    try {
      const result = await poppler.pdfToCairo(tempPdfPath, outputPath, options);
      console.log('✅ PDF converted to images successfully');
    } catch (error) {
      console.error('❌ PDF to image conversion failed:', error);
      console.error('Error type:', error.constructor.name);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
      
      console.error('❌ PDF file exists:', fs.existsSync(tempPdfPath));
      
      throw new Error(`PDF conversion failed: ${error.message}`);
    }
    
    // Find generated image files
    const allFiles = fs.readdirSync(tempDir);
    const files = allFiles.filter(f => f.startsWith('page-') && f.endsWith('.png'));
    const imagePaths = files
      .sort((a, b) => {
        const pageA = parseInt(a.match(/page-(\d+)/)?.[1] || '0');
        const pageB = parseInt(b.match(/page-(\d+)/)?.[1] || '0');
        return pageA - pageB;
      })
      .map(f => path.join(tempDir, f));
    
    console.log(`📄 Found ${imagePaths.length} images from ${allFiles.length} total files`);
    
    if (imagePaths.length === 0) {
      throw new Error('No pages could be converted to images');
    }
    
    // Perform OCR on each page
    let fullText = '';
    const ocrResults = [];
    
    for (let i = 0; i < imagePaths.length; i++) {
      const imagePath = imagePaths[i];
      try {
        const { data: { text, confidence } } = await Tesseract.recognize(imagePath, 'eng', {
          tessedit_pageseg_mode: Tesseract.PSM.SINGLE_BLOCK, // Better for document pages
          tessedit_ocr_engine_mode: Tesseract.OEM.LSTM_ONLY,  // More accurate engine
        });
        
        console.log(`✅ Page ${i + 1}: ${confidence.toFixed(1)}% confidence, ${text.length} chars`);
        
        fullText += text + '\n\n';
        ocrResults.push({ page: i + 1, text, confidence, length: text.length });
        
        // Clean up temporary image file
        try {
          fs.unlinkSync(imagePath);
        } catch (cleanupError) {
          console.warn('Could not clean up temporary file:', imagePath);
        }
        
      } catch (ocrError) {
        console.error(`❌ OCR failed for page ${i + 1}:`, ocrError.message);
        ocrResults.push({ page: i + 1, error: ocrError.message });
      }
    }
    
    // Clean up temporary directory
    try {
      // Remove PDF file
      if (fs.existsSync(tempPdfPath)) {
        fs.unlinkSync(tempPdfPath);
      }
      // Remove any remaining image files
      const remainingFiles = fs.readdirSync(tempDir);
      remainingFiles.forEach(file => {
        fs.unlinkSync(path.join(tempDir, file));
      });
      // Remove directory
      fs.rmdirSync(tempDir);
    } catch (cleanupError) {
      console.warn('⚠️ Could not fully clean up temporary files:', cleanupError.message);
    }
    
    const avgConfidence = ocrResults.filter(r => r.confidence).reduce((sum, r) => sum + r.confidence, 0) / ocrResults.filter(r => r.confidence).length;
    
    console.log(`🎉 OCR completed: ${fullText.length} chars, ${avgConfidence.toFixed(1)}% confidence`);
    
    return {
      success: true,
      text: fullText.trim(),
      confidence: avgConfidence,
      pages: ocrResults,
      method: 'OCR'
    };
    
  } catch (error) {
    console.error('💥 OCR processing failed:', error);
    return {
      success: false,
      error: error.message,
      method: 'OCR'
    };
  }
}

// IPC handler for PDF parsing with OCR fallback
ipcMain.handle('parse-pdf', async (event, pdfBuffer) => {
  try {
    const options = {
      normalizeWhitespace: true,
      disableCombineTextItems: false,
      max: 3
    };
    
    const data = await pdfParse(Buffer.from(pdfBuffer), options);
    console.log(`📄 PDF parsed: ${data.text.length} chars, producer: ${data.info?.Producer}`);
    
    // Just detect if it's scanned, don't run OCR automatically
    const isScanned = isScannedPDF(data.text, data.info);
    if (isScanned) {
      console.log('🔍 Scanned PDF detected - manual OCR available');
    }
    
    // Return standard PDF extraction result
    return {
      success: true,
      text: data.text,
      pages: data.numpages,
      info: data.info,
      extractionMethod: 'PDF_PARSE',
      isScanned: isScanned
    };
    
  } catch (error) {
    console.error('PDF parsing failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

// IPC handler for manual OCR processing
ipcMain.handle('ocr-pdf', async (event, pdfBuffer) => {
  try {
    console.log('🔍 Manual OCR requested for PDF buffer of size:', pdfBuffer.length);
    
    const ocrResult = await performOCROnPDF(pdfBuffer);
    
    if (ocrResult.success) {
      console.log(`✅ Manual OCR completed: ${ocrResult.text.length} chars, ${ocrResult.confidence.toFixed(1)}% confidence`);
      return {
        success: true,
        text: ocrResult.text,
        confidence: ocrResult.confidence,
        pages: ocrResult.pages,
        extractionMethod: 'OCR'
      };
    } else {
      console.error('❌ Manual OCR failed:', ocrResult.error);
      return {
        success: false,
        error: ocrResult.error
      };
    }
  } catch (error) {
    console.error('💥 Manual OCR processing failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

