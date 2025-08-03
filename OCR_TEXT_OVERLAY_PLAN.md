# Plan: Making OCR'd PDFs Text-Searchable in Document Vault

## Problem Analysis
Currently, PDFs that are OCR'd in the document vault return OCR text that is stored separately in the database. The original scanned PDF remains unsearchable. We need to create searchable PDFs during the OCR process itself, using Tesseract.js's built-in text structure detection.

## Technical Requirements
1. **Leverage Tesseract.js built-in structure**: Use existing `data.lines`, `data.paragraphs`, and `data.words` with bounding boxes
2. **Create searchable PDF during OCR**: Generate new PDF with invisible text layers in document vault
3. **Replace original PDF**: Store the searchable version instead of separate OCR text
4. **Maintain PDF quality**: Keep original image intact with invisible text layer overlay
5. **Natural text selection**: Enable sentence and paragraph selection using Tesseract's text groupings

## Implementation Strategy

### Phase 1: Modify Document Vault OCR Process
- **Update Electron OCR function** to use Tesseract.js structure detection
- **Capture lines, paragraphs, and words** with bounding boxes from `data.lines`, `data.paragraphs`, `data.words`
- **Remove separate OCR text storage** from database schema
- **Use pdf-lib to create searchable PDF** during OCR process

### Phase 2: PDF Text Layer Creation in Vault
- **Use pdf-lib drawText()** with opacity: 0 to create invisible text layers
- **Use Tesseract's line groupings** for natural sentence selection (`data.lines`)
- **Use Tesseract's paragraph groupings** for natural paragraph selection (`data.paragraphs`)
- **Scale coordinates** from OCR image resolution to PDF page dimensions
- **Test font sizing** to match OCR detection areas exactly

### Phase 3: File Replacement Workflow
- **Generate searchable PDF** with invisible text overlay
- **Replace original file** in IndexedDB with searchable version
- **Update UI indicators** to show PDF is now searchable
- **Maintain all existing metadata** and file properties

### Phase 4: Testing & Validation
- **Test text selection** across sentences and paragraphs
- **Verify search functionality** in PDF viewers
- **Validate bundle generation** works with searchable PDFs
- **Performance testing** with various document types

## Technical Challenges & Solutions

### Challenge 1: Coordinate Mapping
**Problem**: OCR coordinates are from PNG images, need mapping to PDF coordinates
**Solution**: Calculate scaling factors based on image dimensions vs PDF page size

### Challenge 2: Font Selection
**Problem**: Need font that matches OCR recognition for accurate positioning
**Solution**: Use standard font (Helvetica) with calculated sizes based on bounding box heights

### Challenge 3: Text Alignment
**Problem**: Perfect alignment is critical for text selection to work properly
**Solution**: Use word-level positioning rather than line-level, with fine-tuning

### Challenge 4: Performance Impact
**Problem**: Processing many OCR'd pages could slow bundle generation
**Solution**: Process only pages with stored OCR data, skip text-based PDFs

## Implementation Steps

1. **✅ Update Tesseract OCR** to return word-level bounding boxes
2. **✅ Modify database storage** for coordinate data (simplified - no separate storage needed)
3. **✅ Create text overlay function** in Electron OCR process (not bundle generation)
4. **✅ Integrate with existing document vault pipeline**
5. **✅ Add progress tracking** for OCR overlay process
6. **✅ Test and refine** positioning accuracy

## ✅ IMPLEMENTATION COMPLETED

### What Was Implemented:
- **Document Vault OCR Enhancement**: OCR now creates searchable PDFs during document processing
- **Invisible Text Overlay**: Uses Tesseract.js line groupings for natural text selection
- **PDF Replacement**: Original scanned PDFs are replaced with searchable versions
- **Error Handling**: Robust error handling for OCR failures and edge cases
- **Progress Tracking**: Visual indicators show OCR processing status

### Key Technical Fixes Applied:
1. **Missing searchablePdf field**: Fixed OCR handler to return searchable PDF buffer
2. **Division by zero error**: Fixed confidence calculation when no valid OCR results
3. **Undefined property access**: Added defensive checks for Tesseract.js data structure
4. **Coordinate mapping**: Implemented proper scaling from OCR image space to PDF coordinates
5. **CRITICAL: Page Segmentation Mode**: Changed from `PSM.SINGLE_BLOCK` to `PSM.AUTO` to enable text structure detection

### Critical Tesseract.js Configuration Discoveries:

#### Discovery 1: Page Segmentation Mode
**Problem**: `PSM.SINGLE_BLOCK` mode treats entire page as one block, returning 0 lines/paragraphs/words despite successful text extraction
**Solution**: `PSM.AUTO` mode properly segments text into hierarchical structure needed for invisible text overlay

