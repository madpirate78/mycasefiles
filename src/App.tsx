import React, { useState, useEffect } from 'react';
import { openDB, addFile, getFiles, updateFile, deleteFile, StoredFile, clearDatabase } from './services/indexedDBService';
import './App.css';
import './styles/Notifications.css';
import DocumentVault from './components/DocumentVault';
import BundleList from './components/BundleList';
import VaultSelector from './components/VaultSelector';
import VaultSettings from './components/VaultSettings';
import { FileWithOCR } from './components/FilePreviewModal';
import { VaultType } from './types/vault';

type View = 'bundles' | 'documents' | 'settings';

function App() {
  const [currentView, setCurrentView] = useState<View>('documents');
  const [uploadedFiles, setUploadedFiles] = useState<StoredFile[]>([]);
  const [showBrowserWarning, setShowBrowserWarning] = useState<boolean>(false);
  const [currentVault, setCurrentVault] = useState<VaultType>('child');
  const [uploadNotification, setUploadNotification] = useState<{
    type: 'success' | 'warning' | 'error' | 'processing';
    message: string;
  } | null>(null);
  const [ocrProgress, setOcrProgress] = useState<{
    isProcessing: boolean;
    currentFile: string;
    current: number;
    total: number;
  }>({ isProcessing: false, currentFile: '', current: 0, total: 0 });

  // Check if running in Electron
  const isElectron = !!(window as any).electronAPI || !!(window as any).require;

  const isDuplicateFile = async (newFile: File, currentVaultType: VaultType): Promise<boolean> => {
    try {
      // Get fresh files from database, not from state
      const existingFiles = await getFiles(currentVaultType);
      
      const isDuplicate = existingFiles.some(existingFile => {
        const nameMatch = (existingFile.originalName || existingFile.name) === newFile.name;
        const sizeMatch = existingFile.data.size === newFile.size;
        return nameMatch && sizeMatch;
      });
      
      return isDuplicate;
    } catch (error) {
      console.error('Error checking duplicates:', error);
      return false; // If we can't check, allow the upload
    }
  };

  const showUploadNotification = (type: 'success' | 'warning' | 'error' | 'processing', message: string) => {
    setUploadNotification({ type, message });
    setTimeout(() => setUploadNotification(null), 5000); // Hide after 5 seconds
  };

  const handleFileUpload = async (files: FileList) => {
    const totalFiles = files.length;
    let successCount = 0;
    let duplicateCount = 0;
    let errorCount = 0;
    const duplicateFiles: string[] = [];
    const newFileIds: string[] = [];

    for (const file of Array.from(files) as File[]) {
      try {
        // Check for duplicates
        if (await isDuplicateFile(file, currentVault)) {
          duplicateFiles.push(file.name);
          duplicateCount++;
          continue;
        }

        const fileId = await addFile(file, currentVault);
        successCount++;
        newFileIds.push(fileId);
      } catch (error) {
        console.error(`Error adding file ${file.name} to IndexedDB:`, error);
        errorCount++;
      }
    }

    // Refresh file list if any files were added
    if (successCount > 0) {
      await fetchFilesFromDB();

      // Automatically trigger OCR for newly uploaded PDF files
      if (window.electronAPI && window.electronAPI.parsePDF) {
        // Get the updated files after refresh
        const allFiles = await getFiles(currentVault);
        const pdfFiles = newFileIds.map(id => allFiles.find(f => f.id === parseInt(id)))
          .filter(f => f && f.type.includes('pdf')) as StoredFile[];

        if (pdfFiles.length > 0) {
          console.log(`🚀 Starting automatic OCR for ${pdfFiles.length} PDF files`);

          // Show OCR processing notification
          setOcrProgress({
            isProcessing: true,
            currentFile: '',
            current: 0,
            total: pdfFiles.length
          });

          for (let i = 0; i < pdfFiles.length; i++) {
            const storedFile = pdfFiles[i];
            try {
              // Update progress
              setOcrProgress({
                isProcessing: true,
                currentFile: storedFile.name,
                current: i + 1,
                total: pdfFiles.length
              });

              // Show processing notification
              showUploadNotification('processing',
                `Processing ${i + 1}/${pdfFiles.length}: ${storedFile.name.length > 30 ?
                  storedFile.name.substring(0, 30) + '...' : storedFile.name}`
              );

              console.log(`🔍 Processing OCR for: ${storedFile.name}`);
              const arrayBuffer = await storedFile.data.arrayBuffer();

              // Get filename suggestions first
              const { getSuggestedMetadata } = await import('./services/documentParser');
              const suggestions = getSuggestedMetadata(storedFile.name, currentVault);

              // Extract PDF text
              const pdfResult = await window.electronAPI.parsePDF(arrayBuffer);
              let extractedMetadata: any = {};

              // Run OCR if needed
              if (pdfResult.isScanned && (window as any).api?.processDocument) {
                const ocrResult = await (window as any).api.processDocument(storedFile.data, storedFile.name);
                if (ocrResult) {
                  extractedMetadata = { ...extractedMetadata, ...ocrResult };
                }
              }

              // Merge all metadata
              const finalMetadata = {
                ...suggestions,
                ...extractedMetadata,
                ocrPerformed: true,
                totalPages: pdfResult.pages || storedFile.totalPages
              };

              // Update file with metadata
              if (storedFile.id) {
                await updateFile(storedFile.id, finalMetadata);
              }
              console.log(`✅ OCR completed for: ${storedFile.name}`);
            } catch (error) {
              console.error(`❌ OCR failed for ${storedFile.name}:`, error);
            }
          }

          // Clear OCR progress
          setOcrProgress({ isProcessing: false, currentFile: '', current: 0, total: 0 });

          // Show completion message
          showUploadNotification('success',
            `Processing complete! ${pdfFiles.length} ${pdfFiles.length === 1 ? 'file' : 'files'} processed`
          );

          // Refresh file list after OCR processing
          fetchFilesFromDB();
        }
      }
    }

    // Show appropriate notification based on results
    if (totalFiles === 1) {
      // Single file upload
      if (duplicateCount === 1) {
        showUploadNotification('warning', `"${duplicateFiles[0]}" is already uploaded`);
      } else if (errorCount === 1) {
        showUploadNotification('error', 'Failed to upload file');
      } else if (successCount === 1) {
        showUploadNotification('success', 'File uploaded successfully');
      }
    } else {
      // Multiple file upload
      if (successCount === 0 && duplicateCount > 0) {
        if (duplicateCount === totalFiles) {
          showUploadNotification('warning', `All ${totalFiles} files are already uploaded`);
        } else {
          showUploadNotification('warning', `${duplicateCount} files already uploaded`);
        }
      } else if (successCount > 0 && duplicateCount === 0 && errorCount === 0) {
        showUploadNotification('success', `${successCount} files uploaded successfully`);
      } else if (successCount > 0 && duplicateCount > 0) {
        showUploadNotification('warning', `${successCount} uploaded, ${duplicateCount} duplicates skipped`);
      } else if (successCount > 0 && errorCount > 0) {
        showUploadNotification('warning', `${successCount} uploaded, ${errorCount} failed`);
      } else if (errorCount > 0) {
        showUploadNotification('error', `Failed to upload ${errorCount} files`);
      }
    }
  };

  const fetchFilesFromDB = React.useCallback(async () => {
    try {
      const files = await getFiles(currentVault);
      setUploadedFiles(files);
    } catch (error) {
      console.error("Error fetching files from IndexedDB:", error);
    }
  }, [currentVault]);

  const handleFileUpdate = async (fileId: number, metadata: FileWithOCR) => {
    try {
      await updateFile(fileId, {
        name: metadata.name,
        displayName: metadata.displayName,
        section: metadata.section,
        orderReference: metadata.orderReference as string | undefined,
        judgeName: metadata.judgeName as string | undefined,
        date: metadata.date as string | undefined,
        description: metadata.description,
        vaultType: currentVault, // Use current vault from app state, not from metadata
        courtReference: metadata.courtReference,
        applicationDate: metadata.applicationDate,
        // All metadata fields that get auto-populated
        reference: metadata.reference as string | undefined,
        personName: metadata.personName as string | undefined,
        expertName: metadata.expertName as string | undefined,
        reportDate: metadata.reportDate as string | undefined,
        orderType: metadata.orderType as string | undefined,
        documentType: metadata.documentType as string | undefined,
        expertType: metadata.expertType as string | undefined,
        childName: metadata.childName as string | undefined,
        planType: metadata.planType as string | undefined,
        reviewDate: metadata.reviewDate as string | undefined,
        socialWorker: metadata.socialWorker as string | undefined,
        disclosureType: metadata.disclosureType as string | undefined,
        period: metadata.period as string | undefined,
        valuationType: metadata.valuationType as string | undefined,
        propertyAddress: metadata.propertyAddress as string | undefined,
        valuer: metadata.valuer as string | undefined,
        valuationDate: metadata.valuationDate as string | undefined,
        value: metadata.value as string | undefined,
        sender: metadata.sender as string | undefined,
        recipient: metadata.recipient as string | undefined,
        subject: metadata.subject as string | undefined,
        // Auto-population and OCR tracking
        autopopulationPerformed: metadata.autopopulationPerformed,
        ocrPerformed: metadata.ocrPerformed,
        ocrText: metadata.ocrText as string | undefined,
        ocrConfidence: metadata.ocrConfidence,
        ocrDate: metadata.ocrDate as string | undefined,
        // Page tracking - CRITICAL for bundle generation!
        totalPages: metadata.totalPages,
        selectedPages: metadata.selectedPages,
        // Include updated file data if present (e.g., searchable PDF after OCR)
        ...((metadata as any).data ? { data: (metadata as any).data } : {})
      });
      fetchFilesFromDB(); // Refresh the files list
    } catch (error) {
      console.error('Error updating file:', error);
    }
  };


  const handlePageSelectionUpdate = async (fileId: number, selectedPages: number[], totalPages: number) => {
    try {
      await updateFile(fileId, {
        selectedPages: selectedPages,
        totalPages: totalPages
      });
      fetchFilesFromDB(); // Refresh the files list
      console.log(`📄 Updated page selection for file ${fileId}: ${selectedPages.length}/${totalPages} pages selected`);
    } catch (error) {
      console.error('Error updating page selection:', error);
    }
  };


  const handleVaultChange = (vaultType: VaultType) => {
    setCurrentVault(vaultType);
  };

  const handleFileDelete = async (fileId: number) => {
    try {
      await deleteFile(fileId);
      showUploadNotification('success', 'File deleted successfully');
      fetchFilesFromDB(); // Refresh the files list
    } catch (error) {
      console.error('Error deleting file:', error);
      showUploadNotification('error', 'Failed to delete file');
    }
  };

  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    const initializeApp = async () => {
      // Show browser warning if not running in Electron
      if (!isElectron) {
        setShowBrowserWarning(true);
        console.warn('⚠️ Running in browser mode - Limited functionality. PDF text extraction and OCR not available.');
      }

      try {
        await openDB();
        const files = await getFiles(currentVault);
        setUploadedFiles(files);
        
        // Add clear database function to global scope for console access
        (window as any).clearDB = async () => {
          try {
            await clearDatabase();
            setUploadedFiles([]);
            console.log("Database cleared! Page will refresh...");
            window.location.reload();
          } catch (error) {
            console.error("Failed to clear database:", error);
          }
        };
        
        setIsInitialized(true);
      } catch (error) {
        console.error("Failed to initialize app:", error);
      }
    };

    if (!isInitialized) {
      initializeApp();
    }
  }, [isElectron, isInitialized, currentVault]);

  // Fetch files when vault changes after initialization
  useEffect(() => {
    if (isInitialized) {
      fetchFilesFromDB();
    }
  }, [currentVault, isInitialized, fetchFilesFromDB]);

  const renderContent = () => {
    switch (currentView) {
      case 'bundles':
        return <BundleList uploadedFiles={uploadedFiles} />;
      case 'documents':
        return <DocumentVault uploadedFiles={uploadedFiles} onFileUpload={handleFileUpload} onFileDelete={handleFileDelete} onFileEdit={handleFileUpdate} onFileUpdate={handlePageSelectionUpdate} currentVault={currentVault} />;
      case 'settings':
        return <VaultSettings vaultType={currentVault} />;
      default:
        return <DocumentVault uploadedFiles={uploadedFiles} onFileUpload={handleFileUpload} onFileDelete={handleFileDelete} onFileEdit={handleFileUpdate} onFileUpdate={handlePageSelectionUpdate} currentVault={currentVault} />;
    }
  };

  return (
    <div className={`app vault-${currentVault}`}>
      {showBrowserWarning && (
        <div className="browser-warning">
          <div className="warning-content">
            <strong>⚠️ Limited Browser Mode</strong>
            <p>
              This app is designed for desktop use with Electron. PDF text extraction, OCR, and document parsing are not available in browser mode.
              <br/>
              <strong>To use full functionality, run:</strong> <code>npm run build && npm run electron</code>
            </p>
            <button onClick={() => setShowBrowserWarning(false)}>×</button>
          </div>
        </div>
      )}

      {/* Upload Notification */}
      {uploadNotification && (
        <div className={`upload-notification ${uploadNotification.type}`}>
          <span className="notification-icon">
            {uploadNotification.type === 'success' && '✅'}
            {uploadNotification.type === 'warning' && '⚠️'}
            {uploadNotification.type === 'error' && '❌'}
            {uploadNotification.type === 'processing' && '🔄'}
          </span>
          <span className="notification-text">{uploadNotification.message}</span>
          {uploadNotification.type !== 'processing' && (
            <button
              className="notification-close"
              onClick={() => setUploadNotification(null)}
            >
              ×
            </button>
          )}
          {uploadNotification.type === 'processing' && ocrProgress.total > 0 && (
            <span className="processing-progress">
              {ocrProgress.current}/{ocrProgress.total}
            </span>
          )}
        </div>
      )}
      
      <header className="app-header">
        <div className="logo">
          <img src="/wtf-logo.svg" alt="WTF Logo" className="logo-icon" />
          <span className="logo-text">MyCaseFiles</span>
        </div>
        <VaultSelector 
          currentVault={currentVault}
          onVaultChange={handleVaultChange}
        />
      </header>

      <div className="app-body">
        <nav className="sidebar">
          <button 
            className={`nav-btn ${currentView === 'settings' ? 'active' : ''}`}
            onClick={() => setCurrentView('settings')}
          >
            <span className="nav-icon">⚙️</span>
            <span className="nav-label">Case Settings</span>
          </button>
          <button 
            className={`nav-btn ${currentView === 'documents' ? 'active' : ''}`}
            onClick={() => setCurrentView('documents')}
          >
            <span className="nav-icon">📄</span>
            <span className="nav-label">Documents</span>
          </button>
          <button 
            className={`nav-btn ${currentView === 'bundles' ? 'active' : ''}`}
            onClick={() => setCurrentView('bundles')}
          >
            <span className="nav-icon">📁</span>
            <span className="nav-label">Bundles</span>
          </button>
        </nav>

        <main className="content">
          {renderContent()}
        </main>
      </div>
    </div>
  );
}

export default App;