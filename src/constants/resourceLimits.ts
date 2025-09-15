// Resource limits configuration for OCR and PDF processing
export const RESOURCE_LIMITS = {
  // OCR Processing Limits
  OCR: {
    MAX_PAGES_PER_DOCUMENT: 5, // Maximum pages to process for OCR
    MAX_CONCURRENT_OPERATIONS: 2, // Maximum concurrent OCR operations
    TIMEOUT_PER_PAGE_MS: 30000, // 30 seconds per page
    TOTAL_TIMEOUT_MS: 180000, // 3 minutes total per document
    MAX_FILE_SIZE_MB: 50, // Maximum file size for OCR processing
    MAX_IMAGE_DIMENSIONS: {
      width: 4096,
      height: 4096
    },
    MIN_IMAGE_DIMENSIONS: {
      width: 100,
      height: 100
    }
  },

  // PDF Processing Limits
  PDF: {
    MAX_PAGES_FOR_TEXT_EXTRACTION: 20, // Maximum pages for text extraction
    MAX_FILE_SIZE_MB: 100, // Maximum PDF file size
    TIMEOUT_MS: 60000, // 1 minute timeout for PDF processing
    MAX_MEMORY_MB: 512 // Maximum memory usage for PDF processing
  },

  // Bundle Generation Limits
  BUNDLE: {
    MAX_FILES_PER_BUNDLE: 50, // Maximum files in a bundle
    MAX_TOTAL_SIZE_MB: 500, // Maximum total bundle size
    TIMEOUT_MS: 300000, // 5 minutes timeout for bundle creation
    MAX_CONCURRENT_BUNDLES: 1 // Only one bundle generation at a time
  },

  // System Resource Limits
  SYSTEM: {
    MAX_MEMORY_USAGE_MB: 1024, // Maximum memory usage for the app
    MAX_TEMP_FILES: 100, // Maximum temporary files
    CLEANUP_INTERVAL_MS: 300000, // 5 minutes cleanup interval
    MAX_TEMP_DIR_SIZE_MB: 1000 // Maximum size of temp directory
  },

  // Performance Monitoring
  MONITORING: {
    MEMORY_CHECK_INTERVAL_MS: 30000, // Check memory every 30 seconds
    LOG_PERFORMANCE_METRICS: true,
    ALERT_THRESHOLDS: {
      MEMORY_USAGE_PERCENT: 80, // Alert when memory usage exceeds 80%
      PROCESSING_TIME_MS: 60000 // Alert when operation takes more than 1 minute
    }
  }
} as const;

export type ResourceLimitError = {
  code: string;
  message: string;
  currentValue?: number;
  limitValue?: number;
  resource?: string;
};

export const RESOURCE_LIMIT_ERROR_CODES = {
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  TOO_MANY_PAGES: 'TOO_MANY_PAGES',
  OPERATION_TIMEOUT: 'OPERATION_TIMEOUT',
  MEMORY_LIMIT_EXCEEDED: 'MEMORY_LIMIT_EXCEEDED',
  CONCURRENT_LIMIT_EXCEEDED: 'CONCURRENT_LIMIT_EXCEEDED',
  TEMP_SPACE_EXCEEDED: 'TEMP_SPACE_EXCEEDED',
  IMAGE_TOO_LARGE: 'IMAGE_TOO_LARGE',
  IMAGE_TOO_SMALL: 'IMAGE_TOO_SMALL',
  SYSTEM_OVERLOADED: 'SYSTEM_OVERLOADED'
} as const;