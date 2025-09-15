const os = require('os');
const fs = require('fs');
const path = require('path');

/**
 * Resource monitoring and limit enforcement service for Electron main process
 * Prevents resource exhaustion during PDF/OCR processing
 */
class ResourceMonitor {
  constructor() {
    this.activeOperations = new Map(); // Track active operations
    this.operationCounter = 0;
    this.memoryCheckInterval = null;
    this.tempDirPath = path.join(os.tmpdir(), 'mycasefiles-temp');
    
    // Resource limits (mirroring the constants from the renderer)
    this.limits = {
      OCR: {
        MAX_PAGES_PER_DOCUMENT: 5,
        MAX_CONCURRENT_OPERATIONS: 2,
        TIMEOUT_PER_PAGE_MS: 30000,
        TOTAL_TIMEOUT_MS: 180000,
        MAX_FILE_SIZE_MB: 50
      },
      PDF: {
        MAX_PAGES_FOR_TEXT_EXTRACTION: 20,
        MAX_FILE_SIZE_MB: 100,
        TIMEOUT_MS: 60000
      },
      SYSTEM: {
        MAX_MEMORY_USAGE_MB: 1024,
        MAX_TEMP_FILES: 100,
        CLEANUP_INTERVAL_MS: 300000,
        MAX_TEMP_DIR_SIZE_MB: 1000
      }
    };
    
    this.startMonitoring();
  }

  /**
   * Start resource monitoring
   */
  startMonitoring() {
    console.log('🔍 Starting resource monitoring...');
    
    // Monitor memory usage every 30 seconds
    this.memoryCheckInterval = setInterval(() => {
      this.checkSystemResources();
    }, 30000);
    
    // Cleanup temp files every 5 minutes
    setInterval(() => {
      this.cleanupTempFiles();
    }, this.limits.SYSTEM.CLEANUP_INTERVAL_MS);
  }

  /**
   * Stop resource monitoring
   */
  stopMonitoring() {
    if (this.memoryCheckInterval) {
      clearInterval(this.memoryCheckInterval);
      this.memoryCheckInterval = null;
    }
    console.log('🔍 Resource monitoring stopped');
  }

  /**
   * Check if a file operation is within resource limits
   */
  validateFileOperation(filePath, operationType = 'general') {
    const stats = fs.statSync(filePath);
    const fileSizeMB = stats.size / (1024 * 1024);
    
    // Check file size limits based on operation type
    let maxSizeMB;
    switch (operationType) {
      case 'ocr':
        maxSizeMB = this.limits.OCR.MAX_FILE_SIZE_MB;
        break;
      case 'pdf':
        maxSizeMB = this.limits.PDF.MAX_FILE_SIZE_MB;
        break;
      default:
        maxSizeMB = this.limits.PDF.MAX_FILE_SIZE_MB;
    }
    
    if (fileSizeMB > maxSizeMB) {
      throw new Error(`File size ${fileSizeMB.toFixed(2)}MB exceeds limit of ${maxSizeMB}MB for ${operationType} operations`);
    }
    
    return true;
  }

  /**
   * Start tracking a resource-intensive operation
   */
  startOperation(operationType, metadata = {}) {
    const operationId = `${operationType}_${++this.operationCounter}_${Date.now()}`;
    
    // Check concurrent operation limits
    const activeOCROperations = Array.from(this.activeOperations.values())
      .filter(op => op.type === 'ocr').length;
    
    if (operationType === 'ocr' && activeOCROperations >= this.limits.OCR.MAX_CONCURRENT_OPERATIONS) {
      throw new Error(`Maximum concurrent OCR operations (${this.limits.OCR.MAX_CONCURRENT_OPERATIONS}) exceeded`);
    }
    
    const operation = {
      id: operationId,
      type: operationType,
      startTime: Date.now(),
      metadata,
      timeout: null
    };
    
    // Set timeout based on operation type
    let timeoutMs;
    switch (operationType) {
      case 'ocr':
        timeoutMs = this.limits.OCR.TOTAL_TIMEOUT_MS;
        break;
      case 'pdf':
        timeoutMs = this.limits.PDF.TIMEOUT_MS;
        break;
      default:
        timeoutMs = 60000; // 1 minute default
    }
    
    operation.timeout = setTimeout(() => {
      console.error(`⚠️ Operation ${operationId} timed out after ${timeoutMs}ms`);
      this.finishOperation(operationId, { timedOut: true });
    }, timeoutMs);
    
    this.activeOperations.set(operationId, operation);
    console.log(`🚀 Started ${operationType} operation:`, operationId);
    
    return operationId;
  }

