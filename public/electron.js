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
    icon: path.join(__dirname, 'icon-512.png'), // App icon
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
        // Capture full Tesseract.js data structure including lines, paragraphs, words
        // CRITICAL: v6 requires worker API for hierarchical structure output
        const worker = await Tesseract.createWorker('eng');
        let data;
        
        try {
          const result = await worker.recognize(imagePath, {}, {
            text: true,
            blocks: true  // Enable hierarchical data structure (lines, paragraphs, words)
          });
          data = result.data;
          
          await worker.terminate();
        } catch (workerError) {
          await worker.terminate();
          throw workerError;
        }
        
        // Debug: Log the raw data structure to understand what Tesseract is returning
        console.log(`🔍 Page ${i + 1} raw data structure:`, {
          hasLines: !!data.lines,
          linesLength: data.lines?.length || 0,
          hasParagraphs: !!data.paragraphs,
          paragraphsLength: data.paragraphs?.length || 0,
          hasWords: !!data.words,
          wordsLength: data.words?.length || 0,
          hasBlocks: !!data.blocks,
          blocksLength: data.blocks?.length || 0
        });
        
        // Debug: Inspect blocks structure to find hierarchical data
        if (data.blocks && data.blocks.length > 0) {
          console.log(`🔍 Page ${i + 1} first block structure:`, {
            hasLines: !!data.blocks[0].lines,
            linesLength: data.blocks[0].lines?.length || 0,
            hasParagraphs: !!data.blocks[0].paragraphs,
            paragraphsLength: data.blocks[0].paragraphs?.length || 0,
            hasWords: !!data.blocks[0].words,
            wordsLength: data.blocks[0].words?.length || 0,
            blockKeys: Object.keys(data.blocks[0])
          });
          
          // Debug first paragraph structure if available
          if (data.blocks[0].paragraphs && data.blocks[0].paragraphs.length > 0) {
            console.log(`🔍 Page ${i + 1} first paragraph structure:`, {
              hasLines: !!data.blocks[0].paragraphs[0].lines,
              linesLength: data.blocks[0].paragraphs[0].lines?.length || 0,
              hasWords: !!data.blocks[0].paragraphs[0].words,
              wordsLength: data.blocks[0].paragraphs[0].words?.length || 0,
              paragraphKeys: Object.keys(data.blocks[0].paragraphs[0])
            });
          }
        }
        
        const pageText = data.text || '';
        const pageConfidence = data.confidence || 0;
        let pageLines = data.lines || [];
        let pageParagraphs = data.paragraphs || [];
        let pageWords = data.words || [];
        const pageBlocks = data.blocks || [];
        
        // Extract hierarchical data from blocks if not available at top level
        if (pageLines.length === 0 && pageBlocks.length > 0) {
          console.log(`📄 Page ${i + 1}: Extracting hierarchical data from blocks structure...`);
          
          // Flatten data from all blocks
          pageBlocks.forEach(block => {
            // Extract paragraphs from block
            if (block.paragraphs && block.paragraphs.length > 0) {
              pageParagraphs = pageParagraphs.concat(block.paragraphs);
              
              // Extract lines from paragraphs
              block.paragraphs.forEach(paragraph => {
                if (paragraph.lines && paragraph.lines.length > 0) {
                  pageLines = pageLines.concat(paragraph.lines);
                  
                  // Extract words from lines
                  paragraph.lines.forEach(line => {
                    if (line.words && line.words.length > 0) {
                      pageWords = pageWords.concat(line.words);
                    }
                  });
                }
              });
            }
            
            // Also check for direct lines/words in block (fallback)
            if (block.lines && block.lines.length > 0) {
              pageLines = pageLines.concat(block.lines);
            }
            if (block.words && block.words.length > 0) {
              pageWords = pageWords.concat(block.words);
            }
          });
          
          console.log(`✅ Page ${i + 1}: Extracted ${pageLines.length} lines, ${pageParagraphs.length} paragraphs, ${pageWords.length} words from blocks hierarchy`);
        }
        
        console.log(`✅ Page ${i + 1}: ${pageConfidence.toFixed(1)}% confidence, ${pageText.length} chars`);
        console.log(`📄 Page ${i + 1}: ${pageLines.length} lines, ${pageParagraphs.length} paragraphs, ${pageWords.length} words`);
        
        fullText += pageText + '\n\n';
        ocrResults.push({ 
          page: i + 1, 
          text: pageText, 
          confidence: pageConfidence, 
          length: pageText.length,
          lines: pageLines,
          paragraphs: pageParagraphs,
          words: pageWords,
          blocks: pageBlocks
        });
        
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
    
    const validResults = ocrResults.filter(r => r.confidence);
    const avgConfidence = validResults.length > 0 
      ? validResults.reduce((sum, r) => sum + r.confidence, 0) / validResults.length 
      : 0;
    
    console.log(`🎉 OCR completed: ${fullText.length} chars, ${avgConfidence.toFixed(1)}% confidence`);
    
    // Create searchable PDF with invisible text layers
    console.log('📝 Creating searchable PDF with text overlay...');
    
    // Get image dimensions from poppler conversion options or use defaults
    const imageDimensions = { 
      width: options.resolutionXYAxis * 8.5,  // Approximate A4 width at 300 DPI
      height: options.resolutionXYAxis * 11   // Approximate A4 height at 300 DPI  
    };
    
    const searchablePdfBuffer = await createSearchablePDF(pdfBuffer, ocrResults, imageDimensions);
    
    return {
      success: true,
      text: fullText.trim(),
      confidence: avgConfidence,
      pages: ocrResults,
      method: 'OCR',
      searchablePdf: searchablePdfBuffer // Return the searchable PDF
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

// Helper function to create searchable PDF with OCR text overlay
async function createSearchablePDF(originalPdfBuffer, ocrResults, imageDimensions) {
  try {
    console.log('🔧 Loading original PDF for text overlay...');
    const originalPdf = await PDFDocument.load(originalPdfBuffer);
    const newPdf = await PDFDocument.create();
    const helvetica = await newPdf.embedFont(StandardFonts.Helvetica);
    
    console.log(`📄 Processing ${originalPdf.getPageCount()} pages for text overlay...`);
    
    for (let pageIndex = 0; pageIndex < originalPdf.getPageCount(); pageIndex++) {
      // Copy original page
      const [copiedPage] = await newPdf.copyPages(originalPdf, [pageIndex]);
      newPdf.addPage(copiedPage);
      
      const { width: pdfWidth, height: pdfHeight } = copiedPage.getSize();
      console.log(`📐 Page ${pageIndex + 1}: PDF dimensions ${pdfWidth}x${pdfHeight}, Image dimensions ${imageDimensions.width}x${imageDimensions.height}`);
      
      // Calculate scaling factors
      const scaleX = pdfWidth / imageDimensions.width;
      const scaleY = pdfHeight / imageDimensions.height;
      
      // Get OCR data for this page
      const pageOcr = ocrResults[pageIndex];
      if (pageOcr && pageOcr.lines) {
        console.log(`📝 Adding ${pageOcr.lines.length} text lines to page ${pageIndex + 1}...`);
        
        // Add invisible text using Tesseract's line groupings for natural selection
        pageOcr.lines.forEach((line, lineIndex) => {
          if (line.text.trim().length > 0 && line.bbox) {
            const scaledX = line.bbox.x0 * scaleX;
            const scaledY = pdfHeight - (line.bbox.y1 * scaleY); // PDF coords are bottom-up
            const scaledFontSize = Math.max(8, (line.bbox.y1 - line.bbox.y0) * scaleY); // Minimum 8pt font
            
            copiedPage.drawText(line.text.trim(), {
              x: scaledX,
              y: scaledY,
              size: scaledFontSize,
              font: helvetica,
              color: rgb(0, 0, 0),
              opacity: 0, // Invisible but selectable
            });
            
            if (lineIndex < 3) { // Log first few lines for debugging
              console.log(`  Line ${lineIndex + 1}: "${line.text.trim()}" at (${scaledX.toFixed(1)}, ${scaledY.toFixed(1)}) size ${scaledFontSize.toFixed(1)}`);
            }
          }
        });
      }
    }
    
    console.log('✅ Searchable PDF created successfully');
    return await newPdf.save();
    
  } catch (error) {
    console.error('❌ Failed to create searchable PDF:', error);
    // Return original PDF if overlay fails
    return originalPdfBuffer;
  }
}

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
        extractionMethod: 'OCR',
        searchablePdf: ocrResult.searchablePdf
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
  const pageReferences = new Map(); // Track page references for linking
  
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
  
  // Use actual page numbers from bundle data
  const frontPageCount = 2; // Cover page + index page(s)
  
  for (const section of bundleData.sections) {
    if (!section.documentCount) continue;
    
    // Calculate actual section page (section start page + front pages)
    const sectionPageRef = section.startPage + frontPageCount;
    pageReferences.set(`section_${section.id}`, sectionPageRef);
    
    // Section header (e.g., "A. Chronology")
    yPosition -= 5;
    const sectionLabel = `${section.letter}. ${section.label}`;
    
    // Create hyperlink annotation for section
    const labelWidth = helveticaBold.widthOfTextAtSize(sectionLabel, 12);
    const sectionLinkAnnotation = pdfDoc.context.register(
      pdfDoc.context.obj({
        Type: 'Annot',
        Subtype: 'Link',
        Rect: [margin, yPosition - 2, margin + labelWidth, yPosition + 12],
        Border: [0, 0, 0],
        Dest: [sectionPageRef - 1, 'XYZ', null, null, null], // 0-indexed page reference
        H: 'I', // Highlight mode
      })
    );
    
    indexPage.node.addAnnot(sectionLinkAnnotation);
    
    drawLeftText(sectionLabel, helveticaBold, 12, yPosition, margin, indexPage);
    
    // Draw dotted line from section label to page number
    const pageNumStr = sectionPageRef.toString();
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
      
      // Store document page reference using actual bundle pagination
      const docPageRef = doc.bundleStartPage + frontPageCount;
      pageReferences.set(`doc_${doc.id}`, docPageRef);
      
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
      
      // Create hyperlink annotation for document
      const docLabelWidth = helvetica.widthOfTextAtSize(displayLabel, 11);
      const docLinkAnnotation = pdfDoc.context.register(
        pdfDoc.context.obj({
          Type: 'Annot',
          Subtype: 'Link',
          Rect: [indentX, yPosition - 2, indentX + docLabelWidth, yPosition + 11],
          Border: [0, 0, 0],
          Dest: [docPageRef - 1, 'XYZ', null, null, null], // 0-indexed page reference
          H: 'I', // Highlight mode
        })
      );
      
      indexPage.node.addAnnot(docLinkAnnotation);
      
      drawLeftText(displayLabel, helvetica, 11, yPosition, indentX, indexPage);
      
      // Page number with dotted line
      const docPageStr = docPageRef.toString();
      const docPageWidth = helvetica.widthOfTextAtSize(docPageStr, 11);
      const docPageX = width - margin - docPageWidth;
      
      drawDottedLine(indentX + docLabelWidth + 10, docPageX - 10, yPosition + 3, indexPage);
      drawLeftText(docPageStr, helvetica, 11, yPosition, docPageX, indexPage);
      
      yPosition -= 18;
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
  
  // Return both cover page, index pages, and page references for bookmarks
  return {
    pages: [coverPage, ...indexPages],
    pageReferences: pageReferences
  };
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
    const indexResult = await createBundleIndex(bundlePdf, bundleData);
    const frontPages = indexResult.pages;
    const pageReferences = indexResult.pageReferences;
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
      message: 'Creating bookmarks and finalizing bundle...' 
    });
    
    // Create PDF bookmarks/outline
    console.log('📑 Creating PDF bookmarks...');
    
    // Get pages for bookmark creation
    const pages = bundlePdf.getPages();
    
    // Create root outline
    const outlineRef = bundlePdf.context.nextRef();
    const outlineDict = bundlePdf.context.obj({
      Type: 'Outlines',
      Count: 0,
    });
    bundlePdf.context.assign(outlineRef, outlineDict);
    
    // Set the outline in the catalog
    bundlePdf.catalog.set(bundlePdf.context.obj('Outlines'), outlineRef);
    
    let bookmarkCount = 0;
    let prevBookmarkRef = null;
    let firstBookmarkRef = null;
    
    // Create bookmarks for each section
    for (const section of bundleData.sections) {
      if (!section.documentCount) continue;
      
      const sectionPageRef = pageReferences.get(`section_${section.id}`);
      if (!sectionPageRef) continue;
      
      // Create section bookmark
      const sectionBookmarkRef = bundlePdf.context.nextRef();
      const sectionBookmarkDict = bundlePdf.context.obj({
        Title: bundlePdf.context.obj(`Section ${section.letter}: ${section.label}`),
        Dest: bundlePdf.context.obj([pages[sectionPageRef - 1].ref, 'XYZ', null, null, null]),
        Parent: outlineRef,
      });
      
      if (prevBookmarkRef) {
        sectionBookmarkDict.set(bundlePdf.context.obj('Prev'), prevBookmarkRef);
        const prevDict = bundlePdf.context.lookup(prevBookmarkRef);
        prevDict.set(bundlePdf.context.obj('Next'), sectionBookmarkRef);
      } else {
        firstBookmarkRef = sectionBookmarkRef;
      }
      
      bundlePdf.context.assign(sectionBookmarkRef, sectionBookmarkDict);
      prevBookmarkRef = sectionBookmarkRef;
      bookmarkCount++;
      
      // Create bookmarks for documents in this section
      const sectionDocs = bundleData.documents.filter(doc => doc.section === section.id);
      let docIndex = 1;
      let prevDocBookmarkRef = null;
      let firstDocBookmarkRef = null;
      let docBookmarkCount = 0;
      
      for (const doc of sectionDocs) {
        const docPageRef = pageReferences.get(`doc_${doc.id}`);
        if (!docPageRef) continue;
        
        const docBookmarkRef = bundlePdf.context.nextRef();
        const docBookmarkDict = bundlePdf.context.obj({
          Title: bundlePdf.context.obj(`${section.letter}.${docIndex} ${doc.name}`),
          Dest: bundlePdf.context.obj([pages[docPageRef - 1].ref, 'XYZ', null, null, null]),
          Parent: sectionBookmarkRef,
        });
        
        if (prevDocBookmarkRef) {
          docBookmarkDict.set(bundlePdf.context.obj('Prev'), prevDocBookmarkRef);
          const prevDocDict = bundlePdf.context.lookup(prevDocBookmarkRef);
          prevDocDict.set(bundlePdf.context.obj('Next'), docBookmarkRef);
        } else {
          firstDocBookmarkRef = docBookmarkRef;
        }
        
        bundlePdf.context.assign(docBookmarkRef, docBookmarkDict);
        prevDocBookmarkRef = docBookmarkRef;
        docIndex++;
        docBookmarkCount++;
      }
      
      // Update section bookmark with children
      if (firstDocBookmarkRef) {
        sectionBookmarkDict.set(bundlePdf.context.obj('First'), firstDocBookmarkRef);
        sectionBookmarkDict.set(bundlePdf.context.obj('Last'), prevDocBookmarkRef);
        sectionBookmarkDict.set(bundlePdf.context.obj('Count'), bundlePdf.context.obj(docBookmarkCount));
      }
    }
    
    // Update root outline
    if (firstBookmarkRef) {
      outlineDict.set(bundlePdf.context.obj('First'), firstBookmarkRef);
      outlineDict.set(bundlePdf.context.obj('Last'), prevBookmarkRef);
      outlineDict.set(bundlePdf.context.obj('Count'), bundlePdf.context.obj(bookmarkCount));
    }
    
    console.log(`✅ Created ${bookmarkCount} section bookmarks with document sub-bookmarks`);
    
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

