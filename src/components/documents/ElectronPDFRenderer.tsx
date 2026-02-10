import React, { useState, useEffect, useRef, useCallback } from 'react';
import { isElectron, parsePDF } from '../../services/electronAPI';

interface ElectronPDFRendererProps {
  file: File;
  onLoad?: () => void;
  onError?: (error: string) => void;
  showNavigation?: boolean;
  onPageChange?: (pageNumber: number, totalPages: number) => void;
  externalPageNumber?: number;
}

const ElectronPDFRenderer: React.FC<ElectronPDFRendererProps> = ({ 
  file, 
  onLoad, 
  onError, 
  showNavigation = true, 
  onPageChange, 
  externalPageNumber 
}) => {
  const [pdfUrl, setPdfUrl] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const webviewRef = useRef<HTMLElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const extractPDFInfo = useCallback(async (pdfFile: File) => {
    try {
      if (!isElectron()) return;

      const arrayBuffer = await pdfFile.arrayBuffer();
      const result = await parsePDF(arrayBuffer);

      if (result.success) {
        // For now, assume single page - we can enhance this later
        setTotalPages(1);
        onLoad?.();
      } else {
        throw new Error(result.error || 'Failed to parse PDF');
      }
    } catch (err) {
      console.error('PDF info extraction failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to load PDF');
      onError?.(err instanceof Error ? err.message : 'Failed to load PDF');
    }
  }, [onLoad, onError]);

  useEffect(() => {
    console.log('🔍 PDF useEffect triggered:', {
      hasFile: !!file,
      fileName: file?.name,
      fileSize: file?.size,
      extractPDFInfo: extractPDFInfo.toString().substring(0, 50) + '...'
    });
    
    if (file) {
      console.log('ElectronPDFRenderer: Loading file:', file.name, file.type, file.size);
      
      // Create blob URL for the PDF
      const url = URL.createObjectURL(file);
      setPdfUrl(url);
      setIsLoading(false);
      
      // Extract page information from PDF (using our existing parser)
      if (isElectron()) {
        extractPDFInfo(file);
      }
      
      return () => {
        URL.revokeObjectURL(url);
      };
    }
  }, [file, extractPDFInfo]);

  // Sync with external page number
  useEffect(() => {
    if (externalPageNumber && externalPageNumber !== pageNumber) {
      setPageNumber(externalPageNumber);
    }
  }, [externalPageNumber, pageNumber]);

  // Page navigation functions (using useCallback for stable references)
  const goToFirstPage = useCallback(() => {
    setPageNumber(1);
    onPageChange?.(1, totalPages);
  }, [totalPages, onPageChange]);
  
  const goToPreviousPage = useCallback(() => {
    const newPage = Math.max(1, pageNumber - 1);
    setPageNumber(newPage);
    onPageChange?.(newPage, totalPages);
  }, [pageNumber, totalPages, onPageChange]);
  
  const goToNextPage = useCallback(() => {
    const newPage = Math.min(totalPages, pageNumber + 1);
    setPageNumber(newPage);
    onPageChange?.(newPage, totalPages);
  }, [pageNumber, totalPages, onPageChange]);
  
  const goToLastPage = useCallback(() => {
    setPageNumber(totalPages);
    onPageChange?.(totalPages, totalPages);
  }, [totalPages, onPageChange]);

  // Keyboard navigation (disabled when typing in form fields)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const activeElement = document.activeElement;
      
      // Check if we're in a form field - be more specific about form field detection
      const isInFormField = activeElement && (
        activeElement.tagName === 'INPUT' ||
        activeElement.tagName === 'TEXTAREA' ||
        activeElement.tagName === 'SELECT' ||
        activeElement.hasAttribute('contenteditable') ||
        // Also check if we're inside a modal that contains form fields
        activeElement.closest('.modal-content')
      );
      
      if (isInFormField) {
        return; // Don't handle keyboard events when typing in form fields
      }

      // Only handle navigation keys when not in form fields
      switch (event.key) {
        case 'ArrowUp':
        case 'PageUp':
          event.preventDefault();
          goToPreviousPage();
          break;
        case 'ArrowDown':
        case 'PageDown':
          event.preventDefault();
          goToNextPage();
          break;
        case 'Home':
          event.preventDefault();
          goToFirstPage();
          break;
        case 'End':
          event.preventDefault();
          goToLastPage();
          break;
        default:
          // Don't handle other keys
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [goToFirstPage, goToLastPage, goToNextPage, goToPreviousPage]); // Removed pageNumber and totalPages from dependencies

  const handleWebviewLoad = () => {
    setIsLoading(false);
    setError('');
    onLoad?.();
  };

  const handleWebviewError = () => {
    setIsLoading(false);
    setError('Failed to load PDF preview');
    onError?.('Failed to load PDF preview');
  };


  if (error) {
    return (
      <div className="pdf-error">
        <span className="error-icon">❌</span>
        <p>Unable to preview PDF</p>
        <p className="error-message">{error}</p>
        <button 
          onClick={() => {
            setError('');
            setIsLoading(true);
            if (file) {
              const url = URL.createObjectURL(file);
              setPdfUrl(url);
              setIsLoading(false);
            }
          }}
          className="btn secondary"
          style={{ marginTop: '10px', fontSize: '12px', padding: '4px 8px' }}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="pdf-renderer electron-pdf-renderer">
      {/* Page Navigation Controls */}
      {showNavigation && totalPages > 1 && !isLoading && (
        <div className="pdf-navigation">
          <button 
            onClick={goToFirstPage} 
            disabled={pageNumber === 1}
            className="nav-btn"
            title="First page"
          >
            ⏮
          </button>
          <button 
            onClick={goToPreviousPage} 
            disabled={pageNumber === 1}
            className="nav-btn"
            title="Previous page"
          >
            ◀
          </button>
          <span className="page-info">
            Page {pageNumber} of {totalPages}
          </span>
          <button 
            onClick={goToNextPage} 
            disabled={pageNumber === totalPages}
            className="nav-btn"
            title="Next page"
          >
            ▶
          </button>
          <button 
            onClick={goToLastPage} 
            disabled={pageNumber === totalPages}
            className="nav-btn"
            title="Last page"
          >
            ⏭
          </button>
        </div>
      )}

      {isLoading && (
        <div className="pdf-loading">
          <span className="loading-icon">⏳</span>
          <p>Loading PDF preview...</p>
        </div>
      )}

      {!isLoading && pdfUrl && (
        <div 
          className="pdf-container"
          ref={containerRef}
          tabIndex={-1}
          style={{ outline: 'none' }}
        >
          {/* Use Electron's built-in PDF viewer */}
          <iframe
            ref={webviewRef as any}
            src={pdfUrl}
            width="100%"
            height="100%"
            style={{
              border: 'none',
              backgroundColor: '#f0f0f0',
              borderRadius: '4px',
              pointerEvents: 'auto'
            }}
            onLoad={handleWebviewLoad}
            onError={handleWebviewError}
            title="PDF Preview"
          />
        </div>
      )}

      {totalPages > 0 && !isLoading && totalPages === 1 && (
        <div className="pdf-info">
          <p>Single page document</p>
        </div>
      )}
    </div>
  );
};

export default ElectronPDFRenderer;