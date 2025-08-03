import React, { useState, useEffect } from 'react';
import { Case, CaseType } from '../types/case';
import caseService from '../services/caseService';
import './CaseManager.css';

interface CaseManagerProps {
  onCaseSelect: (caseId: string) => void;
  currentCaseId: string | null;
}

const CaseManager: React.FC<CaseManagerProps> = ({ onCaseSelect, currentCaseId }) => {
  const [cases, setCases] = useState<Case[]>([]);
  const [showNewCaseModal, setShowNewCaseModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingCase, setEditingCase] = useState<Case | null>(null);
  const [newCaseData, setNewCaseData] = useState({
    name: '',
    type: 'child' as CaseType,
    dateOfApplication: '',
    courtReference: '',
    courtName: '',
    applicant: '',
    respondent: '',
    description: ''
  });

  useEffect(() => {
    loadCases();
  }, []);

  const loadCases = async () => {
    try {
      const allCases = await caseService.getAllCases();
      setCases(allCases);
    } catch (error) {
      console.error('Error loading cases:', error);
    }
  };

  const handleCreateCase = async () => {
    if (!newCaseData.name.trim()) {
      alert('Please enter a case name');
      return;
    }

    if (!newCaseData.dateOfApplication) {
      alert('Please enter the date of application');
      return;
    }

    try {
      const newCase = await caseService.createCase({
        name: newCaseData.name,
        type: newCaseData.type,
        dateOfApplication: newCaseData.dateOfApplication ? new Date(newCaseData.dateOfApplication) : undefined,
        courtReference: newCaseData.courtReference || undefined,
        courtName: newCaseData.courtName || undefined,
        parties: {
          applicant: newCaseData.applicant || undefined,
          respondent: newCaseData.respondent || undefined
        },
        description: newCaseData.description || undefined
      });

      await loadCases();
      setShowNewCaseModal(false);
      resetNewCaseForm();
      
      // Auto-select the new case
      onCaseSelect(newCase.id);
    } catch (error) {
      console.error('Error creating case:', error);
      alert('Failed to create case');
    }
  };

  const handleUpdateCase = async () => {
    if (!editingCase) return;

    try {
      await caseService.updateCase(editingCase.id, {
        name: editingCase.name,
        dateOfApplication: editingCase.dateOfApplication,
        courtReference: editingCase.courtReference,
        courtName: editingCase.courtName,
        parties: editingCase.parties,
        description: editingCase.description
      });

      await loadCases();
      setShowEditModal(false);
      setEditingCase(null);
    } catch (error) {
      console.error('Error updating case:', error);
      alert('Failed to update case');
    }
  };

  const handleDeleteCase = async (caseId: string) => {
    const confirmDelete = window.confirm('Are you sure you want to delete this case? All associated documents will be removed.');
    if (!confirmDelete) return;

    try {
      await caseService.deleteCase(caseId);
      await loadCases();
    } catch (error) {
      console.error('Error deleting case:', error);
      alert('Failed to delete case');
    }
  };

  const resetNewCaseForm = () => {
    setNewCaseData({
      name: '',
      type: 'child',
      dateOfApplication: '',
      courtReference: '',
      courtName: '',
      applicant: '',
      respondent: '',
      description: ''
    });
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  return (
    <div className="case-manager">
      <div className="case-manager-header">
        <h2>Case Management</h2>
        <button className="btn-primary" onClick={() => setShowNewCaseModal(true)}>
          New Case
        </button>
      </div>

      <div className="cases-grid">
        {cases.map(caseItem => (
          <div 
            key={caseItem.id} 
            className={`case-card ${currentCaseId === caseItem.id ? 'active' : ''}`}
            onClick={() => onCaseSelect(caseItem.id)}
          >
            <div className="case-card-header">
              <h3>{caseItem.name}</h3>
              <span className={`case-type-badge ${caseItem.type}`}>
                {caseItem.type === 'child' ? 'Child Matters' : 'Financial Matters'}
              </span>
            </div>
            
            {caseItem.dateOfApplication && (
              <p className="case-application-date">Application date: {formatDate(caseItem.dateOfApplication)}</p>
            )}
            
            {caseItem.courtReference && (
              <p className="case-reference">Ref: {caseItem.courtReference}</p>
            )}
            
            {caseItem.parties && (caseItem.parties.applicant || caseItem.parties.respondent) && (
              <p className="case-parties">
                {caseItem.parties.applicant && `${caseItem.parties.applicant}`}
                {caseItem.parties.applicant && caseItem.parties.respondent && ' v '}
                {caseItem.parties.respondent && `${caseItem.parties.respondent}`}
              </p>
            )}
            
            <p className="case-date">Last modified: {formatDate(caseItem.lastModified)}</p>
            
            <div className="case-actions">
              <button 
                className="btn-secondary"
                onClick={(e) => {
                  e.stopPropagation();
                  setEditingCase(caseItem);
                  setShowEditModal(true);
                }}
              >
                Edit
              </button>
              <button 
                className="btn-danger"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteCase(caseItem.id);
                }}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {cases.length === 0 && (
        <div className="no-cases">
          <p>No cases yet. Create your first case to get started.</p>
        </div>
      )}

      {/* New Case Modal */}
      {showNewCaseModal && (
        <div className="modal-overlay" onClick={() => setShowNewCaseModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3>Create New Case</h3>
            
            <div className="form-group">
              <label>Case Name *</label>
              <input
                type="text"
                value={newCaseData.name}
                onChange={e => setNewCaseData({...newCaseData, name: e.target.value})}
                placeholder="e.g., Smith v Jones"
              />
            </div>

            <div className="form-group">
              <label>Case Type *</label>
              <select 
                value={newCaseData.type} 
                onChange={e => setNewCaseData({...newCaseData, type: e.target.value as CaseType})}
              >
                <option value="child">Child Matters</option>
                <option value="finance">Financial Matters</option>
              </select>
            </div>

            <div className="form-group">
              <label>Date of Application *</label>
              <input
                type="date"
                value={newCaseData.dateOfApplication}
                onChange={e => setNewCaseData({...newCaseData, dateOfApplication: e.target.value})}
                required
                lang="en-GB"
              />
            </div>

            <div className="form-group">
              <label>Court Reference</label>
              <input
                type="text"
                value={newCaseData.courtReference}
                onChange={e => setNewCaseData({...newCaseData, courtReference: e.target.value})}
                placeholder="e.g., AB12C34567"
              />
            </div>

            <div className="form-group">
              <label>Court Name</label>
              <input
                type="text"
                value={newCaseData.courtName}
                onChange={e => setNewCaseData({...newCaseData, courtName: e.target.value})}
                placeholder="e.g., Central Family Court"
              />
            </div>

            <div className="form-group">
              <label>Applicant</label>
              <input
                type="text"
                value={newCaseData.applicant}
                onChange={e => setNewCaseData({...newCaseData, applicant: e.target.value})}
                placeholder="e.g., John Smith"
              />
            </div>

            <div className="form-group">
              <label>Respondent</label>
              <input
                type="text"
                value={newCaseData.respondent}
                onChange={e => setNewCaseData({...newCaseData, respondent: e.target.value})}
                placeholder="e.g., Jane Jones"
              />
            </div>

            <div className="form-group">
              <label>Description</label>
              <textarea
                value={newCaseData.description}
                onChange={e => setNewCaseData({...newCaseData, description: e.target.value})}
                placeholder="Brief description of the case..."
                rows={3}
              />
            </div>

            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowNewCaseModal(false)}>
                Cancel
              </button>
              <button className="btn-primary" onClick={handleCreateCase}>
                Create Case
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Case Modal */}
      {showEditModal && editingCase && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3>Edit Case</h3>
            
            <div className="form-group">
              <label>Case Name *</label>
              <input
                type="text"
                value={editingCase.name}
                onChange={e => setEditingCase({...editingCase, name: e.target.value})}
              />
            </div>

            <div className="form-group">
              <label>Date of Application</label>
              <input
                type="date"
                value={editingCase.dateOfApplication ? new Date(editingCase.dateOfApplication).toISOString().split('T')[0] : ''}
                onChange={e => setEditingCase({...editingCase, dateOfApplication: e.target.value ? new Date(e.target.value) : undefined})}
                lang="en-GB"
              />
            </div>

            <div className="form-group">
              <label>Court Reference</label>
              <input
                type="text"
                value={editingCase.courtReference || ''}
                onChange={e => setEditingCase({...editingCase, courtReference: e.target.value})}
              />
            </div>

            <div className="form-group">
              <label>Court Name</label>
              <input
                type="text"
                value={editingCase.courtName || ''}
                onChange={e => setEditingCase({...editingCase, courtName: e.target.value})}
              />
            </div>

            <div className="form-group">
              <label>Applicant</label>
              <input
                type="text"
                value={editingCase.parties?.applicant || ''}
                onChange={e => setEditingCase({
                  ...editingCase, 
                  parties: {...editingCase.parties, applicant: e.target.value}
                })}
              />
            </div>

            <div className="form-group">
              <label>Respondent</label>
              <input
                type="text"
                value={editingCase.parties?.respondent || ''}
                onChange={e => setEditingCase({
                  ...editingCase, 
                  parties: {...editingCase.parties, respondent: e.target.value}
                })}
              />
            </div>

            <div className="form-group">
              <label>Description</label>
              <textarea
                value={editingCase.description || ''}
                onChange={e => setEditingCase({...editingCase, description: e.target.value})}
                rows={3}
              />
            </div>

            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowEditModal(false)}>
                Cancel
              </button>
              <button className="btn-primary" onClick={handleUpdateCase}>
                Update Case
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CaseManager;