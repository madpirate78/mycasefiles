import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { getPDFLoadingOptions } from '../pdfConfig';

interface PDFRendererProps {
  file: File;
  onLoad?: () => void;
  onError?: (error: string) => void;
  showNavigation?: boolean;
  onPageChange?: (pageNumber: number, totalPages: number) => void;
  externalPageNumber?: number;
}

const PDFRenderer: React.FC<PDFRendererProps> = ({ file, onLoad, onError, showNavigation = true, onPageChange, externalPageNumber }) => {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [fileUrl, setFileUrl] = useState<string>('');

  // Memoize PDF loading options to prevent unnecessary reloads
  const pdfOptions = useMemo(() => getPDFLoadingOptions(), []);

  // Create and cleanup blob URL for file
  useEffect(() => {
    if (file) {
      const url = URL.createObjectURL(file);
      setFileUrl(url);
      
      return () => {
        URL.revokeObjectURL(url);
      };
    }
  }, [file]);

  // Sync with external page number
  useEffect(() => {
    if (externalPageNumber && externalPageNumber !== pageNumber) {
      setPageNumber(externalPageNumber);
    }
  }, [externalPageNumber]);

  useEffect(() => {
    console.log('PDFRenderer: Component mounted with file:', file.name, file.type, file.size);
    console.log('PDF.js version:', pdfjs.version);
    console.log('Worker source:', pdfjs.GlobalWorkerOptions.workerSrc);
  }, [file]);

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    console.log('PDF loaded successfully! Pages:', numPages);
    setNumPages(numPages);
    setIsLoading(false);
    setError('');
    onLoad?.();
  };

  const onDocumentLoadError = (error: Error) => {
    console.error('PDF load error:', error);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    setIsLoading(false);
    setError(error.message || 'Failed to load PDF');
    onError?.(error.message || 'Failed to load PDF');
  };

  const onPageLoadSuccess = () => {
    console.log('PDF page rendered successfully');
  };

  const onPageLoadError = (error: Error) => {
    console.error('PDF page render error:', error);
    setError(`Page render error: ${error.message}`);
  };

  // Page navigation functions
  const goToFirstPage = () => {
    setPageNumber(1);
    onPageChange?.(1, numPages);
  };
  const goToPreviousPage = () => {
    const newPage = Math.max(1, pageNumber - 1);
    setPageNumber(newPage);
    onPageChange?.(newPage, numPages);
  };
  const goToNextPage = () => {
    const newPage = Math.min(numPages, pageNumber + 1);
    setPageNumber(newPage);
    onPageChange?.(newPage, numPages);
  };
  const goToLastPage = () => {
    setPageNumber(numPages);
    onPageChange?.(numPages, numPages);
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
    <div className="pdf-renderer">
      {/* Page Navigation Controls */}
      {showNavigation && numPages > 1 && !isLoading && (
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
            Page {pageNumber} of {numPages}
          </span>
          <button 
            onClick={goToNextPage} 
            disabled={pageNumber === numPages}
            className="nav-btn"
            title="Next page"
          >
            ▶
          </button>
          <button 
            onClick={goToLastPage} 
            disabled={pageNumber === numPages}
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

      <div className="pdf-container">
        {/* Left Navigation - First Page */}
        {numPages > 1 && !isLoading && (
          <button 
            onClick={goToFirstPage} 
            disabled={pageNumber === 1}
            className="pdf-nav-btn pdf-nav-first"
            title="First page"
          >
            ⏮
          </button>
        )}
        
        {/* Left Navigation - Previous Page */}
        {numPages > 1 && !isLoading && (
          <button 
            onClick={goToPreviousPage} 
            disabled={pageNumber === 1}
            className="pdf-nav-btn pdf-nav-prev"
            title="Previous page"
          >
            ◀
          </button>
        )}

        <Document
          file={fileUrl}
          onLoadSuccess={onDocumentLoadSuccess}
          onLoadError={onDocumentLoadError}
          options={pdfOptions}
          loading={
            <div className="pdf-loading">
              <span className="loading-icon">⏳</span>
              <p>Loading PDF...</p>
            </div>
          }
          error={
            <div className="pdf-error">
              <span className="error-icon">❌</span>
              <p>Document load failed</p>
            </div>
          }
        >
          {!isLoading && numPages > 0 && (
            <Page
              pageNumber={pageNumber}
              width={600}
              renderTextLayer={false}
              renderAnnotationLayer={false}
              onLoadSuccess={onPageLoadSuccess}
              onLoadError={onPageLoadError}
            />
          )}
        </Document>

        {/* Right Navigation - Next Page */}
        {numPages > 1 && !isLoading && (
          <button 
            onClick={goToNextPage} 
            disabled={pageNumber === numPages}
            className="pdf-nav-btn pdf-nav-next"
            title="Next page"
          >
            ▶
          </button>
        )}
        
        {/* Right Navigation - Last Page */}
        {numPages > 1 && !isLoading && (
          <button 
            onClick={goToLastPage} 
            disabled={pageNumber === numPages}
            className="pdf-nav-btn pdf-nav-last"
            title="Last page"
          >
            ⏭
          </button>
        )}
      </div>

      {numPages > 0 && !isLoading && numPages === 1 && (
        <div className="pdf-info">
          <p>Single page document</p>
        </div>
      )}
    </div>
  );
};

// Export navigation controls component
export const PDFNavigationControls: React.FC<{
  pageNumber: number;
  numPages: number;
  onFirstPage: () => void;
  onPreviousPage: () => void;
  onNextPage: () => void;
  onLastPage: () => void;
}> = ({ pageNumber, numPages, onFirstPage, onPreviousPage, onNextPage, onLastPage }) => {
  if (numPages <= 1) return null;
  
  return (
    <div className="pdf-navigation">
      <button 
        onClick={onFirstPage} 
        disabled={pageNumber === 1}
        className="nav-btn"
        title="First page"
      >
        ⏮
      </button>
      <button 
        onClick={onPreviousPage} 
        disabled={pageNumber === 1}
        className="nav-btn"
        title="Previous page"
      >
        ◀
      </button>
      <span className="page-info">
        Page {pageNumber} of {numPages}
      </span>
      <button 
        onClick={onNextPage} 
        disabled={pageNumber === numPages}
        className="nav-btn"
        title="Next page"
      >
        ▶
      </button>
      <button 
        onClick={onLastPage} 
        disabled={pageNumber === numPages}
        className="nav-btn"
        title="Last page"
      >
        ⏭
      </button>
    </div>
  );
};

export default PDFRenderer;