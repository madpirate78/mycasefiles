import React, { useState, useEffect } from 'react';
import { openDB, addFile, getFiles, updateFile, StoredFile, clearDatabase } from './services/indexedDBService';
import './App.css';
import Dashboard from './components/Dashboard';
import DocumentVault from './components/DocumentVault';
import BundleList from './components/BundleList';
import EmailManager from './components/EmailManager';
import VaultSelector from './components/VaultSelector';
import VaultSettings from './components/VaultSettings';
import { FileMetadata } from './components/FilePreviewModal';
import { VaultType } from './types/vault';
import vaultService from './services/vaultService';

type View = 'home' | 'bundles' | 'documents' | 'emails' | 'settings';

function App() {
  const [currentView, setCurrentView] = useState<View>('home');
  const [uploadedFiles, setUploadedFiles] = useState<StoredFile[]>([]);
  const [showBrowserWarning, setShowBrowserWarning] = useState<boolean>(false);
  const [currentVault, setCurrentVault] = useState<VaultType>('child');
  const [uploadNotification, setUploadNotification] = useState<{
    type: 'success' | 'warning' | 'error';
    message: string;
  } | null>(null);

  // Check if running in Electron
  const isElectron = !!(window as any).electronAPI || !!(window as any).require;

  const isDuplicateFile = async (newFile: File, currentVaultType: VaultType): Promise<boolean> => {
    try {
      console.log('🔍 Checking for duplicates...');
      console.log('New file:', { name: newFile.name, size: newFile.size });
      
      // Get fresh files from database, not from state
      const existingFiles = await getFiles(currentVaultType);
      console.log('Existing files count:', existingFiles.length);
      
      const isDuplicate = existingFiles.some(existingFile => {
        const nameMatch = (existingFile.originalName || existingFile.name) === newFile.name;
        const sizeMatch = existingFile.data.size === newFile.size;
        
        if (nameMatch || sizeMatch) {
          console.log('Comparing with:', { 
            originalName: existingFile.originalName, 
            name: existingFile.name, 
            size: existingFile.data.size,
            nameMatch, 
            sizeMatch 
          });
        }
        
        return nameMatch && sizeMatch;
      });
      
      console.log('Is duplicate?', isDuplicate);
      return isDuplicate;
    } catch (error) {
      console.error('Error checking duplicates:', error);
      return false; // If we can't check, allow the upload
    }
  };

  const showUploadNotification = (type: 'success' | 'warning' | 'error', message: string) => {
    setUploadNotification({ type, message });
    setTimeout(() => setUploadNotification(null), 5000); // Hide after 5 seconds
  };

  const handleFileUpload = async (files: FileList) => {
    console.log("📤 UPLOAD BUTTON PRESSED: File dialog opened");
    console.log("Files uploaded:", files);
    const totalFiles = files.length;
    let successCount = 0;
    let duplicateCount = 0;
    let errorCount = 0;
    const duplicateFiles: string[] = [];
    
    for (const file of Array.from(files) as File[]) {
      try {
        // Check for duplicates
        if (await isDuplicateFile(file, currentVault)) {
          console.log(`Duplicate file detected: ${file.name}`);
          duplicateFiles.push(file.name);
          duplicateCount++;
          continue;
        }

        await addFile(file, currentVault);
        console.log(`File ${file.name} added to IndexedDB with vault type: ${currentVault}`);
        successCount++;
      } catch (error) {
        console.error(`Error adding file ${file.name} to IndexedDB:`, error);
        errorCount++;
      }
    }
    
    // Refresh file list if any files were added
    if (successCount > 0) {
      fetchFilesFromDB();
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
      console.log(`📁 Fetched ${files.length} files for ${currentVault} vault`);
      console.log('Files:', files.map(f => ({ name: f.name, section: (f as any).section, vaultType: f.vaultType })));
      setUploadedFiles(files);
    } catch (error) {
      console.error("Error fetching files from IndexedDB:", error);
    }
  }, [currentVault]);

  const handleFileUpdate = async (fileId: number, metadata: FileMetadata) => {
    try {
      await updateFile(fileId, {
        name: metadata.name,
        section: metadata.section,
        orderReference: metadata.orderReference,
        judgeName: metadata.judgeName,
        date: metadata.date,
        description: metadata.description,
        vaultType: currentVault,
        courtReference: metadata.courtReference,
        applicationDate: metadata.applicationDate
      });
      console.log('File updated successfully');
      fetchFilesFromDB(); // Refresh the files list
    } catch (error) {
      console.error('Error updating file:', error);
    }
  };

  const handleQuickOrganize = async (fileId: number, section: string, vaultType: VaultType) => {
    try {
      await updateFile(fileId, {
        section: section,
        vaultType: vaultType
      });
      console.log(`File quickly organized to section: ${section}`);
      fetchFilesFromDB(); // Refresh the files list
    } catch (error) {
      console.error('Error organizing file:', error);
    }
  };

  const handleVaultChange = (vaultType: VaultType) => {
    console.log(`🔄 VAULT CHANGE BUTTON PRESSED: Switching from ${currentVault} to ${vaultType}`);
    setCurrentVault(vaultType);
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
        console.log("🚀 Starting app initialization...");
        const database = await openDB();
        console.log("Database opened:", !!database);
        
        console.log("🔄 Loading initial files...");
        const files = await getFiles(currentVault);
        console.log(`📁 Found ${files.length} files for ${currentVault} vault`);
        setUploadedFiles(files);
        console.log("✅ Initial files loaded");
        
        // Add clear database function to global scope for console access
        (window as any).clearDB = async () => {
          try {
            await clearDatabase();
            setUploadedFiles([]);
            console.log("✅ Database cleared! Page will refresh...");
            window.location.reload();
          } catch (error) {
            console.error("❌ Failed to clear database:", error);
          }
        };
        console.log("💡 To clear database, run: clearDB() in console");
        
        setIsInitialized(true);
        console.log("✅ App initialization complete");
      } catch (error) {
        console.error("❌ Failed to initialize app:", error);
        console.error("Error details:", error);
      }
    };

    if (!isInitialized) {
      initializeApp();
    }
  }, [isElectron, isInitialized]);

  // Fetch files when vault changes after initialization
  useEffect(() => {
    if (isInitialized) {
      fetchFilesFromDB();
    }
  }, [currentVault, isInitialized, fetchFilesFromDB]);

  const renderContent = () => {
    switch (currentView) {
      case 'home':
        return <Dashboard uploadedFiles={uploadedFiles} onFileUpload={handleFileUpload} onQuickOrganize={handleQuickOrganize} currentVault={currentVault} />;
      case 'bundles':
        return <BundleList uploadedFiles={uploadedFiles} />;
      case 'documents':
        return <DocumentVault uploadedFiles={uploadedFiles} onFileUpload={handleFileUpload} currentVault={currentVault} />;
      case 'emails':
        return <EmailManager onFileUpload={handleFileUpload} />;
      case 'settings':
        return <VaultSettings vaultType={currentVault} />;
      default:
        return <Dashboard uploadedFiles={uploadedFiles} onFileUpload={handleFileUpload} onQuickOrganize={handleQuickOrganize} currentVault={currentVault} />;
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
          </span>
          <span className="notification-text">{uploadNotification.message}</span>
          <button 
            className="notification-close"
            onClick={() => setUploadNotification(null)}
          >
            ×
          </button>
        </div>
      )}
      
      <header className="app-header">
        <div className="logo">MyCaseFiles</div>
        <VaultSelector 
          currentVault={currentVault}
          onVaultChange={handleVaultChange}
        />
        <input 
          type="search" 
          placeholder="Search documents..." 
          className="search-bar"
        />
        <button 
          className="settings-btn"
          onClick={() => setCurrentView('settings')}
        >
          ⚙️
        </button>
      </header>

      <div className="app-body">
        <nav className="sidebar">
          <button 
            className={`nav-btn ${currentView === 'home' ? 'active' : ''}`}
            onClick={() => setCurrentView('home')}
          >
            <span className="nav-icon">🏠</span>
            <span className="nav-label">Home</span>
          </button>
          <button 
            className={`nav-btn ${currentView === 'bundles' ? 'active' : ''}`}
            onClick={() => setCurrentView('bundles')}
          >
            <span className="nav-icon">📁</span>
            <span className="nav-label">Bundles</span>
          </button>
          <button 
            className={`nav-btn ${currentView === 'documents' ? 'active' : ''}`}
            onClick={() => setCurrentView('documents')}
          >
            <span className="nav-icon">📄</span>
            <span className="nav-label">Documents</span>
          </button>
          <button 
            className={`nav-btn ${currentView === 'emails' ? 'active' : ''}`}
            onClick={() => setCurrentView('emails')}
          >
            <span className="nav-icon">✉️</span>
            <span className="nav-label">Emails</span>
          </button>
          <button 
            className={`nav-btn ${currentView === 'settings' ? 'active' : ''}`}
            onClick={() => setCurrentView('settings')}
          >
            <span className="nav-icon">⚙️</span>
            <span className="nav-label">Settings</span>
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