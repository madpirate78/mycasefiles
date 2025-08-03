# Auto-Update Implementation Plan for MyCaseFiles

## 📋 Overview

This document outlines the complete implementation plan for adding automatic updates to the MyCaseFiles Electron application using `electron-updater` and GitHub Releases.

## 🎯 Goals

- **Seamless Updates**: Users receive updates automatically without manual intervention
- **Background Processing**: Updates download silently in the background
- **User Control**: Users can choose when to restart and apply updates
- **Private Repo Support**: Works with private GitHub repositories
- **Testing Friendly**: Easy to test updates during development

## 🏗️ Implementation Steps

### Phase 1: Setup Dependencies

#### 1.1 Install Required Packages
```bash
npm install electron-updater
npm install --save-dev electron-builder
```

#### 1.2 Verify Current Structure
Ensure your project has:
- `public/electron.js` (main process)
- `public/preload.js` (preload script)
- `package.json` with basic Electron configuration

### Phase 2: Configure Auto-Updater

#### 2.1 Update Main Process (`public/electron.js`)

Add auto-updater functionality to your main process:

```javascript
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const isDev = require('electron-is-dev');

// Configure auto-updater for GitHub releases
if (!isDev) {
  // Only check for updates in production builds
  autoUpdater.checkForUpdatesAndNotify();
}

// Auto-updater event handlers
autoUpdater.on('checking-for-update', () => {
  console.log('Checking for update...');
});

autoUpdater.on('update-available', (info) => {
  console.log('Update available:', info.version);
  // Optionally notify renderer process
  if (mainWindow) {
    mainWindow.webContents.send('update-available', info);
  }
});

autoUpdater.on('update-not-available', (info) => {
  console.log('Update not available:', info.version);
});

autoUpdater.on('error', (err) => {
  console.log('Update error:', err);
});

autoUpdater.on('download-progress', (progressObj) => {
  let log_message = "Download speed: " + progressObj.bytesPerSecond;
  log_message = log_message + ' - Downloaded ' + progressObj.percent + '%';
  log_message = log_message + ' (' + progressObj.transferred + "/" + progressObj.total + ')';
  console.log(log_message);
  
  // Send progress to renderer
  if (mainWindow) {
    mainWindow.webContents.send('download-progress', progressObj);
  }
});

autoUpdater.on('update-downloaded', (info) => {
  console.log('Update downloaded:', info.version);
  
  // Show dialog to user
  const response = dialog.showMessageBoxSync(mainWindow, {
    type: 'info',
    title: 'Update Ready',
    message: `MyCaseFiles ${info.version} has been downloaded.`,
    detail: 'The application will restart to apply the update.',
    buttons: ['Restart Now', 'Later'],
    defaultId: 0
  });
  
  if (response === 0) {
    autoUpdater.quitAndInstall();
  }
});

let mainWindow;

function createWindow() {
  // Your existing window creation code
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });
  
  // Your existing window setup code
}

app.whenReady().then(() => {
  createWindow();
  
  // Check for updates 5 seconds after app starts
  if (!isDev) {
    setTimeout(() => {
      autoUpdater.checkForUpdatesAndNotify();
    }, 5000);
  }
});

// IPC handlers for manual update checks
ipcMain.handle('check-for-updates', async () => {
  if (!isDev) {
    return await autoUpdater.checkForUpdates();
  }
  return null;
});

// Your existing app event handlers
```

#### 2.2 Update Preload Script (`public/preload.js`)

Add update-related APIs:

```javascript
const { contextBridge, ipcRenderer } = require('electron');

// Your existing API
contextBridge.exposeInMainWorld('electronAPI', {
  // Your existing methods...
  parsePDF: (arrayBuffer) => ipcRenderer.invoke('parse-pdf', arrayBuffer),
  
  // New update methods
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  onUpdateAvailable: (callback) => ipcRenderer.on('update-available', callback),
  onDownloadProgress: (callback) => ipcRenderer.on('download-progress', callback),
  onUpdateDownloaded: (callback) => ipcRenderer.on('update-downloaded', callback)
});
```

### Phase 3: Configure Build System

#### 3.1 Update `package.json`

Add comprehensive build configuration:

