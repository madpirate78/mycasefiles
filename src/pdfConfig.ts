/**
 * Comprehensive PDF.js Configuration for Offline-First PDF Processing
 * 
 * This configuration provides:
 * - Complete offline functionality
 * - Support for international fonts and character mappings
 * - Standard font rendering
 * - Optimized performance settings
 * - Development debugging tools
 */

import { pdfjs } from 'react-pdf';

export interface PDFConfig {
  workerSrc: string;
  cMapUrl: string;
  cMapPacked: boolean;
  standardFontDataUrl: string;
  verbosity?: number;
  maxImageSize: number;
  isEvalSupported: boolean;
  isOffscreenCanvasSupported: boolean;
}

// Default configuration for robust PDF handling
export const defaultPDFConfig: PDFConfig = {
  // Local worker for offline functionality
  workerSrc: '/pdfjs-dist/build/pdf.worker.min.mjs',
  
  // Character mapping for international text support
  cMapUrl: '/pdfjs-dist/cmaps/',
  cMapPacked: true,
  
  // Standard fonts for consistent text rendering
  standardFontDataUrl: '/pdfjs-dist/standard_fonts/',
  
  // Performance optimization
  maxImageSize: 1024 * 1024 * 50, // 50MB max image size
  isEvalSupported: false, // Disable eval for security
  isOffscreenCanvasSupported: true, // Enable offscreen canvas when available
};

/**
 * Configure PDF.js with the provided settings
 */
export function configurePDFJS(config: Partial<PDFConfig> = {}): void {
  const finalConfig = { ...defaultPDFConfig, ...config };
  
  // Apply worker configuration - only workerSrc is directly settable
  pdfjs.GlobalWorkerOptions.workerSrc = finalConfig.workerSrc;
  
  // CMap and font settings are applied via document loading options
  // Store these for use in getPDFLoadingOptions
  (window as any).__pdfConfig = finalConfig;
  
  // Development settings - verbosity is set via loading options
  // (verbosity is not available on GlobalWorkerOptions in this version)
  
  console.log('PDF.js configured:', {
    version: pdfjs.version,
    worker: finalConfig.workerSrc,
    cmaps: finalConfig.cMapUrl,
    fonts: finalConfig.standardFontDataUrl,
    offline: true
  });
}

/**
 * Get PDF document loading options optimized for performance
 */
export function getPDFLoadingOptions(options: any = {}) {
  const config = (window as any).__pdfConfig || defaultPDFConfig;
  
  return {
    // CMap configuration for international text
    cMapUrl: config.cMapUrl,
    cMapPacked: config.cMapPacked,
    
    // Standard fonts configuration
    standardFontDataUrl: config.standardFontDataUrl,
    
    // High quality rendering settings
    useSystemFonts: true, // Use system fonts for better text rendering
    disableFontFace: false, // Allow custom fonts
    enableXfa: false, // Disable XFA for better performance
    stopAtErrors: false, // Continue loading despite minor errors
    maxImageSize: config.maxImageSize,
    isEvalSupported: config.isEvalSupported,
    fontExtraProperties: true, // Enable font metadata
    
    // Rendering quality improvements
    renderInteractiveForms: false, // Disable for better performance
    useOnlyCssZoom: false, // Allow canvas scaling
    
    // Development settings
    verbosity: process.env.NODE_ENV === 'development' && config.verbosity ? config.verbosity : undefined,
    
    // Override with user options
    ...options
  };
}

/**
 * PDF rendering options for optimal display
 */
export const pdfRenderingOptions = {
  // Canvas options
  canvasMaxAreaInBytes: -1, // No canvas size limit
  continuePageLoading: true, // Continue loading other pages
  enableWebGL: true, // Use WebGL acceleration when available
  
  // High quality rendering
  useSystemFonts: true, // Use system fonts for better text rendering
  renderInteractiveForms: false, // Disable for better performance
  
  // Text layer options
  textLayerMode: 2, // Enable enhanced text layer
  enablePermissions: false, // Ignore PDF permissions for local files
  
  // Annotation options
  renderAnnotations: true,
  renderForms: true,
  renderMarkedContent: true
};

export default pdfjs;