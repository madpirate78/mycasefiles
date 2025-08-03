import React, { useState, useEffect, useRef, useCallback } from 'react';

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

  useEffect(() => {
    if (file) {
      console.log('ElectronPDFRenderer: Loading file:', file.name, file.type, file.size);
      
      // Create blob URL for the PDF
      const url = URL.createObjectURL(file);
      setPdfUrl(url);
      setIsLoading(false);
      
      // Extract page information from PDF (using our existing parser)
      if (window.electron) {
        extractPDFInfo(file);
      }
      
      return () => {
        URL.revokeObjectURL(url);
      };
    }
  }, [file]);

  const extractPDFInfo = useCallback(async (pdfFile: File) => {
    try {
      if (!window.electron) return;
      
      const arrayBuffer = await pdfFile.arrayBuffer();
      const result = await window.electron.parsePDF(arrayBuffer);
      
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
  }, [onPDFExtracted]);

  // Sync with external page number
  useEffect(() => {
    if (externalPageNumber && externalPageNumber !== pageNumber) {
      setPageNumber(externalPageNumber);
    }
  }, [externalPageNumber, pageNumber]);

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

  // Page navigation functions (for multi-page support later)
  const goToFirstPage = () => {
    setPageNumber(1);
    onPageChange?.(1, totalPages);
  };
  
  const goToPreviousPage = () => {
    const newPage = Math.max(1, pageNumber - 1);
    setPageNumber(newPage);
    onPageChange?.(newPage, totalPages);
  };
  
  const goToNextPage = () => {
    const newPage = Math.min(totalPages, pageNumber + 1);
    setPageNumber(newPage);
    onPageChange?.(newPage, totalPages);
  };
  
  const goToLastPage = () => {
    setPageNumber(totalPages);
    onPageChange?.(totalPages, totalPages);
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
        <div className="pdf-container">
          {/* Use Electron's built-in PDF viewer */}
          <iframe
            ref={webviewRef as any}
            src={pdfUrl}
            width="100%"
            height="100%"
            style={{
              border: 'none',
              backgroundColor: '#f0f0f0',
              borderRadius: '4px'
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