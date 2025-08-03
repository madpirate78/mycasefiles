declare global {
  interface Window {
    electronAPI?: {
      parsePDF: (arrayBuffer: ArrayBuffer) => Promise<{
        success: boolean;
        text?: string;
        pages?: number;
        info?: any;
        error?: string;
        extractionMethod?: 'PDF_PARSE' | 'OCR';
        isScanned?: boolean;
      }>;
      ocrPDF: (arrayBuffer: ArrayBuffer) => Promise<{
        success: boolean;
        text?: string;
        confidence?: number;
        pages?: Array<{
          page: number;
          text?: string;
          confidence?: number;
          length?: number;
          error?: string;
        }>;
        extractionMethod?: 'OCR';
        error?: string;
      }>;
      createPDFBundle: (bundleData: any) => Promise<{
        success: boolean;
        filename?: string;
        size?: number;
        pdfBytes?: number[];
        filePath?: string;
        error?: string;
      }>;
      onBundleProgress: (callback: (event: any, progress: {
        stage: 'initializing' | 'processing' | 'finalizing' | 'complete' | 'error';
        progress: number;
        message: string;
      }) => void) => void;
      removeBundleProgressListener: (callback: (event: any, progress: any) => void) => void;
    };
    electron?: {
      parsePDF: (arrayBuffer: ArrayBuffer) => Promise<{
        success: boolean;
        text?: string;
        pages?: number;
        info?: any;
        error?: string;
        extractionMethod?: 'PDF_PARSE' | 'OCR';
        isScanned?: boolean;
        ocrConfidence?: number;
        ocrPages?: Array<{
          page: number;
          text?: string;
          confidence?: number;
          length?: number;
          error?: string;
        }>;
        originalTextLength?: number;
      }>;
    };
  }
}

export {};