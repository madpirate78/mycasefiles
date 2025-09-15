import { 
  FILE_VALIDATION_CONFIG, 
  FileValidationError, 
  VALIDATION_ERROR_CODES 
} from '../constants/fileValidation';

/**
 * Comprehensive file validation service for PDF uploads
 * Provides security, performance, and data integrity checks
 */
export class FileValidationService {
  
  /**
   * Validate a single file with comprehensive security checks
   */
  static async validateFile(file: File): Promise<FileValidationError[]> {
    const errors: FileValidationError[] = [];
    
    try {
      // Basic file checks
      this.validateFileSize(file, errors);
      this.validateFileName(file, errors);
      this.validateFileType(file, errors);
      this.validateFileExtension(file, errors);
      
      // PDF structure validation (async)
      await this.validatePDFStructure(file, errors);
      
    } catch (error) {
      errors.push({
        code: VALIDATION_ERROR_CODES.VALIDATION_TIMEOUT,
        message: 'File validation timed out',
        fileName: file.name
      });
    }
    
    return errors;
  }
  
  /**
   * Validate multiple files and check batch constraints
   */
  static async validateFileList(
    files: FileList, 
    currentVaultFileCount = 0
  ): Promise<FileValidationError[]> {
    const errors: FileValidationError[] = [];
    const fileArray = Array.from(files);
    
    // Check file count limits
    if (fileArray.length > FILE_VALIDATION_CONFIG.MAX_FILES_PER_UPLOAD) {
      errors.push({
        code: VALIDATION_ERROR_CODES.TOO_MANY_FILES,
        message: `Too many files selected. Maximum ${FILE_VALIDATION_CONFIG.MAX_FILES_PER_UPLOAD} files per upload.`
      });
      return errors; // Stop validation if too many files
    }
    
    // Check vault capacity
    if (currentVaultFileCount + fileArray.length > FILE_VALIDATION_CONFIG.MAX_TOTAL_FILES) {
      errors.push({
        code: VALIDATION_ERROR_CODES.VAULT_CAPACITY_EXCEEDED,
        message: `Vault capacity exceeded. Maximum ${FILE_VALIDATION_CONFIG.MAX_TOTAL_FILES} files per vault.`
      });
    }
    
    // Check total upload size
    const totalSize = fileArray.reduce((sum, file) => sum + file.size, 0);
    if (totalSize > FILE_VALIDATION_CONFIG.MAX_TOTAL_UPLOAD_SIZE) {
      errors.push({
        code: VALIDATION_ERROR_CODES.TOTAL_SIZE_EXCEEDED,
        message: `Total upload size too large. Maximum ${this.formatBytes(FILE_VALIDATION_CONFIG.MAX_TOTAL_UPLOAD_SIZE)} per upload.`
      });
    }
    
    // Validate each file individually
    const fileValidationPromises = fileArray.map(async (file) => {
      const timeoutPromise = new Promise<FileValidationError[]>((_, reject) => {
        setTimeout(() => reject(new Error('Validation timeout')), FILE_VALIDATION_CONFIG.VALIDATION_TIMEOUT);
      });
      
      try {
        return await Promise.race([
          this.validateFile(file),
          timeoutPromise
        ]);
      } catch (error) {
        return [{
          code: VALIDATION_ERROR_CODES.VALIDATION_TIMEOUT,
          message: 'File validation timed out',
          fileName: file.name
        }];
      }
    });
    
    try {
      const fileValidationResults = await Promise.all(fileValidationPromises);
      fileValidationResults.forEach(fileErrors => errors.push(...fileErrors));
    } catch (error) {
      errors.push({
        code: VALIDATION_ERROR_CODES.VALIDATION_TIMEOUT,
        message: 'Batch validation timed out'
      });
    }
    
    return errors;
  }
  
  /**
   * Check file size against limits
   */
  private static validateFileSize(file: File, errors: FileValidationError[]): void {
    if (file.size > FILE_VALIDATION_CONFIG.MAX_FILE_SIZE) {
      errors.push({
        code: VALIDATION_ERROR_CODES.FILE_TOO_LARGE,
        message: `File too large. Maximum size: ${this.formatBytes(FILE_VALIDATION_CONFIG.MAX_FILE_SIZE)}`,
        fileName: file.name
      });
    }
    
    if (file.size < FILE_VALIDATION_CONFIG.MIN_PDF_SIZE) {
      errors.push({
        code: VALIDATION_ERROR_CODES.FILE_TOO_SMALL,
        message: `File too small. Minimum size: ${this.formatBytes(FILE_VALIDATION_CONFIG.MIN_PDF_SIZE)}`,
        fileName: file.name
      });
    }
  }
  
