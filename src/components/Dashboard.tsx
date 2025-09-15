import React from 'react';
import { StoredFile } from '../services/indexedDBService';
import { VaultType } from '../types/vault';

interface DashboardProps {
  uploadedFiles: StoredFile[];
  onFileUpload: (files: FileList) => void;
  onQuickOrganize: (fileId: number, section: string, vaultType: VaultType) => void;
  currentVault: VaultType;
}

const Dashboard: React.FC<DashboardProps> = ({ onFileUpload }) => {


  return (
    <div className="dashboard">
      <div className="simple-upload">
        <input
          type="file"
          id="simple-file-upload"
          multiple
          accept=".pdf,application/pdf"
          onChange={(e) => e.target.files && onFileUpload(e.target.files)}
          style={{ display: 'none' }}
        />
        <label htmlFor="simple-file-upload" className="btn primary large">
          📁 Upload Documents
        </label>
      </div>
    </div>
  );
};

export default Dashboard;