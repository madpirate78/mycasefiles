const { app, BrowserWindow, ipcMain, Menu, dialog, shell } = require('electron');
const path = require('path');
const isDev = process.env.NODE_ENV === 'development' || process.env.ELECTRON_IS_DEV === 'true';

// Set UK locale for proper date formatting
app.commandLine.appendSwitch('lang', 'en-GB');
const pdfParse = require('pdf-parse');
const fs = require('fs');
const Tesseract = require('tesseract.js');
const { Poppler } = require('node-poppler');
const os = require('os');
const crypto = require('crypto');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');

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

// Helper function to calculate page numbers for index
function calculatePageNumbers(bundleData) {
  const pageMap = {};
  let currentPage = 3; // Start after cover and index pages
  
  for (const section of bundleData.sections) {
    if (!section.documentCount) continue;
    
    // Section divider page
    pageMap[`section_${section.id}`] = currentPage;
    currentPage++;
    
    // Documents in section
    const sectionDocs = bundleData.documents.filter(doc => doc.section === section.id);
    for (const doc of sectionDocs) {
      pageMap[`doc_${doc.id}`] = currentPage;
      // Estimate pages (will be updated with actual count during processing)
      const estimatedPages = doc.selectedPages ? doc.selectedPages.length : 1;
      currentPage += estimatedPages;
    }
  }
  
  return pageMap;
}