```json
{
  "name": "mycasefiles",
  "version": "1.0.0",
  "main": "public/electron.js",
  "scripts": {
    "start": "react-scripts start",
    "build": "react-scripts build",
    "electron": "electron .",
    "dev-electron": "npm run build && npm run electron",
    "build-electron": "npm run build && electron-builder",
    "dist": "npm run build && electron-builder --publish=never",
    "dist-publish": "npm run build && electron-builder --publish=always",
    "version-patch": "npm version patch && git push origin master --tags",
    "version-minor": "npm version minor && git push origin master --tags",
    "version-major": "npm version major && git push origin master --tags"
  },
  "build": {
    "appId": "com.yourname.mycasefiles",
    "productName": "MyCaseFiles",
    "directories": {
      "buildResources": "build",
      "output": "dist"
    },
    "files": [
      "build/**/*",
      "node_modules/**/*",
      "public/electron.js",
      "public/preload.js",
      "!node_modules/.cache/**/*"
    ],
    "publish": {
      "provider": "github",
      "owner": "yourusername",
      "repo": "mycasefiles",
      "private": true,
      "releaseType": "release"
    },
    "win": {
      "target": [
        {
          "target": "nsis",
          "arch": ["x64"]
        }
      ],
      "icon": "public/favicon.ico",
      "publisherName": "Your Name"
    },
    "nsis": {
      "oneClick": false,
      "allowToChangeInstallationDirectory": true,
      "createDesktopShortcut": true,
      "createStartMenuShortcut": true,
      "shortcutName": "MyCaseFiles"
    }
  }
}
```

### Phase 4: GitHub Actions Setup

#### 4.1 Create Workflow (`.github/workflows/release.yml`)

```yaml
name: Build and Release

on:
  push:
    tags:
      - 'v*'
  workflow_dispatch:
    inputs:
      version:
        description: 'Version to release'
        required: true
        default: 'v1.0.0'

jobs:
  build-and-release:
    runs-on: windows-latest
    
    steps:
    - name: Checkout code
      uses: actions/checkout@v4
      
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '18'
        cache: 'npm'
        
    - name: Install dependencies
      run: npm ci
      
    - name: Build React app
      run: npm run build
      
    - name: Build and publish Electron app
      run: npm run dist-publish
      env:
        GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        
    - name: Upload build artifacts
      uses: actions/upload-artifact@v4
      with:
        name: windows-installer
        path: |
          dist/*.exe
          dist/*.zip
          dist/*.yml
        retention-days: 30
```

#### 4.2 Create Development Workflow (`.github/workflows/build-test.yml`)

```yaml
name: Build Test

on:
  push:
    branches: [ master, develop ]
  pull_request:
    branches: [ master ]
  workflow_dispatch:

jobs:
  build-test:
    runs-on: windows-latest
    
    steps:
    - name: Checkout code
      uses: actions/checkout@v4
      
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '18'
        cache: 'npm'
        
    - name: Install dependencies
      run: npm ci
      
    - name: Build React app
      run: npm run build
      
    - name: Build Electron app (no publish)
      run: npm run dist
      
    - name: Upload build artifacts
      uses: actions/upload-artifact@v4
      with:
        name: test-build
        path: |
          dist/*.exe
        retention-days: 7
```

### Phase 5: Frontend Integration (Optional)

#### 5.1 Add Update Component (`src/components/UpdateNotification.tsx`)

```typescript
import React, { useState, useEffect } from 'react';

interface UpdateInfo {
  version: string;
  releaseDate: string;
}

interface DownloadProgress {
  percent: number;
  bytesPerSecond: number;
  transferred: number;
  total: number;
}

const UpdateNotification: React.FC = () => {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null);

  useEffect(() => {
    if (window.electronAPI) {
      // Listen for update events
      window.electronAPI.onUpdateAvailable((_event, info) => {
        setUpdateAvailable(true);
        setUpdateInfo(info);
        setDownloading(true);
      });

      window.electronAPI.onDownloadProgress((_event, progress) => {
        setDownloadProgress(progress);
      });

      window.electronAPI.onUpdateDownloaded((_event, info) => {
        setDownloading(false);
        setDownloadProgress(null);
      });
    }
  }, []);

  const handleCheckForUpdates = async () => {
    if (window.electronAPI) {
      await window.electronAPI.checkForUpdates();
    }
  };

  if (!updateAvailable && !downloading) {
    return (
      <div className="update-check">
        <button onClick={handleCheckForUpdates} className="btn secondary">
          Check for Updates
        </button>
      </div>
    );
  }

  return (
    <div className="update-notification">
      {downloading && downloadProgress && (
        <div className="update-downloading">
          <h4>Downloading Update {updateInfo?.version}</h4>
          <div className="progress-bar">
            <div 
              className="progress-fill" 
              style={{ width: `${downloadProgress.percent}%` }}
            />
          </div>
          <p>{Math.round(downloadProgress.percent)}% complete</p>
        </div>
      )}
    </div>
  );
};

export default UpdateNotification;
```

