import React, { useState, useEffect } from 'react';
import { StoredFile } from '../services/indexedDBService';
import bundleService, { Bundle } from '../services/bundleService';
import { formatStoredDate } from '../utils/dateUtils';
import vaultService from '../services/vaultService';
import bundleGenerationService from '../services/bundleGenerationService';

interface BundleListProps {
  uploadedFiles: StoredFile[];
}

const BundleList: React.FC<BundleListProps> = ({ uploadedFiles }) => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [editingBundle, setEditingBundle] = useState<Bundle | null>(null);
  const [verifyingBundle, setVerifyingBundle] = useState<Bundle | null>(null);
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [selectedDocuments, setSelectedDocuments] = useState<number[]>([]);
  const [bundleProgress, setBundleProgress] = useState<any>(null);
  const [newBundleData, setNewBundleData] = useState({
    name: '',
    caseReference: '',
    hearingDate: '',
    court: ''
  });
  const [editBundleData, setEditBundleData] = useState({
    name: '',
    caseReference: '',
    hearingDate: '',
    court: ''
  });

  // Load bundles on component mount
  useEffect(() => {
    loadBundles();
  }, []);

  const loadBundles = async () => {
    try {
      console.log('Loading bundles...');
      const allBundles = await bundleService.getAllBundles();
      console.log('Loaded bundles:', allBundles);
      setBundles(allBundles);
    } catch (error) {
      console.error('Error loading bundles:', error);
    }
  };

  const handleCreateBundle = async () => {
    try {
      console.log('Creating bundle with data:', newBundleData);
      console.log('Bundle name length:', newBundleData.name.trim().length);
      
      if (!newBundleData.name.trim()) {
        alert('Bundle name is required');
        return;
      }
      
      console.log('Calling bundleService.createBundle...');
      const createdBundle = await bundleService.createBundle(newBundleData);
      console.log('Bundle created successfully:', createdBundle);
      
      setShowCreateModal(false);
      // Reset form
      setNewBundleData({
        name: '',
        caseReference: '',
        hearingDate: '',
        court: ''
      });
      
      console.log('Reloading bundles...');
      await loadBundles();
      console.log('Bundles reloaded');
    } catch (error) {
      console.error('Error creating bundle:', error);
      console.error('Error details:', error instanceof Error ? error.message : 'Unknown error', error instanceof Error ? error.stack : '');
      alert('Failed to create bundle. Please try again. Check console for details.');
    }
  };

  const handleEditBundle = (bundle: Bundle) => {
    setEditingBundle(bundle);
    setEditBundleData({
      name: bundle.name,
      caseReference: bundle.caseReference || '',
      hearingDate: bundle.hearingDate || '',
      court: bundle.court || ''
    });
    setShowEditModal(true);
  };

  const handleUpdateBundle = async () => {
    if (!editingBundle) return;
    
    try {
      console.log('Updating bundle with data:', editBundleData);
      
      if (!editBundleData.name.trim()) {
        alert('Bundle name is required');
        return;
      }
      
      console.log('Calling bundleService.updateBundle...');
      await bundleService.updateBundle(editingBundle.id!, editBundleData);
      console.log('Bundle updated successfully');
      
      setShowEditModal(false);
      setEditingBundle(null);
      // Reset form
      setEditBundleData({
        name: '',
        caseReference: '',
        hearingDate: '',
        court: ''
      });
      
      console.log('Reloading bundles...');
      await loadBundles();
      console.log('Bundles reloaded');
    } catch (error) {
      console.error('Error updating bundle:', error);
      console.error('Error details:', error instanceof Error ? error.message : 'Unknown error', error instanceof Error ? error.stack : '');
      alert('Failed to update bundle. Please try again. Check console for details.');
    }
  };

  const handleVerifyDocuments = (bundle: Bundle) => {
    setVerifyingBundle(bundle);
    
    // If bundle has no existing document selections, default to selecting all PDFs
    if (!bundle.documentIds || bundle.documentIds.length === 0) {
      const allPdfIds = uploadedFiles
        .filter(file => file.type === 'application/pdf' && file.id)
        .map(file => file.id!);
      setSelectedDocuments(allPdfIds);
    } else {
      // Otherwise, use existing selections
      setSelectedDocuments(bundle.documentIds);
    }
    
    setShowVerifyModal(true);
  };

  const handleDocumentToggle = (documentId: number) => {
    setSelectedDocuments(prev => 
      prev.includes(documentId) 
        ? prev.filter(id => id !== documentId)
        : [...prev, documentId]
    );
  };

  const handleSaveDocumentSelection = async () => {
    if (!verifyingBundle) return;
    
    try {
      console.log('Saving document selection:', selectedDocuments);
      await bundleService.updateBundle(verifyingBundle.id!, {
        documentIds: selectedDocuments,
        documentCount: selectedDocuments.length
      });
      
      setShowVerifyModal(false);
      setVerifyingBundle(null);
      setSelectedDocuments([]);
      await loadBundles();
    } catch (error) {
      console.error('Error saving document selection:', error);
      alert('Failed to save document selection. Please try again.');
    }
  };

  // Group uploaded files by section and sort by date
  const getFilesBySection = () => {
    const sections = vaultService.getVaultSections('child'); // Use child vault sections for now
    const filesBySection: Record<string, StoredFile[]> = {};
    
    // Initialize all sections
    sections.forEach(section => {
      filesBySection[section.id] = [];
    });
    
    // Group files by section
    uploadedFiles.forEach(file => {
      const section = file.section || 'other';
      if (filesBySection[section]) {
        filesBySection[section].push(file);
      } else {
        filesBySection['other'].push(file);
      }
    });
    
    // Sort files in each section by date (files with dates first, then files without dates)
    Object.keys(filesBySection).forEach(sectionId => {
      filesBySection[sectionId].sort((a, b) => {
        const aDate = a.date;
        const bDate = b.date;
        
        // Files without dates go to the bottom
        if (!aDate && !bDate) return 0;
        if (!aDate) return 1;
        if (!bDate) return -1;
        
        // Sort by date (most recent first)
        return new Date(bDate).getTime() - new Date(aDate).getTime();
      });
    });
    
    return { sections, filesBySection };
  };

  const handleCreatePDF = async (bundle: Bundle) => {
    try {
      console.log('Creating PDF bundle for:', bundle.name);
      
      if (!bundle.documentIds || bundle.documentIds.length === 0) {
        alert('No documents selected for this bundle. Please verify documents first.');
        return;
      }
      
      // Get the selected documents
      const selectedFiles = uploadedFiles.filter(file => 
        bundle.documentIds!.includes(file.id!)
      );
      
      if (selectedFiles.length === 0) {
        alert('Selected documents not found. Please verify documents again.');
        return;
      }
      
      console.log('Selected files for bundle:', selectedFiles.length);
      
      // Show progress modal
      setShowProgressModal(true);
      setBundleProgress({ stage: 'starting', progress: 0, message: 'Preparing bundle creation...' });
      
      // Setup progress listener
      const cleanup = bundleGenerationService.setupProgressListener((progress) => {
        setBundleProgress(progress);
      });
      
      try {
        // Generate the bundle
        const result = await bundleGenerationService.generateBundle(bundle, selectedFiles);
        
        if (result.success) {
          setBundleProgress({ 
            stage: 'complete', 
            progress: 100, 
            message: `Bundle "${result.filename}" created successfully!` 
          });
          
          // Auto-close progress modal after 2 seconds
          setTimeout(() => {
            setShowProgressModal(false);
            setBundleProgress(null);
          }, 2000);
          
        } else {
          setBundleProgress({ 
            stage: 'error', 
            progress: 0, 
            message: `Error: ${result.error}` 
          });
        }
      } finally {
        cleanup(); // Remove progress listener
      }
      
    } catch (error) {
      console.error('Error creating PDF bundle:', error);
      setBundleProgress({ 
        stage: 'error', 
        progress: 0, 
        message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}` 
      });
    }
  };

  return (
    <div className="bundle-list">
      <div className="bundle-header">
        <h1>Your Bundles</h1>
        <button className="btn primary" onClick={() => setShowCreateModal(true)}>
          <span className="btn-icon">➕</span>
          Create New Bundle
        </button>
      </div>

      {bundles.length === 0 ? (
        <div className="empty-bundles">
          <h3>No bundles created yet</h3>
          <p>Create your first bundle to organize documents for court submission</p>
        </div>
      ) : (
        <div className="bundles-grid">
          {bundles.map((bundle) => (
            <div key={bundle.id} className="bundle-card">
              <div className="bundle-icon">📁</div>
              <div className="bundle-info">
                <h3>{bundle.name}</h3>
                <p className="bundle-meta">
                  {bundle.documentCount} documents • Created {formatStoredDate(bundle.createdDate)}
                  {bundle.caseReference && ` • ${bundle.caseReference}`}
                </p>
                {bundle.court && (
                  <p className="bundle-court">{bundle.court}</p>
                )}
                {bundle.hearingDate && (
                  <p className="bundle-hearing">Hearing: {formatStoredDate(bundle.hearingDate)}</p>
                )}
                <div className="bundle-status">
                  <span className={`status-badge ${bundle.status}`}>
                    {bundle.status === 'completed' ? '✓ Completed' : '📝 Draft'}
                  </span>
                  {bundle.watermarked && (
                    <span className="watermark-badge">
                      Prepared with MyCaseFiles
                    </span>
                  )}
                </div>
              </div>
              <div className="bundle-actions">
                <button className="action-btn" onClick={() => handleEditBundle(bundle)}>Edit Case Details</button>
                <button className="action-btn" onClick={() => handleVerifyDocuments(bundle)}>Verify Documents</button>
                <button className="action-btn" onClick={() => handleCreatePDF(bundle)}>Create PDF</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="pro-upgrade-banner">
        <h4>Remove watermarks with Professional</h4>
        <p>Upgrade to create clean, professional bundles without watermarks</p>
        <button className="btn secondary">Learn More</button>
      </div>

      {/* Create Bundle Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Create New Bundle</h2>
              <button className="close-btn" onClick={() => setShowCreateModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="bundle-form">
                <div className="form-group">
                  <label>Bundle Name *</label>
                  <input
                    type="text"
                    value={newBundleData.name}
                    onChange={(e) => setNewBundleData({...newBundleData, name: e.target.value})}
                    placeholder="e.g., Application Bundle - March 2025"
                    className="form-input"
                    required
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Case Reference</label>
                    <input
                      type="text"
                      value={newBundleData.caseReference}
                      onChange={(e) => setNewBundleData({...newBundleData, caseReference: e.target.value})}
                      placeholder="e.g., AB12C34567"
                      className="form-input"
                    />
                  </div>

                  <div className="form-group">
                    <label>Hearing Date</label>
                    <input
                      type="date"
                      value={newBundleData.hearingDate}
                      onChange={(e) => setNewBundleData({...newBundleData, hearingDate: e.target.value})}
                      className="form-input"
                      lang="en-GB"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Court</label>
                  <input
                    type="text"
                    value={newBundleData.court}
                    onChange={(e) => setNewBundleData({...newBundleData, court: e.target.value})}
                    placeholder="e.g., Central Family Court"
                    className="form-input"
                  />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn secondary" onClick={() => setShowCreateModal(false)}>
                Cancel
              </button>
              <button 
                className="btn primary" 
                onClick={handleCreateBundle}
                disabled={!newBundleData.name.trim()}
              >
                Create Bundle
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Bundle Modal */}
      {showEditModal && editingBundle && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Edit Bundle</h2>
              <button className="close-btn" onClick={() => setShowEditModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="bundle-form">
                <div className="form-group">
                  <label>Bundle Name *</label>
                  <input
                    type="text"
                    value={editBundleData.name}
                    onChange={(e) => setEditBundleData({...editBundleData, name: e.target.value})}
                    placeholder="e.g., Application Bundle - March 2025"
                    className="form-input"
                    required
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Case Reference</label>
                    <input
                      type="text"
                      value={editBundleData.caseReference}
                      onChange={(e) => setEditBundleData({...editBundleData, caseReference: e.target.value})}
                      placeholder="e.g., AB12C34567"
                      className="form-input"
                    />
                  </div>

                  <div className="form-group">
                    <label>Hearing Date</label>
                    <input
                      type="date"
                      value={editBundleData.hearingDate}
                      onChange={(e) => setEditBundleData({...editBundleData, hearingDate: e.target.value})}
                      className="form-input"
                      lang="en-GB"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Court</label>
                  <input
                    type="text"
                    value={editBundleData.court}
                    onChange={(e) => setEditBundleData({...editBundleData, court: e.target.value})}
                    placeholder="e.g., Central Family Court"
                    className="form-input"
                  />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn secondary" onClick={() => setShowEditModal(false)}>
                Cancel
              </button>
              <button 
                className="btn primary" 
                onClick={handleUpdateBundle}
                disabled={!editBundleData.name.trim()}
              >
                Update Bundle
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Verify Documents Modal */}
      {showVerifyModal && verifyingBundle && (
        <div className="modal-overlay" onClick={() => setShowVerifyModal(false)}>
          <div className="modal-content verify-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Verify Documents - {verifyingBundle.name}</h2>
              <button className="close-btn" onClick={() => setShowVerifyModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="document-sections">
                {(() => {
                  const { sections, filesBySection } = getFilesBySection();
                  return sections.map((section, index) => {
                    const sectionFiles = filesBySection[section.id] || [];
                    const sectionLetter = String.fromCharCode(65 + index); // A, B, C, etc.
                    
                    return (
                      <div key={section.id} className="document-section">
                        <div className="section-header">
                          <h3>Section {sectionLetter}: {section.label} <span className="section-count">({sectionFiles.length})</span></h3>
                        </div>
                        <div className="document-list">
                          {sectionFiles.length === 0 ? (
                            <div className="no-documents">No documents in this section</div>
                          ) : (
                            sectionFiles.map(file => (
                              <div key={file.id} className={`document-item ${!file.date ? 'no-date' : ''}`}>
                                <label className="document-checkbox">
                                  <input
                                    type="checkbox"
                                    checked={selectedDocuments.includes(file.id!)}
                                    onChange={() => handleDocumentToggle(file.id!)}
                                  />
                                  <span className="checkmark"></span>
                                  <div className="document-info">
                                    <div className="document-name">{file.displayName || file.name}</div>
                                    <div className="document-meta">
                                      {file.date ? `Date: ${file.date}` : 'No date extracted'}
                                      {file.courtReference && ` • Ref: ${file.courtReference}`}
                                      {file.judgeName && ` • Judge: ${file.judgeName}`}
                                    </div>
                                  </div>
                                </label>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
            <div className="modal-footer">
              <div className="selected-count">
                {selectedDocuments.length} document{selectedDocuments.length !== 1 ? 's' : ''} selected
              </div>
              <button className="btn secondary" onClick={() => setShowVerifyModal(false)}>
                Cancel
              </button>
              <button 
                className="btn primary" 
                onClick={handleSaveDocumentSelection}
              >
                Save Selection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bundle Creation Progress Modal */}
      {showProgressModal && bundleProgress && (
        <div className="modal-overlay">
          <div className="modal-content progress-modal">
            <div className="modal-header">
              <h2>Creating Bundle PDF</h2>
              {bundleProgress.stage === 'error' && (
                <button className="close-btn" onClick={() => setShowProgressModal(false)}>×</button>
              )}
            </div>
            <div className="modal-body">
              <div className="progress-container">
                <div className="progress-bar">
                  <div 
                    className="progress-fill" 
                    style={{ 
                      width: `${bundleProgress.progress}%`,
                      backgroundColor: bundleProgress.stage === 'error' ? '#f44336' : '#4caf50'
                    }}
                  ></div>
                </div>
                <div className="progress-text">
                  {bundleProgress.message}
                </div>
                <div className="progress-percentage">
                  {bundleProgress.progress}%
                </div>
              </div>
              {bundleProgress.stage === 'error' && (
                <div className="error-actions">
                  <button className="btn secondary" onClick={() => setShowProgressModal(false)}>
                    Close
                  </button>
                </div>
              )}
              {bundleProgress.stage === 'complete' && (
                <div className="success-message">
                  ✅ Bundle created successfully! The PDF has been opened in your default PDF viewer.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BundleList;