// Helper function to create professional court bundle index
async function createBundleIndex(pdfDoc, bundleData) {
  const indexPages = [];
  
  // Load fonts
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const timesRoman = await pdfDoc.embedFont(StandardFonts.TimesRoman);
  const timesRomanBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
  const courier = await pdfDoc.embedFont(StandardFonts.Courier);
  
  // Create front page
  let coverPage = pdfDoc.addPage([595.28, 841.89]); // A4 size
  
  const { width, height } = coverPage.getSize();
  const margin = 72; // 1 inch margins
  let yPosition = height - 100;
  
  // Helper function to draw centered text
  const drawCenteredText = (text, font, size, y, page = coverPage) => {
    const textWidth = font.widthOfTextAtSize(text, size);
    const x = (width - textWidth) / 2;
    page.drawText(text, { x, y, size, font, color: rgb(0, 0, 0) });
  };
  
  // Helper function to draw left-aligned text
  const drawLeftText = (text, font, size, y, x = margin, page = coverPage) => {
    page.drawText(text, { x, y, size, font, color: rgb(0, 0, 0) });
  };
  
  // FAMILY COURT BUNDLE
  drawCenteredText('FAMILY COURT BUNDLE', timesRomanBold, 18, yPosition);
  yPosition -= 30;
  
  // Bundle type
  drawCenteredText(bundleData.bundleName.toUpperCase(), timesRomanBold, 16, yPosition);
  yPosition -= 40;
  
  // Case reference
  if (bundleData.caseReference) {
    drawCenteredText(`Case No: ${bundleData.caseReference}`, timesRoman, 14, yPosition);
    yPosition -= 30;
  }
  
  // Court location
  if (bundleData.court) {
    drawCenteredText(`In the Family Court at ${bundleData.court}`, timesRoman, 14, yPosition);
    yPosition -= 20;
  }
  
  // Act/Rules
  drawCenteredText('Children Act 1989', timesRoman, 14, yPosition);
  yPosition -= 40;
  
  // Re: Children (if applicable)
  if (bundleData.children && bundleData.children.length > 0) {
    const childNames = bundleData.children.map(child => {
      const dob = child.dob ? ` (DOB: ${new Date(child.dob).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })})` : '';
      return `${child.name}${dob}`;
    }).join(', ');
    drawCenteredText(`Re: ${childNames}`, timesRoman, 12, yPosition);
    yPosition -= 30;
  }
  
  // Parties
  yPosition -= 10;
  const applicantLabel = bundleData.applicantName || '[Applicant Name]';
  const respondentLabel = bundleData.respondentName || '[Respondent Name]';
  
  // Applicant
  drawLeftText(applicantLabel, timesRoman, 12, yPosition, width / 2 - 100);
  drawLeftText('Applicant', timesRomanBold, 12, yPosition, width / 2 + 50);
  yPosition -= 20;
  
  // and
  drawCenteredText('and', timesRoman, 12, yPosition);
  yPosition -= 20;
  
  // Respondent
  drawLeftText(respondentLabel, timesRoman, 12, yPosition, width / 2 - 100);
  drawLeftText('Respondent', timesRomanBold, 12, yPosition, width / 2 + 50);
  yPosition -= 60;
  
  // Hearing details
  if (bundleData.hearingDate) {
    const hearingDate = new Date(bundleData.hearingDate);
    const formattedDate = hearingDate.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
    const formattedTime = '10:00'; // Default time
    drawCenteredText(`First Directions Hearing: ${formattedDate} at ${formattedTime}`, timesRoman, 14, yPosition);
    yPosition -= 30;
  }
  
  // Bundle prepared date
  const preparedDate = new Date().toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long', 
    year: 'numeric'
  });
  drawCenteredText(`Bundle prepared: ${preparedDate}`, timesRoman, 12, yPosition);
  
  // Create index page (page 2)
  let indexPage = pdfDoc.addPage([595.28, 841.89]); // A4 size
  indexPages.push(indexPage);
  yPosition = height - margin;
  
  // INDEX TO BUNDLE
  drawCenteredText('INDEX TO BUNDLE', timesRomanBold, 16, yPosition, indexPage);
  yPosition -= 40;
  
  // Process sections and documents
  let pageNumber = 2; // Start page numbering at 2 (after cover page)
  
  // Helper function to draw dotted line
  const drawDottedLine = (startX, endX, y, page = indexPage) => {
    const dotSpacing = 3;
    const dotSize = 0.5;
    let x = startX;
    
    while (x < endX) {
      page.drawCircle({
        x: x,
        y: y,
        size: dotSize,
        color: rgb(0, 0, 0),
      });
      x += dotSpacing;
    }
  };
  
  // Define starting page for documents
  let docStartPage = 3; // After cover page and index page
  
  for (const section of bundleData.sections) {
    if (!section.documentCount) continue;
    
    // Section header (e.g., "A. Chronology")
    yPosition -= 5;
    const sectionLabel = `${section.letter}. ${section.label}`;
    drawLeftText(sectionLabel, helveticaBold, 12, yPosition, margin, indexPage);
    
    // Draw dotted line from section label to page number
    const labelWidth = helveticaBold.widthOfTextAtSize(sectionLabel, 12);
    const pageNumStr = docStartPage.toString();
    const pageNumWidth = helvetica.widthOfTextAtSize(pageNumStr, 12);
    const pageNumX = width - margin - pageNumWidth;
    
    drawDottedLine(margin + labelWidth + 10, pageNumX - 10, yPosition + 3, indexPage);
    drawLeftText(pageNumStr, helvetica, 12, yPosition, pageNumX, indexPage);
    
    yPosition -= 20;
    
    // Get documents for this section
    const sectionDocs = bundleData.documents.filter(doc => doc.section === section.id);
    let docIndex = 1;
    
    for (const doc of sectionDocs) {
      // Check if we need a new page
      if (yPosition < 100) {
        const newIndexPage = pdfDoc.addPage([595.28, 841.89]);
        indexPages.push(newIndexPage);
        indexPage = newIndexPage; // Update current page reference
        yPosition = height - margin;
        
        // Continue header on new page
        drawCenteredText('INDEX TO BUNDLE (continued)', helvetica, 12, yPosition, indexPage);
        yPosition -= 30;
      }
      
      // Document entry with subsection numbering (e.g., "B.1 Enforcement Application dated 23 April 2025")
      const docLabel = `${section.letter}.${docIndex} ${doc.name}`;
      const indentX = margin + 20; // Indent sub-items
      
      // Truncate if too long
      let displayLabel = docLabel;
      const maxLabelWidth = width - margin * 2 - 100; // Leave room for dots and page number
      if (helvetica.widthOfTextAtSize(displayLabel, 11) > maxLabelWidth) {
        // Truncate to fit
        while (helvetica.widthOfTextAtSize(displayLabel + '...', 11) > maxLabelWidth && displayLabel.length > 10) {
          displayLabel = displayLabel.substring(0, displayLabel.length - 1);
        }
        displayLabel += '...';
      }
      
      drawLeftText(displayLabel, helvetica, 11, yPosition, indentX, indexPage);
      
      // Page number with dotted line
      const docLabelWidth = helvetica.widthOfTextAtSize(displayLabel, 11);
      const docPageStr = docStartPage.toString();
      const docPageWidth = helvetica.widthOfTextAtSize(docPageStr, 11);
      const docPageX = width - margin - docPageWidth;
      
      drawDottedLine(indentX + docLabelWidth + 10, docPageX - 10, yPosition + 3, indexPage);
      drawLeftText(docPageStr, helvetica, 11, yPosition, docPageX, indexPage);
      
      yPosition -= 18;
      docStartPage++; // Increment page number for next document
      docIndex++;
    }
    
    yPosition -= 10; // Extra space between sections
  }
  
  // Add page number to index page(s)
  let pageNum = 2; // Index starts at page 2
  for (const page of indexPages) {
    const pageText = pageNum.toString();
    const pageTextWidth = helvetica.widthOfTextAtSize(pageText, 10);
    
    page.drawText(pageText, {
      x: (width - pageTextWidth) / 2,
      y: 30,
      size: 10,
      font: helvetica,
      color: rgb(0, 0, 0)
    });
    pageNum++;
  }
  
  // Return both cover page and index pages
  return [coverPage, ...indexPages];
}

