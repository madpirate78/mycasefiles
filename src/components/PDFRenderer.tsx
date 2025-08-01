import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { getPDFLoadingOptions } from '../pdfConfig';

interface PDFRendererProps {
  file: File;
  onLoad?: () => void;
  onError?: (error: string) => void;
  showMagnifier?: boolean;
}

interface MagnifierPosition {
  x: number;
  y: number;
}

const PDFRenderer: React.FC<PDFRendererProps> = ({ file, onLoad, onError, showMagnifier = true }) => {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [magnifierPos, setMagnifierPos] = useState<MagnifierPosition>({ x: 100, y: 100 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const pdfContainerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const magnifierCanvasRef = useRef<HTMLCanvasElement>(null);
  const mainPageRef = useRef<HTMLCanvasElement>(null);
  const [fileUrl, setFileUrl] = useState<string>('');
  const [magnifierContent, setMagnifierContent] = useState<string>('');

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
    // Update magnifier content when page loads
    updateMagnifierContent();
  };

  const updateMagnifierContent = useCallback(() => {
    if (!mainPageRef.current || !pdfContainerRef.current) return;

    const mainCanvas = mainPageRef.current;
    const magnifierCanvas = magnifierCanvasRef.current;
    
    if (!magnifierCanvas) return;

    const ctx = magnifierCanvas.getContext('2d');
    if (!ctx) return;

    // Set magnifier canvas size (rectangular banner)
    const magnifierWidth = 200;
    const magnifierHeight = 80;
    magnifierCanvas.width = magnifierWidth;
    magnifierCanvas.height = magnifierHeight;

    // Get the PDF container and canvas positions
    const containerRect = pdfContainerRef.current.getBoundingClientRect();
    const canvasRect = mainCanvas.getBoundingClientRect();
    
    // Calculate the relative position of magnifier center within the canvas
    const canvasOffsetX = canvasRect.left - containerRect.left;
    const canvasOffsetY = canvasRect.top - containerRect.top;
    
    // Magnifier center position relative to canvas
    const magnifierCenterX = magnifierPos.x + magnifierWidth / 2 - canvasOffsetX;
    const magnifierCenterY = magnifierPos.y + magnifierHeight / 2 - canvasOffsetY;
    
    // Scale factor between display canvas and actual canvas
    const scaleX = mainCanvas.width / canvasRect.width;
    const scaleY = mainCanvas.height / canvasRect.height;
    
    // Convert to actual canvas coordinates
    const actualCenterX = magnifierCenterX * scaleX;
    const actualCenterY = magnifierCenterY * scaleY;

    // Calculate the area to magnify (2x zoom means we take half the size area)
    const sourceWidth = magnifierWidth / 2;
    const sourceHeight = magnifierHeight / 2;
    const sourceX = Math.max(0, Math.min(mainCanvas.width - sourceWidth, actualCenterX - sourceWidth / 2));
    const sourceY = Math.max(0, Math.min(mainCanvas.height - sourceHeight, actualCenterY - sourceHeight / 2));

    // Clear canvas
    ctx.clearRect(0, 0, magnifierWidth, magnifierHeight);

    // Draw magnified content
    try {
      ctx.drawImage(
        mainCanvas,
        sourceX, sourceY, sourceWidth, sourceHeight, // Source rectangle centered on magnifier
        0, 0, magnifierWidth, magnifierHeight // Destination rectangle (2x magnification)
      );

      // Create rectangular mask with rounded corners
      ctx.globalCompositeOperation = 'destination-in';
      ctx.beginPath();
      const radius = 8;
      
      // Fallback for browsers without roundRect support
      if (ctx.roundRect) {
        ctx.roundRect(0, 0, magnifierWidth, magnifierHeight, radius);
      } else {
        // Manual rounded rectangle
        ctx.moveTo(radius, 0);
        ctx.lineTo(magnifierWidth - radius, 0);
        ctx.quadraticCurveTo(magnifierWidth, 0, magnifierWidth, radius);
        ctx.lineTo(magnifierWidth, magnifierHeight - radius);
        ctx.quadraticCurveTo(magnifierWidth, magnifierHeight, magnifierWidth - radius, magnifierHeight);
        ctx.lineTo(radius, magnifierHeight);
        ctx.quadraticCurveTo(0, magnifierHeight, 0, magnifierHeight - radius);
        ctx.lineTo(0, radius);
        ctx.quadraticCurveTo(0, 0, radius, 0);
        ctx.closePath();
      }
      
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';

      // Update the data URL for display
      setMagnifierContent(magnifierCanvas.toDataURL());
    } catch (error) {
      console.warn('Could not update magnifier content:', error);
    }
  }, [magnifierPos]);

  const onPageLoadError = (error: Error) => {
    console.error('PDF page render error:', error);
    setError(`Page render error: ${error.message}`);
  };

  // Page navigation functions
  const goToFirstPage = () => setPageNumber(1);
  const goToPreviousPage = () => setPageNumber(prev => Math.max(1, prev - 1));
  const goToNextPage = () => setPageNumber(prev => Math.min(numPages, prev + 1));
  const goToLastPage = () => setPageNumber(numPages);

  // Magnifier drag handlers
  const handleMagnifierMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    });
  }, []);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !pdfContainerRef.current) return;
    
    const containerRect = pdfContainerRef.current.getBoundingClientRect();
    const newX = e.clientX - containerRect.left - dragOffset.x;
    const newY = e.clientY - containerRect.top - dragOffset.y;
    
    // Keep magnifier within bounds
    const magnifierWidth = 200;
    const magnifierHeight = 80;
    const maxX = containerRect.width - magnifierWidth;
    const maxY = containerRect.height - magnifierHeight;
    
    const newPos = {
      x: Math.max(0, Math.min(maxX, newX)),
      y: Math.max(0, Math.min(maxY, newY))
    };
    setMagnifierPos(newPos);
  };

  // Update magnifier content when position changes
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      updateMagnifierContent();
    }, 50); // Debounce for smooth dragging

    return () => clearTimeout(timeoutId);
  }, [magnifierPos, updateMagnifierContent]);


  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove as any);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove as any);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, dragOffset]);

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
      {numPages > 1 && !isLoading && (
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

      <div 
        className="pdf-container" 
        ref={pdfContainerRef}
        onMouseMove={handleMouseMove}
        style={{ position: 'relative' }}
      >
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
            <>
              <Page
                pageNumber={pageNumber}
                width={350}
                renderTextLayer={false}
                renderAnnotationLayer={false}
                onLoadSuccess={onPageLoadSuccess}
                onLoadError={onPageLoadError}
                canvasRef={mainPageRef}
                devicePixelRatio={2} // High DPI rendering for magnifier quality
              />
            </>
          )}
        </Document>

        {/* Hidden canvas for magnifier processing */}
        <canvas
          ref={magnifierCanvasRef}
          style={{ position: 'absolute', left: '-9999px', top: '-9999px' }}
          width={200}
          height={80}
        />

        {/* Rectangular Magnifier Banner Overlay */}
        {!isLoading && numPages > 0 && showMagnifier && (
          <div
            className="magnifier rectangular-magnifier"
            style={{
              position: 'absolute',
              left: `${magnifierPos.x}px`,
              top: `${magnifierPos.y}px`,
              width: '200px',
              height: '80px',
              border: '3px solid #007bff',
              borderRadius: '8px',
              cursor: isDragging ? 'grabbing' : 'grab',
              background: magnifierContent ? `url(${magnifierContent})` : 'rgba(255,255,255,0.9)',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
              zIndex: 1000,
              overflow: 'hidden'
            }}
            onMouseDown={handleMagnifierMouseDown}
            title="Drag to move magnifier - shows 2x magnified view in banner format"
          >
            {!magnifierContent && (
              <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                fontSize: '20px',
                pointerEvents: 'none',
                color: '#007bff',
                textShadow: '1px 1px 2px white'
              }}>
                🔍 Banner Magnifier
              </div>
            )}
          </div>
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

export default PDFRenderer;