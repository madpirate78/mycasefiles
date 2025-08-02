import React, { useState, useMemo } from 'react';
import { StoredFile } from '../services/indexedDBService';
import { formatStoredDate } from '../utils/dateUtils';
import { VaultType } from '../types/vault';
import vaultService from '../services/vaultService';
import FilePreviewModal, { FileWithOCR } from './FilePreviewModal';
import PagePruneModal from './PagePruneModal';

interface DocumentVaultProps {
  uploadedFiles: StoredFile[];
  onFileUpload: (files: FileList) => void;
  onFileDelete?: (fileId: number) => void;
  onFileEdit?: (fileId: number, metadata: FileWithOCR) => void;
  onFileUpdate?: (fileId: number, selectedPages: number[], totalPages: number) => void;
  currentVault: VaultType;
}

interface ExtendedFile extends StoredFile {
  section?: string;
  description?: string;
  judgeName?: string;
  orderReference?: string;
  date?: string;
}

const DocumentVault: React.FC<DocumentVaultProps> = ({ uploadedFiles, onFileUpload, onFileDelete, onFileEdit, onFileUpdate, currentVault }) => {
  const [filter, setFilter] = useState('all');
  const [sortBy, setSortBy] = useState('date');
  const [searchQuery, setSearchQuery] = useState('');
  const [deletingFileId, setDeletingFileId] = useState<number | null>(null);
  const [editingFile, setEditingFile] = useState<StoredFile | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [pageViewFile, setPageViewFile] = useState<StoredFile | null>(null);
  const [isPagePruneModalOpen, setIsPagePruneModalOpen] = useState(false);

  // Get vault-specific sections
  const sections = vaultService.getVaultSections(currentVault);

  const handleDeleteClick = (fileId: number, fileName: string) => {
    if (window.confirm(`Are you sure you want to delete "${fileName}"?\n\nThis action cannot be undone.`)) {
      setDeletingFileId(fileId);
      if (onFileDelete) {
        onFileDelete(fileId);
      }
      // Reset deleting state after a short delay
      setTimeout(() => setDeletingFileId(null), 500);
    }
  };

  const handleEditClick = (file: StoredFile) => {
    setEditingFile(file);
    setIsEditModalOpen(true);
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
    // Only open page prune modal for PDF files
    if (file.type.includes('pdf')) {
      setPageViewFile(file);
      setIsPagePruneModalOpen(true);
    } else {
      // For non-PDF files, could show a different viewer or download
      console.log('Viewing non-PDF file:', file.name);
      // TODO: Implement non-PDF file viewing
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

  // Filter and sort files
  const processedFiles = useMemo(() => {
    let files = uploadedFiles as ExtendedFile[];

    // Filter by section
    if (filter !== 'all') {
      files = files.filter(file => file.section === filter);
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      files = files.filter(file => 
        file.name.toLowerCase().includes(query) ||
        file.description?.toLowerCase().includes(query) ||
        file.judgeName?.toLowerCase().includes(query) ||
        file.orderReference?.toLowerCase().includes(query)
      );
    }

    // Sort files
    files = [...files].sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'type':
          return a.type.localeCompare(b.type);
        case 'section':
          return (a.section || 'other').localeCompare(b.section || 'other');
        case 'date':
        default:
          // Sort by added date (newest first)
          const dateA = a.addedDate ? new Date(a.addedDate).getTime() : 0;
          const dateB = b.addedDate ? new Date(b.addedDate).getTime() : 0;
          return dateB - dateA;
      }
    });

    return files;
  }, [uploadedFiles, filter, sortBy, searchQuery]);

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
    { id: 'all', label: 'All Documents', icon: '📚' },
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
      return {
        id: section.id,
        label: section.label,
        icon: iconMap[section.id] || '📄'
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
          <select 
            value={sortBy} 
            onChange={(e) => setSortBy(e.target.value)}
            className="sort-select"
          >
            <option value="date">Sort by Date</option>
            <option value="name">Sort by Name</option>
            <option value="type">Sort by Type</option>
            <option value="section">Sort by Section</option>
          </select>
        </div>
      </div>

      <div className="vault-layout">
        <aside className="filter-sidebar">
          <h3>Bundle Sections</h3>
          <p className="section-hint">Documents are organized by court bundle sections</p>
          {categories.map((cat) => (
            <button
              key={cat.id}
              className={`filter-btn ${filter === cat.id ? 'active' : ''}`}
              onClick={() => setFilter(cat.id)}
            >
              <span className="filter-icon">{cat.icon}</span>
              <span className="filter-label">{cat.label}</span>
              <span className="filter-count">{sectionCounts[cat.id] || 0}</span>
            </button>
          ))}
        </aside>

        <div className="document-list">
          {processedFiles.length === 0 ? (
            <div className="empty-vault">
              {uploadedFiles.length === 0 ? (
                <>
                  <h3>Your vault is empty</h3>
                  <p>Upload documents to start organizing your case files</p>
                  <label className="upload-prompt">
                    <input
                      type="file"
                      multiple
                      onChange={(e) => e.target.files && onFileUpload(e.target.files)}
                      style={{ display: 'none' }}
                    />
                    <span className="btn primary">Upload Documents</span>
                  </label>
                </>
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
                
                return (
                  <div key={file.id} className="document-row">
                    <div className="doc-icon">
                      {file.type.includes('pdf') ? '📑' : file.type.includes('image') ? '🖼️' : '📄'}
                    </div>
                    <div className="doc-content">
                      <div className="doc-title-line">
                        <div className="doc-title-with-indicators">
                          <a href="#" className="doc-title">{file.name}</a>
                          <div className="doc-status-indicators">
                            {/* Page selection indicator */}
                            {file.selectedPages && file.selectedPages.length > 0 && file.totalPages && (
                              <span 
                                className="status-indicator page-selection"
                                title={`${file.selectedPages.length}/${file.totalPages} pages selected`}
                              >
                                📄 {file.selectedPages.length}/{file.totalPages}
                              </span>
                            )}
                            {/* Metadata populated indicator */}
                            {(file.judgeName || file.orderReference || file.courtReference || file.personName) && (
                              <span 
                                className="status-indicator metadata-filled"
                                title="Metadata populated"
                              >
                                ✓
                              </span>
                            )}
                            {/* OCR performed indicator */}
                            {file.ocrPerformed && (
                              <span 
                                className="status-indicator ocr-performed"
                                title="OCR text extracted"
                              >
                                🔍
                              </span>
                            )}
                          </div>
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
                            {file.orderReference && <span> • Ref: {file.orderReference}</span>}
                            {file.date && <span> • {formatStoredDate(file.date)}</span>}
                          </span>
                        )}
                        <span className="doc-added-date">Added {formatStoredDate(file.addedDate)}</span>
                      </div>
                    </div>
                    <div className="doc-actions-inline">
                      <button 
                        className="link-btn"
                        onClick={() => handleViewClick(file)}
                        title={file.type.includes('pdf') ? 'View and select pages for bundle' : 'View document'}
                      >
                        {file.type.includes('pdf') ? 'Page Select' : 'View'}
                      </button>
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
        vaultType={currentVault}
      />

      {/* Page Pruning Modal */}
      <PagePruneModal
        file={pageViewFile}
        isOpen={isPagePruneModalOpen}
        onClose={handlePagePruneClose}
        onSave={handlePagePruneSave}
      />
    </div>
  );
};

export default DocumentVault;