#### Discovery 2: Output Formats API Change (CRITICAL ROOT CAUSE)
**Problem**: In Tesseract.js v4+, the old parameter-based approach to enable hierarchical data was replaced with output options as 3rd parameter
**Solution**: Use modern v4+ output options API:
```javascript
const result = await Tesseract.recognize(imagePath, 'eng', {
  text: true,
  blocks: true,  // Enable hierarchical data structure (lines, paragraphs, words)
  hocr: false,   // Optional: XML output
  tsv: false,    // Optional: TSV output  
  box: false,    // Optional: box output
});
```
**Impact**: This was the actual root cause of "0 paragraphs ever" - using old parameter API instead of new output options API

### Expected Outcome (ACHIEVED):
- ✅ OCR'd PDFs in document vault are now text-searchable and selectable
- ✅ Users can copy/paste text from scanned documents
- ✅ PDF search will find text in previously unsearchable documents
- ✅ Maintains professional document appearance with invisible text layers
- ✅ Bundle generation uses searchable PDFs automatically

This implementation successfully leverages Tesseract.js's built-in text structure detection to create searchable PDFs during the OCR process in the document vault, eliminating the need for complex bundle-time text overlay processing.

## Key Insight: Proper Use of Tesseract.js

**Important Discovery**: Tesseract.js already provides the exact text structure we need through its built-in hierarchical detection. Instead of manually grouping words, we should use:

- **`data.lines`** - Pre-grouped lines with bounding boxes (perfect for sentence selection)
- **`data.paragraphs`** - Pre-grouped paragraphs with bounding boxes (perfect for paragraph selection)  
- **`data.words`** - Individual words for fine-grained positioning if needed
- **`data.blocks`** - Larger text regions for document structure

Each element includes a `bbox` property with `{x0, y0, x1, y1}` coordinates, making text positioning straightforward.

**Why This Matters**: This eliminates complex word-grouping algorithms and leverages Tesseract's sophisticated layout analysis engine that already understands document structure, reading order, and text relationships.

## Technical Implementation Details

### Tesseract.js Structure Detection
```javascript
const { data } = await Tesseract.recognize(imagePath, 'eng', {
  tessedit_pageseg_mode: Tesseract.PSM.SINGLE_BLOCK,
  tessedit_ocr_engine_mode: Tesseract.OEM.LSTM_ONLY,
});

// Access hierarchical text structure:
// data.lines - Array of line objects with text and bbox
// data.paragraphs - Array of paragraph objects with text and bbox  
// data.words - Array of word objects with text and bbox
// data.blocks - Array of block objects with text and bbox

// Example line object:
// { text: "This is a complete line of text", bbox: { x0, y0, x1, y1 }, confidence }
```

### Database Schema Simplification
```typescript
interface StoredFile {
  // ... existing fields
  ocrPerformed?: boolean; // Whether OCR has been run (creates searchable PDF)
  ocrConfidence?: number; // Overall OCR confidence score
  ocrDate?: string; // When OCR was performed
  // Remove: ocrText, ocrWords - text is now embedded in PDF
}
```

### PDF Text Overlay Implementation (Document Vault OCR)
```javascript
// In Electron OCR process - create searchable PDF:
async function createSearchablePDF(originalPdfBuffer, ocrData, imageDimensions) {
  const originalPdf = await PDFDocument.load(originalPdfBuffer);
  const newPdf = await PDFDocument.create();
  const helvetica = await newPdf.embedFont(StandardFonts.Helvetica);
  
  for (let pageIndex = 0; pageIndex < originalPdf.getPageCount(); pageIndex++) {
    // Copy original page
    const [copiedPage] = await newPdf.copyPages(originalPdf, [pageIndex]);
    newPdf.addPage(copiedPage);
    
    const { width: pdfWidth, height: pdfHeight } = copiedPage.getSize();
    
    // Calculate scaling factors
    const scaleX = pdfWidth / imageDimensions.width;
    const scaleY = pdfHeight / imageDimensions.height;
    
    // Add invisible text using Tesseract's line groupings for natural selection
    ocrData.lines.forEach(line => {
      const scaledX = line.bbox.x0 * scaleX;
      const scaledY = pdfHeight - (line.bbox.y1 * scaleY); // PDF coords are bottom-up
      const scaledFontSize = (line.bbox.y1 - line.bbox.y0) * scaleY;
      
      copiedPage.drawText(line.text, {
        x: scaledX,
        y: scaledY,
        size: scaledFontSize,
        font: helvetica,
        color: rgb(0, 0, 0),
        opacity: 0, // Invisible but selectable
        lineHeight: scaledFontSize * 1.2,
      });
    });
  }
  
  return await newPdf.save();
}
```

### Performance Considerations
- OCR processing happens once in document vault, creates permanent searchable PDF
- No additional processing needed during bundle generation
- Searchable PDFs work in any PDF viewer, not just bundles
- Font calculations are done once during OCR, not repeatedly
- Progress tracking for OCR process with text overlay creation