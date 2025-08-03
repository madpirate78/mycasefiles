# OCR Searchable PDF Implementation Guide

## Overview
This guide documents the technical challenges and solutions for implementing searchable PDF creation from scanned documents using OCR text overlays.

## The Problem
- Scanned PDFs in court bundles are not text-searchable
- OCR extracts text but traditionally stores it separately in database
- Need invisible text overlays on PDFs for natural text selection and searchability

## Key Technical Challenges Discovered

### 1. Tesseract.js v6 API Breaking Changes

**Problem**: Simple `Tesseract.recognize()` doesn't return hierarchical data in v6

```javascript
// ❌ BROKEN - doesn't work in v6
const { data } = await Tesseract.recognize(image, 'eng');
console.log(data.lines); // undefined
console.log(data.paragraphs); // undefined  
console.log(data.words); // undefined
```

**Solution**: Must use worker API with explicit output options

```javascript
// ✅ WORKS - v6 worker API
const worker = await Tesseract.createWorker('eng');
const { data } = await worker.recognize(image, {}, {
  text: true,
  blocks: true  // Enables hierarchical structure
});
await worker.terminate();
```

### 2. Hierarchical Data Structure Location

**Problem**: `data.lines`, `data.paragraphs`, `data.words` are empty even with blocks enabled

**Root Cause**: v6 nests hierarchy inside blocks structure instead of top-level

```javascript
// ❌ WRONG - looking at top level
console.log(data.lines.length); // 0
console.log(data.paragraphs.length); // 0

// ✅ CORRECT - extract from blocks hierarchy
let pageLines = [];
data.blocks.forEach(block => {
  block.paragraphs?.forEach(paragraph => {
    paragraph.lines?.forEach(line => {
      pageLines.push(line); // This is where the lines actually are
    });
  });
});
```

### 3. Coordinate Mapping

**Problem**: OCR coordinates are in image space, PDF needs page space

```javascript
// ❌ WRONG - using OCR coordinates directly
copiedPage.drawText(line.text, {
  x: line.bbox.x0,  // Image coordinates
  y: line.bbox.y0   // Wrong coordinate system
});

// ✅ CORRECT - scale coordinates properly
const scaleX = pdfWidth / imageDimensions.width;
const scaleY = pdfHeight / imageDimensions.height;
const scaledX = line.bbox.x0 * scaleX;
const scaledY = pdfHeight - (line.bbox.y1 * scaleY); // PDF coords are bottom-up

copiedPage.drawText(line.text, {
  x: scaledX,
  y: scaledY,
  size: Math.max(8, (line.bbox.y1 - line.bbox.y0) * scaleY),
  opacity: 0  // Invisible but selectable
});
```

### 4. Common Runtime Errors

**Error**: "Cannot read properties of undefined (reading 'length')"
```javascript
// ❌ CAUSES ERROR - division by zero
const avgConfidence = results.reduce((sum, r) => sum + r.confidence, 0) / results.length;

// ✅ FIXED - check array length
const validResults = results.filter(r => r.confidence);
const avgConfidence = validResults.length > 0 
  ? validResults.reduce((sum, r) => sum + r.confidence, 0) / validResults.length 
  : 0;
```

## Minimal Working Implementation

### 1. OCR with Hierarchical Data Extraction

```javascript
async function performOCR(pdfBuffer) {
  // Convert PDF to images first (using pdf-poppler)
  const imagePaths = await convertPdfToImages(pdfBuffer);
  
  const ocrResults = [];
  
  for (const imagePath of imagePaths) {
    // CRITICAL: Use worker API, not simple recognize
    const worker = await Tesseract.createWorker('eng');
    
    try {
      const { data } = await worker.recognize(imagePath, {}, {
        text: true,
        blocks: true  // Enable hierarchical structure
      });
      
      // Extract lines from blocks hierarchy (v6 structure)
      let pageLines = [];
      let pageWords = [];
      
      data.blocks.forEach(block => {
        block.paragraphs?.forEach(paragraph => {
          paragraph.lines?.forEach(line => {
            pageLines.push(line);
            
            // Extract words from lines
            line.words?.forEach(word => {
              pageWords.push(word);
            });
          });
        });
      });
      
      ocrResults.push({
        text: data.text,
        lines: pageLines,
        words: pageWords,
        confidence: data.confidence
      });
      
    } finally {
      await worker.terminate();
    }
  }
  
  return ocrResults;
}
```

