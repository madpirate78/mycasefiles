// File validation constants and configuration
export const FILE_VALIDATION_CONFIG = {
  // File size limits (in bytes)
  MAX_FILE_SIZE: 50 * 1024 * 1024, // 50MB
  MAX_TOTAL_UPLOAD_SIZE: 200 * 1024 * 1024, // 200MB total per upload session
  
  // File count limits
  MAX_FILES_PER_UPLOAD: 10,
  MAX_TOTAL_FILES: 1000, // Maximum files in vault
  
  // Allowed file types
  ALLOWED_MIME_TYPES: [
    'application/pdf',
  ] as readonly string[],
  
  ALLOWED_EXTENSIONS: [
    '.pdf',
  ],
  
  // PDF validation
  PDF_MAGIC_BYTES: [0x25, 0x50, 0x44, 0x46, 0x2D], // %PDF-
  MIN_PDF_SIZE: 1024, // 1KB minimum PDF size
  
  // Security patterns to reject
  SUSPICIOUS_FILENAME_PATTERNS: [
    /\.(exe|bat|cmd|scr|vbs|js|jar|com|pif)$/i,
    /[<>:"|?*]/,
    /^\./,
    /\.\./,
  ],
  
  // Performance limits
  VALIDATION_TIMEOUT: 5000, // 5 seconds timeout for validation
} as const;

export type FileValidationError = {
  code: string;
  message: string;
  fileName?: string;
};

export const VALIDATION_ERROR_CODES = {
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  INVALID_FILE_TYPE: 'INVALID_FILE_TYPE',
  INVALID_EXTENSION: 'INVALID_EXTENSION',
  TOO_MANY_FILES: 'TOO_MANY_FILES',
  TOTAL_SIZE_EXCEEDED: 'TOTAL_SIZE_EXCEEDED',
  INVALID_PDF_STRUCTURE: 'INVALID_PDF_STRUCTURE',
  SUSPICIOUS_FILENAME: 'SUSPICIOUS_FILENAME',
  FILE_TOO_SMALL: 'FILE_TOO_SMALL',
  VALIDATION_TIMEOUT: 'VALIDATION_TIMEOUT',
  VAULT_CAPACITY_EXCEEDED: 'VAULT_CAPACITY_EXCEEDED',
} as const;