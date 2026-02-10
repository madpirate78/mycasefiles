/**
 * Abstraction layer over the Electron IPC bridge (window.electronAPI / window.electron).
 *
 * Every component and service should import from here instead of touching
 * `window.electronAPI` or `window.electron` directly. This gives us:
 *  - A single place to handle availability checks
 *  - Consistent return types
 *  - Easy mocking for tests
 *  - Browser-mode fallbacks
 */

// ─── Result types ────────────────────────────────────────────────

export interface PDFParseResult {
  success: boolean;
  text?: string;
  pages?: number;
  info?: any;
  error?: string;
  extractionMethod?: 'PDF_PARSE' | 'OCR';
  isScanned?: boolean;
}

export interface OCRResult {
  success: boolean;
  text?: string;
  confidence?: number;
  pages?: Array<{
    page: number;
    text?: string;
    confidence?: number;
    length?: number;
    error?: string;
    lines?: Array<{ text: string; bbox: { x0: number; y0: number; x1: number; y1: number } }>;
    paragraphs?: Array<{ text: string; bbox: { x0: number; y0: number; x1: number; y1: number } }>;
    words?: Array<{ text: string; bbox: { x0: number; y0: number; x1: number; y1: number } }>;
  }>;
  extractionMethod?: 'OCR';
  searchablePdf?: ArrayBuffer;
  error?: string;
}

export interface PageCountResult {
  success: boolean;
  pageCount?: number;
  error?: string;
}

export interface BundleResult {
  success: boolean;
  filename?: string;
  size?: number;
  pdfBytes?: number[];
  filePath?: string;
  error?: string;
}

export interface BundleProgress {
  stage: 'initializing' | 'processing' | 'finalizing' | 'complete' | 'error';
  progress: number;
  message: string;
}

type BundleProgressCallback = (event: any, progress: BundleProgress) => void;

// ─── Availability ────────────────────────────────────────────────

/** True when running inside Electron with the IPC bridge available. */
export function isElectron(): boolean {
  return !!(window as any).electronAPI || !!(window as any).electron;
}

/** Returns the primary API object, falling back to the legacy `window.electron` bridge. */
function getAPI() {
  return (window as any).electronAPI ?? (window as any).electron ?? null;
}

// ─── PDF operations ──────────────────────────────────────────────

export async function parsePDF(arrayBuffer: ArrayBuffer): Promise<PDFParseResult> {
  const api = getAPI();
  if (!api?.parsePDF) {
    return { success: false, error: 'PDF parsing not available (browser mode)' };
  }
  return api.parsePDF(arrayBuffer);
}

export async function ocrPDF(arrayBuffer: ArrayBuffer): Promise<OCRResult> {
  const api = getAPI();
  if (!api?.ocrPDF) {
    return { success: false, error: 'OCR not available (browser mode)' };
  }
  return api.ocrPDF(arrayBuffer);
}

export async function extractPageCount(arrayBuffer: ArrayBuffer): Promise<PageCountResult> {
  const api = getAPI();
  if (!api?.extractPageCount) {
    return { success: false, error: 'Page count extraction not available (browser mode)' };
  }
  return api.extractPageCount(arrayBuffer);
}

// ─── Bundle operations ───────────────────────────────────────────

export async function createPDFBundle(bundleData: any): Promise<BundleResult> {
  const api = getAPI();
  if (!api?.createPDFBundle) {
    return { success: false, error: 'Bundle creation not available (browser mode)' };
  }
  return api.createPDFBundle(bundleData);
}

export function onBundleProgress(callback: BundleProgressCallback): void {
  const api = getAPI();
  if (api?.onBundleProgress) {
    api.onBundleProgress(callback);
  }
}

export function removeBundleProgressListener(callback: BundleProgressCallback): void {
  const api = getAPI();
  if (api?.removeBundleProgressListener) {
    api.removeBundleProgressListener(callback);
  }
}
