import React, { useState, useCallback } from 'react';
import { StoredFile } from '../services/indexedDBService';
import { VaultType } from '../types/vault';
import FileUpload from './FileUpload';
import { getSuggestedSection } from '../services/documentParser';
import vaultService from '../services/vaultService';
import SimpleOrganizeModal from './SimpleOrganizeModal';

interface DashboardProps {
  uploadedFiles: StoredFile[];
  onFileUpload: (files: FileList) => void;
  onQuickOrganize: (fileId: number, section: string, vaultType: VaultType) => void;
  currentVault: VaultType;
  onNavigateToImport?: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ uploadedFiles, onFileUpload, onQuickOrganize, currentVault, onNavigateToImport }) => {
  const [selectedFile, setSelectedFile] = useState<StoredFile | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  // Filter only uncategorized files (those without a section)
  const uncategorizedFiles = uploadedFiles.filter(file => 
    !(file as any).section || (file as any).section === 'uncategorized'
  );

  console.log(`📊 Dashboard: ${uploadedFiles.length} total files, ${uncategorizedFiles.length} uncategorized files`);
  console.log('Uncategorized files:', uncategorizedFiles.map(f => ({ name: f.name, section: (f as any).section })));

  const handleSectionChange = useCallback((file: StoredFile, section: string) => {
    if (file.id && section !== 'uncategorized') {
      onQuickOrganize(file.id, section, currentVault);
    }
  }, [onQuickOrganize, currentVault]);

  const getSuggestedSectionForFile = useCallback((file: StoredFile): string => {
    return getSuggestedSection(file.name, currentVault);
  }, [currentVault]);

  const getConfidenceLevel = (filename: string): 'high' | 'medium' | 'low' => {
    const lowerName = filename.toLowerCase();
    
    // High confidence indicators - these should auto-assign
    const highConfidencePatterns = [
      { keywords: ['order', 'judgment', 'decree', 'ruling'], section: 'orders' },
      { keywords: ['application', 'c100', 'fl401', 'form a', 'form e', 'transcript', 'hearing'], section: 'orders' },
      { keywords: ['cafcass', 'social services report', 'expert report'], section: 'experts' }
    ];
    
    for (const pattern of highConfidencePatterns) {
      if (pattern.keywords.some(keyword => lowerName.includes(keyword))) {
        return 'high';
      }
    }
    
    // Medium confidence - show suggestion but let user decide
    const mediumConfidencePatterns = [
      'statement', 'affidavit', 'witness', 'position statement'
    ];
    
    if (mediumConfidencePatterns.some(keyword => lowerName.includes(keyword))) {
      return 'medium';
    }
    
    return 'low';
  };

  // Auto-assign high-confidence files immediately after upload
  React.useEffect(() => {
    uncategorizedFiles.forEach(file => {
      const confidence = getConfidenceLevel(file.name);
      if (confidence === 'high') {
        const suggestedSection = getSuggestedSectionForFile(file);
        console.log(`🎯 Auto-assigning "${file.name}" to section "${suggestedSection}" (high confidence)`);
        handleSectionChange(file, suggestedSection);
      }
    });
  }, [uncategorizedFiles, getSuggestedSectionForFile, handleSectionChange]); // Run when new files are added

  const sections = vaultService.getVaultSections(currentVault);

  const handlePreviewFile = (file: StoredFile) => {
    setSelectedFile(file);
    setIsPreviewOpen(true);
  };

  const handlePreviewClose = () => {
    setIsPreviewOpen(false);
    setSelectedFile(null);
  };

  const handlePreviewSave = (fileId: number, section: string, vaultType: VaultType) => {
    onQuickOrganize(fileId, section, vaultType);
    setIsPreviewOpen(false);
    setSelectedFile(null);
  };


  return (
    <div className="dashboard">
      <h1>Welcome to Your Case Files</h1>
      
      <div className="filing-cabinet">
        <FileUpload onFileUpload={onFileUpload} />
        
        {onNavigateToImport && (
          <div className="import-section">
            <div className="import-card">
              <div className="import-icon">📂</div>
              <div className="import-content">
                <h3>Already Organized?</h3>
                <p>Import files from folders like "Section A", "Orders", "Statements", etc.</p>
                <button 
                  className="import-btn"
                  onClick={onNavigateToImport}
                >
                  📂 Import Organized Folder
                </button>
              </div>
            </div>
          </div>
        )}
        
        <div className="recent-files">
          <h2>Uncategorized Documents</h2>
          <p className="section-subtitle">Select a section to organize each document</p>
          
          {uncategorizedFiles.length === 0 ? (
            <p className="empty-state">No uncategorized files. Drag and drop your documents above to get started.</p>
          ) : (
            <div className="file-list">
              {uncategorizedFiles
                .filter(file => getConfidenceLevel(file.name) !== 'high') // Only show files that weren't auto-assigned
                .map((file) => {
                  const suggestedSection = getSuggestedSectionForFile(file);
                  const suggestedSectionLabel = sections.find(s => s.id === suggestedSection)?.label || 'Other Documents';
                  const confidence = getConfidenceLevel(file.name);
                  
                  return (
                    <div key={file.id} className="file-item">
                      <div className="file-info">
                        <div className="file-icon">
                          {file.type.includes('pdf') ? '📑' : file.type.includes('image') ? '🖼️' : '📄'}
                        </div>
                        <div className="file-details">
                          <h4>{file.name}</h4>
                          <p className="file-suggestion">
                            {confidence === 'medium' ? '💡 Suggested: ' : '❓ Maybe: '}
                            {suggestedSectionLabel}
                          </p>
                        </div>
                      </div>
                      <div className="file-organize">
                        <div className="organize-controls">
                          <select 
                            className="section-dropdown"
                            defaultValue={confidence === 'medium' ? suggestedSection : 'uncategorized'}
                            onChange={(e) => handleSectionChange(file, e.target.value)}
                          >
                            <option value="uncategorized">Select section...</option>
                            {sections.map(section => (
                              <option key={section.id} value={section.id}>
                                {section.label}
                              </option>
                            ))}
                          </select>
                          <button 
                            className="preview-btn"
                            onClick={() => handlePreviewFile(file)}
                            title="Take a closer look at this document"
                          >
                            👁️ Take a Closer Look
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>

        <div className="organized-summary">
          <h3>Your Document Vault</h3>
          <div className="vault-stats">
            <div className="stat-card">
              <span className="stat-icon">📋</span>
              <div className="stat-info">
                <span className="stat-number">{uploadedFiles.filter(f => (f as any).section === 'preliminary').length}</span>
                <span className="stat-label">Preliminary Docs</span>
              </div>
            </div>
            <div className="stat-card">
              <span className="stat-icon">⚖️</span>
              <div className="stat-info">
                <span className="stat-number">{uploadedFiles.filter(f => (f as any).section === 'orders').length}</span>
                <span className="stat-label">Court Documents</span>
              </div>
            </div>
            <div className="stat-card">
              <span className="stat-icon">📝</span>
              <div className="stat-info">
                <span className="stat-number">{uploadedFiles.filter(f => (f as any).section === 'statements').length}</span>
                <span className="stat-label">Statements</span>
              </div>
            </div>
            <div className="stat-card">
              <span className="stat-icon">📄</span>
              <div className="stat-info">
                <span className="stat-number">{uploadedFiles.length}</span>
                <span className="stat-label">Total Documents</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <SimpleOrganizeModal
        file={selectedFile}
        isOpen={isPreviewOpen}
        onClose={handlePreviewClose}
        onSave={handlePreviewSave}
        currentVault={currentVault}
      />
    </div>
  );
};

export default Dashboard;