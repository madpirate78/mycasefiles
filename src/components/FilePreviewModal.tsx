import React, { useState, useEffect } from 'react';
import { StoredFile } from '../services/indexedDBService';
import PDFRenderer from './PDFRenderer';
import { getSuggestedMetadata, extractFromPDF } from '../services/documentParser';

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

  // Auto-populate metadata when file changes
  useEffect(() => {
    const populateMetadata = async () => {
      if (file) {
        console.log('Auto-populating metadata for file:', file.name);
        
        // Start with filename-based metadata
        const suggestedMetadata = getSuggestedMetadata(file.name);
        console.log('Suggested metadata from filename:', suggestedMetadata);
        
        // Try to extract additional info from PDF content
        let pdfData = null;
        if (file.type.includes('pdf') && file.data) {
          try {
            console.log('Extracting from PDF content...');
            // Convert File to ArrayBuffer
            const arrayBuffer = await file.data.arrayBuffer();
            pdfData = await extractFromPDF(arrayBuffer);
            console.log('PDF extracted data:', pdfData);
          } catch (error) {
            console.error('PDF extraction failed:', error);
          }
        }
        
        // Merge filename and PDF data (filename takes priority for existing fields)
        const finalMetadata: FileMetadata = {
          name: file.name,
          section: suggestedMetadata.section || 'other',
          description: '',
          ...suggestedMetadata
        };

        // Add PDF-extracted data if not already present from filename
        if (pdfData) {
          if (!finalMetadata.reference && !finalMetadata.courtReference && pdfData.caseNumber) {
            finalMetadata.reference = pdfData.caseNumber;
            finalMetadata.courtReference = pdfData.caseNumber;
          }
          if (!finalMetadata.judgeName && pdfData.judgeName) {
            finalMetadata.judgeName = pdfData.judgeName;
          }
          if (!finalMetadata.documentType && pdfData.documentType) {
            // Map PDF document type to form document type
            if (pdfData.documentType === 'order') {
              if (finalMetadata.section === 'child_applications') {
                finalMetadata.documentType = 'interim_order';
              } else if (finalMetadata.section === 'financial_applications') {
                finalMetadata.documentType = 'financial_order';
              }
            }
            // For applications, filename parsing is usually better
          }
        }

        console.log('Final merged metadata:', finalMetadata);
        setMetadata(finalMetadata);
      }
    };

    populateMetadata();
  }, [file]);

  const sectionConfigs: SectionConfig[] = [
    {
      id: 'preliminary',
      label: 'Preliminary Documents',
      fields: [
        { key: 'documentType', label: 'Document Type', type: 'select', required: true,
          options: [
            { value: 'case_summary', label: 'Case Summary' },
            { value: 'statement_of_issues', label: 'Statement of Issues' },
            { value: 'position_statements', label: 'Position Statements' },
            { value: 'chronology', label: 'Chronology' },
            { value: 'skeleton_arguments', label: 'Skeleton Arguments' },
            { value: 'list_essential_reading', label: 'List of Essential Reading' }
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
      id: 'child_applications',
      label: 'Child Matters - Applications and Orders',
      fields: [
        { key: 'documentType', label: 'Document Type', type: 'select', required: true,
          options: [
            { value: 'c100', label: 'C100 - Child Arrangements Application' },
            { value: 'fl401', label: 'FL401 - Non-molestation Application' },
            { value: 'fl402', label: 'FL402 - Occupation Order Application' },
            { value: 'c1', label: 'C1 - Application for Order' },
            { value: 'other_child_application', label: 'Other Child Application' },
            { value: 'interim_order', label: 'Interim Order' },
            { value: 'final_order', label: 'Final Order' },
            { value: 'directions_order', label: 'Directions Order' },
            { value: 'consent_order', label: 'Consent Order' }
          ]
        },
        { key: 'reference', label: 'Reference', type: 'text', placeholder: 'e.g., FL401, C100', required: true },
        { key: 'judgeName', label: 'Judge Name', type: 'text', placeholder: 'e.g., Smith' },
        { key: 'date', label: 'Date', type: 'date', required: true }
      ],
      filenameFormat: (meta) => {
        const parts = ['child', meta.documentType || 'document'];
        if (meta.reference) parts.push(meta.reference.replace(/\s+/g, '_'));
        if (meta.judgeName) parts.push(meta.judgeName.replace(/\s+/g, '_'));
        if (meta.date) parts.push(meta.date);
        return parts.join('_');
      }
    },
    {
      id: 'financial_applications',
      label: 'Financial Matters - Applications and Orders',
      fields: [
        { key: 'documentType', label: 'Document Type', type: 'select', required: true,
          options: [
            { value: 'form_a', label: 'Form A - Financial Application' },
            { value: 'form_e', label: 'Form E - Financial Statement' },
            { value: 'd81', label: 'D81 - Statement of Information' },
            { value: 'financial_dispute_resolution', label: 'FDR - Financial Dispute Resolution' },
            { value: 'other_financial_application', label: 'Other Financial Application' },
            { value: 'financial_order', label: 'Financial Order' },
            { value: 'consent_order', label: 'Consent Order' },
            { value: 'clean_break_order', label: 'Clean Break Order' },
            { value: 'pension_sharing_order', label: 'Pension Sharing Order' }
          ]
        },
        { key: 'reference', label: 'Reference', type: 'text', placeholder: 'e.g., FA-2024-001', required: true },
        { key: 'judgeName', label: 'Judge Name', type: 'text', placeholder: 'e.g., Smith' },
        { key: 'date', label: 'Date', type: 'date', required: true }
      ],
      filenameFormat: (meta) => {
        const parts = ['financial', meta.documentType || 'document'];
        if (meta.reference) parts.push(meta.reference.replace(/\s+/g, '_'));
        if (meta.judgeName) parts.push(meta.judgeName.replace(/\s+/g, '_'));
        if (meta.date) parts.push(meta.date);
        return parts.join('_');
      }
    },
    {
      id: 'statements',
      label: 'Statements and Affidavits',
      fields: [
        { key: 'personName', label: 'Person Name', type: 'text', placeholder: 'Name of person making statement', required: true },
        { key: 'courtReference', label: 'Court Reference Number', type: 'text', placeholder: 'e.g., FL401, C100', required: true },
        { key: 'date', label: 'Date', type: 'date' }
      ],
      filenameFormat: (meta) => {
        const parts = ['statement'];
        if (meta.personName) parts.push(meta.personName.replace(/\s+/g, '_'));
        if (meta.courtReference) parts.push(meta.courtReference);
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
            { value: 'cafcass', label: 'CAFCASS' },
            { value: 'social_services', label: 'Social Services' },
            { value: 'police', label: 'Police' },
            { value: 'counsellor', label: 'Counsellor' },
            { value: 'psychiatrist', label: 'Psychiatrist' },
            { value: 'psychologist', label: 'Psychologist' },
            { value: 'guardian', label: 'Guardian ad Litem' },
            { value: 'other', label: 'Other Expert' }
          ]
        },
        { key: 'expertName', label: 'Expert Name', type: 'text', placeholder: 'Expert\'s name', required: true },
        { key: 'reportDate', label: 'Report Date', type: 'date' }
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

  const sections = [
    { id: 'preliminary', label: 'Preliminary Documents' },
    { id: 'child_applications', label: 'Child Matters - Applications and Orders' },
    { id: 'financial_applications', label: 'Financial Matters - Applications and Orders' },
    { id: 'statements', label: 'Statements and Affidavits' },
    { id: 'care', label: 'Care Plans' },
    { id: 'experts', label: 'Experts\' Reports' },
    { id: 'other', label: 'Other Documents' }
  ];
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
                  // Preserve metadata but update section
                  setMetadata(prev => ({ ...prev, section: e.target.value }));
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