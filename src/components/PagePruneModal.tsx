import React, { useState, useEffect, useCallback } from 'react';
import { StoredFile } from '../services/indexedDBService';
import { 
  extractPDFPages, 
  updatePageSelections,
  PageInfo,
  PDFPageData 
} from '../services/pdfPageExtractor';

interface PagePruneModalProps {
  file: StoredFile | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (fileId: number, selectedPages: number[], totalPages: number) => void;
}

const PagePruneModal: React.FC<PagePruneModalProps> = ({ 
  file, 
  isOpen, 
  onClose, 
  onSave 
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [pdfData, setPdfData] = useState<PDFPageData | null>(null);
  const [pages, setPages] = useState<PageInfo[]>([]);
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string>('');

  // Load PDF page data when modal opens
  useEffect(() => {
    if (isOpen && file && file.type.includes('pdf')) {
      // Create blob URL for PDF viewing
      const blobUrl = URL.createObjectURL(file.data);
      setPdfBlobUrl(blobUrl);
      loadPDFPages();
      
      // Cleanup function
      return () => {
        if (blobUrl) {
          URL.revokeObjectURL(blobUrl);
        }
      };
    }
  }, [isOpen, file, loadPDFPages]);

  const loadPDFPages = useCallback(async () => {
    if (!file) return;

    setLoading(true);
    setError('');

    try {
      console.log('🔄 Loading PDF pages for:', file.name);
      
      // Extract page information
      const pageData = await extractPDFPages(file.data);
      
      // If file already has page selections, use them; otherwise use defaults
      if (file.selectedPages && file.selectedPages.length > 0) {
        const updatedPages = updatePageSelections(pageData.pages, file.selectedPages);
        setPages(updatedPages);
        setPdfData({
          ...pageData,
          pages: updatedPages,
          selectedPages: file.selectedPages
        });
      } else {
        // Default to all pages selected
        setPages(pageData.pages);
        setPdfData(pageData);
      }

    } catch (err) {
      console.error('❌ Failed to load PDF pages:', err);
      setError(`Failed to load PDF pages: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  }, [file]);

  const togglePage = (pageNumber: number) => {
    const updatedPages = pages.map(page => 
      page.number === pageNumber 
        ? { ...page, selected: !page.selected }
        : page
    );
    setPages(updatedPages);
  };

  const selectAllPages = () => {
    const updatedPages = pages.map(page => ({ ...page, selected: true }));
    setPages(updatedPages);
  };

  const deselectAllPages = () => {
    const updatedPages = pages.map(page => ({ ...page, selected: false }));
    setPages(updatedPages);
  };


  const handleSave = () => {
    if (!file || !pdfData) return;

    const selectedPageNumbers = pages
      .filter(page => page.selected)
      .map(page => page.number);

    onSave(file.id!, selectedPageNumbers, pdfData.totalPages);
    onClose();
  };

  const selectedCount = pages.filter(page => page.selected).length;
  const totalPages = pages.length;

  if (!isOpen || !file) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content page-prune-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header page-prune-header">
          <span className="file-name">{file.name}</span>
          <span className="page-count">({totalPages} pages)</span>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">

          {/* Error State */}
          {error && (
            <div className="error-message">
              <p>❌ {error}</p>
              <button onClick={loadPDFPages} className="btn secondary">
                Retry
              </button>
            </div>
          )}

          {/* Loading State */}
          {loading && (
            <div className="loading-state">
              <p>🔄 Analyzing PDF pages...</p>
              <div className="loading-spinner">Please wait while we process each page.</div>
            </div>
          )}

          {/* Bulk Actions */}
          {!loading && !error && pages.length > 0 && (
            <div className="bulk-actions">
              <div className="action-buttons">
                <button onClick={selectAllPages} className="btn secondary">
                  ✓ Select All
                </button>
                <button onClick={deselectAllPages} className="btn secondary">
                  ✗ Deselect All
                </button>
              </div>
              
              <div className="selection-info">
                <span className="selected-count">
                  Selected: <strong>{selectedCount}</strong> of <strong>{totalPages}</strong> pages
                </span>
              </div>
            </div>
          )}

          {/* Page Carousel */}
          {!loading && !error && pages.length > 0 && (
            <div 
              className="page-carousel-container"
              onWheel={(e) => {
                // Prevent vertical scrolling and convert to horizontal
                e.preventDefault();
                const container = e.currentTarget;
                container.scrollLeft += e.deltaY;
              }}
            >
              <div className="page-carousel">
                {pages.map((page) => (
                  <div 
                    key={page.number} 
                    className={`page-card ${page.selected ? 'selected' : 'deselected'}`}
                  >
                    <div className="page-card-header">
                      <div className="page-checkbox-container">
                        <input
                          type="checkbox"
                          checked={page.selected}
                          onChange={() => togglePage(page.number)}
                          className="page-checkbox"
                          id={`page-${page.number}`}
                        />
                        <label htmlFor={`page-${page.number}`} className="checkbox-label">
                          {page.selected ? '✓' : ''}
                        </label>
                      </div>
                      <div className="page-header-info">
                        <span className="page-number">Page {page.number}</span>
                      </div>
                    </div>
                    
                    <div className="page-preview">
                      {pdfBlobUrl ? (
                        <iframe
                          src={`${pdfBlobUrl}#page=${page.number}&view=FitH&toolbar=0&statusbar=0&messages=0&navpanes=0&scrollbar=0`}
                          className="page-iframe"
                          title={`Page ${page.number} preview`}
                          loading="lazy"
                          allow="fullscreen"
                        />
                      ) : (
                        <div className="page-loading">
                          <span>Loading page...</span>
                        </div>
                      )}
                    </div>
                    
                    {/* Click overlay for easy selection */}
                    <div 
                      className="click-overlay"
                      onClick={() => togglePage(page.number)}
                      title={`Click to ${page.selected ? 'deselect' : 'select'} page ${page.number}`}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="modal-footer">
          <button onClick={onClose} className="btn secondary">
            Cancel
          </button>
          <button 
            onClick={handleSave} 
            className="btn primary"
            disabled={loading || selectedCount === 0}
          >
            Save Selection ({selectedCount} pages)
          </button>
        </div>
      </div>
    </div>
  );
};

export default PagePruneModal;