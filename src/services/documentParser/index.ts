// Convenience functions
import { FilenameParser } from './filenameParser';
import { SectionMapper } from './sectionMapper';
import { PDFContentParser } from './pdfContentParser';
import { FilenameData, SuggestedMetadata } from './types';

// Main exports for document parser
export { FilenameParser } from './filenameParser';
export { SectionMapper } from './sectionMapper';
export { PDFContentParser } from './pdfContentParser';
export type { CourtDocumentData, FilenameData, SuggestedMetadata } from './types';

/**
 * Parse filename and extract basic document information
 */
export function parseDocumentFilename(filename: string): FilenameData {
  const parser = new FilenameParser();
  return parser.parse(filename);
}

/**
 * Get suggested section for document organization
 */
export function getSuggestedSection(filename: string, caseType?: 'child' | 'finance'): string {
  const mapper = new SectionMapper();
  return mapper.getSuggestedSection(filename, caseType);
}

/**
 * Get suggested metadata for form pre-population
 */
export function getSuggestedMetadata(filename: string, caseType?: 'child' | 'finance'): SuggestedMetadata {
  const mapper = new SectionMapper();
  return mapper.getSuggestedMetadata(filename, caseType);
}

/**
 * Detect vault type based on document content and filename
 */
export function detectVaultType(filename: string, pdfText?: string): 'child' | 'finance' | null {
  const mapper = new SectionMapper();
  return mapper.detectVaultType(filename, pdfText);
}

/**
 * Extract key information from PDF content (court reference, document type, judge name, person name for statements)
 */
export async function extractFromPDF(pdfBuffer: ArrayBuffer): Promise<{ caseNumber: string | null; documentType: 'order' | 'application' | 'statement' | null; judgeName: string | null; personName?: string | null }> {
  const parser = new PDFContentParser();
  return parser.extractFromPDF(pdfBuffer);
}