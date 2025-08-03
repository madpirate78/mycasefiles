import React, { useState, useEffect } from 'react';
import { StoredFile } from '../services/indexedDBService';
import bundleService, { Bundle } from '../services/bundleService';
import { formatStoredDate } from '../utils/dateUtils';

interface BundleListProps {
  uploadedFiles: StoredFile[];
}

const BundleList: React.FC<BundleListProps> = ({ uploadedFiles }) => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [newBundleData, setNewBundleData] = useState({
    name: '',
    caseReference: '',
    hearingDate: '',
    court: ''
  });

  // Load bundles on component mount
  useEffect(() => {
    loadBundles();
  }, []);

  const loadBundles = async () => {
    try {
      console.log('Loading bundles...');
      const allBundles = await bundleService.getAllBundles();
      console.log('Loaded bundles:', allBundles);
      setBundles(allBundles);
    } catch (error) {
      console.error('Error loading bundles:', error);
    }
  };

  const handleCreateBundle = async () => {
    try {
      console.log('Creating bundle with data:', newBundleData);
      console.log('Bundle name length:', newBundleData.name.trim().length);
      
      if (!newBundleData.name.trim()) {
        alert('Bundle name is required');
        return;
      }
      
      console.log('Calling bundleService.createBundle...');
      const createdBundle = await bundleService.createBundle(newBundleData);
      console.log('Bundle created successfully:', createdBundle);
      
      setShowCreateModal(false);
      // Reset form
      setNewBundleData({
        name: '',
        caseReference: '',
        hearingDate: '',
        court: ''
      });
      
      console.log('Reloading bundles...');
      await loadBundles();
      console.log('Bundles reloaded');
    } catch (error) {
      console.error('Error creating bundle:', error);
      console.error('Error details:', error instanceof Error ? error.message : 'Unknown error', error instanceof Error ? error.stack : '');
      alert('Failed to create bundle. Please try again. Check console for details.');
    }
  };

  return (
    <div className="bundle-list">
      <div className="bundle-header">
        <h1>Your Bundles</h1>
        <button className="btn primary" onClick={() => setShowCreateModal(true)}>
          <span className="btn-icon">➕</span>
          Create New Bundle
        </button>
      </div>

      {bundles.length === 0 ? (
        <div className="empty-bundles">
          <h3>No bundles created yet</h3>
          <p>Create your first bundle to organize documents for court submission</p>
        </div>
      ) : (
        <div className="bundles-grid">
          {bundles.map((bundle) => (
            <div key={bundle.id} className="bundle-card">
              <div className="bundle-icon">📁</div>
              <div className="bundle-info">
                <h3>{bundle.name}</h3>
                <p className="bundle-meta">
                  {bundle.documentCount} documents • Created {formatStoredDate(bundle.createdDate)}
                  {bundle.caseReference && ` • ${bundle.caseReference}`}
                </p>
                {bundle.court && (
                  <p className="bundle-court">{bundle.court}</p>
                )}
                {bundle.hearingDate && (
                  <p className="bundle-hearing">Hearing: {formatStoredDate(bundle.hearingDate)}</p>
                )}
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

      {/* Create Bundle Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Create New Bundle</h2>
              <button className="close-btn" onClick={() => setShowCreateModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="bundle-form">
                <div className="form-group">
                  <label>Bundle Name *</label>
                  <input
                    type="text"
                    value={newBundleData.name}
                    onChange={(e) => setNewBundleData({...newBundleData, name: e.target.value})}
                    placeholder="e.g., Application Bundle - March 2025"
                    className="form-input"
                    required
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Case Reference</label>
                    <input
                      type="text"
                      value={newBundleData.caseReference}
                      onChange={(e) => setNewBundleData({...newBundleData, caseReference: e.target.value})}
                      placeholder="e.g., AB12C34567"
                      className="form-input"
                    />
                  </div>

                  <div className="form-group">
                    <label>Hearing Date</label>
                    <input
                      type="date"
                      value={newBundleData.hearingDate}
                      onChange={(e) => setNewBundleData({...newBundleData, hearingDate: e.target.value})}
                      className="form-input"
                      lang="en-GB"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Court</label>
                  <input
                    type="text"
                    value={newBundleData.court}
                    onChange={(e) => setNewBundleData({...newBundleData, court: e.target.value})}
                    placeholder="e.g., Central Family Court"
                    className="form-input"
                  />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn secondary" onClick={() => setShowCreateModal(false)}>
                Cancel
              </button>
              <button 
                className="btn primary" 
                onClick={handleCreateBundle}
                disabled={!newBundleData.name.trim()}
              >
                Create Bundle
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BundleList;