### 2. Create Searchable PDF with Invisible Text

```javascript
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

async function createSearchablePDF(originalPdfBuffer, ocrResults, imageDimensions) {
  const originalPdf = await PDFDocument.load(originalPdfBuffer);
  const newPdf = await PDFDocument.create();
  const helvetica = await newPdf.embedFont(StandardFonts.Helvetica);
  
  for (let pageIndex = 0; pageIndex < originalPdf.getPageCount(); pageIndex++) {
    // Copy original page (preserves visual appearance)
    const [copiedPage] = await newPdf.copyPages(originalPdf, [pageIndex]);
    newPdf.addPage(copiedPage);
    
    const { width: pdfWidth, height: pdfHeight } = copiedPage.getSize();
    
    // Calculate scaling factors from OCR image space to PDF page space
    const scaleX = pdfWidth / imageDimensions.width;
    const scaleY = pdfHeight / imageDimensions.height;
    
    // Add invisible text overlay using OCR line data
    const pageOcr = ocrResults[pageIndex];
    if (pageOcr?.lines) {
      pageOcr.lines.forEach(line => {
        if (line.text.trim() && line.bbox) {
          const scaledX = line.bbox.x0 * scaleX;
          const scaledY = pdfHeight - (line.bbox.y1 * scaleY); // Flip Y-axis (PDF is bottom-up)
          const scaledFontSize = Math.max(8, (line.bbox.y1 - line.bbox.y0) * scaleY);
          
          copiedPage.drawText(line.text.trim(), {
            x: scaledX,
            y: scaledY,
            size: scaledFontSize,
            font: helvetica,
            color: rgb(0, 0, 0),
            opacity: 0  // Invisible but selectable and searchable
          });
        }
      });
    }
  }
  
  return await newPdf.save();
}
```

### 3. File System Integration

```javascript
// In your document processing workflow
async function processScannedPDF(file) {
  if (isScannedPDF(file)) {
    const arrayBuffer = await file.data.arrayBuffer();
    
    // Perform OCR
    const ocrResults = await performOCR(arrayBuffer);
    
    // Create searchable PDF
    const imageDimensions = { width: 2550, height: 3300 }; // From poppler conversion
    const searchablePdfBuffer = await createSearchablePDF(arrayBuffer, ocrResults, imageDimensions);
    
    // Replace original file with searchable version
    const searchableBlob = new Blob([searchablePdfBuffer], { type: 'application/pdf' });
    const searchableFile = new File([searchableBlob], file.name, { type: 'application/pdf' });
    
    // Update file data - UI will re-render automatically
    file.data = searchableFile;
    
    return {
      success: true,
      text: ocrResults.map(r => r.text).join('\n'),
      confidence: ocrResults.reduce((sum, r) => sum + r.confidence, 0) / ocrResults.length
    };
  }
}
```

## Common Bugs & Solutions

### Bug 1: "0 lines, 0 paragraphs, 0 words"
**Symptoms**: OCR extracts text successfully but hierarchical data is empty
**Cause**: Using old Tesseract.js API or wrong output options
**Fix**: Use worker API with `{blocks: true}` and extract from blocks structure

### Bug 2: Text extracted but no hierarchical structure
**Symptoms**: `data.text` populated but `data.lines` is undefined/empty
**Cause**: Looking at `data.lines` instead of `data.blocks[].paragraphs[].lines`
**Fix**: Extract hierarchical data from nested blocks structure

