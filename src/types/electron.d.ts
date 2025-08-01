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
      generateDescription: (text: string, filename?: string) => Promise<{
        success: boolean;
        description?: string;
        fallback?: boolean;
        error?: string;
      }>;
      summarizeDocument: (text: string) => Promise<{
        success: boolean;
        summary?: string;
        error?: string;
      }>;
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
      generateDescription: (text: string, filename?: string) => Promise<{
        success: boolean;
        description?: string;
        fallback?: boolean;
        error?: string;
      }>;
      summarize: (text: string) => Promise<{
        success: boolean;
        summary?: string;
        error?: string;
      }>;
    };
  }
}

export {};