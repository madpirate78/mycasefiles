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
  const [searchQuery, setSearchQuery] = useState('');
  const [deletingFileId, setDeletingFileId] = useState<number | null>(null);
  const [editingFile, setEditingFile] = useState<StoredFile | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [pageViewFile, setPageViewFile] = useState<StoredFile | null>(null);
  const [isPagePruneModalOpen, setIsPagePruneModalOpen] = useState(false);
  
  // Batch OCR processing state
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

  // Removed batch OCR - now happens automatically on upload
  /* const handleBatchOcrStart_REMOVED = async () => {
    // setShowOcrAllDialog(false); // Removed
    setIsBatchProcessing(true);
    
    const pdfFiles = uploadedFiles.filter(file => file.type.includes('pdf'));
    setBatchProgress({ current: 0, total: pdfFiles.length, currentFile: '' });
    
    console.log(`🚀 Starting batch OCR for ${pdfFiles.length} PDF files`);
    
    for (let i = 0; i < pdfFiles.length; i++) {
      const file = pdfFiles[i];
      setBatchProgress({ current: i + 1, total: pdfFiles.length, currentFile: file.name });
      
      try {
        console.log(`📄 Processing ${i + 1}/${pdfFiles.length}: ${file.name}`);
        
        // Process all files, regardless of previous processing status
        if (file.data) {
          const arrayBuffer = await file.data.arrayBuffer();
          
          try {
            // Get filename suggestions first
            const { getSuggestedMetadata, extractFromPDF } = await import('../../services/documentParser');
            const suggestions = getSuggestedMetadata(file.name, currentVault);
            
            let pdfData: any = null;
            let pdfText = '';
            let isScanned = false;
            let ocrPerformed = false;
            let ocrText = '';
            let ocrConfidence: number | undefined;
            
            // Step 1: Try to extract text via Electron API first
            if (isElectron()) {
              console.log(`🔧 Extracting PDF text via Electron for: ${file.name}`);
              const pdfResult = await parsePDF(arrayBuffer);
              
              if (pdfResult.success && pdfResult.text) {
                pdfText = pdfResult.text;
                const method = (pdfResult as any).extractionMethod || 'PDF_PARSE';
                const textLength = pdfResult.text.length;
                
                // Check if this is likely a scanned PDF
                isScanned = (pdfResult as any).isScanned || 
                           textLength < 50 || 
                           ((pdfResult as any).info?.Producer && (pdfResult as any).info.Producer.includes('EPSON Scan'));
                
                console.log(`📝 Text extracted via ${method}, length: ${textLength}, isScanned: ${isScanned}`);
                
                // Step 2: Run OCR if it's a scanned PDF
                if (isScanned) {
                  console.log(`🔍 Running OCR on scanned PDF: ${file.name}`);
                  setBatchProgress({ 
                    current: i + 1, 
                    total: pdfFiles.length, 
                    currentFile: `${file.name} (OCR processing...)` 
                  });
                  
                  const ocrResult = await ocrPDF(arrayBuffer);
                  if (ocrResult.success && ocrResult.text) {
                    ocrPerformed = true;
                    ocrText = ocrResult.text;
                    ocrConfidence = ocrResult.confidence;
                    pdfText = ocrResult.text; // Use OCR text for parsing
                    console.log(`✅ OCR completed: ${ocrText.length} chars, ${ocrConfidence?.toFixed(1)}% confidence`);
                    
                    // Replace original PDF with searchable version if available
                    if (ocrResult.searchablePdf) {
                      console.log('📝 Replacing original PDF with searchable version');
                      console.log('🔍 Searchable PDF size:', ocrResult.searchablePdf.byteLength, 'bytes');
                      
                      const searchableBlob = new Blob([ocrResult.searchablePdf], { type: 'application/pdf' });
                      const searchableFile = new File([searchableBlob], file.name, { type: 'application/pdf' });
                      
                      // Update the file data with searchable PDF
                      file.data = searchableFile;
                      console.log('✅ File data updated with searchable PDF in memory');
                      
                      // IMPORTANT: We need to update the file in the database with the searchable PDF
                      // This will be done in the metadata update below
                    } else {
                      console.log('⚠️ No searchable PDF returned from OCR');
                    }
                  } else {
                    console.error(`❌ OCR failed for ${file.name}:`, ocrResult.error);
                  }
                }
              }
            }
            
            // Step 3: Extract structured data from the text
            if (pdfText) {
              // Use the text-based extraction with our OCR or extracted text
              const { PDFContentParser } = await import('../../services/documentParser/pdfContentParser');
              const parser = new PDFContentParser();
              pdfData = parser.extractFromText(pdfText);
              console.log(`📊 Extracted data from ${isScanned ? 'OCR' : 'PDF'} text:`, pdfData);
            } else {
              // Fallback to array buffer parsing
              pdfData = await extractFromPDF(arrayBuffer);
              console.log(`📊 Fallback extraction completed:`, pdfData);
            }
            
            // Step 4: Merge all data (filename takes priority)
            const updatedMetadata = {
              ...file,
              section: file.section || suggestions.section || 'other',
              description: file.description || '',
              ...suggestions,
              // Add PDF-extracted data
              courtReference: suggestions.courtReference || (pdfData?.caseNumber ? pdfData.caseNumber : undefined),
              judgeName: suggestions.judgeName || (pdfData?.judgeName ? pdfData.judgeName : undefined),
              personName: suggestions.personName || (pdfData?.personName ? pdfData.personName : undefined),
              // Add auto-population and OCR flags
              autopopulationPerformed: true,
              ocrPerformed: ocrPerformed,
              ocrText: ocrText || undefined,
              ocrConfidence: ocrConfidence,
              ocrDate: ocrPerformed ? new Date().toISOString() : undefined,
              // IMPORTANT: Include the updated file data if OCR created a searchable PDF
              data: file.data
            };
            
            // Step 5: Update the file
            if (onFileEdit && file.id) {
              await onFileEdit(file.id, updatedMetadata);
            }
            
            const status = ocrPerformed ? 'OCR processed' : 'Auto-populated';
            console.log(`✅ ${status}: ${file.name}`);
            
          } catch (error) {
            console.error(`❌ Error processing ${file.name}:`, error);
          }
        }
        
        // Longer delay for OCR processing
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (error) {
        console.error(`❌ Error processing ${file.name}:`, error);
      }
    }
    
    setIsBatchProcessing(false);
    setBatchProgress({ current: 0, total: 0, currentFile: '' });
    console.log('🎉 Batch OCR processing completed');
  }; */

  // Batch reprocess function to extract page counts and basic metadata
  const handleBatchReprocessStart = async () => {
    setShowReprocessAllDialog(false);
    setIsBatchProcessing(true);

    // Filter to only include PDFs that don't already have totalPages
    const pdfFiles = uploadedFiles.filter(file =>
      file.type.includes('pdf') && (!file.totalPages || file.totalPages === 0)
    );
    const totalPdfCount = uploadedFiles.filter(file => file.type.includes('pdf')).length;
    const alreadyProcessed = totalPdfCount - pdfFiles.length;

    setBatchProgress({ current: 0, total: pdfFiles.length, currentFile: '' });

    if (pdfFiles.length === 0) {
      console.log(`✅ All ${totalPdfCount} PDF files already have page counts - nothing to reprocess`);
      setIsBatchProcessing(false);
      setBatchProgress({ current: 0, total: 0, currentFile: '' });
      return;
    }

    console.log(`🚀 Starting batch reprocessing for ${pdfFiles.length} PDF files (${alreadyProcessed} already processed)`);

    for (let i = 0; i < pdfFiles.length; i++) {
      const file = pdfFiles[i];
      setBatchProgress({ current: i + 1, total: pdfFiles.length, currentFile: file.name });

      try {
        console.log(`📄 Reprocessing ${i + 1}/${pdfFiles.length}: ${file.name}`);

        if (file.data && isElectron()) {
          const arrayBuffer = await file.data.arrayBuffer();

          // Extract page count via Electron API
          const result = await extractPageCount(arrayBuffer);

          if (result.success && result.pageCount) {
            console.log(`📄 Extracted ${result.pageCount} pages from ${file.name}`);

            // Update the file with the page count
            if (onFileEdit && file.id) {
              const updatedMetadata = {
                ...file,
                totalPages: result.pageCount
              };
              onFileEdit(file.id, updatedMetadata as any);
            }
          } else {
            console.warn(`⚠️ Could not extract page count from ${file.name}:`, result.error);
          }
        }

        // Short delay between files
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        console.error(`❌ Error reprocessing ${file.name}:`, error);
      }
    }

    setIsBatchProcessing(false);
    setBatchProgress({ current: 0, total: 0, currentFile: '' });
    console.log(`🎉 Batch reprocessing completed - processed ${pdfFiles.length} files, skipped ${alreadyProcessed} already processed`);
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

    // Sort files by date field if available, otherwise by added date (oldest first)
    files = [...files].sort((a, b) => {
      // First priority: use the date field if both files have it
      if (a.date && b.date) {
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        return dateA - dateB; // Oldest first
      }
      
      // If only one has a date field, prioritize it (but still oldest first)
      if (a.date && !b.date) return -1;
      if (!a.date && b.date) return 1;
      
      // Fallback to added date if neither has a date field
      const addedDateA = a.addedDate ? new Date(a.addedDate).getTime() : 0;
      const addedDateB = b.addedDate ? new Date(b.addedDate).getTime() : 0;
      return addedDateA - addedDateB; // Oldest first
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
      
      // Mark important sections for bold styling
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
          <button
            onClick={() => setShowReprocessAllDialog(true)}
            disabled={isBatchProcessing || uploadedFiles.filter(f => f.type.includes('pdf')).length === 0}
            className="btn secondary reprocess-all-btn"
            title="Re-extract page counts and metadata from all PDF documents"
          >
            {isBatchProcessing ? '🔄 Processing...' : '📄 Re-process ALL'}
          </button>
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
                <>
                  <h3>Your vault is empty</h3>
                  <p>Upload documents to start organizing your case files</p>
                  <label className="upload-prompt">
                    <input
                      type="file"
                      multiple
                      accept=".pdf,application/pdf"
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
                          <button className="doc-title link-style" onClick={() => handleEditClick(file)}>{file.name}</button>
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
                            {/* Text PDF processed indicator */}
                            {file.type.includes('pdf') && file.autopopulationPerformed && !file.ocrPerformed && (
                              <span 
                                className="status-indicator text-pdf-processed"
                                title="Text PDF processed - auto-populated from content"
                              >
                                ✅
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

      {/* OCR ALL Dialog Removed - OCR now happens automatically on upload */}
      {false && (
        <div className="modal-overlay" onClick={() => {}}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>🔍 OCR ALL Documents</h3>
              <button className="close-btn" onClick={() => {}}>×</button>
            </div>
            <div className="modal-body">
              <div className="ocr-all-info">
                <p><strong>This will process {uploadedFiles.filter(f => f.type.includes('pdf')).length} PDF documents:</strong></p>
                <ul>
                  <li>📄 Extract text from text-based PDFs</li>
                  <li>🔍 Run OCR on scanned PDFs to extract readable text</li>
                  <li>⚖️ Auto-populate metadata from filename and PDF content</li>
                  <li>📝 Extract court references, judge names, and document types</li>
                  <li>✅ Update visual indicators and processing status</li>
                </ul>
                <div className="warning-box">
                  <p><strong>⚠️ Important:</strong></p>
                  <p>OCR processing can take 10-15 seconds per scanned document. Text PDFs will process much faster.</p>
                  <p>Automatic extraction may make mistakes - always review and verify extracted information, especially court references and legal details.</p>
                  <p>This will reprocess ALL PDFs, even previously processed ones.</p>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button 
                onClick={() => {}}
                className="btn secondary"
              >
                Cancel
              </button>
              <button 
                onClick={() => {}}
                className="btn primary"
              >
                🚀 Start OCR Processing
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Re-process ALL Confirmation Dialog */}
      {showReprocessAllDialog && (
        <div className="modal-overlay" onClick={() => setShowReprocessAllDialog(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>📄 Re-process ALL Documents</h3>
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
                        {missingPageCounts > 0 && <li>📄 {missingPageCounts} documents need page count extraction</li>}
                        {alreadyProcessed > 0 && <li>✅ {alreadyProcessed} documents already have page counts (will be skipped)</li>}
                        <li>🔢 Update database with correct totalPages values</li>
                        <li>🔗 Fix bundle index page numbering and navigation</li>
                        <li>⚡ Quick processing - no OCR required</li>
                      </ul>
                      <div className={missingPageCounts > 0 ? "info-box" : "success-box"}>
                        <p><strong>{missingPageCounts > 0 ? "ℹ️ Purpose:" : "✅ Status:"}</strong></p>
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
                🚀 Start Reprocessing
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
              <h3>🔄 Processing Documents</h3>
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
                  🔍 Running OCR and auto-population... Please wait.
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