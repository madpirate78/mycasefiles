import React, { useState, useEffect } from 'react';
import { openDB, addFile, getFiles, updateFile, StoredFile } from './services/indexedDBService';
import './App.css';
import Dashboard from './components/Dashboard';
import DocumentVault from './components/DocumentVault';
import BundleList from './components/BundleList';
import EmailManager from './components/EmailManager';
import { FileMetadata } from './components/FilePreviewModal';

type View = 'home' | 'bundles' | 'documents' | 'emails';

function App() {
  const [currentView, setCurrentView] = useState<View>('home');
  const [uploadedFiles, setUploadedFiles] = useState<StoredFile[]>([]);

  const handleFileUpload = async (files: FileList) => {
    console.log("Files uploaded:", files);
    for (const file of Array.from(files) as File[]) {
      try {
        await addFile(file);
        console.log(`File ${file.name} added to IndexedDB.`);
      } catch (error) {
        console.error(`Error adding file ${file.name} to IndexedDB:`, error);
      }
    }
    fetchFilesFromDB();
  };

  const fetchFilesFromDB = async () => {
    try {
      const files = await getFiles();
      setUploadedFiles(files);
    } catch (error) {
      console.error("Error fetching files from IndexedDB:", error);
    }
  };

  const handleFileUpdate = async (fileId: number, metadata: FileMetadata) => {
    try {
      await updateFile(fileId, {
        name: metadata.name,
        section: metadata.section,
        orderReference: metadata.orderReference,
        judgeName: metadata.judgeName,
        date: metadata.date,
        description: metadata.description
      });
      console.log('File updated successfully');
      fetchFilesFromDB(); // Refresh the files list
    } catch (error) {
      console.error('Error updating file:', error);
    }
  };

  useEffect(() => {
    openDB().then(() => {
      console.log("IndexedDB opened successfully.");
      fetchFilesFromDB();
    }).catch((error) => {
      console.error("Failed to open IndexedDB:", error);
    });
  }, []);

  const renderContent = () => {
    switch (currentView) {
      case 'home':
        return <Dashboard uploadedFiles={uploadedFiles} onFileUpload={handleFileUpload} onFileUpdate={handleFileUpdate} />;
      case 'bundles':
        return <BundleList uploadedFiles={uploadedFiles} />;
      case 'documents':
        return <DocumentVault uploadedFiles={uploadedFiles} onFileUpload={handleFileUpload} />;
      case 'emails':
        return <EmailManager onFileUpload={handleFileUpload} />;
      default:
        return <Dashboard uploadedFiles={uploadedFiles} onFileUpload={handleFileUpload} onFileUpdate={handleFileUpdate} />;
    }
  };

  return (
    <div className="app">
      <header className="app-header">
        <div className="logo">MyCaseFiles</div>
        <input 
          type="search" 
          placeholder="Search documents..." 
          className="search-bar"
        />
        <button className="settings-btn">⚙️</button>
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
        </nav>

        <main className="content">
          {renderContent()}
        </main>
      </div>
    </div>
  );
}

export default App;