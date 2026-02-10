import React, { useState, useEffect, useCallback } from 'react';
import { StoredFile } from '../../services/indexedDBService';
import {
  extractPDFPages,
  updatePageSelections,
  PageInfo,
  PDFPageData
} from '../../services/pdfPageExtractor';
import '../../styles/PagePruneModal.css';

interface PageSelectionPanelProps {
  file: StoredFile | null;
  onSave: (fileId: number, selectedPages: number[], totalPages: number) => void;
}

const PageSelectionPanel: React.FC<PageSelectionPanelProps> = ({ file, onSave }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [pdfData, setPdfData] = useState<PDFPageData | null>(null);
  const [pages, setPages] = useState<PageInfo[]>([]);
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string>('');

  const loadPDFPages = useCallback(async () => {
    if (!file) return;

    setLoading(true);
    setError('');

    try {
      const pageData = await extractPDFPages(file.data);

      if (file.selectedPages && file.selectedPages.length > 0) {
        const updatedPages = updatePageSelections(pageData.pages, file.selectedPages);
        setPages(updatedPages);
        setPdfData({
          ...pageData,
          pages: updatedPages,
          selectedPages: file.selectedPages
        });
      } else {
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

  useEffect(() => {
    if (file && file.type.includes('pdf')) {
      const blobUrl = URL.createObjectURL(file.data);
      setPdfBlobUrl(blobUrl);
      loadPDFPages();

      return () => {
        if (blobUrl) {
          URL.revokeObjectURL(blobUrl);
        }
      };
    }
  }, [file, loadPDFPages]);

  const togglePage = (pageNumber: number) => {
    const updatedPages = pages.map(page =>
      page.number === pageNumber
        ? { ...page, selected: !page.selected }
        : page
    );
    setPages(updatedPages);
  };

  const selectAllPages = () => {
    setPages(pages.map(page => ({ ...page, selected: true })));
  };

  const deselectAllPages = () => {
    setPages(pages.map(page => ({ ...page, selected: false })));
  };

  const handleSave = () => {
    if (!file || !pdfData) return;

    const selectedPageNumbers = pages
      .filter(page => page.selected)
      .map(page => page.number);

    onSave(file.id!, selectedPageNumbers, pdfData.totalPages);
  };

  const selectedCount = pages.filter(page => page.selected).length;
  const totalPages = pages.length;

  if (!file) return null;

  return (
    <div className="page-selection-panel">
      {error && (
        <div className="error-message">
          <p>{error}</p>
          <button onClick={loadPDFPages} className="btn secondary btn-sm">
            Retry
          </button>
        </div>
      )}

      {loading && (
        <div className="loading-state">
          <p>Analysing PDF pages...</p>
        </div>
      )}

      {!loading && !error && pages.length > 0 && (
        <>
          <div className="bulk-actions">
            <div className="action-buttons">
              <button onClick={selectAllPages} className="btn secondary btn-sm">
                Select All
              </button>
              <button onClick={deselectAllPages} className="btn secondary btn-sm">
                Deselect All
              </button>
            </div>
            <div className="selection-info">
              <span className="selected-count">
                <strong>{selectedCount}</strong> of <strong>{totalPages}</strong> pages
              </span>
            </div>
          </div>

          <div className="page-grid">
            {pages.map((page) => (
              <div
                key={page.number}
                className={`page-card ${page.selected ? 'selected' : 'deselected'}`}
                onClick={() => togglePage(page.number)}
              >
                <div className="page-card-header">
                  <div className="page-checkbox-container">
                    <input
                      type="checkbox"
                      checked={page.selected}
                      onChange={() => togglePage(page.number)}
                      className="page-checkbox"
                      onClick={(e) => e.stopPropagation()}
                    />
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
              </div>
            ))}
          </div>

          <div className="form-actions" style={{ marginTop: 'var(--spacing-md)' }}>
            <button
              onClick={handleSave}
              className="btn primary"
              disabled={selectedCount === 0}
            >
              Save Selection ({selectedCount} pages)
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default PageSelectionPanel;
