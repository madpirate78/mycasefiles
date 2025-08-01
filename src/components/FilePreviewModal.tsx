import React, { useState } from 'react';
import { StoredFile } from '../services/indexedDBService';
import PDFRenderer from './PDFRenderer';

interface FilePreviewModalProps {
  file: StoredFile | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (fileId: number, metadata: FileMetadata) => void;
}

export interface FileMetadata {
  name: string;
  section: string;
  description?: string;
  // Dynamic fields based on section
  [key: string]: string | undefined;
}

interface FormField {
  key: string;
  label: string;
  type: 'text' | 'date' | 'select' | 'textarea';
  placeholder?: string;
  required?: boolean;
  options?: { value: string; label: string }[];
}

interface SectionConfig {
  id: string;
  label: string;
  fields: FormField[];
  filenameFormat?: (metadata: FileMetadata) => string;
}

const FilePreviewModal: React.FC<FilePreviewModalProps> = ({ file, isOpen, onClose, onSave }) => {
  const [metadata, setMetadata] = useState<FileMetadata>({
    name: file?.name || '',
    section: 'other',
    description: ''
  });

  const sectionConfigs: SectionConfig[] = [
    {
      id: 'preliminary',
      label: 'Preliminary Documents',
      fields: [
        { key: 'documentType', label: 'Document Type', type: 'select', required: true,
          options: [
            { value: 'application', label: 'Application Form' },
            { value: 'checklist', label: 'Checklist' },
            { value: 'notice', label: 'Notice' },
            { value: 'filing', label: 'Filing Document' }
          ]
        },
        { key: 'date', label: 'Date Filed', type: 'date' },
        { key: 'reference', label: 'Reference Number', type: 'text', placeholder: 'e.g., REF001' }
      ],
      filenameFormat: (meta) => {
        const parts = ['preliminary'];
        if (meta.documentType) parts.push(meta.documentType);
        if (meta.reference) parts.push(meta.reference);
        if (meta.date) parts.push(meta.date);
        return parts.join('_');
      }
    },
    {
      id: 'applications',
      label: 'Applications and Orders',
      fields: [
        { key: 'orderReference', label: 'Order Reference', type: 'text', placeholder: 'e.g., FL401', required: true },
        { key: 'judgeName', label: 'Judge Name', type: 'text', placeholder: 'e.g., Smith' },
        { key: 'date', label: 'Date', type: 'date', required: true },
        { key: 'orderType', label: 'Order Type', type: 'select',
          options: [
            { value: 'interim', label: 'Interim Order' },
            { value: 'final', label: 'Final Order' },
            { value: 'application', label: 'Application' },
            { value: 'directions', label: 'Directions Order' }
          ]
        }
      ],
      filenameFormat: (meta) => {
        const parts = ['order'];
        if (meta.orderReference) parts.push(meta.orderReference.replace(/\s+/g, '_'));
        if (meta.judgeName) parts.push(meta.judgeName.replace(/\s+/g, '_'));
        if (meta.date) parts.push(meta.date);
        return parts.join('_');
      }
    },
    {
      id: 'statements',
      label: 'Statements and Affidavits',
      fields: [
        { key: 'statementType', label: 'Statement Type', type: 'select', required: true,
          options: [
            { value: 'witness', label: 'Witness Statement' },
            { value: 'position', label: 'Position Statement' },
            { value: 'affidavit', label: 'Affidavit' },
            { value: 'supporting', label: 'Supporting Statement' }
          ]
        },
        { key: 'personName', label: 'Person Name', type: 'text', placeholder: 'Name of person making statement', required: true },
        { key: 'date', label: 'Date', type: 'date' },
        { key: 'statementNumber', label: 'Statement Number', type: 'text', placeholder: 'e.g., 1st, 2nd' }
      ],
      filenameFormat: (meta) => {
        const parts = ['statement'];
        if (meta.statementType) parts.push(meta.statementType);
        if (meta.personName) parts.push(meta.personName.replace(/\s+/g, '_'));
        if (meta.statementNumber) parts.push(meta.statementNumber);
        if (meta.date) parts.push(meta.date);
        return parts.join('_');
      }
    },
    {
      id: 'care',
      label: 'Care Plans',
      fields: [
        { key: 'childName', label: 'Child Name', type: 'text', placeholder: 'Child\'s name', required: true },
        { key: 'planType', label: 'Plan Type', type: 'select', required: true,
          options: [
            { value: 'initial', label: 'Initial Care Plan' },
            { value: 'review', label: 'Review Care Plan' },
            { value: 'final', label: 'Final Care Plan' },
            { value: 'placement', label: 'Placement Plan' }
          ]
        },
        { key: 'reviewDate', label: 'Review Date', type: 'date' },
        { key: 'socialWorker', label: 'Social Worker', type: 'text', placeholder: 'Social worker name' }
      ],
      filenameFormat: (meta) => {
        const parts = ['care_plan'];
        if (meta.planType) parts.push(meta.planType);
        if (meta.childName) parts.push(meta.childName.replace(/\s+/g, '_'));
        if (meta.reviewDate) parts.push(meta.reviewDate);
        return parts.join('_');
      }
    },
    {
      id: 'experts',
      label: 'Experts\' Reports',
      fields: [
        { key: 'expertType', label: 'Expert Type', type: 'select', required: true,
          options: [
            { value: 'psychologist', label: 'Psychologist' },
            { value: 'psychiatrist', label: 'Psychiatrist' },
            { value: 'social_worker', label: 'Social Worker' },
            { value: 'guardian', label: 'Guardian ad Litem' },
            { value: 'medical', label: 'Medical Expert' },
            { value: 'other', label: 'Other Expert' }
          ]
        },
        { key: 'expertName', label: 'Expert Name', type: 'text', placeholder: 'Expert\'s name', required: true },
        { key: 'reportDate', label: 'Report Date', type: 'date' },
        { key: 'reportType', label: 'Report Type', type: 'text', placeholder: 'e.g., Assessment, Evaluation' }
      ],
      filenameFormat: (meta) => {
        const parts = ['expert'];
        if (meta.expertType) parts.push(meta.expertType);
        if (meta.expertName) parts.push(meta.expertName.replace(/\s+/g, '_'));
        if (meta.reportDate) parts.push(meta.reportDate);
        return parts.join('_');
      }
    },
    {
      id: 'other',
      label: 'Other Documents',
      fields: [
        { key: 'documentType', label: 'Document Type', type: 'text', placeholder: 'Type of document' },
        { key: 'date', label: 'Date', type: 'date' },
        { key: 'reference', label: 'Reference', type: 'text', placeholder: 'Any reference number' }
      ],
      filenameFormat: (meta) => {
        const parts = ['other'];
        if (meta.documentType) parts.push(meta.documentType.replace(/\s+/g, '_'));
        if (meta.reference) parts.push(meta.reference);
        if (meta.date) parts.push(meta.date);
        return parts.join('_');
      }
    }
  ];

  const sections = sectionConfigs.map(config => ({ id: config.id, label: config.label }));
  const currentSectionConfig = sectionConfigs.find(config => config.id === metadata.section);

  if (!isOpen || !file) return null;

  const updateMetadata = (key: string, value: string) => {
    setMetadata(prev => ({ ...prev, [key]: value }));
  };

  const renderField = (field: FormField) => {
    const value = metadata[field.key] || '';
    
    switch (field.type) {
      case 'select':
        return (
          <select
            value={value}
            onChange={(e) => updateMetadata(field.key, e.target.value)}
            className="form-select"
            required={field.required}
          >
            <option value="">Select {field.label.toLowerCase()}</option>
            {field.options?.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        );
      case 'textarea':
        return (
          <textarea
            value={value}
            onChange={(e) => updateMetadata(field.key, e.target.value)}
            placeholder={field.placeholder}
            className="form-textarea"
            rows={3}
            required={field.required}
          />
        );
      case 'date':
        return (
          <input
            type="date"
            value={value}
            onChange={(e) => updateMetadata(field.key, e.target.value)}
            className="form-input"
            required={field.required}
          />
        );
      default: // text
        return (
          <input
            type="text"
            value={value}
            onChange={(e) => updateMetadata(field.key, e.target.value)}
            placeholder={field.placeholder}
            className="form-input"
            required={field.required}
          />
        );
    }
  };

  const handleSave = () => {
    // Generate filename based on section configuration
    let newFilename = file.name;
    
    if (currentSectionConfig?.filenameFormat) {
      const extension = file.name.split('.').pop();
      const baseName = currentSectionConfig.filenameFormat(metadata);
      newFilename = `${baseName}.${extension}`;
    } else if (metadata.name !== file.name) {
      newFilename = metadata.name;
    }

    onSave(file.id!, { ...metadata, name: newFilename });
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Organize Document</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          <div className="preview-section">
            <div className="pdf-preview">
              {file.type.includes('pdf') ? (
                <PDFRenderer 
                  file={file.data}
                  onLoad={() => console.log('PDF loaded successfully')}
                  onError={(error) => console.error('PDF error:', error)}
                  showNavigation={false}
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

          <div className="metadata-section">
            <h3>Document Information</h3>
            
            <div className="form-group">
              <label>Document Section *</label>
              <select 
                value={metadata.section} 
                onChange={(e) => {
                  // Clear existing dynamic fields when section changes
                  const newMetadata: FileMetadata = {
                    name: metadata.name,
                    section: e.target.value,
                    description: metadata.description
                  };
                  setMetadata(newMetadata);
                }}
                className="form-select"
              >
                {sections.map(section => (
                  <option key={section.id} value={section.id}>
                    {section.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Dynamic fields based on selected section */}
            {currentSectionConfig && currentSectionConfig.fields.map((field) => (
              <div key={field.key} className="form-group">
                <label>
                  {field.label}
                  {field.required && <span className="required-asterisk"> *</span>}
                </label>
                {renderField(field)}
              </div>
            ))}

            <div className="form-group">
              <label>Description</label>
              <textarea
                value={metadata.description}
                onChange={(e) => setMetadata({...metadata, description: e.target.value})}
                placeholder="Brief description of the document..."
                className="form-textarea"
                rows={3}
              />
            </div>

            <div className="form-group">
              <label>Filename</label>
              <input
                type="text"
                value={metadata.name}
                onChange={(e) => setMetadata({...metadata, name: e.target.value})}
                className="form-input"
              />
              {currentSectionConfig?.filenameFormat && (
                <p className="filename-hint">
                  Suggested filename: {currentSectionConfig.filenameFormat(metadata)}.{file.name.split('.').pop()}
                </p>
              )}
            </div>

            <div className="form-actions">
              <button className="btn secondary" onClick={onClose}>Cancel</button>
              <button className="btn primary" onClick={handleSave}>
                Save & Organize
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FilePreviewModal;