  /**
   * Finish tracking an operation
   */
  finishOperation(operationId, result = {}) {
    const operation = this.activeOperations.get(operationId);
    if (!operation) {
      console.warn('⚠️ Attempted to finish unknown operation:', operationId);
      return;
    }
    
    const duration = Date.now() - operation.startTime;
    
    // Clear timeout
    if (operation.timeout) {
      clearTimeout(operation.timeout);
    }
    
    console.log(`✅ Finished ${operation.type} operation: ${operationId} (${duration}ms)`, {
      success: !result.timedOut && !result.error,
      duration,
      ...result
    });
    
    this.activeOperations.delete(operationId);
  }

  /**
   * Check system resources and log warnings
   */
  checkSystemResources() {
    try {
      const memoryUsage = process.memoryUsage();
      const memoryUsageMB = memoryUsage.heapUsed / (1024 * 1024);
      const systemMemory = os.totalmem();
      const freeMemory = os.freemem();
      const memoryUsagePercent = ((systemMemory - freeMemory) / systemMemory) * 100;
      
      // Check memory usage
      if (memoryUsageMB > this.limits.SYSTEM.MAX_MEMORY_USAGE_MB) {
        console.warn(`⚠️ High memory usage: ${memoryUsageMB.toFixed(2)}MB (limit: ${this.limits.SYSTEM.MAX_MEMORY_USAGE_MB}MB)`);
      }
      
      // Check system memory
      if (memoryUsagePercent > 90) {
        console.warn(`⚠️ High system memory usage: ${memoryUsagePercent.toFixed(1)}%`);
      }
      
      // Check active operations
      const activeCount = this.activeOperations.size;
      if (activeCount > 0) {
        console.log(`📊 Active operations: ${activeCount}`);
        
        // Check for long-running operations
        const now = Date.now();
        this.activeOperations.forEach((operation, id) => {
          const duration = now - operation.startTime;
          if (duration > 120000) { // 2 minutes
            console.warn(`⚠️ Long-running operation: ${id} (${Math.round(duration/1000)}s)`);
          }
        });
      }
      
    } catch (error) {
      console.error('❌ Error checking system resources:', error);
    }
  }

  /**
   * Clean up temporary files
   */
  cleanupTempFiles() {
    try {
      if (!fs.existsSync(this.tempDirPath)) {
        return;
      }
      
      const files = fs.readdirSync(this.tempDirPath);
      const now = Date.now();
      let deletedCount = 0;
      let totalSize = 0;
      
      files.forEach(file => {
        const filePath = path.join(this.tempDirPath, file);
        const stats = fs.statSync(filePath);
        const ageMinutes = (now - stats.mtime.getTime()) / (1000 * 60);
        
        totalSize += stats.size;
        
        // Delete files older than 30 minutes
        if (ageMinutes > 30) {
          try {
            if (stats.isDirectory()) {
              fs.rmSync(filePath, { recursive: true, force: true });
            } else {
              fs.unlinkSync(filePath);
            }
            deletedCount++;
          } catch (error) {
            console.warn(`⚠️ Could not delete temp file: ${filePath}`, error.message);
          }
        }
      });
      
      const totalSizeMB = totalSize / (1024 * 1024);
      
      if (deletedCount > 0) {
        console.log(`🧹 Cleaned up ${deletedCount} temp files`);
      }
      
      // Warning if temp directory is too large
      if (totalSizeMB > this.limits.SYSTEM.MAX_TEMP_DIR_SIZE_MB) {
        console.warn(`⚠️ Temp directory size: ${totalSizeMB.toFixed(2)}MB (limit: ${this.limits.SYSTEM.MAX_TEMP_DIR_SIZE_MB}MB)`);
      }
      
    } catch (error) {
      console.error('❌ Error during temp file cleanup:', error);
    }
  }

  /**
   * Get current resource usage statistics
   */
  getResourceStats() {
    const memoryUsage = process.memoryUsage();
    const systemMemory = os.totalmem();
    const freeMemory = os.freemem();
    
    return {
      memory: {
        heapUsed: Math.round(memoryUsage.heapUsed / (1024 * 1024)),
        heapTotal: Math.round(memoryUsage.heapTotal / (1024 * 1024)),
        external: Math.round(memoryUsage.external / (1024 * 1024)),
        systemTotal: Math.round(systemMemory / (1024 * 1024)),
        systemFree: Math.round(freeMemory / (1024 * 1024))
      },
      operations: {
        active: this.activeOperations.size,
        activeList: Array.from(this.activeOperations.entries()).map(([id, op]) => ({
          id,
          type: op.type,
          duration: Date.now() - op.startTime
        }))
      },
      limits: this.limits
    };
  }

  /**
   * Force cleanup of all active operations (emergency)
   */
  emergencyCleanup() {
    console.warn('⚠️ Emergency cleanup initiated');
    
    // Cancel all active operations
    this.activeOperations.forEach((operation, id) => {
      if (operation.timeout) {
        clearTimeout(operation.timeout);
      }
    });
    
    this.activeOperations.clear();
    
    // Clean up temp files immediately
    this.cleanupTempFiles();
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
  }
}

module.exports = ResourceMonitor;