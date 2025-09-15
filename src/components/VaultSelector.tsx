import React from 'react';
import { VaultType } from '../types/vault';

interface VaultSelectorProps {
  currentVault: VaultType;
  onVaultChange: (vault: VaultType) => void;
}

const VaultSelector: React.FC<VaultSelectorProps> = ({ currentVault, onVaultChange }) => {
  const handleVaultClick = (vaultType: VaultType) => {
    console.log(`🏛️ VAULT BUTTON CLICKED: ${vaultType === 'child' ? 'Child Matters' : 'Financial Matters'} button pressed`);
    onVaultChange(vaultType);
  };

  return (
    <div className="vault-selector">
      <button
        className={`vault-btn ${currentVault === 'child' ? 'active' : ''}`}
        data-vault="child"
        onClick={() => handleVaultClick('child')}
      >
        <span className="vault-icon">👨‍👩‍👧‍👦</span>
        <span className="vault-label">Child Matters</span>
      </button>
      <button
        className={`vault-btn ${currentVault === 'finance' ? 'active' : ''}`}
        data-vault="finance"
        onClick={() => handleVaultClick('finance')}
      >
        <span className="vault-icon">💰</span>
        <span className="vault-label">Financial Matters</span>
      </button>
    </div>
  );
};

export default VaultSelector;