import React from 'react';
import { StoredFile } from '../services/indexedDBService';

interface BundleListProps {
  uploadedFiles: StoredFile[];
}

const BundleList: React.FC<BundleListProps> = ({ uploadedFiles }) => {
  // Placeholder bundles data
  const bundles = [
    {
      id: 1,
      name: 'Initial Court Filing - March 2024',
      createdDate: 'March 10, 2024',
      documentCount: 15,
      status: 'completed',
      watermarked: true
    },
    {
      id: 2,
      name: 'Financial Disclosure Bundle',
      createdDate: 'March 5, 2024',
      documentCount: 8,
      status: 'draft',
      watermarked: true
    }
  ];

  return (
    <div className="bundle-list">
      <div className="bundle-header">
        <h1>Your Bundles</h1>
        <button className="btn primary">
          <span className="btn-icon">➕</span>
          Create New Bundle
        </button>
      </div>

      {bundles.length === 0 ? (
        <div className="empty-bundles">
          <h3>No bundles created yet</h3>
          <p>Create your first bundle to organize documents for court submission</p>
          <button className="btn primary large">Create Your First Bundle</button>
        </div>
      ) : (
        <div className="bundles-grid">
          {bundles.map((bundle) => (
            <div key={bundle.id} className="bundle-card">
              <div className="bundle-icon">📁</div>
              <div className="bundle-info">
                <h3>{bundle.name}</h3>
                <p className="bundle-meta">
                  {bundle.documentCount} documents • Created {bundle.createdDate}
                </p>
                <div className="bundle-status">
                  <span className={`status-badge ${bundle.status}`}>
                    {bundle.status === 'completed' ? '✓ Completed' : '📝 Draft'}
                  </span>
                  {bundle.watermarked && (
                    <span className="watermark-badge">
                      Prepared with MyCaseFiles
                    </span>
                  )}
                </div>
              </div>
              <div className="bundle-actions">
                <button className="action-btn">Edit</button>
                <button className="action-btn">Download</button>
                <button className="action-btn">Duplicate</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="pro-upgrade-banner">
        <h4>Remove watermarks with Professional</h4>
        <p>Upgrade to create clean, professional bundles without watermarks</p>
        <button className="btn secondary">Learn More</button>
      </div>
    </div>
  );
};

export default BundleList;