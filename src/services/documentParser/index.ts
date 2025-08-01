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
export function getSuggestedSection(filename: string): string {
  const mapper = new SectionMapper();
  return mapper.getSuggestedSection(filename);
}

/**
 * Get suggested metadata for form pre-population
 */
export function getSuggestedMetadata(filename: string): SuggestedMetadata {
  const mapper = new SectionMapper();
  return mapper.getSuggestedMetadata(filename);
}

/**
 * Extract key information from PDF content (court reference, document type, judge name)
 */
export async function extractFromPDF(pdfBuffer: ArrayBuffer): Promise<{ caseNumber: string | null; documentType: 'order' | 'application' | null; judgeName: string | null }> {
  const parser = new PDFContentParser();
  return parser.extractFromPDF(pdfBuffer);
}