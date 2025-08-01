// Document.js
import React from 'react';

interface DocumentProps {
  fileName: string;
}

function Document({ fileName }: DocumentProps) {
  return (
    <div>
      <p>{fileName}</p>
      {/* TODO: Add option to trigger pruning mode */}
    </div>
  );
}

export default Document;