import React, { useState, useEffect } from 'react';
import { StoredFile } from '../services/indexedDBService';
import ElectronPDFRenderer from './ElectronPDFRenderer';
import { getSuggestedSection, detectVaultType } from '../services/documentParser';
import { VaultType } from '../types/vault';
import vaultService from '../services/vaultService';
import './SimpleOrganizeModal.css';

interface SimpleOrganizeModalProps {
  file: StoredFile | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (fileId: number, section: string, vaultType: VaultType) => void;
  currentVault: VaultType;
}

const SimpleOrganizeModal: React.FC<SimpleOrganizeModalProps> = ({ 
  file, 
  isOpen, 
  onClose, 
  onSave, 
  currentVault 
}) => {
  const [selectedSection, setSelectedSection] = useState<string>('other');
  const [selectedVaultType, setSelectedVaultType] = useState<VaultType>(currentVault);
  const [showVaultWarning, setShowVaultWarning] = useState(false);

  // Auto-detect section and vault type when file changes
  useEffect(() => {
    if (file) {
      console.log('🔍 Inspecting file:', file.name);
      
      // Auto-detect vault type
      const detectedVaultType = detectVaultType(file.name);
      const finalVaultType = detectedVaultType || currentVault;
      setSelectedVaultType(finalVaultType);
      
      // Show warning if detected vault type differs from current
      if (detectedVaultType && detectedVaultType !== currentVault) {
        setShowVaultWarning(true);
      } else {
        setShowVaultWarning(false);
      }
      
      // Auto-detect section
      const suggestedSection = getSuggestedSection(file.name, finalVaultType);
      setSelectedSection(suggestedSection);
      
      console.log('📂 Detection results:', { 
        vaultType: finalVaultType, 
        section: suggestedSection,
        vaultMismatch: detectedVaultType !== currentVault
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

  const handleVaultChange = (newVaultType: VaultType) => {
    setSelectedVaultType(newVaultType);
    // Update section suggestion based on new vault type
    const suggestedSection = getSuggestedSection(file?.name || '', newVaultType);
    setSelectedSection(suggestedSection);
    setShowVaultWarning(false);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="simple-organize-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>📄 Take a Closer Look</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          <div className="preview-section">
            <div className="pdf-preview">
              {file.type.includes('pdf') ? (
                <ElectronPDFRenderer 
                  file={file.data}
                  onLoad={() => console.log('PDF loaded for inspection')}
                  onError={(error) => console.error('PDF error:', error)}
                  showNavigation={true}
                />
              ) : (
                <div className="file-preview">
                  <span className="file-icon">📄</span>
                  <p>{file.name}</p>
                  <p className="preview-hint">Preview not available for this file type</p>
                </div>
              )}
            </div>
          </div>

          <div className="organize-section">
            <h3>📂 Organize This Document</h3>
            
            {showVaultWarning && (
              <div className="vault-warning">
                <h4>⚠️ Vault Type Mismatch Detected</h4>
                <p>
                  This document appears to be a <strong>{selectedVaultType}</strong> matter, 
                  but you're currently in <strong>{currentVault}</strong> vault mode.
                </p>
                <p className="warning-advice">
                  <strong>Recommendation:</strong> Only upload documents for one case type at a time to avoid confusion.
                </p>
              </div>
            )}

            <div className="form-group vault-type-selector">
              <label>Document Type *</label>
              <div className="vault-type-options">
                <label className="radio-option">
                  <input
                    type="radio"
                    name="vaultType"
                    value="child"
                    checked={selectedVaultType === 'child'}
                    onChange={(e) => handleVaultChange(e.target.value as VaultType)}
                  />
                  <span className="radio-label">
                    <span className="radio-icon">👨‍👩‍👧‍👦</span>
                    <span className="radio-text">
                      <strong>Child Matters</strong>
                    </span>
                  </span>
                </label>
                <label className="radio-option">
                  <input
                    type="radio"
                    name="vaultType"
                    value="finance"
                    checked={selectedVaultType === 'finance'}
                    onChange={(e) => handleVaultChange(e.target.value as VaultType)}
                  />
                  <span className="radio-label">
                    <span className="radio-icon">💰</span>
                    <span className="radio-text">
                      <strong>Financial Matters</strong>
                    </span>
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
            </div>
          </div>
        </div>

        <div className="form-actions">
          <button className="btn secondary" onClick={onClose}>Cancel</button>
          <button className="btn primary" onClick={handleSave}>
            📂 Organize Document
          </button>
        </div>
      </div>
    </div>
  );
};

export default SimpleOrganizeModal;