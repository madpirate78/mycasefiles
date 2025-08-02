import React, { useState } from 'react';
import { VaultType } from '../types/vault';
import folderImportService from '../services/folderImportService';
import vaultService from '../services/vaultService';
import './FolderImportWizard.css';

interface FolderImportWizardProps {
  currentVault: VaultType;
  onImport: (files: FileList, mappings: Array<{ file: File; sectionId: string }>) => void;
}

interface FolderPreview {
  folderName: string;
  fileCount: number;
  suggestedSection: string | null;
  confidence: 'high' | 'medium' | 'low' | null;
  files: string[];
  selectedSection: string;
}

const FolderImportWizard: React.FC<FolderImportWizardProps> = ({ currentVault, onImport }) => {
  const [step, setStep] = useState<'instructions' | 'upload' | 'preview' | 'importing'>('instructions');
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
  const [folderPreviews, setFolderPreviews] = useState<FolderPreview[]>([]);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });

  const sections = vaultService.getVaultSections(currentVault);

  const handleFolderUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setSelectedFiles(files);
    
    // Generate preview with suggestions
    const preview = folderImportService.previewFolderMappings(files, currentVault);
    const folderPreviews: FolderPreview[] = preview.map(p => ({
      ...p,
      selectedSection: p.suggestedSection || 'other'
    }));

    setFolderPreviews(folderPreviews);
    setStep('preview');
  };

  const handleSectionChange = (folderName: string, sectionId: string) => {
    setFolderPreviews(prev => 
      prev.map(fp => 
        fp.folderName === folderName 
          ? { ...fp, selectedSection: sectionId }
          : fp
      )
    );
  };

  const handleImport = async () => {
    if (!selectedFiles) return;

    setStep('importing');
    setImportProgress({ current: 0, total: selectedFiles.length });

    // Create file-to-section mappings
    const mappings: Array<{ file: File; sectionId: string }> = [];
    
    Array.from(selectedFiles).forEach(file => {
      const path = (file as any).webkitRelativePath || file.name;
      const pathParts = path.split('/');
      const folderName = pathParts.length > 1 ? pathParts[0] : 'Root';
      
      const folderPreview = folderPreviews.find(fp => fp.folderName === folderName);
      if (folderPreview) {
        mappings.push({
          file,
          sectionId: folderPreview.selectedSection
        });
      }
    });

    // Call the import function
    onImport(selectedFiles, mappings);
  };

  const getConfidenceIcon = (confidence: 'high' | 'medium' | 'low' | null) => {
    switch (confidence) {
      case 'high': return '🎯';
      case 'medium': return '💡';
      case 'low': return '❓';
      default: return '❌';
    }
  };

  const getConfidenceText = (confidence: 'high' | 'medium' | 'low' | null) => {
    switch (confidence) {
      case 'high': return 'High confidence match';
      case 'medium': return 'Suggested match';
      case 'low': return 'Possible match';
      default: return 'No automatic match';
    }
  };

  if (step === 'instructions') {
    return (
      <div className="import-wizard">
        <div className="wizard-header">
          <h1>📁 Import Organized Folder Structure</h1>
          <p className="wizard-subtitle">
            Already have your documents organized in folders? Import them all at once with automatic section mapping.
          </p>
        </div>

        <div className="instructions-content">
          <div className="instruction-section">
            <h3>🎯 How It Works</h3>
            <ol>
              <li>Select a folder containing your organized documents</li>
              <li>We'll automatically suggest which bundle section each folder maps to</li>
              <li>Review and adjust the mappings as needed</li>
              <li>Import all files with their section assignments</li>
            </ol>
          </div>

          <div className="instruction-section">
            <h3>📂 Supported Folder Naming</h3>
            <div className="naming-examples">
              <div className="naming-group">
                <h4>Standard Court Bundle Format:</h4>
                <ul>
                  <li><code>Section A</code>, <code>Section B</code>, <code>Section C</code></li>
                  <li><code>A</code>, <code>B</code>, <code>C</code>, <code>D</code></li>
                  <li><code>Part 1</code>, <code>Part 2</code>, <code>Part 3</code></li>
                </ul>
              </div>
              <div className="naming-group">
                <h4>Descriptive Names:</h4>
                <ul>
                  <li><code>Orders</code>, <code>Applications</code>, <code>Statements</code></li>
                  <li><code>Court Orders</code>, <code>Witness Statements</code></li>
                  <li><code>CAFCASS Reports</code>, <code>Expert Evidence</code></li>
                </ul>
              </div>
            </div>
          </div>

          <div className="instruction-section">
            <h3>⚠️ Important Notes</h3>
            <ul>
              <li><strong>Vault Type:</strong> Currently importing for <span className="vault-indicator">{currentVault === 'child' ? '👨‍👩‍👧‍👦 Child Matters' : '💰 Financial Matters'}</span></li>
              <li><strong>Folder Selection:</strong> Choose the parent folder containing all your organized subfolders</li>
              <li><strong>File Types:</strong> All document types are supported (PDF, images, Word docs, etc.)</li>
              <li><strong>Review Step:</strong> You can adjust any automatic mappings before importing</li>
            </ul>
          </div>

          <div className="wizard-actions">
            <button 
              className="btn primary large"
              onClick={() => setStep('upload')}
            >
              📁 Select Organized Folder
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'upload') {
    return (
      <div className="import-wizard">
        <div className="wizard-header">
          <h2>📁 Select Your Organized Folder</h2>
          <p>Choose the folder containing your organized document subfolders</p>
        </div>

        <div className="upload-section">
          <div className="folder-upload-area">
            <input
              type="file"
              id="folderInput"
              multiple
              // @ts-ignore - webkitdirectory is not in the types but is supported
              webkitdirectory="true"
              onChange={handleFolderUpload}
              className="folder-input"
            />
            <label htmlFor="folderInput" className="folder-upload-label">
              <div className="upload-icon">📁</div>
              <h3>Click to Select Folder</h3>
              <p>Choose the parent folder containing your organized documents</p>
              <div className="upload-hint">
                <strong>Tip:</strong> Select the folder that contains subfolders like "Section A", "Orders", etc.
              </div>
            </label>
          </div>

          <div className="wizard-actions">
            <button 
              className="btn secondary"
              onClick={() => setStep('instructions')}
            >
              ← Back to Instructions
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'preview') {
    return (
      <div className="import-wizard">
        <div className="wizard-header">
          <h2>📋 Review Folder Mappings</h2>
          <p>Check and adjust how your folders will be mapped to bundle sections</p>
        </div>

        <div className="preview-content">
          <div className="preview-summary">
            <div className="summary-stats">
              <span className="stat">
                <strong>{folderPreviews.length}</strong> folders found
              </span>
              <span className="stat">
                <strong>{folderPreviews.reduce((sum, fp) => sum + fp.fileCount, 0)}</strong> files total
              </span>
              <span className="stat">
                <strong>{folderPreviews.filter(fp => fp.confidence === 'high').length}</strong> high confidence matches
              </span>
            </div>
          </div>

          <div className="folder-mappings">
            {folderPreviews.map(folder => (
              <div key={folder.folderName} className="folder-mapping">
                <div className="folder-info">
                  <div className="folder-name">
                    <span className="confidence-icon">{getConfidenceIcon(folder.confidence)}</span>
                    <strong>{folder.folderName}</strong>
                    <span className="file-count">({folder.fileCount} files)</span>
                  </div>
                  <div className="confidence-text">{getConfidenceText(folder.confidence)}</div>
                  <div className="file-list">
                    {folder.files.slice(0, 3).map(fileName => (
                      <span key={fileName} className="file-name">{fileName}</span>
                    ))}
                    {folder.files.length > 3 && (
                      <span className="file-more">+{folder.files.length - 3} more</span>
                    )}
                  </div>
                </div>

                <div className="section-selector">
                  <label>Bundle Section:</label>
                  <select
                    value={folder.selectedSection}
                    onChange={(e) => handleSectionChange(folder.folderName, e.target.value)}
                    className="section-select"
                  >
                    {sections.map(section => (
                      <option key={section.id} value={section.id}>
                        {section.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
          </div>

          <div className="wizard-actions">
            <button 
              className="btn secondary"
              onClick={() => setStep('upload')}
            >
              ← Change Folder
            </button>
            <button 
              className="btn primary large"
              onClick={handleImport}
            >
              🚀 Import All Files
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'importing') {
    return (
      <div className="import-wizard">
        <div className="wizard-header">
          <h2>🚀 Importing Files...</h2>
          <p>Processing your organized folder structure</p>
        </div>

        <div className="import-progress">
          <div className="progress-bar">
            <div 
              className="progress-fill"
              style={{ width: `${(importProgress.current / importProgress.total) * 100}%` }}
            />
          </div>
          <div className="progress-text">
            {importProgress.current} of {importProgress.total} files processed
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export default FolderImportWizard;