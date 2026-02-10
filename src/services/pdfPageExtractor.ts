// PDF Page Extraction Service for Page Pruning Feature
// Handles page counting, thumbnail generation, and blank page detection
import { isElectron, parsePDF } from './electronAPI';

export interface PageInfo {
  number: number;
  thumbnail: string; // Base64 data URL
  isBlank: boolean;
  textContent: string;
  selected: boolean;
}

export interface PDFPageData {
  totalPages: number;
  pages: PageInfo[];
  selectedPages: number[];
}

/**
 * Extract page information from a PDF file using Electron's PDF parsing capabilities
 */
export const extractPDFPages = async (file: File): Promise<PDFPageData> => {
  if (!isElectron()) {
    throw new Error('PDF page extraction requires Electron environment');
  }

  try {
    console.log('🔄 Extracting PDF pages for:', file.name);

    // Convert File to ArrayBuffer for processing
    const arrayBuffer = await file.arrayBuffer();

    // Get page count and basic info via Electron
    const pdfResult = await parsePDF(arrayBuffer);
    
    if (!pdfResult.success) {
      throw new Error(`PDF parsing failed: ${pdfResult.error}`);
    }

    const totalPages = pdfResult.pages || 1;
    console.log(`📄 Found ${totalPages} pages in ${file.name}`);

    // Generate thumbnails and analyze content for each page
    const pages: PageInfo[] = [];
    
    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      console.log(`📸 Processing page ${pageNum}/${totalPages}`);
      
      try {
        // Generate thumbnail for this page
        const thumbnail = await generatePageThumbnail(file, pageNum);
        
        pages.push({
          number: pageNum,
          thumbnail,
          isBlank: false, // No automatic blank detection
          textContent: '', // No text analysis needed
          selected: true // Default to selected
        });
        
      } catch (pageError) {
        console.warn(`Warning: Could not process page ${pageNum}:`, pageError);
        
        // Create placeholder page info if processing fails
        pages.push({
          number: pageNum,
          thumbnail: createPlaceholderThumbnail(pageNum),
          isBlank: false,
          textContent: '',
          selected: true
        });
      }
    }

    // Create default selection (all pages selected)
    const selectedPages = pages.map(p => p.number);

    console.log(`✅ Successfully extracted ${pages.length} pages`);
    
    return {
      totalPages,
      pages,
      selectedPages
    };

  } catch (error) {
    console.error('❌ PDF page extraction failed:', error);
    throw error;
  }
};

/**
 * Generate a thumbnail image for a specific PDF page
 * Currently uses placeholders - real thumbnails would require server-side PDF rendering
 */
const generatePageThumbnail = async (file: File, pageNumber: number): Promise<string> => {
  // For MVP, use enhanced placeholders that show document info
  // Real PDF thumbnails would require extending Electron main process with pdf-poppler or similar
  return createEnhancedPlaceholder(pageNumber, file.name);
};

/**
 * Extract text content from a specific page for blank detection
 * Using existing Electron PDF parsing - page-specific extraction not yet implemented
 */
// const extractPageText = async (arrayBuffer: ArrayBuffer, pageNumber: number): Promise<string> => {
//   // TODO: Extend Electron PDF parsing to support page-specific text extraction
//   // Current pdf-parse extracts all text at once
//   // For now, return empty string to avoid false blank detection
//   return '';
// };

/**
 * Detect if a page is likely blank based on text content
 * NOTE: This is for visual indication only - NO automatic deselection
 */
// const detectBlankPage = (textContent: string): boolean => {
//   // Very conservative detection - only flag obviously empty pages
//   const cleanedContent = textContent.trim();
//   
//   // Only consider truly empty pages as blank (less than 5 characters)
//   // This avoids false positives with scanned documents, images, or minimal text
//   return cleanedContent.length < 5;
// };

/**
 * Create an enhanced placeholder thumbnail with document info
 */
const createEnhancedPlaceholder = (pageNumber: number, fileName: string): string => {
  // Extract document type from filename for more context (using ASCII symbols)
  const docType = fileName.includes('order') ? 'ORDER' : 
                  fileName.includes('statement') ? 'STMT' : 
                  fileName.includes('application') ? 'APP' : 'DOC';
  
  // Clean filename to avoid encoding issues
  const cleanFileName = fileName.replace(/[^\x20-\x7E]/g, ""); // Keep only printable ASCII
  const displayName = cleanFileName.length > 18 ? cleanFileName.substring(0, 15) + '...' : cleanFileName;
  
  const svg = `<svg width="150" height="200" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="grad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" style="stop-color:#f8f9fa;stop-opacity:1" />
        <stop offset="100%" style="stop-color:#e9ecef;stop-opacity:1" />
      </linearGradient>
    </defs>
    <rect width="150" height="200" fill="url(#grad)" stroke="#dee2e6" stroke-width="1"/>
    <rect x="10" y="10" width="130" height="15" fill="#fff" stroke="#ccc" stroke-width="0.5"/>
    <rect x="10" y="30" width="130" height="140" fill="#fff" stroke="#ccc" stroke-width="0.5"/>
    
    <text x="75" y="85" text-anchor="middle" fill="#495057" font-size="12" font-weight="bold" font-family="Arial">${docType}</text>
    <text x="75" y="105" text-anchor="middle" fill="#6c757d" font-size="16" font-weight="bold" font-family="Arial">Page ${pageNumber}</text>
    <text x="75" y="125" text-anchor="middle" fill="#adb5bd" font-size="9" font-family="Arial">Click to toggle</text>
    <text x="75" y="140" text-anchor="middle" fill="#adb5bd" font-size="7" font-family="Arial">${displayName}</text>
  </svg>`;
  
  // Use URL encoding to avoid btoa Unicode issues
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
};

/**
 * Create a basic placeholder thumbnail for fallback cases
 */
const createPlaceholderThumbnail = (pageNumber: number): string => {
  return createEnhancedPlaceholder(pageNumber, 'document.pdf');
};

/**
 * Update page selections for a document
 */
export const updatePageSelections = (
  pages: PageInfo[], 
  selectedPageNumbers: number[]
): PageInfo[] => {
  return pages.map(page => ({
    ...page,
    selected: selectedPageNumbers.includes(page.number)
  }));
};

/**
 * Get only the selected pages from a page collection
 */
export const getSelectedPages = (pages: PageInfo[]): PageInfo[] => {
  return pages.filter(page => page.selected);
};

/**
 * REMOVED: Auto-deselection functions are too risky for legal documents
 * Users must manually review and deselect pages to avoid losing important content
 */

// These functions are kept for reference but should not be used:
// - autoDeselectBlankPages: Automatically deselects pages marked as blank
// - smartPageSelection: Attempts to intelligently select relevant pages
// 
// Legal documents require manual review due to:
// - Scanned documents may have poor OCR
// - Images/diagrams with minimal text are still important
// - Court submissions must be complete and accurate