import React, { useState, useEffect, useCallback } from 'react';
import { VaultType, VaultSettings as VaultSettingsType } from '../types/vault';
import vaultService from '../services/vaultService';
import './VaultSettings.css';

interface VaultSettingsProps {
  vaultType: VaultType;
}

const VaultSettings: React.FC<VaultSettingsProps> = ({ vaultType }) => {
  const [settings, setSettings] = useState<VaultSettingsType>({
    type: vaultType,
    fatherName: vaultType === 'child' ? '' : undefined,
    motherName: vaultType === 'child' ? '' : undefined,
    applicantName: vaultType === 'finance' ? '' : undefined,
    respondentName: vaultType === 'finance' ? '' : undefined,
    children: vaultType === 'child' ? [] : undefined
  });
  const [editedSettings, setEditedSettings] = useState(settings);

  const loadSettings = useCallback(async () => {
    try {
      const vaultSettings = await vaultService.getVaultSettings(vaultType);
      setSettings(vaultSettings);
      setEditedSettings(vaultSettings);
    } catch (error) {
      console.error('Error loading vault settings:', error);
    }
  }, [vaultType]);

  useEffect(() => {
    loadSettings();
  }, [vaultType, loadSettings]);


  // Auto-save on change
  const handleFieldChange = async (field: string, value: any) => {
    const newSettings = { ...editedSettings, [field]: value };
    setEditedSettings(newSettings);
    
    try {
      await vaultService.updateVaultSettings(vaultType, newSettings);
      setSettings(newSettings);
    } catch (error) {
      console.error('Error auto-saving settings:', error);
    }
  };

  const addChild = async () => {
    if (editedSettings.children) {
      const newChildren = [...editedSettings.children, { name: '', dateOfBirth: undefined }];
      await handleFieldChange('children', newChildren);
    }
  };

  const removeChild = async (index: number) => {
    if (editedSettings.children) {
      const newChildren = editedSettings.children.filter((_, i) => i !== index);
      await handleFieldChange('children', newChildren);
    }
  };

  const updateChild = async (index: number, field: 'name' | 'dateOfBirth', value: string) => {
    if (editedSettings.children) {
      const newChildren = [...editedSettings.children];
      if (field === 'name') {
        newChildren[index].name = value;
      } else {
        newChildren[index].dateOfBirth = value ? new Date(value) : undefined;
      }
      await handleFieldChange('children', newChildren);
    }
  };

  return (
    <div className="vault-settings">
      <div className="settings-header">
        <h2>Case Settings - {vaultType === 'child' ? 'Child Matters' : 'Financial Matters'}</h2>
        <p className="auto-save-note">Changes are saved automatically</p>
      </div>

      <div className="settings-content">
        <p className="settings-description">
          {vaultType === 'child' 
            ? 'These settings are shared across all child matters. The father and mother can be applicant or respondent in different applications.'
            : 'These settings are shared across all financial matters. The same parties are involved in all cases.'
          }
        </p>

        <div className="settings-section">
          <h3>{vaultType === 'child' ? 'Parents' : 'Parties'}</h3>
          {vaultType === 'child' ? (
            <>
              <div className="form-group">
                <label>Father's Name</label>
                <input
                  type="text"
                  value={editedSettings.fatherName || ''}
                  onChange={e => handleFieldChange('fatherName', e.target.value)}
                  placeholder="Enter father's full name"
                />
              </div>

              <div className="form-group">
                <label>Mother's Name</label>
                <input
                  type="text"
                  value={editedSettings.motherName || ''}
                  onChange={e => handleFieldChange('motherName', e.target.value)}
                  placeholder="Enter mother's full name"
                />
              </div>
            </>
          ) : (
            <>
              <div className="form-group">
                <label>Applicant Name</label>
                <input
                  type="text"
                  value={editedSettings.applicantName || ''}
                  onChange={e => handleFieldChange('applicantName', e.target.value)}
                  placeholder="Enter applicant's full name"
                />
              </div>

              <div className="form-group">
                <label>Respondent Name</label>
                <input
                  type="text"
                  value={editedSettings.respondentName || ''}
                  onChange={e => handleFieldChange('respondentName', e.target.value)}
                  placeholder="Enter respondent's full name"
                />
              </div>
            </>
          )}
        </div>

        {vaultType === 'child' && (
          <div className="settings-section">
            <h3>Children</h3>
            <div className="children-section">
              {editedSettings.children?.map((child, index) => (
                <div key={index} className="child-entry">
                  <input
                    type="text"
                    value={child.name}
                    onChange={e => updateChild(index, 'name', e.target.value)}
                    placeholder="Child's name"
                  />
                  <input
                    type="date"
                    value={child.dateOfBirth ? new Date(child.dateOfBirth).toISOString().split('T')[0] : ''}
                    onChange={e => updateChild(index, 'dateOfBirth', e.target.value)}
                    lang="en-GB"
                  />
                  <button className="btn-danger-small" onClick={() => removeChild(index)}>Remove</button>
                </div>
              ))}
              <button className="btn-secondary" onClick={addChild}>Add Child</button>
            </div>
          </div>
        )}

        <div className="settings-section">
          <h3>Court Information</h3>
          <div className="form-group">
            <label>Primary Court Name</label>
            <input
              type="text"
              value={editedSettings.primaryCourtName || ''}
              onChange={e => handleFieldChange('primaryCourtName', e.target.value)}
              placeholder="e.g., Central Family Court"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default VaultSettings;