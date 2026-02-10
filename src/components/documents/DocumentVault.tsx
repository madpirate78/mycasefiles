import React, { useState, useMemo } from 'react';
import { StoredFile } from '../../services/indexedDBService';
import { formatStoredDate } from '../../utils/dateUtils';
import { VaultType } from '../../types/vault';
import vaultService from '../../services/vaultService';
import { isElectron, extractPageCount } from '../../services/electronAPI';
import FilePreviewModal, { FileWithOCR } from './FilePreviewModal';
import PagePruneModal from './PagePruneModal';
import '../../styles/DocumentVault.css';
import '../../styles/Modal.css';
import '../../styles/Forms.css';

interface DocumentVaultProps {
  uploadedFiles: StoredFile[];
  onFileUpload: (files: FileList) => void;
  onFileDelete?: (fileId: number) => void;
  onFileEdit?: (fileId: number, metadata: FileWithOCR) => void;
  onFileUpdate?: (fileId: number, selectedPages: number[], totalPages: number) => void;
  onOpenDocument?: (file: StoredFile) => void;
  currentVault: VaultType;
}

interface ExtendedFile extends StoredFile {
  section?: string;
  description?: string;
  judgeName?: string;
  orderReference?: string;
  date?: string;
}

/** Get a single consolidated status for a document row */
const getDocumentStatus = (file: ExtendedFile): { label: string; className: string; title: string } => {
  const hasMetadata = !!(file.judgeName || file.orderReference || (file as any).courtReference || (file as any).personName);
  const hasPages = !!(file.selectedPages && file.selectedPages.length > 0 && file.totalPages);

  if (hasMetadata && hasPages) {
    return { label: '✓ Ready', className: 'status-ready', title: 'Metadata filled and pages selected' };
  }
  if (hasMetadata || file.autopopulationPerformed) {
    const missing = !hasPages ? 'pages not selected' : '';
    return { label: '⚠ Needs attention', className: 'status-attention', title: missing || 'Review metadata' };
  }
  return { label: '⚠ Needs attention', className: 'status-attention', title: 'Missing metadata' };
};

