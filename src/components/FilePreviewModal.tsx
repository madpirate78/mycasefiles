import React, { useState, useEffect } from 'react';
import { StoredFile } from '../services/indexedDBService';
import ElectronPDFRenderer from './ElectronPDFRenderer';
import { getSuggestedMetadata, extractFromPDF } from '../services/documentParser';
import { formatDateForInput, parseUKDate } from '../utils/dateUtils';

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
  const [pdfText, setPdfText] = useState<string>('');
  const [ocrStatus, setOcrStatus] = useState<{
    isScanned: boolean;
    isProcessing: boolean;
    hasRun: boolean;
    textLength: number;
    confidence?: number;
  }>({
    isScanned: false,
    isProcessing: false, 
    hasRun: false,
    textLength: 0
  });

  // Auto-populate metadata when file changes
  useEffect(() => {
    // Reset states when file changes
    setMetadata({
      name: file?.name || '',
      section: 'other',
      description: ''
    });
    setPdfText('');
    setOcrStatus({
      isScanned: false,
      isProcessing: false,
      hasRun: false,
      textLength: 0
    });
    
    const populateMetadata = async () => {
      if (file) {
        console.log('Auto-populating metadata for file:', file.name);
        
        // Start with filename-based metadata
        const suggestedMetadata = getSuggestedMetadata(file.name);
        console.log('Suggested metadata from filename:', suggestedMetadata);
        
        // Try to extract additional info from PDF content
        let pdfData = null;
        let pdfText = '';
        if (file.type.includes('pdf') && file.data) {
          try {
            console.log('🔄 Starting PDF content extraction...');
            console.log('📁 File info:', { 
              name: file.name, 
              type: file.type, 
              size: file.data.size,
              dataType: typeof file.data 
            });
            
            // Convert File to ArrayBuffer
            console.log('🔧 Converting File to ArrayBuffer...');
            const arrayBuffer = await file.data.arrayBuffer();
            console.log('✅ ArrayBuffer created, size:', arrayBuffer.byteLength);
            
            // Get raw text from PDF via Electron API (without OCR initially)
            if (window.electronAPI && window.electronAPI.parsePDF) {
              const pdfResult = await window.electronAPI.parsePDF(arrayBuffer);
              if (pdfResult.success && pdfResult.text) {
                pdfText = pdfResult.text;
                const method = (pdfResult as any).extractionMethod || 'PDF_PARSE';
                const textLength = pdfResult.text.length;
                
                // Check if this is likely a scanned PDF
                const isScanned = (pdfResult as any).isScanned || 
                                 textLength < 50 || 
                                 ((pdfResult as any).info?.Producer && (pdfResult as any).info.Producer.includes('EPSON Scan'));
                
                setOcrStatus({
                  isScanned,
                  isProcessing: false,
                  hasRun: method === 'OCR',
                  textLength,
                  confidence: undefined
                });
                
                console.log(`📝 Text extracted via ${method}, length: ${textLength}`);
                if (isScanned && method !== 'OCR') {
                  console.log('🔍 Scanned PDF detected - OCR available');
                }
              }
            }
            
            console.log('📄 Calling extractFromPDF...');
            pdfData = await extractFromPDF(arrayBuffer);
            console.log('🎉 PDF extraction completed:', pdfData);
          } catch (error) {
            console.error('💥 PDF extraction failed:', error);
            console.error('Error details:', error instanceof Error ? error.stack : String(error));
          }
        } else {
          console.log('⚠️ Skipping PDF extraction:', {
            isPdf: file.type.includes('pdf'),
            hasData: !!file.data,
            fileType: file.type
          });
        }
        
        // Merge filename and PDF data (filename takes priority for existing fields)
        const finalMetadata: FileMetadata = {
          name: file.name,
          section: suggestedMetadata.section || 'other',
          description: '',
          ...suggestedMetadata
        };

        // Add PDF-extracted data (supplement filename data)
        if (pdfData) {
          if (pdfData.caseNumber && !finalMetadata.reference) {
            finalMetadata.reference = pdfData.caseNumber;
          }
          if (pdfData.caseNumber && !finalMetadata.courtReference) {
            finalMetadata.courtReference = pdfData.caseNumber;
          }
          if (pdfData.judgeName) {
            finalMetadata.judgeName = pdfData.judgeName;
          }
          
          // Handle statement-specific data
          if (pdfData.documentType === 'statement') {
            finalMetadata.section = 'statements';  // Auto-set to statements section
            if (pdfData.personName) {
              finalMetadata.personName = pdfData.personName;
            }
          }
          
          if (pdfData.documentType && !finalMetadata.documentType) {
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

        // Store PDF text for future use (AI processing moved to separate page)
        if (pdfText && pdfText.length > 20) {
          setPdfText(pdfText);
          console.log('📝 PDF text stored (length:', pdfText.length, ')');
        }

        console.log('Final merged metadata:', finalMetadata);
        setMetadata(finalMetadata);
      }
    };

    populateMetadata();
  }, [file]);

  // Manual OCR function
  const runOCR = async () => {
    if (!file || !file.data || !window.electronAPI) return;
    
    setOcrStatus(prev => ({ ...prev, isProcessing: true }));
    
    try {
      console.log('🔍 Starting manual OCR...');
      const arrayBuffer = await file.data.arrayBuffer();
      const ocrResult = await (window.electronAPI as any).ocrPDF(arrayBuffer);
      
      if (ocrResult.success && ocrResult.text) {
        console.log(`✅ OCR completed: ${ocrResult.text.length} chars, ${ocrResult.confidence?.toFixed(1)}% confidence`);
        
        // Update OCR status
        setOcrStatus(prev => ({
          ...prev,
          isProcessing: false,
          hasRun: true,
          textLength: ocrResult.text.length,
          confidence: ocrResult.confidence
        }));
        
        // Store OCR text for parsing
        setPdfText(ocrResult.text);
        
        // Re-run extraction with OCR text
        try {
          // Import the parser directly to use OCR text instead of re-calling Electron
          const { PDFContentParser } = await import('../services/documentParser/pdfContentParser');
          const parser = new PDFContentParser();
          const pdfData = parser.extractFromText(ocrResult.text);
          
          console.log('📊 OCR-based extraction result:', pdfData);
          
          if (pdfData) {
            // Apply extracted data to metadata
            const updatedMetadata = { ...metadata };
            if (pdfData.caseNumber && !updatedMetadata.reference) {
              updatedMetadata.reference = pdfData.caseNumber;
            }
            if (pdfData.caseNumber && !updatedMetadata.courtReference) {  
              updatedMetadata.courtReference = pdfData.caseNumber;
            }
            if (pdfData.judgeName) {
              updatedMetadata.judgeName = pdfData.judgeName;
            }
            if (pdfData.documentType === 'statement') {
              updatedMetadata.section = 'statements';
              if (pdfData.personName) {
                updatedMetadata.personName = pdfData.personName;
              }
            }
            setMetadata(updatedMetadata);
            console.log('📊 Metadata updated with OCR results:', updatedMetadata);
          }
        } catch (extractError) {
          console.error('⚠️ Pattern extraction failed after OCR:', extractError);
        }
        
      } else {
        console.error('❌ OCR failed:', ocrResult.error);
        setOcrStatus(prev => ({
          ...prev,
          isProcessing: false,
          hasRun: false
        }));
      }
    } catch (error) {
      console.error('💥 OCR processing failed:', error);
      setOcrStatus(prev => ({
        ...prev,
        isProcessing: false,
        hasRun: false
      }));
    }
  };

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
        // Convert ISO date to UK format for display
        const formatValueForDisplay = (isoValue: string) => {
          if (!isoValue) return '';
          const date = new Date(isoValue);
          if (isNaN(date.getTime())) return isoValue;
          const day = date.getDate().toString().padStart(2, '0');
          const month = (date.getMonth() + 1).toString().padStart(2, '0');
          const year = date.getFullYear();
          return `${day}/${month}/${year}`;
        };

        // Convert UK format to ISO for HTML input
        const parseUKToISO = (ukValue: string) => {
          if (!ukValue || ukValue.length < 8) return '';
          const parts = ukValue.split('/');
          if (parts.length !== 3) return ukValue;
          const day = parts[0].padStart(2, '0');
          const month = parts[1].padStart(2, '0');
          const year = parts[2];
          if (year.length === 4 && month.length <= 2 && day.length <= 2) {
            return `${year}-${month}-${day}`;
          }
          return ukValue;
        };

        return (
          <div className="uk-date-input">
            <input
              type="text"
              value={value ? formatValueForDisplay(value) : ''}
              onChange={(e) => {
                const ukFormat = e.target.value;
                const isoFormat = parseUKToISO(ukFormat);
                updateMetadata(field.key, isoFormat);
              }}
              placeholder="DD/MM/YYYY"
              className="form-input"
              required={field.required}
              pattern="[0-9]{2}/[0-9]{2}/[0-9]{4}"
              title="Enter date in DD/MM/YYYY format"
            />
          </div>
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
                <ElectronPDFRenderer 
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

            {/* OCR Status and Control */}
            {ocrStatus.isScanned && (
              <div className="form-group">
                <label>Document Scanning</label>
                <div className="ocr-status-container">
                  {!ocrStatus.hasRun && !ocrStatus.isProcessing && (
                    <div className="ocr-prompt">
                      <p className="ocr-detected">📄 Scanned document detected ({ocrStatus.textLength} chars extracted)</p>
                      <button 
                        type="button"
                        className="btn secondary"
                        onClick={runOCR}
                        style={{ marginTop: '8px' }}
                      >
                        🔍 Run OCR to Extract Full Text
                      </button>
                      <p className="ocr-note">OCR will analyze the scanned image to extract readable text. This may take 10-15 seconds.</p>
                    </div>
                  )}
                  
                  {ocrStatus.isProcessing && (
                    <div className="ocr-processing">
                      <p className="ocr-status">🔄 Running OCR analysis...</p>
                      <div className="ocr-spinner">Processing scanned document, please wait...</div>
                    </div>
                  )}
                  
                  {ocrStatus.hasRun && !ocrStatus.isProcessing && (
                    <div className="ocr-complete">
                      <p className="ocr-success">
                        ✅ OCR completed: {ocrStatus.textLength} characters extracted
                        {ocrStatus.confidence && ` (${ocrStatus.confidence.toFixed(1)}% confidence)`}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="form-group">
              <label>Description</label>
              <div className="description-field-container">
                <textarea
                  value={metadata.description}
                  onChange={(e) => setMetadata({...metadata, description: e.target.value})}
                  placeholder="Brief description of the document..."
                  className="form-textarea"
                  rows={3}
                />
              </div>
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