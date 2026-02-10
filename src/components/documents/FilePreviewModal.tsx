import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { StoredFile } from '../../services/indexedDBService';
import ElectronPDFRenderer from './ElectronPDFRenderer';
import { getSuggestedMetadata, extractFromPDF, detectVaultType } from '../../services/documentParser';
import { VaultType } from '../../types/vault';
import vaultService from '../../services/vaultService';
import { isElectron, parsePDF, ocrPDF } from '../../services/electronAPI';
import { getSectionConfigs, FileMetadata, FormField } from '../../constants/sectionConfig';
import '../../styles/Modal.css';
import '../../styles/Forms.css';

interface FilePreviewModalProps {
  file: StoredFile | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (fileId: number, metadata: FileWithOCR) => void;
  onDelete?: (fileId: number) => void;
  vaultType?: VaultType;
}

// Separate interface for core fields without index signature
interface CoreFileMetadata {
  name: string;
  displayName?: string;
  section: string;
  description?: string;
  courtReference?: string;
  applicationDate?: string;
  // Commonly used fields for all sections
  orderReference?: string;
  judgeName?: string;
  date?: string;
  reference?: string;
  personName?: string;
  expertName?: string;
  reportDate?: string;
  orderType?: string;
  documentType?: string;
  expertType?: string;
  childName?: string;
  planType?: string;
  reviewDate?: string;
  socialWorker?: string;
  disclosureType?: string;
  period?: string;
  valuationType?: string;
  propertyAddress?: string;
  valuer?: string;
  valuationDate?: string;
  value?: string;
  sender?: string;
  recipient?: string;
  subject?: string;
}

// OCR-enabled interface that combines core metadata with OCR fields
export interface FileWithOCR extends CoreFileMetadata {
  autopopulationPerformed?: boolean;
  ocrPerformed?: boolean;
  ocrText?: string;
  ocrConfidence?: number;
  ocrDate?: string;
  // Page tracking for bundle generation
  totalPages?: number;
  selectedPages?: number[];
}

