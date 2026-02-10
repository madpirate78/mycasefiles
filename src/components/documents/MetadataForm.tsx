import React, { useCallback } from 'react';
import { VaultType } from '../../types/vault';
import { getSectionConfigs, FormField } from '../../constants/sectionConfig';
import vaultService from '../../services/vaultService';
import '../../styles/Forms.css';

export interface MetadataFormProps {
  metadata: Record<string, any>;
  vaultType: VaultType;
  onUpdate: (key: string, value: string) => void;
  onSectionChange: (section: string) => void;
  onDescriptionChange: (description: string) => void;
  showOptionalFields?: boolean;
}

const MetadataForm: React.FC<MetadataFormProps> = ({
  metadata,
  vaultType,
  onUpdate,
  onSectionChange,
  onDescriptionChange,
  showOptionalFields = true,
}) => {
  const sectionConfigs = getSectionConfigs(vaultType);
  const sections = vaultService.getVaultSections(vaultType);
  const currentSectionConfig = sectionConfigs.find(config => config.id === metadata.section);

  // Date format conversion helpers
  const ukToIso = useCallback((ukDate: string) => {
    if (!ukDate) return '';
    if (ukDate.match(/^\d{4}-\d{2}-\d{2}$/)) return ukDate;
    const parts = ukDate.split('/');
    if (parts.length === 3) {
      const day = parts[0].padStart(2, '0');
      const month = parts[1].padStart(2, '0');
      const year = parts[2];
      if (year.length === 4) return `${year}-${month}-${day}`;
    }
    return ukDate;
  }, []);

  const isoToUk = useCallback((isoDate: string) => {
    if (!isoDate) return '';
    if (isoDate.includes('/')) return isoDate;
    const parts = isoDate.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return isoDate;
  }, []);

  const renderField = (field: FormField) => {
    const value = metadata[field.key] || '';

    switch (field.type) {
      case 'select':
        return (
          <select
            value={value}
            onChange={(e) => onUpdate(field.key, e.target.value)}
            className="form-select"
            required={field.required}
          >
            <option value="">Select {field.label.toLowerCase()}</option>
            {field.options?.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        );
      case 'textarea':
        return (
          <textarea
            value={value}
            onChange={(e) => onUpdate(field.key, e.target.value)}
            placeholder={field.placeholder}
            className="form-textarea"
            rows={3}
            required={field.required}
          />
        );
      case 'date':
        return (
          <input
            type="date"
            value={ukToIso(value)}
            onChange={(e) => {
              const ukValue = isoToUk(e.target.value);
              onUpdate(field.key, ukValue);
            }}
            className="form-input"
            required={field.required}
          />
        );
      default:
        return (
          <input
            type="text"
            value={value || ''}
            onChange={(e) => onUpdate(field.key, e.target.value)}
            placeholder={field.placeholder}
            className="form-input"
            required={field.required}
          />
        );
    }
  };

  // Separate required and optional fields
  const requiredFields = currentSectionConfig?.fields.filter(f => f.required) || [];
  const optionalFields = currentSectionConfig?.fields.filter(f => !f.required) || [];

  return (
    <div className="metadata-form">
      <div className="form-group">
        <label>Document Section *</label>
        <select
          value={metadata.section}
          onChange={(e) => onSectionChange(e.target.value)}
          className="form-select"
        >
          {sections.map(section => (
            <option key={section.id} value={section.id}>
              {section.label}
            </option>
          ))}
        </select>
      </div>

      {/* Required fields always visible */}
      {requiredFields.map((field) => {
        if (field.showIf && !field.showIf(metadata)) return null;
        return (
          <div key={field.key} className="form-group">
            <label>
              {field.label}
              <span className="required-asterisk"> *</span>
            </label>
            {renderField(field)}
          </div>
        );
      })}

      {/* Optional fields - show based on prop */}
      {showOptionalFields && optionalFields.map((field) => {
        if (field.showIf && !field.showIf(metadata)) return null;
        return (
          <div key={field.key} className="form-group">
            <label>{field.label}</label>
            {renderField(field)}
          </div>
        );
      })}

      <div className="form-group">
        <label>Description</label>
        <textarea
          value={metadata.description || ''}
          onChange={(e) => onDescriptionChange(e.target.value)}
          placeholder="Brief description of the document..."
          className="form-textarea"
          rows={3}
        />
      </div>
    </div>
  );
};

export default MetadataForm;
