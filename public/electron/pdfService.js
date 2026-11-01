/**
 * PDF parsing and page extraction service.
 *
 * IPC handlers:
 *  - parse-pdf: Full PDF text extraction with scanned-document detection
 *  - extract-page-count: Fast page-count-only extraction
 *  - get-resource-stats: Resource monitor statistics
 */
const pdfParse = require('pdf-parse');

let resourceMonitor;

// ─── Helpers ──────────────────────────────────────────────────────

/** Detect if PDF is scanned (minimal text content). */
function isScannedPDF(text, info) {
  const textLength = text.trim().length;
  const hasMinimalText = textLength < 50;
  const isEpsonScan = info && info.Producer && info.Producer.includes('EPSON Scan');
  const hasImageOnlyPages = textLength < 10;

  console.log('🔍 Scanned PDF detected:', { textLength, producer: info?.Producer });

  return hasMinimalText || isEpsonScan || hasImageOnlyPages;
}

// ─── IPC registration ─────────────────────────────────────────────

function init(deps) {
  const { ipcMain, resourceMonitor: rm } = deps;
  resourceMonitor = rm;

  // parse-pdf: Full PDF text extraction with OCR detection
  ipcMain.handle('parse-pdf', async (event, pdfBuffer) => {
    let operationId;

    try {
      const fileSizeMB = pdfBuffer.byteLength / (1024 * 1024);
      operationId = resourceMonitor.startOperation('pdf', {
        fileSizeMB: fileSizeMB.toFixed(2)
      });

      // Size check (buffer-based, no file path available)
      const maxSizeMB = resourceMonitor.limits?.PDF?.MAX_FILE_SIZE_MB || 100;
      if (fileSizeMB > maxSizeMB) {
        throw new Error(`PDF too large: ${fileSizeMB.toFixed(1)}MB exceeds ${maxSizeMB}MB limit`);
      }

      const options = {
        normalizeWhitespace: true,
        disableCombineTextItems: false,
        max: 3
      };

      const data = await pdfParse(Buffer.from(pdfBuffer), options);
      console.log(`📄 PDF parsed: ${data.text.length} chars, producer: ${data.info?.Producer}`);

      const isScanned = isScannedPDF(data.text, data.info);
      if (isScanned) {
        console.log('🔍 Scanned PDF detected - manual OCR available');
      }

      if (operationId) {
        resourceMonitor.finishOperation(operationId, {
          success: true,
          pageCount: data.numpages,
          textLength: data.text.length,
          isScanned
        });
      }

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

      if (operationId) {
        resourceMonitor.finishOperation(operationId, {
          success: false,
          error: error.message
        });
      }

      return {
        success: false,
        error: error.message
      };
    }
  });

  // extract-page-count: Fast page count extraction
  ipcMain.handle('extract-page-count', async (event, pdfBuffer) => {
    try {
      console.log('📄 Extracting page count from PDF...');

      const data = await pdfParse(Buffer.from(pdfBuffer), {
        max: 1,
        version: 'v1.10.100'
      });

      console.log(`📄 PDF page count extracted: ${data.numpages} pages`);

      return {
        success: true,
        pageCount: data.numpages
      };

    } catch (error) {
      console.error('❌ Page count extraction failed:', error);
      return {
        success: false,
        error: error.message,
        pageCount: null
      };
    }
  });

  // get-resource-stats: Resource monitor statistics
  ipcMain.handle('get-resource-stats', async () => {
    if (!resourceMonitor) {
      return { error: 'Resource monitor not initialized' };
    }

    try {
      return resourceMonitor.getResourceStats();
    } catch (error) {
      console.error('Error getting resource stats:', error);
      return { error: error.message };
    }
  });
}

module.exports = { init, isScannedPDF };