const FilePreviewModal: React.FC<FilePreviewModalProps> = ({ file, isOpen, onClose, onSave, onDelete, vaultType = 'child' }) => {
  // Create stable reference to file data for PDF renderer
  const stableFileData = useMemo(() => {
    console.log('🔄 useMemo recalculating stableFileData');
    return file?.data;
  }, [file?.data]);

  // Debug when the file object changes
  useEffect(() => {
    console.log('📁 File object changed:', {
      fileName: file?.name,
      hasData: !!file?.data,
      fileId: file?.id,
      fileReference: file
    });
  }, [file]);

  const [metadata, setMetadata] = useState<FileWithOCR>({
    name: file?.name || '',
    section: 'other',
    description: ''
  });


  // Stable PDF callback functions
  const handlePDFLoad = useCallback(() => {
    console.log('PDF loaded successfully');
  }, []);

  const handlePDFError = useCallback((error: string) => {
    console.error('PDF error:', error);
  }, []);
  // const [pdfText, setPdfText] = useState<string>('');
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

  // Vault change confirmation dialog state
  const [showVaultChangeConfirm, setShowVaultChangeConfirm] = useState(false);
  const [pendingVaultChange, setPendingVaultChange] = useState<VaultType | null>(null);
  const [updatedFileData, setUpdatedFileData] = useState<File | null>(null);

  // Reset updated file data when modal closes
  useEffect(() => {
    if (!isOpen) {
      setUpdatedFileData(null);
    }
  }, [isOpen]);

  // Load existing metadata when file changes (not vault type)
  useEffect(() => {
    // Reset states when file changes - load ALL existing metadata from stored file
    setMetadata({
      name: file?.name || '',
      section: file?.section || 'other',
      description: file?.description || '',
      courtReference: file?.courtReference,
      applicationDate: file?.applicationDate,
      displayName: file?.displayName,
      // Load all metadata fields from StoredFile
      orderReference: file?.orderReference,
      judgeName: file?.judgeName,
      date: file?.date,
      reference: file?.reference,
      personName: file?.personName,
      expertName: file?.expertName,
      reportDate: file?.reportDate,
      orderType: file?.orderType,
      documentType: file?.documentType,
      expertType: file?.expertType,
      childName: file?.childName,
      planType: file?.planType,
      reviewDate: file?.reviewDate,
      socialWorker: file?.socialWorker,
      disclosureType: file?.disclosureType,
      period: file?.period,
      valuationType: file?.valuationType,
      propertyAddress: file?.propertyAddress,
      valuer: file?.valuer,
      valuationDate: file?.valuationDate,
      value: file?.value,
      sender: file?.sender,
      recipient: file?.recipient,
      subject: file?.subject,
      // Load auto-population flag and OCR data
      autopopulationPerformed: file?.autopopulationPerformed || false,
      ocrPerformed: file?.ocrPerformed || false,
      ocrText: file?.ocrText,
      ocrConfidence: file?.ocrConfidence,
      ocrDate: file?.ocrDate
    });
    // setPdfText('');
    setOcrStatus({
      isScanned: false,
      isProcessing: false,
      hasRun: file?.ocrPerformed || false, // Set to true if OCR was already performed
      textLength: file?.ocrText?.length || 0,
      confidence: file?.ocrConfidence
    });
    
    const populateMetadata = async () => {
      if (file) {
        // Only auto-populate if it hasn't been done before
        if (file.autopopulationPerformed) {
          console.log('Auto-population already performed for file:', file.name);
          return;
        }
        
        console.log('Auto-populating metadata for new file:', file.name);
        
        // Start with filename-based metadata
        const suggestedMetadata = getSuggestedMetadata(file.name, vaultType);
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
            if (isElectron()) {
              const pdfResult = await parsePDF(arrayBuffer);
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
          ...suggestedMetadata,
          // Load existing OCR data if available
          ocrPerformed: (file as any).ocrPerformed || false,
          ocrText: (file as any).ocrText || '',
          ocrConfidence: (file as any).ocrConfidence || undefined,
          ocrDate: (file as any).ocrDate || undefined
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
          
          if (pdfData.documentType && !finalMetadata.documentType && !finalMetadata.orderType) {
            // Map PDF document type to form document type for orders section
            if (finalMetadata.section === 'orders') {
              if (pdfData.documentType === 'order') {
                finalMetadata.orderType = 'order';
              } else if (pdfData.documentType === 'application') {
                finalMetadata.orderType = 'application';
              } else if (pdfData.documentType === 'judgment') {
                finalMetadata.orderType = 'judgment';
              }
            }
            // For applications, filename parsing is usually better
          }
        }

        // Auto-detect vault type based on filename and content, with current vault as fallback
        const detectedVaultType = detectVaultType(file.name, pdfText);
        if (detectedVaultType) {
          console.log(`🔍 Auto-detected vault type: ${detectedVaultType} (not storing in metadata)`);
        } else {
          // If no clear vault type detected, use current vault mode as default
          console.log(`🔄 No vault type detected, using prop vault: ${vaultType}`);
        }

        // Store PDF text for future use (AI processing moved to separate page)
        if (pdfText && pdfText.length > 20) {
          // setPdfText(pdfText);
          console.log('📝 PDF text stored (length:', pdfText.length, ')');
        }

        // Mark auto-population as completed  
        (finalMetadata as FileWithOCR).autopopulationPerformed = true;
        
        console.log('Final merged metadata:', finalMetadata);
        setMetadata(finalMetadata);
        
        // Update OCR status based on stored data
        if (finalMetadata.ocrPerformed) {
          setOcrStatus({
            isScanned: true,
            isProcessing: false,
            hasRun: true,
            textLength: finalMetadata.ocrText?.length || 0,
            confidence: typeof finalMetadata.ocrConfidence === 'number' ? finalMetadata.ocrConfidence : undefined
          });
          // Also set the PDF text if OCR was previously performed
          if (finalMetadata.ocrText) {
            // setPdfText(finalMetadata.ocrText);
          }
        }
      }
    };

    populateMetadata();
  }, [file, vaultType]);


  // Manual OCR function
  const runOCR = async () => {
    if (!file || !file.data || !isElectron()) return;

    setOcrStatus(prev => ({ ...prev, isProcessing: true }));

    try {
      console.log('🔍 Starting manual OCR...');
      const arrayBuffer = await file.data.arrayBuffer();
      const ocrResult = await ocrPDF(arrayBuffer);
      
      if (ocrResult.success && ocrResult.text) {
        const ocrText = ocrResult.text;
        console.log(`✅ OCR completed: ${ocrText.length} chars, ${ocrResult.confidence?.toFixed(1)}% confidence`);

        // Replace original PDF with searchable version if available
        if (ocrResult.searchablePdf) {
          console.log('📝 Replacing original PDF with searchable version');
          const searchableBlob = new Blob([ocrResult.searchablePdf], { type: 'application/pdf' });
          const searchableFile = new File([searchableBlob], file.name, { type: 'application/pdf' });

          // Update the file data with searchable PDF
          setUpdatedFileData(searchableFile);
          // Also update the file object for immediate preview update
          (file as any).data = searchableFile;
        }

        // Update OCR status
        setOcrStatus(prev => ({
          ...prev,
          isProcessing: false,
          hasRun: true,
          textLength: ocrText.length,
          confidence: ocrResult.confidence
        }));
        
        // Re-run extraction with OCR text
        try {
          // Import the parser directly to use OCR text instead of re-calling Electron
          const { PDFContentParser } = await import('../../services/documentParser/pdfContentParser');
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
            
            // Add OCR data to metadata
            updatedMetadata.ocrPerformed = true;
            updatedMetadata.ocrText = ocrResult.text;
            updatedMetadata.ocrConfidence = ocrResult.confidence;
            updatedMetadata.ocrDate = new Date().toISOString();
            
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

  const sectionConfigs = getSectionConfigs(vaultType);
  const sections = vaultService.getVaultSections(vaultType);
  const currentSectionConfig = sectionConfigs.find(config => config.id === metadata.section);

  // Vault change handlers
  const handleVaultChangeRequest = (newVaultType: VaultType) => {
    setPendingVaultChange(newVaultType);
    setShowVaultChangeConfirm(true);
  };

  const handleVaultChangeConfirm = async () => {
    if (!file || !pendingVaultChange || !file.id) return;
    
    try {
      // Move file to the new vault
      await vaultService.moveFileToVault(file.id, pendingVaultChange);
      
      // Close confirmation dialog
      setShowVaultChangeConfirm(false);
      setPendingVaultChange(null);
      
      // Close the metadata modal to refresh the main view
      onClose();
    } catch (error) {
      console.error('Failed to change vault:', error);
      alert('Failed to change vault. Please try again.');
    }
  };

  const handleVaultChangeCancel = () => {
    setShowVaultChangeConfirm(false);
    setPendingVaultChange(null);
  };

  const handleDelete = () => {
    if (!file || !file.id) return;
    
    if (window.confirm(`Are you sure you want to delete "${file.name}"?\n\nThis action cannot be undone.`)) {
      onDelete?.(file.id);
      onClose(); // Close the modal after deletion
    }
  };

  const handleSave = () => {
    if (!file) return;
    
    // Generate display name from metadata if section has displayNameFormat
    const currentSection = sectionConfigs.find(s => s.id === metadata.section);
    let displayName = undefined;
    
    if (currentSection?.displayNameFormat) {
      try {
        // Create FileMetadata object for display name generation (exclude OCR fields)
        const metadataForDisplay: FileMetadata = {
          name: metadata.name,
          displayName: metadata.displayName,
          section: metadata.section,
          description: metadata.description,
          courtReference: metadata.courtReference,
          applicationDate: metadata.applicationDate,
          // Include only string fields for filename generation
          orderReference: metadata.orderReference,
          judgeName: metadata.judgeName,
          date: metadata.date,
          reference: metadata.reference,
          personName: metadata.personName,
          expertName: metadata.expertName,
          reportDate: metadata.reportDate,
          orderType: metadata.orderType,
          documentType: metadata.documentType,
          expertType: metadata.expertType,
          childName: metadata.childName,
          planType: metadata.planType,
          reviewDate: metadata.reviewDate,
          socialWorker: metadata.socialWorker,
          disclosureType: metadata.disclosureType,
          period: metadata.period,
          valuationType: metadata.valuationType,
          propertyAddress: metadata.propertyAddress,
          valuer: metadata.valuer,
          valuationDate: metadata.valuationDate,
          value: metadata.value,
          sender: metadata.sender,
          recipient: metadata.recipient,
          subject: metadata.subject
        };
        
        displayName = currentSection.displayNameFormat(metadataForDisplay);
      } catch (error) {
        console.warn('Error generating display name:', error);
        displayName = undefined;
      }
    }

    // Prepare complete metadata including OCR and display name
    const completeMetadata: FileWithOCR = {
      ...metadata,
      name: file.name, // Keep original filename
      displayName,
      // Include OCR data if available
      ocrPerformed: metadata.ocrPerformed,
      ocrText: metadata.ocrText,
      ocrConfidence: metadata.ocrConfidence,
      ocrDate: metadata.ocrDate,
      // Include updated file data if OCR created a searchable PDF
      ...(updatedFileData ? { data: updatedFileData } : {})
    };

    onSave(file.id!, completeMetadata);
    onClose();
  };

  // Stable updateMetadata function using useCallback
  const updateMetadata = useCallback((key: string, value: string) => {
    setMetadata(prev => ({ ...prev, [key]: value }));
  }, []);

  if (!isOpen || !file) return null;

  const renderField = (field: FormField) => {
    const value = (metadata as any)[field.key] || '';
    
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
        // Convert between UK format (DD/MM/YYYY) for storage and ISO format (YYYY-MM-DD) for HTML input
        const ukToIso = (ukDate: string) => {
          if (!ukDate) return '';
          // If already ISO format, return as-is
          if (ukDate.match(/^\d{4}-\d{2}-\d{2}$/)) return ukDate;
          // Parse UK format DD/MM/YYYY
          const parts = ukDate.split('/');
          if (parts.length === 3) {
            const day = parts[0].padStart(2, '0');
            const month = parts[1].padStart(2, '0');
            const year = parts[2];
            if (year.length === 4) {
              return `${year}-${month}-${day}`;
            }
          }
          return ukDate;
        };
        
        const isoToUk = (isoDate: string) => {
          if (!isoDate) return '';
          // If already UK format, return as-is
          if (isoDate.includes('/')) return isoDate;
          // Parse ISO format YYYY-MM-DD
          const parts = isoDate.split('-');
          if (parts.length === 3) {
            const year = parts[0];
            const month = parts[1];
            const day = parts[2];
            return `${day}/${month}/${year}`;
          }
          return isoDate;
        };
        
        return (
          <input
            type="date"
            value={ukToIso(value)} // Convert UK to ISO for input
            onChange={(e) => {
              const isoValue = e.target.value; // HTML input gives ISO format
              const ukValue = isoToUk(isoValue); // Convert to UK format for storage
              updateMetadata(field.key, ukValue);
            }}
            className="form-input"
            required={field.required}
            lang="en-GB" // Force UK locale for DD/MM/YYYY display
          />
        );
      default: // text
        return (
          <input
            type="text"
            value={value || ''}
            onChange={(e) => updateMetadata(field.key, e.target.value)}
            placeholder={field.placeholder}
            className="form-input"
            required={field.required}
          />
        );
    }
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
              {file.type.includes('pdf') && stableFileData ? (
                <ElectronPDFRenderer 
                  file={stableFileData}
                  onLoad={handlePDFLoad}
                  onError={handlePDFError}
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
              <label>Vault Type</label>
              <div className="current-vault-display">
                <span className="vault-indicator">
                  <span className="vault-icon">{vaultType === 'child' ? '👨‍👩‍👧‍👦' : '💰'}</span>
                  {vaultType === 'child' ? 'Child Matters' : 'Financial Matters'}
                </span>
                <div className="vault-change-buttons">
                  {vaultType === 'child' ? (
                    <button 
                      type="button"
                      onClick={() => handleVaultChangeRequest('finance')}
                      className="btn secondary small"
                      title="Move to Financial Matters vault"
                    >
                      💰 Move to Financial
                    </button>
                  ) : (
                    <button 
                      type="button"
                      onClick={() => handleVaultChangeRequest('child')}
                      className="btn secondary small"
                      title="Move to Child Matters vault"
                    >
                      👨‍👩‍👧‍👦 Move to Child
                    </button>
                  )}
                  {onDelete && (
                    <button 
                      type="button"
                      onClick={handleDelete}
                      className="btn danger small"
                      title="Delete this document"
                    >
                      🗑️ Delete
                    </button>
                  )}
                </div>
              </div>
            </div>

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
            {currentSectionConfig && currentSectionConfig.fields.map((field) => {
              // Check if field should be shown
              if (field.showIf && !field.showIf(metadata)) {
                return null;
              }
              
              return (
                <div key={field.key} className="form-group">
                  <label>
                    {field.label}
                    {field.required && <span className="required-asterisk"> *</span>}
                  </label>
                  {renderField(field)}
                </div>
              );
            })}

            {/* Document Processing Status */}
            <div className="form-group">
              <label>Document Processing</label>
              <div className="processing-status-container">
                {ocrStatus.isScanned ? (
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
                          {metadata.ocrDate && (
                            <span className="ocr-date">
                              <br />
                              <small>Performed on {new Date(metadata.ocrDate).toLocaleDateString('en-GB')}</small>
                            </span>
                          )}
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-document-status">
                    <p className="text-document-complete">
                      ✅ Text PDF processed: {ocrStatus.textLength > 0 ? `${ocrStatus.textLength} characters extracted` : 'Text extracted and analyzed'}
                      {metadata.autopopulationPerformed && <br />}
                      {metadata.autopopulationPerformed && <small>Auto-populated from PDF content</small>}
                    </p>
                  </div>
                )}
              </div>
            </div>

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
      
      {/* Vault Change Confirmation Dialog */}
      {showVaultChangeConfirm && (
        <div className="modal-overlay" onClick={handleVaultChangeCancel}>
          <div className="modal-content small" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Confirm Vault Change</h3>
              <button className="close-btn" onClick={handleVaultChangeCancel}>×</button>
            </div>
            <div className="modal-body">
              <p>
                Are you sure you want to move this document from <strong>{vaultType === 'child' ? 'Child Matters' : 'Financial Matters'}</strong> to <strong>{pendingVaultChange === 'child' ? 'Child Matters' : 'Financial Matters'}</strong>?
              </p>
              <p className="warning-text">
                ⚠️ This action will move the document to a different vault. You can move it back if needed.
              </p>
            </div>
            <div className="modal-footer">
              <button 
                onClick={handleVaultChangeCancel}
                className="btn secondary"
              >
                Cancel
              </button>
              <button 
                onClick={handleVaultChangeConfirm}
                className="btn primary"
              >
                Yes, Move Document
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FilePreviewModal;