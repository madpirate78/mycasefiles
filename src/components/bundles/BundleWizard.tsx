import React, { useState, useEffect, useCallback } from 'react';
import { StoredFile } from '../../services/indexedDBService';
import { Bundle } from '../../services/bundleService';
import bundleService from '../../services/bundleService';
import bundleGenerationService from '../../services/bundleGenerationService';
import vaultService from '../../services/vaultService';
import { formatStoredDate } from '../../utils/dateUtils';
import '../../styles/BundleWizard.css';
import '../../styles/Modal.css';
import '../../styles/Forms.css';

interface BundleWizardProps {
  bundle?: Bundle | null;
  uploadedFiles: StoredFile[];
  onClose: () => void;
  onComplete: () => void;
}

type Step = 1 | 2 | 3;

const BundleWizard: React.FC<BundleWizardProps> = ({
  bundle,
  uploadedFiles,
  onClose,
  onComplete,
}) => {
  const isEditing = !!bundle?.id;

  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [bundleData, setBundleData] = useState({
    name: bundle?.name || '',
    caseReference: bundle?.caseReference || '',
    hearingDate: bundle?.hearingDate || '',
    court: bundle?.court || '',
  });
  const [selectedDocuments, setSelectedDocuments] = useState<number[]>(
    bundle?.documentIds || []
  );
  const [bundleProgress, setBundleProgress] = useState<any>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationResult, setGenerationResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  // Initialize document selection
  useEffect(() => {
    if (!bundle?.documentIds || bundle.documentIds.length === 0) {
      const allPdfIds = uploadedFiles
        .filter(file => file.type === 'application/pdf' && file.id)
        .map(file => file.id!);
      setSelectedDocuments(allPdfIds);
    }
  }, [bundle, uploadedFiles]);

  const handleDocumentToggle = useCallback((documentId: number) => {
    setSelectedDocuments(prev =>
      prev.includes(documentId)
        ? prev.filter(id => id !== documentId)
        : [...prev, documentId]
    );
  }, []);

  const handleSectionToggle = useCallback((sectionFiles: StoredFile[], checked: boolean) => {
    const sectionIds = sectionFiles.map(f => f.id!).filter(Boolean);
    setSelectedDocuments(prev => {
      if (checked) {
        const combined = [...prev, ...sectionIds];
        return combined.filter((id, index) => combined.indexOf(id) === index);
      }
      return prev.filter(id => !sectionIds.includes(id));
    });
  }, []);

  // Group files by section
  const getFilesBySection = useCallback(() => {
    const sections = vaultService.getVaultSections('child');
    const filesBySection: Record<string, StoredFile[]> = {};

    sections.forEach(section => {
      filesBySection[section.id] = [];
    });

    uploadedFiles.forEach(file => {
      const section = file.section || 'other';
      if (filesBySection[section]) {
        filesBySection[section].push(file);
      } else if (filesBySection['other']) {
        filesBySection['other'].push(file);
      }
    });

    Object.keys(filesBySection).forEach(sectionId => {
      filesBySection[sectionId].sort((a, b) => {
        if (!a.date && !b.date) return 0;
        if (!a.date) return 1;
        if (!b.date) return -1;
        return new Date(a.date).getTime() - new Date(b.date).getTime();
      });
    });

    return { sections, filesBySection };
  }, [uploadedFiles]);

  const handleNext = async () => {
    if (currentStep === 1) {
      if (!bundleData.name.trim()) {
        alert('Bundle name is required');
        return;
      }
      setCurrentStep(2);
    } else if (currentStep === 2) {
      // Save bundle details and document selection
      try {
        if (isEditing && bundle?.id) {
          await bundleService.updateBundle(bundle.id, {
            ...bundleData,
            documentIds: selectedDocuments,
            documentCount: selectedDocuments.length,
          });
        } else {
          // Create bundle first (without documents), then update with selection
          const created = await bundleService.createBundle(bundleData);
          if (created.id) {
            await bundleService.updateBundle(created.id, {
              documentIds: selectedDocuments,
              documentCount: selectedDocuments.length,
            });
          }
        }
        setCurrentStep(3);
      } catch (error) {
        console.error('Error saving bundle:', error);
        alert('Failed to save bundle. Please try again.');
      }
    }
  };

  const handleBack = () => {
    if (currentStep === 2) setCurrentStep(1);
    else if (currentStep === 3) setCurrentStep(2);
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    setGenerationResult(null);

    const selectedFiles = uploadedFiles.filter(file =>
      selectedDocuments.includes(file.id!)
    );

    if (selectedFiles.length === 0) {
      setGenerationResult({ success: false, message: 'No documents selected.' });
      setIsGenerating(false);
      return;
    }

    const cleanup = bundleGenerationService.setupProgressListener((progress) => {
      setBundleProgress(progress);
    });

    try {
      const bundleForGeneration: Bundle = {
        ...bundle!,
        ...bundleData,
        documentIds: selectedDocuments,
        documentCount: selectedDocuments.length,
        createdDate: bundle?.createdDate || new Date().toISOString(),
        status: 'draft',
        watermarked: bundle?.watermarked || true,
      };

      const result = await bundleGenerationService.generateBundle(
        bundleForGeneration,
        selectedFiles
      );

      if (result.success) {
        setGenerationResult({
          success: true,
          message: `Bundle "${result.filename}" created successfully!`,
        });
      } else {
        setGenerationResult({
          success: false,
          message: `Error: ${result.error}`,
        });
      }
    } catch (error) {
      setGenerationResult({
        success: false,
        message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    } finally {
      cleanup();
      setIsGenerating(false);
    }
  };

  const stepLabels = ['Details', 'Select Documents', 'Review & Generate'];

  return (
    <div className="wizard-overlay" onClick={onClose}>
      <div className="wizard-container" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="wizard-header">
          <h2>{isEditing ? 'Edit Bundle' : 'Create Bundle'}</h2>
          <div className="wizard-steps">
            {stepLabels.map((label, i) => {
              const stepNum = (i + 1) as Step;
              const isActive = stepNum === currentStep;
              const isCompleted = stepNum < currentStep;
              return (
                <React.Fragment key={stepNum}>
                  {i > 0 && <span className="step-divider" />}
                  <div className={`wizard-step ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}`}>
                    <span className="step-number">
                      {isCompleted ? '✓' : stepNum}
                    </span>
                    <span>{label}</span>
                  </div>
                </React.Fragment>
              );
            })}
          </div>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        {/* Body */}
        <div className="wizard-body">
          {/* Step 1: Details */}
          {currentStep === 1 && (
            <div className="bundle-form">
              <div className="form-group">
                <label>Bundle Name *</label>
                <input
                  type="text"
                  value={bundleData.name}
                  onChange={(e) => setBundleData({ ...bundleData, name: e.target.value })}
                  placeholder="e.g., Application Bundle - March 2025"
                  className="form-input"
                  autoFocus
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Case Reference</label>
                  <input
                    type="text"
                    value={bundleData.caseReference}
                    onChange={(e) => setBundleData({ ...bundleData, caseReference: e.target.value })}
                    placeholder="e.g., AB12C34567"
                    className="form-input"
                  />
                </div>
                <div className="form-group">
                  <label>Hearing Date</label>
                  <input
                    type="date"
                    value={bundleData.hearingDate}
                    onChange={(e) => setBundleData({ ...bundleData, hearingDate: e.target.value })}
                    className="form-input"
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Court</label>
                <input
                  type="text"
                  value={bundleData.court}
                  onChange={(e) => setBundleData({ ...bundleData, court: e.target.value })}
                  placeholder="e.g., Central Family Court"
                  className="form-input"
                />
              </div>
            </div>
          )}

          {/* Step 2: Select Documents */}
          {currentStep === 2 && (
            <div className="document-selection">
              <div className="document-selection-counter">
                <span>
                  {selectedDocuments.length} of {uploadedFiles.filter(f => f.type === 'application/pdf').length} documents selected
                </span>
              </div>

              <div className="document-sections">
                {(() => {
                  const { sections, filesBySection } = getFilesBySection();
                  return sections.map((section, index) => {
                    const sectionFiles = filesBySection[section.id] || [];
                    if (sectionFiles.length === 0) return null;

                    const sectionLetter = String.fromCharCode(65 + index);
                    const allSelected = sectionFiles.every(f => selectedDocuments.includes(f.id!));
                    const someSelected = sectionFiles.some(f => selectedDocuments.includes(f.id!));

                    return (
                      <div key={section.id} className="document-section">
                        <h4>
                          <label className="select-all-section">
                            <input
                              type="checkbox"
                              checked={allSelected}
                              ref={(el) => {
                                if (el) el.indeterminate = someSelected && !allSelected;
                              }}
                              onChange={(e) => handleSectionToggle(sectionFiles, e.target.checked)}
                            />
                            Section {sectionLetter}: {section.label}
                          </label>
                          <span className="section-count">({sectionFiles.length})</span>
                        </h4>
                        <div className="document-list">
                          {sectionFiles.map(file => (
                            <div key={file.id} className={`document-item ${!file.date ? 'no-date' : ''}`}>
                              <label className="document-checkbox">
                                <input
                                  type="checkbox"
                                  checked={selectedDocuments.includes(file.id!)}
                                  onChange={() => handleDocumentToggle(file.id!)}
                                />
                                <div className="document-info">
                                  <div className="document-name">{file.displayName || file.name}</div>
                                  <div className="document-meta">
                                    {file.date ? formatStoredDate(file.date) : '⚠ No date'}
                                    {file.courtReference && ` · ${file.courtReference}`}
                                    {file.judgeName && ` · ${file.judgeName}`}
                                  </div>
                                </div>
                              </label>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          )}

          {/* Step 3: Review & Generate */}
          {currentStep === 3 && (
            <div className="review-summary">
              <div className="review-card">
                <h4>Bundle Details</h4>
                <div className="review-stat">
                  <span>Name</span>
                  <span>{bundleData.name}</span>
                </div>
                {bundleData.caseReference && (
                  <div className="review-stat">
                    <span>Case Reference</span>
                    <span>{bundleData.caseReference}</span>
                  </div>
                )}
                {bundleData.court && (
                  <div className="review-stat">
                    <span>Court</span>
                    <span>{bundleData.court}</span>
                  </div>
                )}
                {bundleData.hearingDate && (
                  <div className="review-stat">
                    <span>Hearing Date</span>
                    <span>{formatStoredDate(bundleData.hearingDate)}</span>
                  </div>
                )}
              </div>

              <div className="review-card">
                <h4>Documents</h4>
                <div className="review-stat">
                  <span>Total documents</span>
                  <span>{selectedDocuments.length}</span>
                </div>
                {(() => {
                  const { sections, filesBySection } = getFilesBySection();
                  return sections.map((section, index) => {
                    const sectionFiles = (filesBySection[section.id] || []).filter(f =>
                      selectedDocuments.includes(f.id!)
                    );
                    if (sectionFiles.length === 0) return null;
                    const letter = String.fromCharCode(65 + index);
                    return (
                      <div key={section.id} className="review-stat">
                        <span>Section {letter}: {section.label}</span>
                        <span>{sectionFiles.length}</span>
                      </div>
                    );
                  });
                })()}
              </div>

              {/* Generation Progress */}
              {(isGenerating || generationResult) && (
                <div className="wizard-progress">
                  {isGenerating && bundleProgress && (
                    <>
                      <div className="progress-bar">
                        <div
                          className="progress-bar-fill"
                          style={{ width: `${bundleProgress.progress || 0}%` }}
                        />
                      </div>
                      <div className="progress-message">
                        {bundleProgress.message || 'Preparing...'}
                      </div>
                    </>
                  )}
                  {generationResult?.success && (
                    <div className="success-message">
                      {generationResult.message}
                    </div>
                  )}
                  {generationResult && !generationResult.success && (
                    <div className="error-message">
                      {generationResult.message}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="wizard-footer">
          <div className="wizard-footer-left">
            {currentStep > 1 && !isGenerating && !generationResult?.success && (
              <button className="btn secondary" onClick={handleBack}>
                Back
              </button>
            )}
          </div>
          <div className="wizard-footer-right">
            <button className="btn secondary" onClick={generationResult?.success ? () => { onComplete(); onClose(); } : onClose}>
              {generationResult?.success ? 'Done' : 'Cancel'}
            </button>
            {currentStep < 3 && (
              <button
                className="btn primary"
                onClick={handleNext}
                disabled={currentStep === 1 && !bundleData.name.trim()}
              >
                Next
              </button>
            )}
            {currentStep === 3 && !generationResult?.success && (
              <button
                className="btn primary"
                onClick={handleGenerate}
                disabled={isGenerating || selectedDocuments.length === 0}
              >
                {isGenerating ? 'Generating...' : 'Generate PDF'}
              </button>
            )}
            {generationResult && !generationResult.success && (
              <button className="btn primary" onClick={handleGenerate}>
                Retry
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BundleWizard;
