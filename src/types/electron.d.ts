declare global {
  interface Window {
    electron?: {
      parsePDF: (arrayBuffer: ArrayBuffer) => Promise<{
        success: boolean;
        text?: string;
        pages?: number;
        info?: any;
        error?: string;
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