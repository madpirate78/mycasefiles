import React, { useState, useEffect } from 'react';
import { Case } from '../types/case';
import caseService from '../services/caseService';
import './CaseSelector.css';

interface CaseSelectorProps {
  currentCase: Case | null;
  onCaseChange: (caseId: string) => void;
  onManageCases: () => void;
}

const CaseSelector: React.FC<CaseSelectorProps> = ({ currentCase, onCaseChange, onManageCases }) => {
  const [cases, setCases] = useState<Case[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    loadCases();
  }, [currentCase]);

  const loadCases = async () => {
    try {
      const allCases = await caseService.getAllCases();
      setCases(allCases);
    } catch (error) {
      console.error('Error loading cases:', error);
    }
  };

  const handleCaseSelect = (caseId: string) => {
    onCaseChange(caseId);
    setIsOpen(false);
  };

  const formatCaseName = (caseItem: Case) => {
    let name = caseItem.name;
    if (caseItem.parties && (caseItem.parties.applicant || caseItem.parties.respondent)) {
      const parties = [];
      if (caseItem.parties.applicant) parties.push(caseItem.parties.applicant);
      if (caseItem.parties.respondent) parties.push(caseItem.parties.respondent);
      name += ` (${parties.join(' v ')})`;
    }
    return name;
  };

  return (
    <div className="case-selector">
      <button 
        className="case-selector-button"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="case-selector-label">Current Case:</span>
        <span className="case-selector-name">
          {currentCase ? formatCaseName(currentCase) : 'No case selected'}
        </span>
        <span className={`case-selector-arrow ${isOpen ? 'open' : ''}`}>▼</span>
      </button>

      {isOpen && (
        <div className="case-selector-dropdown">
          <div className="case-selector-header">
            <h4>Select Case</h4>
            <button className="manage-cases-btn" onClick={onManageCases}>
              Manage Cases
            </button>
          </div>
          
          <div className="case-selector-list">
            {cases.map(caseItem => (
              <div
                key={caseItem.id}
                className={`case-selector-item ${currentCase?.id === caseItem.id ? 'active' : ''}`}
                onClick={() => handleCaseSelect(caseItem.id)}
              >
                <div className="case-item-main">
                  <span className="case-item-name">{formatCaseName(caseItem)}</span>
                  <span className={`case-type-indicator ${caseItem.type}`}>
                    {caseItem.type === 'child' ? 'C' : 'F'}
                  </span>
                </div>
                {caseItem.courtReference && (
                  <span className="case-item-reference">{caseItem.courtReference}</span>
                )}
              </div>
            ))}
          </div>

          {cases.length === 0 && (
            <div className="case-selector-empty">
              <p>No cases found.</p>
              <button className="btn-primary" onClick={onManageCases}>
                Create Your First Case
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CaseSelector;