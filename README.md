# MyCaseFiles - Legal Document Management

**Desktop application for UK family court document organization.** Built with Electron, React, and TypeScript.

⚠️ **Desktop-only**: Requires Electron for PDF extraction, OCR, and file system access. Browser deployment not supported.

## Features

### Document Management
- **Smart Organization**: Auto-assigns orders, applications, and expert reports to correct sections
- **Two-Vault System**: Separate workspaces for Child and Financial matters
- **Folder Import**: Import pre-organized folders with automatic section mapping
- **"Take a Closer Look"**: PDF preview when filename isn't clear
- **Duplicate Detection**: Prevents duplicate files with smart notifications

### PDF Processing
- **Text Extraction**: Automated extraction via pdf-parse in Electron
- **UK Court Patterns**: Recognizes case numbers (AB12C34567), forms (C100, FL401), judge titles (HHJ, DJ)
- **Auto-Population**: Fills court references, judge names, document types
- **OCR Support**: Manual OCR for scanned documents with confidence scoring

### Document Vault
- **Status Indicators**: Shows page selections (📄 5/10), metadata (✓), OCR status (🔍)
- **Page Selection**: Carousel interface for selecting specific pages
- **Advanced Search**: Filter by section, search across metadata
- **Quick Actions**: Edit, delete, and manage documents

## Installation

### For Users
1. Download installer from [Releases](../../releases)
2. Run `My Case Files Setup X.X.X.exe`
3. Launch from desktop shortcut

### For Developers
```bash
git clone <repository-url>
cd mycasefiles
npm install
npm run dev-electron  # Recommended - builds and launches
```

## Development

### Prerequisites
- Node.js v18+
- Windows/macOS/Linux desktop
- GitHub CLI (optional, for build triggers)

### Quick Start
```bash
npm install
npm run dev-electron  # Fresh build + Electron launch
```

### Commands
- `npm run dev-electron` - Build and launch (recommended)
- `npm run electron` - Quick launch with existing build
- `npm start` - React dev server (limited - no PDF/OCR features)
- `npm run dist` - Create Windows installer
- `npm run version-patch` - Create release (0.1.0 → 0.1.1)
- `npm run trigger-build` - Trigger GitHub Actions build

### Linux/WSL Setup
```bash
sudo apt install -y libnss3-dev libatk-bridge2.0-dev libdrm2 libxkbcommon-dev libxcomposite-dev libxdamage-dev libxrandr-dev libgbm-dev libxss-dev libasound2-dev
```

## Architecture

### Core Tech
- **Electron**: Desktop wrapper with Node.js capabilities
- **React + TypeScript**: Modern UI with type safety
- **IPC Communication**: Secure main/renderer process bridge
- **IndexedDB**: Local document storage
- **pdf-parse**: PDF text extraction (Node.js only)
- **Tesseract.js**: OCR for scanned documents

### Key Files
```
src/
├── components/         # React UI components
├── services/          # Business logic and storage
├── documentParser/    # PDF parsing and UK court patterns
public/
├── electron.js        # Electron main process
├── preload.js         # IPC security bridge
```

## Troubleshooting

### Common Issues
- **"Cannot find module"**: Ensure runtime deps are in `dependencies`, not `devDependencies`
- **Windows SmartScreen**: Click "More info" → "Run anyway"
- **PDF not working**: Use `npm run dev-electron`, not `npm start`
- **GitHub Actions 403**: Add `permissions: contents: write` to workflow

## Contributing
1. Follow TypeScript patterns and ESLint rules
2. Test with real UK court documents
3. Update docs for new patterns
4. Keep PDF.js assets local for offline use

## License
Proprietary software for legal document management.

---
**Built for UK family court document organization with intelligent PDF parsing and OCR.**