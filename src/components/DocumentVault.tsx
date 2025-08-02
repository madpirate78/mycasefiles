import React, { useState } from 'react';
import { StoredFile } from '../services/indexedDBService';
import { formatStoredDate } from '../utils/dateUtils';
import { VaultType } from '../types/vault';
import vaultService from '../services/vaultService';

interface DocumentVaultProps {
  uploadedFiles: StoredFile[];
  onFileUpload: (files: FileList) => void;
  currentVault: VaultType;
}

const DocumentVault: React.FC<DocumentVaultProps> = ({ uploadedFiles, onFileUpload, currentVault }) => {
  const [filter, setFilter] = useState('all');
  const [sortBy, setSortBy] = useState('date');

  // Get vault-specific sections
  const sections = vaultService.getVaultSections(currentVault);
  
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
          <select 
            value={sortBy} 
            onChange={(e) => setSortBy(e.target.value)}
            className="sort-select"
          >
            <option value="date">Sort by Date</option>
            <option value="name">Sort by Name</option>
            <option value="type">Sort by Type</option>
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
              <span className="filter-count">{uploadedFiles.length}</span>
            </button>
          ))}
        </aside>

        <div className="document-list">
          {uploadedFiles.length === 0 ? (
            <div className="empty-vault">
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
            </div>
          ) : (
            uploadedFiles.map((file) => (
              <div key={file.id} className="document-item">
                <div className="doc-thumbnail">
                  {file.type.includes('pdf') ? '📑' : file.type.includes('image') ? '🖼️' : '📄'}
                </div>
                <div className="doc-details">
                  <h4>{file.name}</h4>
                  <p className="doc-description">{(file as any).description || 'No description available'}</p>
                  <p className="doc-meta">Added on {formatStoredDate(file.addedDate) || 'Unknown date'}</p>
                </div>
                <div className="doc-actions">
                  <button className="action-btn small">Add to Bundle</button>
                  <button className="action-btn small">View</button>
                  <button className="action-btn small danger">Delete</button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default DocumentVault;