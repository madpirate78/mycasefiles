import React, { useState, useEffect } from 'react';
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
  const [isEditing, setIsEditing] = useState(false);
  const [editedSettings, setEditedSettings] = useState(settings);

  useEffect(() => {
    loadSettings();
  }, [vaultType]);

  const loadSettings = async () => {
    try {
      const vaultSettings = await vaultService.getVaultSettings(vaultType);
      setSettings(vaultSettings);
      setEditedSettings(vaultSettings);
    } catch (error) {
      console.error('Error loading vault settings:', error);
    }
  };

  const handleSave = async () => {
    try {
      await vaultService.updateVaultSettings(vaultType, editedSettings);
      setSettings(editedSettings);
      setIsEditing(false);
    } catch (error) {
      console.error('Error saving vault settings:', error);
      alert('Failed to save settings');
    }
  };

  const handleCancel = () => {
    setEditedSettings(settings);
    setIsEditing(false);
  };

  const addChild = () => {
    if (editedSettings.children) {
      setEditedSettings({
        ...editedSettings,
        children: [...editedSettings.children, { name: '', dateOfBirth: undefined }]
      });
    }
  };

  const removeChild = (index: number) => {
    if (editedSettings.children) {
      setEditedSettings({
        ...editedSettings,
        children: editedSettings.children.filter((_, i) => i !== index)
      });
    }
  };

  const updateChild = (index: number, field: 'name' | 'dateOfBirth', value: string) => {
    if (editedSettings.children) {
      const newChildren = [...editedSettings.children];
      if (field === 'name') {
        newChildren[index].name = value;
      } else {
        newChildren[index].dateOfBirth = value ? new Date(value) : undefined;
      }
      setEditedSettings({
        ...editedSettings,
        children: newChildren
      });
    }
  };

  return (
    <div className="vault-settings">
      <div className="settings-header">
        <h2>{vaultType === 'child' ? 'Child Matters' : 'Financial Matters'} Settings</h2>
        {!isEditing ? (
          <button className="btn-primary" onClick={() => setIsEditing(true)}>
            Edit Settings
          </button>
        ) : (
          <div className="settings-actions">
            <button className="btn-secondary" onClick={handleCancel}>Cancel</button>
            <button className="btn-primary" onClick={handleSave}>Save</button>
          </div>
        )}
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
                {isEditing ? (
                  <input
                    type="text"
                    value={editedSettings.fatherName || ''}
                    onChange={e => setEditedSettings({...editedSettings, fatherName: e.target.value})}
                    placeholder="Enter father's full name"
                  />
                ) : (
                  <p className="field-value">{settings.fatherName || 'Not set'}</p>
                )}
              </div>

              <div className="form-group">
                <label>Mother's Name</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={editedSettings.motherName || ''}
                    onChange={e => setEditedSettings({...editedSettings, motherName: e.target.value})}
                    placeholder="Enter mother's full name"
                  />
                ) : (
                  <p className="field-value">{settings.motherName || 'Not set'}</p>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="form-group">
                <label>Applicant Name</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={editedSettings.applicantName || ''}
                    onChange={e => setEditedSettings({...editedSettings, applicantName: e.target.value})}
                    placeholder="Enter applicant's full name"
                  />
                ) : (
                  <p className="field-value">{settings.applicantName || 'Not set'}</p>
                )}
              </div>

              <div className="form-group">
                <label>Respondent Name</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={editedSettings.respondentName || ''}
                    onChange={e => setEditedSettings({...editedSettings, respondentName: e.target.value})}
                    placeholder="Enter respondent's full name"
                  />
                ) : (
                  <p className="field-value">{settings.respondentName || 'Not set'}</p>
                )}
              </div>
            </>
          )}
        </div>

        {vaultType === 'child' && (
          <div className="settings-section">
            <h3>Children</h3>
            {isEditing ? (
              <>
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
                    />
                    <button className="btn-danger-small" onClick={() => removeChild(index)}>Remove</button>
                  </div>
                ))}
                <button className="btn-secondary" onClick={addChild}>Add Child</button>
              </>
            ) : (
              <div className="children-list">
                {settings.children && settings.children.length > 0 ? (
                  settings.children.map((child, index) => (
                    <p key={index} className="field-value">
                      {child.name} {child.dateOfBirth && `(DOB: ${new Date(child.dateOfBirth).toLocaleDateString('en-GB')})`}
                    </p>
                  ))
                ) : (
                  <p className="field-value">No children added</p>
                )}
              </div>
            )}
          </div>
        )}

        <div className="settings-section">
          <h3>Court Information</h3>
          <div className="form-group">
            <label>Primary Court Name</label>
            {isEditing ? (
              <input
                type="text"
                value={editedSettings.primaryCourtName || ''}
                onChange={e => setEditedSettings({...editedSettings, primaryCourtName: e.target.value})}
                placeholder="e.g., Central Family Court"
              />
            ) : (
              <p className="field-value">{settings.primaryCourtName || 'Not set'}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default VaultSettings;