  /**
   * Validate filename for security issues
   */
  private static validateFileName(file: File, errors: FileValidationError[]): void {
    const fileName = file.name;
    
    // Check for suspicious patterns
    for (const pattern of FILE_VALIDATION_CONFIG.SUSPICIOUS_FILENAME_PATTERNS) {
      if (pattern.test(fileName)) {
        errors.push({
          code: VALIDATION_ERROR_CODES.SUSPICIOUS_FILENAME,
          message: 'Filename contains potentially unsafe characters or extensions',
          fileName: file.name
        });
        break;
      }
    }
    
    // Check filename length (reasonable limit)
    if (fileName.length > 255) {
      errors.push({
        code: VALIDATION_ERROR_CODES.SUSPICIOUS_FILENAME,
        message: 'Filename too long',
        fileName: file.name
      });
    }
  }
  
  /**
   * Validate MIME type
   */
  private static validateFileType(file: File, errors: FileValidationError[]): void {
    if (!FILE_VALIDATION_CONFIG.ALLOWED_MIME_TYPES.includes(file.type)) {
      errors.push({
        code: VALIDATION_ERROR_CODES.INVALID_FILE_TYPE,
        message: `Invalid file type. Only PDF files are allowed. Detected: ${file.type || 'unknown'}`,
        fileName: file.name
      });
    }
  }
  
  /**
   * Validate file extension
   */
  private static validateFileExtension(file: File, errors: FileValidationError[]): void {
    const fileName = file.name.toLowerCase();
    const hasValidExtension = FILE_VALIDATION_CONFIG.ALLOWED_EXTENSIONS.some(ext => 
      fileName.endsWith(ext.toLowerCase())
    );
    
    if (!hasValidExtension) {
      errors.push({
        code: VALIDATION_ERROR_CODES.INVALID_EXTENSION,
        message: `Invalid file extension. Only ${FILE_VALIDATION_CONFIG.ALLOWED_EXTENSIONS.join(', ')} files are allowed`,
        fileName: file.name
      });
    }
  }
  
  /**
   * Validate PDF file structure by checking magic bytes
   */
  private static async validatePDFStructure(file: File, errors: FileValidationError[]): Promise<void> {
    try {
      // Read first few bytes to check PDF header
      const headerBytes = await this.readFileHeader(file, 8);
      
      // Check PDF magic bytes (%PDF-)
      const pdfMagicBytes = FILE_VALIDATION_CONFIG.PDF_MAGIC_BYTES;
      const headerArray = new Uint8Array(headerBytes);
      
      const isValidPDF = pdfMagicBytes.every((byte, index) => 
        headerArray[index] === byte
      );
      
      if (!isValidPDF) {
        errors.push({
          code: VALIDATION_ERROR_CODES.INVALID_PDF_STRUCTURE,
          message: 'File does not appear to be a valid PDF document',
          fileName: file.name
        });
      }
    } catch (error) {
      errors.push({
        code: VALIDATION_ERROR_CODES.INVALID_PDF_STRUCTURE,
        message: 'Unable to validate PDF structure',
        fileName: file.name
      });
    }
  }
  
  /**
   * Read the first N bytes of a file
   */
  private static readFileHeader(file: File, byteCount: number): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(new Error('Failed to read file header'));
      reader.readAsArrayBuffer(file.slice(0, byteCount));
    });
  }
  
  /**
   * Format bytes to human readable string
   */
  private static formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
  
  /**
   * Create user-friendly error summary
   */
  static createErrorSummary(errors: FileValidationError[]): string {
    if (errors.length === 0) return '';
    
    const errorGroups = errors.reduce((groups, error) => {
      if (!groups[error.code]) {
        groups[error.code] = [];
      }
      groups[error.code].push(error);
      return groups;
    }, {} as Record<string, FileValidationError[]>);
    
    const summaryParts: string[] = [];
    
    Object.entries(errorGroups).forEach(([code, groupErrors]) => {
      const count = groupErrors.length;
      const fileNames = groupErrors.map(e => e.fileName).filter(Boolean);
      
      let message = groupErrors[0].message;
      if (count > 1 && fileNames.length > 0) {
        message += ` (${count} files: ${fileNames.slice(0, 3).join(', ')}${fileNames.length > 3 ? '...' : ''})`;
      }
      
      summaryParts.push(message);
    });
    
    return summaryParts.join('\n\n');
  }
  
  /**
   * Filter valid files from a FileList based on validation results
   */
  static filterValidFiles(files: FileList, errors: FileValidationError[]): File[] {
    const fileArray = Array.from(files);
    const invalidFileNames = new Set(
      errors.map(error => error.fileName).filter(Boolean)
    );
    
    return fileArray.filter(file => !invalidFileNames.has(file.name));
  }
}