### Bug 3: Text overlay positioning wrong
**Symptoms**: Text appears in wrong locations or outside page boundaries
**Cause**: Not scaling coordinates or using wrong coordinate system
**Fix**: Scale from image to PDF space and flip Y-axis for PDF coordinate system

### Bug 4: Division by zero in confidence calculation
**Symptoms**: `NaN% confidence` in logs, crashes on `toFixed()`
**Cause**: No successful OCR results when calculating average confidence
**Fix**: Check array length before division and provide fallback values

### Bug 5: Missing searchablePdf in OCR response
**Symptoms**: OCR completes but searchable PDF not created
**Cause**: IPC handler not passing through searchablePdf field in Electron apps
**Fix**: Include all fields in return object from IPC handlers

### Bug 6: Memory leaks with multiple workers
**Symptoms**: Browser/Node.js memory usage grows with each OCR operation
**Cause**: Not terminating Tesseract workers properly
**Fix**: Always terminate workers in try/finally blocks

## Dependencies Required

```json
{
  "tesseract.js": "^6.0.1",
  "pdf-lib": "^1.17.1", 
  "node-poppler": "^8.0.4"
}
```

## Complete Working Example

```javascript
import Tesseract from 'tesseract.js';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import Poppler from 'node-poppler';

class SearchablePDFGenerator {
  async convertScannedPDFToSearchable(pdfBuffer) {
    try {
      // Step 1: Convert PDF to images
      const imagePaths = await this.convertPdfToImages(pdfBuffer);
      
      // Step 2: Perform OCR on each page
      const ocrResults = await this.performOCR(imagePaths);
      
      // Step 3: Create searchable PDF with invisible text overlay
      const searchablePdfBuffer = await this.createSearchablePDF(
        pdfBuffer, 
        ocrResults, 
        { width: 2550, height: 3300 }
      );
      
      return {
        success: true,
        searchablePdf: searchablePdfBuffer,
        text: ocrResults.map(r => r.text).join('\n'),
        confidence: this.calculateAverageConfidence(ocrResults)
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  async performOCR(imagePaths) {
    const results = [];
    
    for (const imagePath of imagePaths) {
      const worker = await Tesseract.createWorker('eng');
      
      try {
        const { data } = await worker.recognize(imagePath, {}, {
          text: true,
          blocks: true
        });
        
        // Extract hierarchical structure from blocks
        let lines = [];
        data.blocks.forEach(block => {
          block.paragraphs?.forEach(paragraph => {
            paragraph.lines?.forEach(line => {
              lines.push(line);
            });
          });
        });
        
        results.push({
          text: data.text,
          lines: lines,
          confidence: data.confidence
        });
        
      } finally {
        await worker.terminate();
      }
    }
    
    return results;
  }
  
  async createSearchablePDF(originalBuffer, ocrResults, imageDimensions) {
    const originalPdf = await PDFDocument.load(originalBuffer);
    const newPdf = await PDFDocument.create();
    const font = await newPdf.embedFont(StandardFonts.Helvetica);
    
    for (let i = 0; i < originalPdf.getPageCount(); i++) {
      const [page] = await newPdf.copyPages(originalPdf, [i]);
      newPdf.addPage(page);
      
      const { width, height } = page.getSize();
      const scaleX = width / imageDimensions.width;
      const scaleY = height / imageDimensions.height;
      
      const pageOcr = ocrResults[i];
      if (pageOcr?.lines) {
        pageOcr.lines.forEach(line => {
          if (line.text.trim() && line.bbox) {
            page.drawText(line.text.trim(), {
              x: line.bbox.x0 * scaleX,
              y: height - (line.bbox.y1 * scaleY),
              size: Math.max(8, (line.bbox.y1 - line.bbox.y0) * scaleY),
              font: font,
              color: rgb(0, 0, 0),
              opacity: 0
            });
          }
        });
      }
    }
    
    return await newPdf.save();
  }
  
  calculateAverageConfidence(results) {
    const validResults = results.filter(r => r.confidence);
    return validResults.length > 0 
      ? validResults.reduce((sum, r) => sum + r.confidence, 0) / validResults.length 
      : 0;
  }
}
```

