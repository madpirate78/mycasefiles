import React, { useState, useEffect } from 'react';
import { openDB, getFiles, StoredFile, clearDatabase } from './services/indexedDBService';
import { uploadFiles, processUploadedPDFs, getUploadNotification, saveFileMetadata, savePageSelection, removeFile, NotificationType } from './services/uploadService';
import { isElectron } from './services/electronAPI';
import { FileWithOCR } from './components/FilePreviewModal';
import { VaultType } from './types/vault';
import DocumentVault from './components/DocumentVault';
import BundleList from './components/BundleList';
import VaultSelector from './components/VaultSelector';
import VaultSettings from './components/VaultSettings';
import './App.css';
import './styles/Notifications.css';

type View = 'bundles' | 'documents' | 'settings';

function App() {
  const [currentView, setCurrentView] = useState<View>('documents');
  const [uploadedFiles, setUploadedFiles] = useState<StoredFile[]>([]);
  const [showBrowserWarning, setShowBrowserWarning] = useState<boolean>(false);
  const [currentVault, setCurrentVault] = useState<VaultType>('child');
  const [uploadNotification, setUploadNotification] = useState<{
    type: NotificationType;
    message: string;
  } | null>(null);
  const [ocrProgress, setOcrProgress] = useState<{
    isProcessing: boolean;
    currentFile: string;
    current: number;
    total: number;
  }>({ isProcessing: false, currentFile: '', current: 0, total: 0 });
  const [isInitialized, setIsInitialized] = useState(false);

  const runningInElectron = isElectron();

  // ─── Data fetching ───────────────────────────────────────────

  const fetchFilesFromDB = React.useCallback(async () => {
    try {
      const files = await getFiles(currentVault);
      setUploadedFiles(files);
    } catch (error) {
      console.error("Error fetching files from IndexedDB:", error);
    }
  }, [currentVault]);

  // ─── Notifications ───────────────────────────────────────────

  const showNotification = (type: NotificationType, message: string) => {
    setUploadNotification({ type, message });
    setTimeout(() => setUploadNotification(null), 5000);
  };

  // ─── File handlers ───────────────────────────────────────────

  const handleFileUpload = async (files: FileList) => {
    const result = await uploadFiles(files, currentVault);

    // Refresh and run post-upload processing for new PDFs
    if (result.successCount > 0) {
      await fetchFilesFromDB();

      if (runningInElectron && result.newFileIds.length > 0) {
        setOcrProgress({ isProcessing: true, currentFile: '', current: 0, total: result.newFileIds.length });

        await processUploadedPDFs(result.newFileIds, currentVault, (current, total, fileName) => {
          setOcrProgress({ isProcessing: true, currentFile: fileName, current, total });
          showNotification('processing',
            `Processing ${current}/${total}: ${fileName.length > 30 ? fileName.substring(0, 30) + '...' : fileName}`
          );
        });

        setOcrProgress({ isProcessing: false, currentFile: '', current: 0, total: 0 });
        showNotification('success',
          `Processing complete! ${result.newFileIds.length} ${result.newFileIds.length === 1 ? 'file' : 'files'} processed`
        );
        fetchFilesFromDB();
      }
    }

    // Show upload result notification
    const notification = getUploadNotification(result);
    if (notification) {
      showNotification(notification.type as NotificationType, notification.message);
    }
  };

  const handleFileUpdate = async (fileId: number, metadata: FileWithOCR) => {
    try {
      await saveFileMetadata(fileId, metadata, currentVault);
      fetchFilesFromDB();
    } catch (error) {
      console.error('Error updating file:', error);
    }
  };

  const handlePageSelectionUpdate = async (fileId: number, selectedPages: number[], totalPages: number) => {
    try {
      await savePageSelection(fileId, selectedPages, totalPages);
      fetchFilesFromDB();
    } catch (error) {
      console.error('Error updating page selection:', error);
    }
  };

  const handleFileDelete = async (fileId: number) => {
    try {
      await removeFile(fileId);
      showNotification('success', 'File deleted successfully');
      fetchFilesFromDB();
    } catch (error) {
      console.error('Error deleting file:', error);
      showNotification('error', 'Failed to delete file');
    }
  };

  // ─── Initialization ──────────────────────────────────────────

  useEffect(() => {
    const initializeApp = async () => {
      if (!runningInElectron) {
        setShowBrowserWarning(true);
        console.warn('⚠️ Running in browser mode - Limited functionality. PDF text extraction and OCR not available.');
      }

      try {
        await openDB();
        const files = await getFiles(currentVault);
        setUploadedFiles(files);

        // Console utility for development
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
  }, [runningInElectron, isInitialized, currentVault]);

  useEffect(() => {
    if (isInitialized) {
      fetchFilesFromDB();
    }
  }, [currentVault, isInitialized, fetchFilesFromDB]);

  // ─── Render ──────────────────────────────────────────────────

  const renderContent = () => {
    switch (currentView) {
      case 'bundles':
        return <BundleList uploadedFiles={uploadedFiles} />;
      case 'settings':
        return <VaultSettings vaultType={currentVault} />;
      case 'documents':
      default:
        return (
          <DocumentVault
            uploadedFiles={uploadedFiles}
            onFileUpload={handleFileUpload}
            onFileDelete={handleFileDelete}
            onFileEdit={handleFileUpdate}
            onFileUpdate={handlePageSelectionUpdate}
            currentVault={currentVault}
          />
        );
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
          onVaultChange={setCurrentVault}
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