// IPC handler for PDF bundle creation
ipcMain.handle('create-pdf-bundle', async (event, bundleData) => {
  try {
    console.log('📁 Starting PDF bundle creation for:', bundleData.bundleName);
    console.log('📄 Documents to process:', bundleData.documents.length);
    
    // Send progress update
    event.sender.send('bundle-progress', { 
      stage: 'initializing', 
      progress: 0, 
      message: 'Initializing bundle creation...' 
    });
    
    // Create new PDF document
    const bundlePdf = await PDFDocument.create();
    
    // Set document metadata
    bundlePdf.setTitle(bundleData.bundleName);
    bundlePdf.setSubject(`Court Bundle - ${bundleData.caseReference || 'Case'}`);
    bundlePdf.setCreator('My Case Files');
    bundlePdf.setProducer('My Case Files Legal Document Management');
    bundlePdf.setCreationDate(new Date());
    
    event.sender.send('bundle-progress', { 
      stage: 'processing', 
      progress: 10, 
      message: 'Creating bundle index...' 
    });
    
    // Create professional court bundle cover page and index
    const frontPages = await createBundleIndex(bundlePdf, bundleData);
    let currentPageNumber = frontPages.length + 1; // Start document pages after front matter
    
    event.sender.send('bundle-progress', { 
      stage: 'processing', 
      progress: 20, 
      message: 'Processing documents...' 
    });
    
    // Process and merge actual PDF documents
    const helveticaBold = await bundlePdf.embedFont(StandardFonts.HelveticaBold);
    let processedDocs = 0;
    const totalDocs = bundleData.documents.length;
    
    // Process documents by section
    for (const section of bundleData.sections) {
      if (!section.documentCount) continue;
      
      // Add section divider page
      const dividerPage = bundlePdf.addPage([595.28, 841.89]); // A4 size
      const { width, height } = dividerPage.getSize();
      
      // Draw section header
      const sectionTitle = `SECTION ${section.letter}`;
      const sectionLabel = section.label.toUpperCase();
      
      // Center the section information
      const titleWidth = helveticaBold.widthOfTextAtSize(sectionTitle, 36);
      const labelWidth = helveticaBold.widthOfTextAtSize(sectionLabel, 24);
      
      dividerPage.drawText(sectionTitle, {
        x: (width - titleWidth) / 2,
        y: height / 2 + 50,
        size: 36,
        font: helveticaBold,
        color: rgb(0, 0, 0),
      });
      
      dividerPage.drawText(sectionLabel, {
        x: (width - labelWidth) / 2,
        y: height / 2 - 20,
        size: 24,
        font: helveticaBold,
        color: rgb(0, 0, 0),
      });
      
      // Add page number in bottom right corner in blue, large font with white background (consistent with document pages)
      const pageNumText = currentPageNumber.toString();
      const fontSize = 16; // Large font to match document pages
      const pageNumWidth = helveticaBold.widthOfTextAtSize(pageNumText, fontSize);
      const padding = 6; // Padding around text
      
      // Draw white background rectangle
      dividerPage.drawRectangle({
        x: width - pageNumWidth - 20 - padding, // Position with padding
        y: 20 - padding, // Position with padding
        width: pageNumWidth + (padding * 2),
        height: fontSize + (padding * 2),
        color: rgb(1, 1, 1), // White background
        borderColor: rgb(0.8, 0.8, 0.8), // Light gray border
        borderWidth: 0.5,
      });
      
      // Draw page number text on top
      dividerPage.drawText(pageNumText, {
        x: width - pageNumWidth - 20, // 20px margin from right edge
        y: 20, // 20px margin from bottom edge
        size: fontSize,
        font: helveticaBold,
        color: rgb(0, 0.4, 0.8), // Blue color to match document pages
      });
      
      currentPageNumber++;
      
      // Get documents for this section
      const sectionDocs = bundleData.documents.filter(doc => doc.section === section.id);
      
      for (const doc of sectionDocs) {
        try {
          processedDocs++;
          const progress = 20 + Math.floor((processedDocs / totalDocs) * 60); // 20-80% for document processing
          
          event.sender.send('bundle-progress', { 
            stage: 'processing', 
            progress: progress, 
            message: `Processing document ${processedDocs} of ${totalDocs}: ${doc.name}` 
          });
          
          console.log(`📄 Processing document: ${doc.name}`);
          
          // Convert array back to Uint8Array
          const pdfBytes = new Uint8Array(doc.arrayBuffer);
          
          // Load the source PDF
          const srcPdf = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
          
          // Handle selected pages if specified
          let pagesToCopy = [];
          if (doc.selectedPages && doc.selectedPages.length > 0) {
            // Use selected pages (1-indexed)
            pagesToCopy = doc.selectedPages.map(pageNum => pageNum - 1); // Convert to 0-indexed
          } else {
            // Use all pages
            pagesToCopy = srcPdf.getPageIndices();
          }
          
          // Copy pages to bundle
          const copiedPages = await bundlePdf.copyPages(srcPdf, pagesToCopy);
          
          for (const page of copiedPages) {
            bundlePdf.addPage(page);
            
            // Add page number in bottom right corner in blue, large font with white background
            const { width } = page.getSize();
            const pageNumText = currentPageNumber.toString();
            const fontSize = 16; // Large font
            const pageNumWidth = helveticaBold.widthOfTextAtSize(pageNumText, fontSize);
            const padding = 6; // Padding around text
            
            // Draw white background rectangle
            page.drawRectangle({
              x: width - pageNumWidth - 20 - padding, // Position with padding
              y: 20 - padding, // Position with padding
              width: pageNumWidth + (padding * 2),
              height: fontSize + (padding * 2),
              color: rgb(1, 1, 1), // White background
              borderColor: rgb(0.8, 0.8, 0.8), // Light gray border
              borderWidth: 0.5,
            });
            
            // Draw page number text on top
            page.drawText(pageNumText, {
              x: width - pageNumWidth - 20, // 20px margin from right edge
              y: 20, // 20px margin from bottom edge
              size: fontSize,
              font: helveticaBold,
              color: rgb(0, 0.4, 0.8), // Blue color
            });
            
            currentPageNumber++;
          }
          
          console.log(`✅ Added ${copiedPages.length} pages from ${doc.name}`);
          
        } catch (error) {
          console.error(`❌ Error processing document ${doc.name}:`, error);
          // Continue with other documents even if one fails
        }
      }
    }
    
    event.sender.send('bundle-progress', { 
      stage: 'finalizing', 
      progress: 90, 
      message: 'Finalizing bundle...' 
    });
    
    // Serialize PDF to bytes
    const pdfBytes = await bundlePdf.save();
    
    // Generate filename
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `${bundleData.bundleName.replace(/[^a-zA-Z0-9]/g, '_')}_${timestamp}.pdf`;
    
    // Save to temp directory
    const tempDir = path.join(os.tmpdir(), 'mycasefiles-bundles');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    const tempFilePath = path.join(tempDir, filename);
    fs.writeFileSync(tempFilePath, pdfBytes);
    
    console.log('✅ PDF bundle saved to:', tempFilePath);
    
    // Try to open the PDF file
    shell.openPath(tempFilePath).then((error) => {
      if (error) {
        console.error('Error opening PDF:', error);
        // If opening fails, show the file in the folder
        shell.showItemInFolder(tempFilePath);
        console.log('Showing PDF in folder instead');
      } else {
        console.log('PDF opened successfully');
      }
    });
    
    event.sender.send('bundle-progress', { 
      stage: 'complete', 
      progress: 100, 
      message: 'Bundle created and opened!' 
    });
    
    return {
      success: true,
      filename: filename,
      size: pdfBytes.length,
      filePath: tempFilePath
    };
    
  } catch (error) {
    console.error('💥 Bundle creation failed:', error);
    event.sender.send('bundle-progress', { 
      stage: 'error', 
      progress: 0, 
      message: `Error: ${error.message}` 
    });
    
    return {
      success: false,
      error: error.message
    };
  }
});

