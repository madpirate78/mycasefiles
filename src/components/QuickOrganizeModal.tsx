import React, { useState, useEffect } from 'react';
import { StoredFile } from '../services/indexedDBService';
import { getSuggestedSection, detectVaultType } from '../services/documentParser';
import { VaultType } from '../types/vault';
import vaultService from '../services/vaultService';

interface QuickOrganizeModalProps {
  file: StoredFile | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (fileId: number, section: string, vaultType: VaultType) => void;
  currentVault: VaultType;
}

const QuickOrganizeModal: React.FC<QuickOrganizeModalProps> = ({ 
  file, 
  isOpen, 
  onClose, 
  onSave, 
  currentVault 
}) => {
  const [selectedSection, setSelectedSection] = useState<string>('other');
  const [selectedVaultType, setSelectedVaultType] = useState<VaultType>(currentVault);

  // Auto-detect section and vault type when file changes
  useEffect(() => {
    if (file) {
      console.log('🚀 Quick organizing file:', file.name);
      
      // Auto-detect vault type
      const detectedVaultType = detectVaultType(file.name);
      const finalVaultType = detectedVaultType || currentVault;
      setSelectedVaultType(finalVaultType);
      
      // Auto-detect section
      const suggestedSection = getSuggestedSection(file.name, finalVaultType);
      setSelectedSection(suggestedSection);
      
      console.log('📂 Auto-detected:', { 
        vaultType: finalVaultType, 
        section: suggestedSection 
      });
    }
  }, [file, currentVault]);

  const sections = vaultService.getVaultSections(selectedVaultType);

  if (!isOpen || !file) return null;

  const handleSave = () => {
    if (file?.id) {
      onSave(file.id, selectedSection, selectedVaultType);
      onClose();
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="quick-organize-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>📂 Organize File</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="file-info">
          <div className="file-icon">📄</div>
          <div className="file-details">
            <h3>{file.name}</h3>
            <p>Quick section assignment for bundling</p>
          </div>
        </div>

        <div className="organize-form">
          <div className="form-group">
            <label>Document Type</label>
            <div className="vault-type-options">
              <label className="radio-option">
                <input
                  type="radio"
                  name="vaultType"
                  value="child"
                  checked={selectedVaultType === 'child'}
                  onChange={(e) => setSelectedVaultType(e.target.value as VaultType)}
                />
                <span className="radio-label">
                  <span className="radio-icon">👨‍👩‍👧‍👦</span>
                  Child Matters
                </span>
              </label>
              <label className="radio-option">
                <input
                  type="radio"
                  name="vaultType"
                  value="finance"
                  checked={selectedVaultType === 'finance'}
                  onChange={(e) => setSelectedVaultType(e.target.value as VaultType)}
                />
                <span className="radio-label">
                  <span className="radio-icon">💰</span>
                  Financial Matters
                </span>
              </label>
            </div>
          </div>

          <div className="form-group">
            <label>Bundle Section *</label>
            <select 
              value={selectedSection} 
              onChange={(e) => setSelectedSection(e.target.value)}
              className="form-select large"
            >
              {sections.map(section => (
                <option key={section.id} value={section.id}>
                  {section.label}
                </option>
              ))}
            </select>
            <p className="help-text">
              Files will be organized into this section for court bundle preparation. 
              You can add detailed metadata later.
            </p>
          </div>
        </div>

        <div className="form-actions">
          <button className="btn secondary" onClick={onClose}>Cancel</button>
          <button className="btn primary" onClick={handleSave}>
            📂 Organize File
          </button>
        </div>
      </div>
    </div>
  );
};

export default QuickOrganizeModal;