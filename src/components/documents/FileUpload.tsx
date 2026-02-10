// FileUpload.tsx
import React, { useState } from 'react';
import { FileValidationService } from '../../services/fileValidationService';
import { FILE_VALIDATION_CONFIG } from '../../constants/fileValidation';

interface FileUploadProps {
  onFileUpload: (files: FileList) => void;
  currentVaultFileCount?: number;
}

function FileUpload({ onFileUpload, currentVaultFileCount = 0 }: FileUploadProps) {
  const [dragActive, setDragActive] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string>('');

  const handleDrag = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const validateAndUpload = async (files: FileList) => {
    if (!files || files.length === 0) return;
    
    setIsValidating(true);
    setValidationErrors('');
    
    try {
      // Validate files
      const errors = await FileValidationService.validateFileList(files, currentVaultFileCount);
      
      if (errors.length > 0) {
        const errorSummary = FileValidationService.createErrorSummary(errors);
        setValidationErrors(errorSummary);
        console.error('❌ File validation failed:', errors);
        return;
      }
      
      // All files are valid, proceed with upload
      console.log('✅ File validation passed for', files.length, 'files');
      onFileUpload(files);
      
    } catch (error) {
      console.error('❌ File validation error:', error);
      setValidationErrors('An error occurred while validating files. Please try again.');
    } finally {
      setIsValidating(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndUpload(e.dataTransfer.files);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      validateAndUpload(e.target.files);
    }
  };

  const handleUploadClick = () => {
    console.log("📤 UPLOAD BUTTON CLICKED: Opening file dialog...");
  };

  return (
    <div
      id="form-file-upload"
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      onDragOver={handleDrag}
      onDrop={handleDrop}
    >
      <input
        type="file"
        id="input-file-upload"
        multiple={true}
        accept=".pdf,application/pdf"
        onChange={handleChange}
        disabled={isValidating}
      />
      <label
        id="label-file-upload"
        htmlFor="input-file-upload"
        className={dragActive ? "drag-active" : ""}
        onClick={handleUploadClick}
      >
        <div>
          {isValidating ? (
            <p>🔍 Validating files...</p>
          ) : (
            <>
              <p>Drag and drop your PDF files here or</p>
              <button className="upload-button" disabled={isValidating}>
                Upload PDF files
              </button>
              <p style={{ fontSize: '0.8em', color: '#666', marginTop: '8px' }}>
                Maximum {FILE_VALIDATION_CONFIG.MAX_FILES_PER_UPLOAD} files, 
                {Math.round(FILE_VALIDATION_CONFIG.MAX_FILE_SIZE / (1024 * 1024))}MB each
              </p>
            </>
          )}
        </div>
      </label>
      {dragActive && <div id="drag-file-element" onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}></div>}
      
      {validationErrors && (
        <div style={{ 
          marginTop: '16px', 
          padding: '12px', 
          backgroundColor: '#fee', 
          border: '1px solid #fcc', 
          borderRadius: '4px',
          color: '#c00'
        }}>
          <strong>⚠️ Validation Errors:</strong>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: '0.9em', marginTop: '8px' }}>
            {validationErrors}
          </pre>
        </div>
      )}
    </div>
  );
}

export default FileUpload;