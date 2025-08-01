// BundleBuilder.js
import React from 'react';

interface UploadedFile {
  id?: number; // id can be undefined before being stored in IndexedDB
  name: string;
  type: string;
  data: File; // Assuming the original File object is stored
}

interface BundleBuilderProps {
  uploadedFiles: UploadedFile[];
}

function BundleBuilder({ uploadedFiles }: BundleBuilderProps) {
  return (
    <div>
      <h1>Court Bundle Builder</h1>
      {/* TODO: Manage sections and documents */}
      <div>
        <h2>Uploaded Files:</h2>
        {uploadedFiles.length === 0 ? (
          <p>No files uploaded yet.</p>
        ) : (
          <ul>
            {uploadedFiles.map((file, index) => (
              <li key={index}>{file.name}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default BundleBuilder;