## Debugging Steps

### 1. Verify Tesseract.js Setup
```javascript
// Test basic OCR functionality
const worker = await Tesseract.createWorker('eng');
const { data } = await worker.recognize(imagePath, {}, { text: true });
console.log('Basic text extraction:', data.text.length > 0 ? 'WORKS' : 'FAILS');
await worker.terminate();
```

### 2. Check Hierarchical Data Access
```javascript
// Debug data structure
const { data } = await worker.recognize(imagePath, {}, { text: true, blocks: true });
console.log('Top-level structure:', {
  hasLines: !!data.lines,
  hasBlocks: !!data.blocks,
  blocksCount: data.blocks?.length || 0
});

// Check blocks structure
if (data.blocks?.[0]) {
  console.log('First block structure:', Object.keys(data.blocks[0]));
  if (data.blocks[0].paragraphs?.[0]) {
    console.log('First paragraph structure:', Object.keys(data.blocks[0].paragraphs[0]));
  }
}
```

### 3. Validate Coordinate Mapping
```javascript
// Test coordinate scaling
const testLine = extractedLines[0];
console.log('Original bbox:', testLine.bbox);
console.log('Scaled coordinates:', {
  x: testLine.bbox.x0 * scaleX,
  y: pdfHeight - (testLine.bbox.y1 * scaleY),
  width: (testLine.bbox.x1 - testLine.bbox.x0) * scaleX,
  height: (testLine.bbox.y1 - testLine.bbox.y0) * scaleY
});
```

## Performance Considerations

### Memory Management
- Always terminate Tesseract workers
- Process pages sequentially for large documents
- Use garbage collection hints after large operations

### Processing Optimization
- Limit OCR to first 3 pages for performance testing
- Use appropriate image resolution (300 DPI recommended)
- Consider worker pooling for high-volume processing

### Error Recovery
- Implement timeout mechanisms for OCR operations
- Provide fallback for failed page processing
- Log detailed error information for debugging

## Is This Information Easily Accessible?

**NO** - This implementation required extensive debugging and research because:

### Documentation Gaps
1. **Tesseract.js v6 breaking changes** not clearly documented in migration guides
2. **Hierarchical data location** changes not explained in official docs
3. **Worker API requirement** for blocks output not obvious from examples
4. **Coordinate mapping complexity** not covered in tutorials
5. **Most online tutorials** use older versions with different APIs

### Missing Integration Examples
- No examples showing OCR → PDF text overlay workflows
- Limited documentation on `pdf-lib` coordinate systems
- No guidance on scaling between different coordinate spaces
- Sparse examples of invisible text implementation

### Production Considerations Not Covered
- Worker memory management and termination
- Error handling for failed OCR operations
- Performance optimization for large documents
- Integration with file upload/storage systems

This implementation guide fills significant documentation gaps for production OCR-to-searchable-PDF workflows that are increasingly important for document accessibility and compliance requirements.

### Research Sources Used
- GitHub Issues: `naptha/tesseract.js` repository
- API Documentation: Tesseract.js official docs
- Community Forums: Stack Overflow, Reddit
- Trial and error debugging with real scanned documents
- PDF specification documentation for coordinate systems

The lack of comprehensive, up-to-date examples for this workflow represents a significant knowledge gap in the OCR and PDF processing ecosystem.

## Project-Specific Implementation Notes

This implementation was developed for a legal case management application where:
- Scanned court documents needed to be searchable in bundles
- Text selection across sentences/paragraphs was critical for user experience
- Professional appearance had to be maintained (invisible text overlay)
- Integration with Electron desktop app was required for offline functionality

The solution successfully converts scanned PDFs to searchable documents while preserving their original visual appearance and enabling natural text interaction.