#### 5.2 Add to Main App (`src/App.tsx`)

```typescript
import UpdateNotification from './components/UpdateNotification';

function App() {
  return (
    <div className="App">
      {/* Your existing app content */}
      
      {/* Add update notification */}
      <UpdateNotification />
    </div>
  );
}
```

## 🧪 Testing Strategy

### Testing Phase 1: Local Development
1. **Build initial version**: `npm run dist`
2. **Install on Windows machine**: Run the generated .exe
3. **Test app functionality**: Ensure everything works normally

### Testing Phase 2: Update Process
1. **Increment version**: `npm run version-patch` (1.0.0 → 1.0.1)
2. **Push tags**: Automatically triggers GitHub Actions
3. **Verify release**: Check GitHub Releases page
4. **Test auto-update**: Start installed app, wait for update notification

### Testing Phase 3: Update Scenarios
1. **Major updates**: `npm run version-major`
2. **Minor updates**: `npm run version-minor`
3. **Patch updates**: `npm run version-patch`
4. **Update rollback**: Test reverting to previous version

## 🔧 Development Workflow

### Daily Development (Unchanged)
```bash
npm run dev-electron  # Your normal development
```

### Creating Releases
```bash
# For patch releases (1.0.0 → 1.0.1)
npm run version-patch

# For minor releases (1.0.0 → 1.1.0)  
npm run version-minor

# For major releases (1.0.0 → 2.0.0)
npm run version-major
```

### Manual Testing
```bash
# Build without publishing
npm run dist

# Build and publish to GitHub
npm run dist-publish
```

## 🔒 Security Considerations

### Code Signing (Future Enhancement)
- Windows requires code signing for automatic updates
- Users may see security warnings without signing
- Consider EV Code Signing certificate for production

### Private Repository Access
- GitHub token automatically provided by Actions
- Users need GitHub access to download updates
- Consider moving to public repo for wider distribution

## 📝 Troubleshooting

### Common Issues

#### Update Not Detected
- Check GitHub token permissions
- Verify release is published (not draft)
- Check console logs in developer tools

#### Update Download Fails
- Check internet connectivity
- Verify GitHub release assets exist
- Check file permissions

#### App Won't Restart After Update
- Check for running background processes
- Verify file permissions
- Check Windows User Account Control settings

### Debug Mode
Add to main process for verbose logging:
```javascript
// Enable debug logging
autoUpdater.logger = require('electron-log');
autoUpdater.logger.transports.file.level = 'info';
```

## 🚀 Deployment Checklist

### Before First Release
- [ ] Install `electron-updater` and `electron-builder`
- [ ] Update `public/electron.js` with auto-updater code
- [ ] Update `public/preload.js` with update APIs
- [ ] Configure `package.json` build settings
- [ ] Create GitHub Actions workflows
- [ ] Test build process locally
- [ ] Create initial release tag

### For Each Release
- [ ] Test app functionality thoroughly
- [ ] Increment version number appropriately
- [ ] Push tags to trigger build
- [ ] Verify GitHub Actions build succeeds
- [ ] Test update process on installed app
- [ ] Monitor for user feedback

## 🎯 Success Metrics

### Technical Metrics
- Build success rate: >95%
- Update download success rate: >90%
- Update application success rate: >85%

### User Experience Metrics
- Time from release to user update: <24 hours
- User complaints about update process: <5%
- Update adoption rate: >80% within 1 week

## 🔄 Future Enhancements

### Phase 2 Features
- Delta updates (only download changed files)
- Update rollback functionality
- Silent updates for security patches
- Update scheduling (install during off-hours)

### Phase 3 Features
- Code signing for Windows
- Mac and Linux support
- Custom update server
- Enterprise deployment support

---

## 📚 Additional Resources

- [electron-updater Documentation](https://www.electron.build/auto-update)
- [GitHub Actions for Electron](https://www.electronjs.org/docs/latest/tutorial/automated-testing)
- [Code Signing for Windows](https://www.electron.build/code-signing)
- [Electron Security Best Practices](https://www.electronjs.org/docs/latest/tutorial/security)

This implementation plan provides a complete roadmap for adding professional auto-update functionality to MyCaseFiles while maintaining your current development workflow.