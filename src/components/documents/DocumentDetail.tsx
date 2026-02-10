import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { StoredFile } from '../../services/indexedDBService';
import ElectronPDFRenderer from './ElectronPDFRenderer';
import MetadataForm from './MetadataForm';
import PageSelectionPanel from './PageSelectionPanel';
import DocumentToolbar from './DocumentToolbar';
import { getSuggestedMetadata, extractFromPDF } from '../../services/documentParser';
import { VaultType } from '../../types/vault';
import vaultService from '../../services/vaultService';
import { isElectron, parsePDF, ocrPDF } from '../../services/electronAPI';
import { getSectionConfigs, FileMetadata } from '../../constants/sectionConfig';
import { FileWithOCR } from './FilePreviewModal';
import '../../styles/DocumentDetail.css';

interface DocumentDetailProps {
  file: StoredFile;
  vaultType: VaultType;
  onBack: () => void;
  onSave: (fileId: number, metadata: FileWithOCR) => void;
  onDelete: (fileId: number) => void;
  onPageSelectionUpdate: (fileId: number, selectedPages: number[], totalPages: number) => void;
}

type Tab = 'metadata' | 'pages';

const DocumentDetail: React.FC<DocumentDetailProps> = ({
  file,
  vaultType,
  onBack,
  onSave,
  onDelete,
  onPageSelectionUpdate,
}) => {
  const [activeTab, setActiveTab] = useState<Tab>('metadata');
  const [showOptionalFields, setShowOptionalFields] = useState(false);
  const [updatedFileData, setUpdatedFileData] = useState<File | null>(null);

  const [metadata, setMetadata] = useState<FileWithOCR>({
    name: file?.name || '',
    section: 'other',
    description: ''
  });

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

  // Stable file data for PDF renderer
  const stableFileData = useMemo(() => file?.data, [file?.data]);

  const handlePDFLoad = useCallback(() => {}, []);
  const handlePDFError = useCallback((error: string) => {
    console.error('PDF error:', error);
  }, []);

  // Load existing metadata when file changes
  useEffect(() => {
    if (!file) return;

    setMetadata({
      name: file.name || '',
      section: file.section || 'other',
      description: file.description || '',
      courtReference: file.courtReference,
      applicationDate: file.applicationDate,
      displayName: file.displayName,
      orderReference: file.orderReference,
      judgeName: file.judgeName,
      date: file.date,
      reference: file.reference,
      personName: file.personName,
      expertName: file.expertName,
      reportDate: file.reportDate,
      orderType: file.orderType,
      documentType: file.documentType,
      expertType: file.expertType,
      childName: file.childName,
      planType: file.planType,
      reviewDate: file.reviewDate,
      socialWorker: file.socialWorker,
      disclosureType: file.disclosureType,
      period: file.period,
      valuationType: file.valuationType,
      propertyAddress: file.propertyAddress,
      valuer: file.valuer,
      valuationDate: file.valuationDate,
      value: file.value,
      sender: file.sender,
      recipient: file.recipient,
      subject: file.subject,
      autopopulationPerformed: file.autopopulationPerformed || false,
      ocrPerformed: file.ocrPerformed || false,
      ocrText: file.ocrText,
      ocrConfidence: file.ocrConfidence,
      ocrDate: file.ocrDate
    });

    setOcrStatus({
      isScanned: false,
      isProcessing: false,
      hasRun: file.ocrPerformed || false,
      textLength: file.ocrText?.length || 0,
      confidence: file.ocrConfidence
    });

    // Auto-populate metadata for new files
    const populateMetadata = async () => {
      if (file.autopopulationPerformed) return;

      const suggestedMetadata = getSuggestedMetadata(file.name, vaultType);
      let pdfData = null;

      if (file.type.includes('pdf') && file.data) {
        try {
          const arrayBuffer = await file.data.arrayBuffer();

          if (isElectron()) {
            const pdfResult = await parsePDF(arrayBuffer);
            if (pdfResult.success && pdfResult.text) {
              const textLength = pdfResult.text.length;
              const isScanned = (pdfResult as any).isScanned ||
                textLength < 50 ||
                ((pdfResult as any).info?.Producer && (pdfResult as any).info.Producer.includes('EPSON Scan'));

              setOcrStatus({
                isScanned,
                isProcessing: false,
                hasRun: (pdfResult as any).extractionMethod === 'OCR',
                textLength,
                confidence: undefined
              });
            }
          }

          pdfData = await extractFromPDF(arrayBuffer);
        } catch (error) {
          console.error('PDF extraction failed:', error);
        }
      }

      const finalMetadata: any = {
        name: file.name,
        section: suggestedMetadata.section || 'other',
        description: '',
        ...suggestedMetadata,
        ocrPerformed: file.ocrPerformed || false,
        ocrText: file.ocrText || '',
        ocrConfidence: file.ocrConfidence || undefined,
        ocrDate: file.ocrDate || undefined
      };

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
        if (pdfData.documentType === 'statement') {
          finalMetadata.section = 'statements';
          if (pdfData.personName) {
            finalMetadata.personName = pdfData.personName;
          }
        }
        if (pdfData.documentType && !finalMetadata.documentType && !finalMetadata.orderType) {
          if (finalMetadata.section === 'orders') {
            if (pdfData.documentType === 'order') finalMetadata.orderType = 'order';
            else if (pdfData.documentType === 'application') finalMetadata.orderType = 'application';
            else if (pdfData.documentType === 'judgment') finalMetadata.orderType = 'judgment';
          }
        }
      }

      (finalMetadata as FileWithOCR).autopopulationPerformed = true;
      setMetadata(finalMetadata as FileWithOCR);

      if (finalMetadata.ocrPerformed) {
        setOcrStatus({
          isScanned: true,
          isProcessing: false,
          hasRun: true,
          textLength: finalMetadata.ocrText?.length || 0,
          confidence: typeof finalMetadata.ocrConfidence === 'number' ? finalMetadata.ocrConfidence : undefined
        });
      }
    };

    populateMetadata();
  }, [file, vaultType]);

  // Manual OCR
  const runOCR = useCallback(async () => {
    if (!file || !file.data || !isElectron()) return;

    setOcrStatus(prev => ({ ...prev, isProcessing: true }));

    try {
      const arrayBuffer = await file.data.arrayBuffer();
      const ocrResult = await ocrPDF(arrayBuffer);

      if (ocrResult.success && ocrResult.text) {
        if (ocrResult.searchablePdf) {
          const searchableBlob = new Blob([ocrResult.searchablePdf], { type: 'application/pdf' });
          const searchableFile = new File([searchableBlob], file.name, { type: 'application/pdf' });
          setUpdatedFileData(searchableFile);
          (file as any).data = searchableFile;
        }

        setOcrStatus(prev => ({
          ...prev,
          isProcessing: false,
          hasRun: true,
          textLength: ocrResult.text!.length,
          confidence: ocrResult.confidence
        }));

        try {
          const { PDFContentParser } = await import('../../services/documentParser/pdfContentParser');
          const parser = new PDFContentParser();
          const pdfData = parser.extractFromText(ocrResult.text!);

          if (pdfData) {
            setMetadata(prev => {
              const updated = { ...prev };
              if (pdfData.caseNumber && !updated.reference) updated.reference = pdfData.caseNumber;
              if (pdfData.caseNumber && !updated.courtReference) updated.courtReference = pdfData.caseNumber;
              if (pdfData.judgeName) updated.judgeName = pdfData.judgeName;
              if (pdfData.documentType === 'statement') {
                updated.section = 'statements';
                if (pdfData.personName) updated.personName = pdfData.personName;
              }
              updated.ocrPerformed = true;
              updated.ocrText = ocrResult.text;
              updated.ocrConfidence = ocrResult.confidence;
              updated.ocrDate = new Date().toISOString();
              return updated;
            });
          }
        } catch (extractError) {
          console.error('Pattern extraction failed after OCR:', extractError);
        }
      } else {
        setOcrStatus(prev => ({ ...prev, isProcessing: false, hasRun: false }));
      }
    } catch (error) {
      console.error('OCR processing failed:', error);
      setOcrStatus(prev => ({ ...prev, isProcessing: false, hasRun: false }));
    }
  }, [file]);

  const sectionConfigs = getSectionConfigs(vaultType);

  const handleSave = useCallback(() => {
    if (!file) return;

    const currentSection = sectionConfigs.find(s => s.id === metadata.section);
    let displayName = undefined;

    if (currentSection?.displayNameFormat) {
      try {
        const metadataForDisplay: FileMetadata = {
          name: metadata.name,
          displayName: metadata.displayName,
          section: metadata.section,
          description: metadata.description,
          courtReference: metadata.courtReference,
          applicationDate: metadata.applicationDate,
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
      }
    }

    const completeMetadata: FileWithOCR = {
      ...metadata,
      name: file.name,
      displayName,
      ocrPerformed: metadata.ocrPerformed,
      ocrText: metadata.ocrText,
      ocrConfidence: metadata.ocrConfidence,
      ocrDate: metadata.ocrDate,
      ...(updatedFileData ? { data: updatedFileData } : {})
    };

    onSave(file.id!, completeMetadata);
  }, [file, metadata, sectionConfigs, updatedFileData, onSave]);

  const handleUpdateMetadata = useCallback((key: string, value: string) => {
    setMetadata(prev => ({ ...prev, [key]: value }));
  }, []);

  const handleSectionChange = useCallback((section: string) => {
    setMetadata(prev => ({ ...prev, section }));
  }, []);

  const handleDescriptionChange = useCallback((description: string) => {
    setMetadata(prev => ({ ...prev, description }));
  }, []);

  const handleVaultChange = useCallback(async (newVault: VaultType) => {
    if (!file?.id) return;
    try {
      await vaultService.moveFileToVault(file.id, newVault);
      onBack();
    } catch (error) {
      console.error('Failed to change vault:', error);
      alert('Failed to change vault. Please try again.');
    }
  }, [file, onBack]);

  const handleDelete = useCallback(() => {
    if (!file?.id) return;
    if (window.confirm(`Are you sure you want to delete "${file.name}"?\n\nThis action cannot be undone.`)) {
      onDelete(file.id);
      onBack();
    }
  }, [file, onDelete, onBack]);

  const handlePageSave = useCallback((fileId: number, selectedPages: number[], totalPages: number) => {
    onPageSelectionUpdate(fileId, selectedPages, totalPages);
  }, [onPageSelectionUpdate]);

  return (
    <div className="document-detail">
      <DocumentToolbar
        fileName={file.name}
        vaultType={vaultType}
        onBack={onBack}
        onVaultChange={handleVaultChange}
        onDelete={handleDelete}
      />

      <div className="document-detail-body">
        {/* Left: PDF Preview */}
        <div className="detail-pdf-panel">
          {file.type.includes('pdf') && stableFileData ? (
            <ElectronPDFRenderer
              file={stableFileData}
              onLoad={handlePDFLoad}
              onError={handlePDFError}
              showNavigation={true}
            />
          ) : (
            <div className="file-preview">
              <span className="file-icon" style={{ fontSize: '3rem' }}>📄</span>
              <p>{file.name}</p>
              <p style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-size-sm)' }}>
                Preview not available for this file type
              </p>
            </div>
          )}
        </div>

        {/* Right: Tabbed panel */}
        <div className="detail-right-panel">
          <div className="detail-tabs">
            <button
              className={`detail-tab ${activeTab === 'metadata' ? 'active' : ''}`}
              onClick={() => setActiveTab('metadata')}
            >
              Metadata
            </button>
            {file.type.includes('pdf') && (
              <button
                className={`detail-tab ${activeTab === 'pages' ? 'active' : ''}`}
                onClick={() => setActiveTab('pages')}
              >
                Pages
                {file.selectedPages && file.selectedPages.length > 0 && file.totalPages && (
                  <span className="tab-badge">{file.selectedPages.length}/{file.totalPages}</span>
                )}
              </button>
            )}
          </div>

          <div className="detail-tab-content">
            {activeTab === 'metadata' && (
              <>
                {/* OCR Banner */}
                {ocrStatus.isScanned && !ocrStatus.hasRun && !ocrStatus.isProcessing && (
                  <div className="ocr-banner">
                    <p>Scanned document detected ({ocrStatus.textLength} chars extracted)</p>
                    <button className="btn secondary btn-sm" onClick={runOCR}>
                      Run OCR to Extract Full Text
                    </button>
                  </div>
                )}
                {ocrStatus.isProcessing && (
                  <div className="ocr-banner processing">
                    <p>Running OCR analysis... Please wait.</p>
                  </div>
                )}
                {ocrStatus.hasRun && !ocrStatus.isProcessing && (
                  <div className="ocr-banner success">
                    <p>
                      OCR completed: {ocrStatus.textLength} characters
                      {ocrStatus.confidence && ` (${ocrStatus.confidence.toFixed(1)}% confidence)`}
                    </p>
                  </div>
                )}

                <MetadataForm
                  metadata={metadata}
                  vaultType={vaultType}
                  onUpdate={handleUpdateMetadata}
                  onSectionChange={handleSectionChange}
                  onDescriptionChange={handleDescriptionChange}
                  showOptionalFields={showOptionalFields}
                />

                {!showOptionalFields && (
                  <button
                    className="btn ghost btn-sm"
                    onClick={() => setShowOptionalFields(true)}
                    style={{ marginBottom: 'var(--spacing-md)' }}
                  >
                    Show more fields
                  </button>
                )}

                <div className="form-actions">
                  <button className="btn secondary" onClick={onBack}>Cancel</button>
                  <button className="btn primary" onClick={handleSave}>
                    Save & Organise
                  </button>
                </div>
              </>
            )}

            {activeTab === 'pages' && (
              <PageSelectionPanel
                file={file}
                onSave={handlePageSave}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DocumentDetail;
