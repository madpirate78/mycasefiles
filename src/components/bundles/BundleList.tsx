import React, { useState, useEffect } from 'react';
import { StoredFile } from '../../services/indexedDBService';
import bundleService, { Bundle } from '../../services/bundleService';
import { formatStoredDate } from '../../utils/dateUtils';
import BundleWizard from './BundleWizard';
import '../../styles/BundleList.css';

interface BundleListProps {
  uploadedFiles: StoredFile[];
}

const getBundleStatusBadge = (bundle: Bundle, uploadedFiles: StoredFile[]): { label: string; className: string } => {
  if (bundle.status === 'completed') {
    return { label: 'PDF generated', className: 'completed' };
  }
  if (!bundle.documentIds || bundle.documentIds.length === 0) {
    return { label: 'No documents selected', className: 'draft' };
  }
  return { label: 'Ready to generate', className: 'draft' };
};

const BundleList: React.FC<BundleListProps> = ({ uploadedFiles }) => {
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [wizardBundle, setWizardBundle] = useState<Bundle | null | undefined>(undefined);
  const [showWizard, setShowWizard] = useState(false);

  useEffect(() => {
    loadBundles();
  }, []);

  const loadBundles = async () => {
    try {
      const allBundles = await bundleService.getAllBundles();
      setBundles(allBundles);
    } catch (error) {
      console.error('Error loading bundles:', error);
    }
  };

  const handleCreateNew = () => {
    setWizardBundle(null);
    setShowWizard(true);
  };

  const handleOpenBundle = (bundle: Bundle) => {
    setWizardBundle(bundle);
    setShowWizard(true);
  };

  const handleWizardClose = () => {
    setShowWizard(false);
    setWizardBundle(undefined);
  };

  const handleWizardComplete = () => {
    loadBundles();
  };

  const handleDeleteBundle = async (bundleId: number) => {
    if (window.confirm('Are you sure you want to delete this bundle?\n\nThis action cannot be undone.')) {
      try {
        await bundleService.deleteBundle(bundleId);
        loadBundles();
      } catch (error) {
        console.error('Error deleting bundle:', error);
      }
    }
  };

  return (
    <div className="bundle-list">
      <div className="bundle-header">
        <h1>Your Bundles</h1>
        <button className="btn primary" onClick={handleCreateNew}>
          Create New Bundle
        </button>
      </div>

      {bundles.length === 0 ? (
        <div className="empty-bundles">
          <h3>No bundles created yet</h3>
          <p>Create your first bundle to organise documents for court submission</p>
          <button className="btn primary" onClick={handleCreateNew}>
            Create New Bundle
          </button>
        </div>
      ) : (
        <div className="bundles-grid">
          {bundles.map((bundle) => {
            const status = getBundleStatusBadge(bundle, uploadedFiles);
            return (
              <div key={bundle.id} className="bundle-card">
                <div className="bundle-icon">📁</div>
                <div className="bundle-info">
                  <h3>{bundle.name}</h3>
                  <p className="bundle-meta">
                    {bundle.documentCount} documents · Created {formatStoredDate(bundle.createdDate)}
                    {bundle.caseReference && ` · ${bundle.caseReference}`}
                  </p>
                  {bundle.court && (
                    <p className="bundle-court">{bundle.court}</p>
                  )}
                  {bundle.hearingDate && (
                    <p className="bundle-hearing">Hearing: {formatStoredDate(bundle.hearingDate)}</p>
                  )}
                  <div className="bundle-status">
                    <span className={`status-badge ${status.className}`}>
                      {status.label}
                    </span>
                    {bundle.watermarked && (
                      <span className="watermark-badge">
                        Prepared with MyCaseFiles
                      </span>
                    )}
                  </div>
                </div>
                <div className="bundle-actions">
                  <button
                    className="action-btn primary"
                    onClick={() => handleOpenBundle(bundle)}
                  >
                    Open
                  </button>
                  <button
                    className="action-btn"
                    onClick={() => bundle.id && handleDeleteBundle(bundle.id)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Bundle Wizard */}
      {showWizard && (
        <BundleWizard
          bundle={wizardBundle}
          uploadedFiles={uploadedFiles}
          onClose={handleWizardClose}
          onComplete={handleWizardComplete}
        />
      )}
    </div>
  );
};

export default BundleList;
