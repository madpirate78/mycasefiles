/**
 * OCR processing service.
 *
 * Handles PDF-to-image conversion via Poppler, OCR via Tesseract.js,
 * and creation of searchable PDFs with invisible text overlays.
 *
 * IPC handlers:
 *  - ocr-pdf: Manual OCR processing on a PDF buffer
 */
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const Tesseract = require('tesseract.js');
const { Poppler } = require('node-poppler');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');

let resourceMonitor;

// ─── Core OCR pipeline ───────────────────────────────────────────

/** Perform OCR on PDF pages (max 3 pages for performance). */
async function performOCROnPDF(pdfBuffer) {
  let operationId;

  try {
    console.log('🔍 Starting OCR processing...');

    const fileSizeMB = pdfBuffer.byteLength / (1024 * 1024);
    if (fileSizeMB > 50) {
      throw new Error(`PDF file too large for OCR: ${fileSizeMB.toFixed(2)}MB (limit: 50MB)`);
    }

    operationId = resourceMonitor.startOperation('ocr', {
      fileSizeMB: fileSizeMB.toFixed(2)
    });

    // Create temporary directory for images
    const tempDir = path.join(os.tmpdir(), 'mycasefiles-ocr-' + crypto.randomBytes(8).toString('hex'));
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const tempPdfPath = path.join(tempDir, 'temp.pdf');
    fs.writeFileSync(tempPdfPath, Buffer.from(pdfBuffer));

    // Convert PDF to images using node-poppler
    const poppler = new Poppler();
    const outputPath = path.join(tempDir, 'page');

    const options = {
      firstPageToConvert: 1,
      lastPageToConvert: Math.min(3, resourceMonitor.limits.OCR.MAX_PAGES_PER_DOCUMENT),
      pngFile: true,
      resolutionXYAxis: 300,
    };

    console.log('📄 Converting PDF to images...');

    try {
      await poppler.pdfToCairo(tempPdfPath, outputPath, options);
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

    for (let i = 0; i < imagePaths.length; i++) {
      const stats = fs.statSync(imagePaths[i]);
      console.log(`📊 Image ${i + 1}: ${path.basename(imagePaths[i])}, size: ${stats.size} bytes`);
    }

    if (imagePaths.length === 0) {
      throw new Error('No pages could be converted to images');
    }

    // Perform OCR on each page
    let fullText = '';
    const ocrResults = [];

    for (let i = 0; i < imagePaths.length; i++) {
      const imagePath = imagePaths[i];
      try {
        let worker;
        let fallbackToSingleColumn = false;

        try {
          worker = await Tesseract.createWorker('eng', 1, {
            legacyCore: true,
            legacyLang: true
          });

          await worker.setParameters({
            tessedit_pageseg_mode: 1,
            user_defined_dpi: options.resolutionXYAxis || 300
          });
        } catch (legacyError) {
          console.log(`⚠️ Page ${i + 1}: Legacy worker failed, falling back to PSM_SINGLE_COLUMN`);
          fallbackToSingleColumn = true;

          worker = await Tesseract.createWorker('eng');
          await worker.setParameters({
            tessedit_pageseg_mode: 3,
            user_defined_dpi: options.resolutionXYAxis || 300
          });
        }

        let data;
        let usedPSM = fallbackToSingleColumn ? 3 : 1;

        try {
          const result = await worker.recognize(imagePath, {}, {
            text: true,
            blocks: true
          });
          data = result.data;

          const hasGoodResults = data.text && data.text.trim().length > 10 && data.lines && data.lines.length > 0;

          if (!hasGoodResults) {
            await worker.setParameters({
              tessedit_pageseg_mode: 11,
              user_defined_dpi: options.resolutionXYAxis || 300
            });

            const sparseResult = await worker.recognize(imagePath, {}, {
              text: true,
              blocks: true
            });

            if (sparseResult.data.text && sparseResult.data.text.trim().length > data.text?.trim().length) {
              data = sparseResult.data;
              usedPSM = 11;
            }
          }

          await worker.terminate();
        } catch (workerError) {
          await worker.terminate();
          throw workerError;
        }

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

          pageBlocks.forEach(block => {
            if (block.paragraphs && block.paragraphs.length > 0) {
              pageParagraphs = pageParagraphs.concat(block.paragraphs);

              block.paragraphs.forEach(paragraph => {
                if (paragraph.lines && paragraph.lines.length > 0) {
                  pageLines = pageLines.concat(paragraph.lines);

                  paragraph.lines.forEach(line => {
                    if (line.words && line.words.length > 0) {
                      pageWords = pageWords.concat(line.words);
                    }
                  });
                }
              });
            }

            if (block.lines && block.lines.length > 0) {
              pageLines = pageLines.concat(block.lines);
            }
            if (block.words && block.words.length > 0) {
              pageWords = pageWords.concat(block.words);
            }
          });
        }

        fullText += pageText + '\n\n';
        ocrResults.push({
          page: i + 1,
          text: pageText,
          confidence: pageConfidence,
          length: pageText.length,
          lines: pageLines,
          paragraphs: pageParagraphs,
          words: pageWords,
          blocks: pageBlocks,
          usedPSM: usedPSM,
          actualDPI: options.resolutionXYAxis || 300
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
      if (fs.existsSync(tempPdfPath)) {
        fs.unlinkSync(tempPdfPath);
      }
      const remainingFiles = fs.readdirSync(tempDir);
      remainingFiles.forEach(file => {
        fs.unlinkSync(path.join(tempDir, file));
      });
      fs.rmdirSync(tempDir);
    } catch (cleanupError) {
      console.warn('⚠️ Could not fully clean up temporary files:', cleanupError.message);
    }

    const validResults = ocrResults.filter(r => r.confidence);
    const avgConfidence = validResults.length > 0
      ? validResults.reduce((sum, r) => sum + r.confidence, 0) / validResults.length
      : 0;

    const psmModes = ocrResults
      .filter(r => r.usedPSM)
      .map(r => `PSM${r.usedPSM}`)
      .join(',');

    const dpiIssues = ocrResults.filter(r => r.usedPSM === 11).length;
    const summary = `✅ ${ocrResults.length}p|${avgConfidence.toFixed(0)}%|PSM:${psmModes}${dpiIssues > 0 ? `|⚠️DPI:${dpiIssues}` : ''}`;
    console.log(summary);

    // Get actual image dimensions for searchable PDF creation
    const sharp = require('sharp');
    let imageDimensions;

    try {
      if (imagePaths.length > 0) {
        const firstImageMetadata = await sharp(imagePaths[0]).metadata();
        imageDimensions = {
          width: firstImageMetadata.width,
          height: firstImageMetadata.height,
          actualDPI: firstImageMetadata.density || options.resolutionXYAxis
        };
        console.log(`📏 Actual: ${imageDimensions.width}x${imageDimensions.height}px @ ${imageDimensions.actualDPI}DPI`);
      } else {
        throw new Error('No images available');
      }
    } catch (error) {
      console.log('⚠️ Using DPI approximation');
      imageDimensions = {
        width: options.resolutionXYAxis * 8.5,
        height: options.resolutionXYAxis * 11,
        actualDPI: options.resolutionXYAxis
      };
    }

    const searchablePdfBuffer = await createSearchablePDF(pdfBuffer, ocrResults, imageDimensions);

    if (operationId) {
      resourceMonitor.finishOperation(operationId, {
        success: true,
        confidence: avgConfidence,
        pageCount: ocrResults.length
      });
    }

    return {
      success: true,
      text: fullText.trim(),
      confidence: avgConfidence,
      pages: ocrResults,
      method: 'OCR',
      searchablePdf: searchablePdfBuffer
    };

  } catch (error) {
    console.error('💥 OCR processing failed:', error);

    if (operationId) {
      resourceMonitor.finishOperation(operationId, {
        success: false,
        error: error.message
      });
    }

    return {
      success: false,
      error: error.message,
      method: 'OCR'
    };
  }
}

// ─── Searchable PDF creation ─────────────────────────────────────

/** Create a searchable PDF with invisible text overlays from OCR results. */
async function createSearchablePDF(originalPdfBuffer, ocrResults, imageDimensions) {
  try {
    console.log('🔧 Loading original PDF for text overlay...');
    const originalPdf = await PDFDocument.load(originalPdfBuffer);
    const newPdf = await PDFDocument.create();
    const helvetica = await newPdf.embedFont(StandardFonts.Helvetica);

    for (let pageIndex = 0; pageIndex < originalPdf.getPageCount(); pageIndex++) {
      const [copiedPage] = await newPdf.copyPages(originalPdf, [pageIndex]);
      newPdf.addPage(copiedPage);

      const { width: pdfWidth, height: pdfHeight } = copiedPage.getSize();
      const scaleX = pdfWidth / imageDimensions.width;
      const scaleY = pdfHeight / imageDimensions.height;

      const pageOcr = ocrResults[pageIndex];
      if (pageOcr && pageOcr.lines) {
        const useWordLevel = pageOcr.lines.some(line => line.words && line.words.length > 0);

        if (useWordLevel) {
          // First pass: Calculate average font size per line
          pageOcr.lines.forEach((line) => {
            if (line.words && line.words.length > 0) {
              const reliableWords = line.words
                .filter(word => word.text.trim().length > 0 && word.bbox && (word.confidence || 0) > 70)
                .slice(0, 10);

              const sampleWords = reliableWords.length > 3 ? reliableWords :
                line.words.filter(word => word.text.trim().length > 0 && word.bbox).slice(0, 10);

              const wordFontSizes = sampleWords.map(word => {
                const bboxHeightInPixels = word.bbox.y1 - word.bbox.y0;
                const actualDPI = pageOcr.actualDPI || 300;
                let fontSizeInPoints = (bboxHeightInPixels * 72) / actualDPI;

                const confidence = word.confidence || 50;
                const isHighConfidence = confidence > 80;

                if (!isHighConfidence && bboxHeightInPixels > 60) {
                  fontSizeInPoints = 12;
                } else if (bboxHeightInPixels > 100) {
                  fontSizeInPoints = 12;
                } else if (bboxHeightInPixels < 4) {
                  fontSizeInPoints = 8;
                }

                return fontSizeInPoints;
              });

              const avgFontSize = wordFontSizes.length > 0
                ? wordFontSizes.reduce((sum, size) => sum + size, 0) / wordFontSizes.length
                : 10;

              line._avgFontSize = Math.max(6, Math.min(18, avgFontSize));
            }
          });

          // Second pass: Apply averaged font sizes to all words
          pageOcr.lines.forEach((line) => {
            if (line.words && line.words.length > 0 && line._avgFontSize) {
              line.words.forEach((word) => {
                if (word.text.trim().length > 0 && word.bbox) {
                  const scaledX = word.bbox.x0 * scaleX;
                  const centerY = (word.bbox.y0 + word.bbox.y1) / 2;
                  const scaledY = pdfHeight - (centerY * scaleY);

                  copiedPage.drawText(word.text.trim(), {
                    x: scaledX,
                    y: scaledY,
                    size: line._avgFontSize,
                    font: helvetica,
                    color: rgb(0, 0, 0),
                    opacity: 0,
                  });
                }
              });
            }
          });
        } else {
          // Fallback to line-level positioning
          pageOcr.lines.forEach((line) => {
            if (line.text.trim().length > 0 && line.bbox) {
              const scaledX = line.bbox.x0 * scaleX;
              const centerY = (line.bbox.y0 + line.bbox.y1) / 2;
              const scaledY = pdfHeight - (centerY * scaleY);

              const bboxHeightInPixels = line.bbox.y1 - line.bbox.y0;
              let fontSizeInPoints = (bboxHeightInPixels * 72) / 300;

              if (bboxHeightInPixels > 80) {
                console.log(`⚠️ Rejecting oversized bounding box: "${line.text.trim()}" h=${bboxHeightInPixels}px (would be ${fontSizeInPoints.toFixed(1)}pt)`);
                fontSizeInPoints = 12;
              } else if (bboxHeightInPixels < 8) {
                fontSizeInPoints = 8;
              }

              copiedPage.drawText(line.text.trim(), {
                x: scaledX,
                y: scaledY,
                size: fontSizeInPoints,
                font: helvetica,
                color: rgb(0, 0, 0),
                opacity: 0,
              });
            }
          });
        }
      }
    }

    const searchablePdfBytes = await newPdf.save();
    return searchablePdfBytes;

  } catch (error) {
    console.error('❌ Failed to create searchable PDF:', error);
    return originalPdfBuffer;
  }
}

// ─── IPC registration ─────────────────────────────────────────────

function init(deps) {
  const { ipcMain, resourceMonitor: rm } = deps;
  resourceMonitor = rm;

  ipcMain.handle('ocr-pdf', async (event, pdfBuffer) => {
    try {
      const ocrResult = await performOCROnPDF(pdfBuffer);

      if (ocrResult.success) {
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
}

module.exports = { init };