const DocumentVault: React.FC<DocumentVaultProps> = ({ uploadedFiles, onFileUpload, onFileDelete, onFileEdit, onFileUpdate, onOpenDocument, currentVault }) => {
  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [deletingFileId, setDeletingFileId] = useState<number | null>(null);
  const [editingFile, setEditingFile] = useState<StoredFile | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [pageViewFile, setPageViewFile] = useState<StoredFile | null>(null);
  const [isPagePruneModalOpen, setIsPagePruneModalOpen] = useState(false);

  // Overflow menu state
  const [showOverflowMenu, setShowOverflowMenu] = useState(false);

  // Batch processing state
  const [showReprocessAllDialog, setShowReprocessAllDialog] = useState(false);
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0, currentFile: '' });

  // Get vault-specific sections
  const sections = vaultService.getVaultSections(currentVault);

  const handleDeleteClick = (fileId: number, fileName: string) => {
    if (window.confirm(`Are you sure you want to delete "${fileName}"?\n\nThis action cannot be undone.`)) {
      setDeletingFileId(fileId);
      if (onFileDelete) {
        onFileDelete(fileId);
      }
      setTimeout(() => setDeletingFileId(null), 500);
    }
  };

  const handleEditClick = (file: StoredFile) => {
    if (onOpenDocument) {
      onOpenDocument(file);
    } else {
      setEditingFile(file);
      setIsEditModalOpen(true);
    }
  };

  const handleEditSave = (fileId: number, metadata: FileWithOCR) => {
    if (onFileEdit) {
      onFileEdit(fileId, metadata);
    }
    setIsEditModalOpen(false);
    setEditingFile(null);
  };

  const handleEditClose = () => {
    setIsEditModalOpen(false);
    setEditingFile(null);
  };

  const handleViewClick = (file: StoredFile) => {
    if (file.type.includes('pdf')) {
      setPageViewFile(file);
      setIsPagePruneModalOpen(true);
    }
  };

  const handlePagePruneClose = () => {
    setIsPagePruneModalOpen(false);
    setPageViewFile(null);
  };

  const handlePagePruneSave = (fileId: number, selectedPages: number[], totalPages: number) => {
    if (onFileUpdate) {
      onFileUpdate(fileId, selectedPages, totalPages);
    }
    setIsPagePruneModalOpen(false);
    setPageViewFile(null);
  };

  // Batch reprocess function to extract page counts
  const handleBatchReprocessStart = async () => {
    setShowReprocessAllDialog(false);
    setIsBatchProcessing(true);

    const pdfFiles = uploadedFiles.filter(file =>
      file.type.includes('pdf') && (!file.totalPages || file.totalPages === 0)
    );
    setBatchProgress({ current: 0, total: pdfFiles.length, currentFile: '' });

    if (pdfFiles.length === 0) {
      setIsBatchProcessing(false);
      setBatchProgress({ current: 0, total: 0, currentFile: '' });
      return;
    }

    for (let i = 0; i < pdfFiles.length; i++) {
      const file = pdfFiles[i];
      setBatchProgress({ current: i + 1, total: pdfFiles.length, currentFile: file.name });

      try {
        if (file.data && isElectron()) {
          const arrayBuffer = await file.data.arrayBuffer();
          const result = await extractPageCount(arrayBuffer);

          if (result.success && result.pageCount) {
            if (onFileEdit && file.id) {
              const updatedMetadata = {
                ...file,
                totalPages: result.pageCount
              };
              onFileEdit(file.id, updatedMetadata as any);
            }
          }
        }

        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`❌ Error reprocessing ${file.name}:`, error);
      }
    }

    setIsBatchProcessing(false);
    setBatchProgress({ current: 0, total: 0, currentFile: '' });
  };

  // Filter and sort files
  const processedFiles = useMemo(() => {
    let files = uploadedFiles as ExtendedFile[];

    if (filter !== 'all') {
      files = files.filter(file => file.section === filter);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      files = files.filter(file =>
        file.name.toLowerCase().includes(query) ||
        file.description?.toLowerCase().includes(query) ||
        file.judgeName?.toLowerCase().includes(query) ||
        file.orderReference?.toLowerCase().includes(query)
      );
    }

    files = [...files].sort((a, b) => {
      if (a.date && b.date) {
        return new Date(a.date).getTime() - new Date(b.date).getTime();
      }
      if (a.date && !b.date) return -1;
      if (!a.date && b.date) return 1;
      const addedDateA = a.addedDate ? new Date(a.addedDate).getTime() : 0;
      const addedDateB = b.addedDate ? new Date(b.addedDate).getTime() : 0;
      return addedDateA - addedDateB;
    });

    return files;
  }, [uploadedFiles, filter, searchQuery]);

  // Count files by section
  const sectionCounts = useMemo(() => {
    const counts: { [key: string]: number } = { all: uploadedFiles.length };
    uploadedFiles.forEach((file: ExtendedFile) => {
      const section = file.section || 'other';
      counts[section] = (counts[section] || 0) + 1;
    });
    return counts;
  }, [uploadedFiles]);

  const categories = [
    { id: 'all', label: 'All Documents', icon: '📚', important: false },
    ...sections.map(section => {
      const iconMap: { [key: string]: string } = {
        'preliminary': '📋',
        'applications': '⚖️',
        'orders': '⚖️',
        'statements': '📝',
        'care': '👨‍👩‍👧‍👦',
        'experts': '🔬',
        'disclosure': '💰',
        'valuations': '🏠',
        'correspondence': '✉️',
        'chronology': '📅',
        'evidence': '🔍',
        'other': '📄'
      };
      const importantSections = ['orders', 'statements', 'experts'];
      return {
        id: section.id,
        label: section.label,
        icon: iconMap[section.id] || '📄',
        important: importantSections.includes(section.id)
      };
    })
  ];

  return (
    <div className="document-vault">
      <div className="vault-header">
        <h1>Document Vault</h1>
        <div className="vault-controls">
          <input
            type="search"
            placeholder="Search documents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="vault-search"
          />
          <input
            type="file"
            id="vault-file-upload"
            multiple
            accept=".pdf,application/pdf"
            onChange={(e) => e.target.files && onFileUpload(e.target.files)}
            style={{ display: 'none' }}
          />
          <label htmlFor="vault-file-upload" className="btn primary upload-btn">
            📁 Upload Documents
          </label>
          {/* Overflow menu for admin actions */}
          <div className="overflow-menu-container">
            <button
              className="overflow-menu-btn"
              onClick={() => setShowOverflowMenu(!showOverflowMenu)}
              title="More actions"
            >
              ⋮
            </button>
            {showOverflowMenu && (
              <div className="overflow-menu">
                <button
                  className="overflow-menu-item"
                  onClick={() => {
                    setShowOverflowMenu(false);
                    setShowReprocessAllDialog(true);
                  }}
                  disabled={isBatchProcessing || uploadedFiles.filter(f => f.type.includes('pdf')).length === 0}
                >
                  📄 Re-process all documents
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="vault-layout">
        <aside className="vault-sidebar">
          <h3>Bundle Sections</h3>
          {categories.map((cat) => (
            <button
              key={cat.id}
              className={`nav-btn ${filter === cat.id ? 'active' : ''}`}
              onClick={() => setFilter(cat.id)}
            >
              <span className="nav-icon">{cat.icon}</span>
              <span className="nav-label">{cat.label}</span>
              <span className="nav-count">{sectionCounts[cat.id] || 0}</span>
            </button>
          ))}
        </aside>

        <div className="document-list">
          {processedFiles.length === 0 ? (
            <div className="empty-vault">
              {uploadedFiles.length === 0 ? (
                <div className="empty-vault-guide">
                  <h3>Get started with your case files</h3>
                  <div className="guide-steps">
                    <div className="guide-step">
                      <span className="guide-step-number">1</span>
                      <div>
                        <strong>Upload your court documents</strong>
                        <p>Add PDF files from your case — orders, statements, reports</p>
                      </div>
                    </div>
                    <div className="guide-step">
                      <span className="guide-step-number">2</span>
                      <div>
                        <strong>Organise by section and fill in metadata</strong>
                        <p>Categorise documents and add dates, references, and descriptions</p>
                      </div>
                    </div>
                    <div className="guide-step">
                      <span className="guide-step-number">3</span>
                      <div>
                        <strong>Create a court bundle for your hearing</strong>
                        <p>Generate a professional PDF bundle with index and page numbers</p>
                      </div>
                    </div>
                  </div>
                  <label className="upload-prompt" style={{ marginTop: 'var(--spacing-lg)' }}>
                    <input
                      type="file"
                      multiple
                      accept=".pdf,application/pdf"
                      onChange={(e) => e.target.files && onFileUpload(e.target.files)}
                      style={{ display: 'none' }}
                    />
                    <span className="btn primary btn-lg">Upload Documents</span>
                  </label>
                </div>
              ) : (
                <>
                  <h3>No documents found</h3>
                  <p>No documents match your current filter or search criteria</p>
                </>
              )}
            </div>
          ) : (
            <div className="documents-list">
              {processedFiles.map((file) => {
                const section = sections.find(s => s.id === file.section);
                const sectionLabel = section?.label || 'Uncategorized';
                const categoryIcon = categories.find(c => c.id === file.section)?.icon || '📄';
                const status = getDocumentStatus(file);

                return (
                  <div key={file.id} className="document-row">
                    <div className="doc-icon">
                      {file.type.includes('pdf') ? '📑' : file.type.includes('image') ? '🖼️' : '📄'}
                    </div>
                    <div className="doc-content">
                      <div className="doc-title-line">
                        <div className="doc-title-with-indicators">
                          <span className="doc-title">{file.name}</span>
                          <span
                            className={`status-indicator ${status.className}`}
                            title={status.title}
                          >
                            {status.label}
                          </span>
                        </div>
                        <div className="doc-section-indicator">
                          <span className="section-icon">{categoryIcon}</span>
                          <span className="section-label">{sectionLabel}</span>
                        </div>
                      </div>
                      <div className="doc-subtitle">
                        {file.description && (
                          <span className="doc-description">{file.description}</span>
                        )}
                        {(file.judgeName || file.orderReference || file.date) && (
                          <span className="doc-metadata-inline">
                            {file.judgeName && <span>Judge: {file.judgeName}</span>}
                            {file.orderReference && <span> · Ref: {file.orderReference}</span>}
                            {file.date && <span> · {formatStoredDate(file.date)}</span>}
                          </span>
                        )}
                        <span className="doc-added-date">Added {formatStoredDate(file.addedDate)}</span>
                      </div>
                    </div>
                    <div className="doc-actions-inline">
                      {file.type.includes('pdf') && (
                        <button
                          className="link-btn"
                          onClick={() => handleViewClick(file)}
                          title="View and select pages for bundle"
                        >
                          Page Select
                        </button>
                      )}
                      <button
                        className="link-btn"
                        onClick={() => handleEditClick(file)}
                      >
                        Edit
                      </button>
                      <button
                        className={`link-btn danger ${deletingFileId === file.id ? 'deleting' : ''}`}
                        onClick={() => file.id && handleDeleteClick(file.id, file.name)}
                        disabled={deletingFileId === file.id}
                      >
                        {deletingFileId === file.id ? 'Deleting...' : 'Delete'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      <FilePreviewModal
        file={editingFile}
        isOpen={isEditModalOpen}
        onClose={handleEditClose}
        onSave={handleEditSave}
        onDelete={onFileDelete}
        vaultType={currentVault}
      />

      {/* Page Pruning Modal */}
      <PagePruneModal
        file={pageViewFile}
        isOpen={isPagePruneModalOpen}
        onClose={handlePagePruneClose}
        onSave={handlePagePruneSave}
      />

      {/* Re-process ALL Confirmation Dialog */}
      {showReprocessAllDialog && (
        <div className="modal-overlay" onClick={() => setShowReprocessAllDialog(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Re-process All Documents</h3>
              <button className="close-btn" onClick={() => setShowReprocessAllDialog(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="ocr-all-info">
                {(() => {
                  const totalPdfs = uploadedFiles.filter(f => f.type.includes('pdf')).length;
                  const missingPageCounts = uploadedFiles.filter(f => f.type.includes('pdf') && (!f.totalPages || f.totalPages === 0)).length;
                  const alreadyProcessed = totalPdfs - missingPageCounts;

                  return (
                    <>
                      <p><strong>Found {totalPdfs} PDF documents:</strong></p>
                      <ul>
                        {missingPageCounts > 0 && <li>{missingPageCounts} documents need page count extraction</li>}
                        {alreadyProcessed > 0 && <li>{alreadyProcessed} documents already have page counts (will be skipped)</li>}
                        <li>Update database with correct totalPages values</li>
                        <li>Fix bundle index page numbering and navigation</li>
                      </ul>
                      <div className={missingPageCounts > 0 ? "info-box" : "success-box"}>
                        <p><strong>{missingPageCounts > 0 ? "Purpose:" : "Status:"}</strong></p>
                        {missingPageCounts > 0 ? (
                          <>
                            <p>This fixes bundle index page numbering issues by ensuring all documents have accurate page counts stored in the database.</p>
                            <p>Processing is fast - typically 1-2 seconds per document. Only documents without page counts will be processed.</p>
                          </>
                        ) : (
                          <p>All PDF documents already have page counts. No reprocessing needed!</p>
                        )}
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
            <div className="modal-footer">
              <button
                onClick={() => setShowReprocessAllDialog(false)}
                className="btn secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleBatchReprocessStart}
                className="btn primary"
              >
                Start Reprocessing
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Batch Processing Progress Modal */}
      {isBatchProcessing && (
        <div className="modal-overlay">
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Processing Documents</h3>
            </div>
            <div className="modal-body">
              <div className="batch-progress">
                <div className="progress-info">
                  <p><strong>Processing:</strong> {batchProgress.currentFile}</p>
                  <p><strong>Progress:</strong> {batchProgress.current} of {batchProgress.total} files</p>
                </div>
                <div className="progress-bar-container">
                  <div
                    className="progress-bar"
                    style={{
                      width: `${batchProgress.total > 0 ? (batchProgress.current / batchProgress.total) * 100 : 0}%`
                    }}
                  />
                </div>
                <div className="progress-percentage">
                  {batchProgress.total > 0 ? Math.round((batchProgress.current / batchProgress.total) * 100) : 0}%
                </div>
                <p className="processing-note">
                  Extracting page counts... Please wait.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DocumentVault;
