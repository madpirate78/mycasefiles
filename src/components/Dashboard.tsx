import React, { useState } from 'react';
import { StoredFile } from '../services/indexedDBService';
import { VaultType } from '../types/vault';
import FileUpload from './FileUpload';
import FilePreviewModal, { FileMetadata } from './FilePreviewModal';

interface DashboardProps {
  uploadedFiles: StoredFile[];
  onFileUpload: (files: FileList) => void;
  onFileUpdate: (fileId: number, metadata: FileMetadata) => void;
  currentVault: VaultType;
}

const Dashboard: React.FC<DashboardProps> = ({ uploadedFiles, onFileUpload, onFileUpdate, currentVault }) => {
  const [selectedFile, setSelectedFile] = useState<StoredFile | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Filter only uncategorized files (those without a section)
  const uncategorizedFiles = uploadedFiles.filter(file => 
    !(file as any).section || (file as any).section === 'uncategorized'
  );

  console.log(`📊 Dashboard: ${uploadedFiles.length} total files, ${uncategorizedFiles.length} uncategorized files`);
  console.log('Uncategorized files:', uncategorizedFiles.map(f => ({ name: f.name, section: (f as any).section })));

  const handleFileClick = (file: StoredFile) => {
    setSelectedFile(file);
    setIsModalOpen(true);
  };

  const handleSaveMetadata = (fileId: number, metadata: FileMetadata) => {
    onFileUpdate(fileId, metadata);
    setIsModalOpen(false);
    setSelectedFile(null);
  };

  return (
    <div className="dashboard">
      <h1>Welcome to Your Case Files</h1>
      
      <div className="filing-cabinet">
        <FileUpload onFileUpload={onFileUpload} />
        
        <div className="recent-files">
          <h2>Uncategorized Documents</h2>
          <p className="section-subtitle">Click on a document to organize it into the correct section</p>
          
          {uncategorizedFiles.length === 0 ? (
            <p className="empty-state">No uncategorized files. Drag and drop your documents above to get started.</p>
          ) : (
            <div className="file-carousel">
              {uncategorizedFiles.map((file) => (
                <div 
                  key={file.id} 
                  className="file-card clickable"
                  onClick={() => handleFileClick(file)}
                >
                  <div className="file-icon">
                    {file.type.includes('pdf') ? '📑' : file.type.includes('image') ? '🖼️' : '📄'}
                  </div>
                  <div className="file-info">
                    <h4>{file.name}</h4>
                    <p className="file-status">⚠️ Needs organization</p>
                  </div>
                  <div className="organize-hint">
                    Click to organize →
                  </div>
                </div>
              ))}
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
                <span className="stat-number">{uploadedFiles.filter(f => (f as any).section === 'applications').length}</span>
                <span className="stat-label">Orders</span>
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

      <div className="quick-actions">
        <h3>Quick Actions</h3>
        <button className="action-btn primary">
          <span className="action-icon">➕</span>
          Create New Bundle
        </button>
        <button className="action-btn">
          <span className="action-icon">📧</span>
          Import Emails
        </button>
      </div>

      <FilePreviewModal
        file={selectedFile}
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedFile(null);
        }}
        onSave={handleSaveMetadata}
        vaultType={currentVault}
      />
    </div>
  );
};

export default Dashboard;