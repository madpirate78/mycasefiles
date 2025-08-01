import React, { useState } from 'react';

interface EmailManagerProps {
  onFileUpload: (files: FileList) => void;
}

const EmailManager: React.FC<EmailManagerProps> = ({ onFileUpload }) => {
  const [dragOver, setDragOver] = useState(false);
  const [emailMetadata, setEmailMetadata] = useState({
    sender: '',
    subject: '',
    date: '',
    summary: ''
  });
  const [showForm, setShowForm] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      // Simulate email parsing
      setEmailMetadata({
        sender: 'solicitor@lawfirm.com',
        subject: 'Re: Case Update - Financial Disclosure',
        date: 'March 15, 2024',
        summary: 'This email contains important updates regarding the financial disclosure requirements for your case, including deadlines and required documentation.'
      });
      setShowForm(true);
      onFileUpload(e.dataTransfer.files);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setEmailMetadata({
        sender: 'court@justice.gov',
        subject: 'Court Hearing Notice',
        date: 'March 20, 2024',
        summary: 'Official notice of upcoming court hearing scheduled for April 15, 2024, including attendance requirements and preparation guidelines.'
      });
      setShowForm(true);
      onFileUpload(e.target.files);
    }
  };

  return (
    <div className="email-manager">
      <h1>Email Manager</h1>
      <p className="subtitle">Import and organize emails related to your case</p>

      <div className="email-import-section">
        <div
          className={`drop-zone large ${dragOver ? 'drag-over' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div className="drop-zone-content">
            <span className="drop-icon">📧</span>
            <h3>Drag & Drop Emails Here</h3>
            <p>Supports .eml and .pdf email formats</p>
            <label className="file-input-label">
              <input
                type="file"
                accept=".eml,.pdf"
                onChange={handleFileSelect}
                style={{ display: 'none' }}
              />
              <span className="btn secondary">Or Browse Files</span>
            </label>
          </div>
        </div>

        {showForm && (
          <div className="email-review-form">
            <h3>Review Email Information</h3>
            <p className="form-hint">Our system has extracted the following information. Please review and edit if needed.</p>
            
            <div className="form-group">
              <label>From:</label>
              <input
                type="text"
                value={emailMetadata.sender}
                onChange={(e) => setEmailMetadata({...emailMetadata, sender: e.target.value})}
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label>Subject:</label>
              <input
                type="text"
                value={emailMetadata.subject}
                onChange={(e) => setEmailMetadata({...emailMetadata, subject: e.target.value})}
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label>Date:</label>
              <input
                type="text"
                value={emailMetadata.date}
                onChange={(e) => setEmailMetadata({...emailMetadata, date: e.target.value})}
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label>Summary:</label>
              <textarea
                value={emailMetadata.summary}
                onChange={(e) => setEmailMetadata({...emailMetadata, summary: e.target.value})}
                className="form-textarea"
                rows={3}
              />
            </div>

            <div className="form-actions">
              <button className="btn primary">Accept & Save</button>
              <button className="btn secondary" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </div>
        )}
      </div>

      <div className="email-tips">
        <h3>📌 Tips for Email Management</h3>
        <ul>
          <li>Save important emails as PDF files from your email client</li>
          <li>Include the full email thread for context</li>
          <li>Review automated summaries for accuracy</li>
          <li>Organize emails by date and sender for easy reference</li>
        </ul>
      </div>
    </div>
  );
};

export default EmailManager;