import React, { useState } from 'react';
import { VaultType } from '../../types/vault';

interface DocumentToolbarProps {
  fileName: string;
  vaultType: VaultType;
  onBack: () => void;
  onVaultChange: (newVault: VaultType) => void;
  onDelete: () => void;
}

const DocumentToolbar: React.FC<DocumentToolbarProps> = ({
  fileName,
  vaultType,
  onBack,
  onVaultChange,
  onDelete,
}) => {
  const [showVaultConfirm, setShowVaultConfirm] = useState(false);
  const targetVault: VaultType = vaultType === 'child' ? 'finance' : 'child';

  const handleVaultMoveClick = () => {
    setShowVaultConfirm(true);
  };

  const handleVaultMoveConfirm = () => {
    onVaultChange(targetVault);
    setShowVaultConfirm(false);
  };

  return (
    <div className="document-toolbar">
      <button className="btn ghost" onClick={onBack}>
        ← Back to Documents
      </button>
      <div className="toolbar-title" title={fileName}>
        {fileName}
      </div>
      <div className="toolbar-actions">
        <button
          className="btn secondary btn-sm"
          onClick={handleVaultMoveClick}
          title={`Move to ${targetVault === 'child' ? 'Child Matters' : 'Financial Matters'}`}
        >
          {targetVault === 'child' ? '👨‍👩‍👧‍👦' : '💰'} Move to {targetVault === 'child' ? 'Child' : 'Financial'}
        </button>
        <button
          className="btn danger btn-sm"
          onClick={onDelete}
          title="Delete this document"
        >
          Delete
        </button>
      </div>

      {/* Inline vault change confirmation */}
      {showVaultConfirm && (
        <div className="vault-confirm-banner">
          <span>
            Move this document to <strong>{targetVault === 'child' ? 'Child Matters' : 'Financial Matters'}</strong>?
          </span>
          <div className="vault-confirm-actions">
            <button className="btn secondary btn-sm" onClick={() => setShowVaultConfirm(false)}>
              Cancel
            </button>
            <button className="btn primary btn-sm" onClick={handleVaultMoveConfirm}>
              Yes, Move
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DocumentToolbar;
