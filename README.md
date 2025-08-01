# MyCaseFiles - Desktop Legal Document Management System

A comprehensive legal case management desktop application designed for self-represented litigants and legal professionals. Built with React, TypeScript, and Electron, featuring advanced PDF document organization, intelligent text extraction, and automated metadata population for UK family court documents.

## 🎯 Current Features

### Document Management
- **Dynamic Organize Dialog**: Section-specific metadata fields that adapt based on document type
- **Smart File Organization**: UK family court structure (Child Matters, Financial Matters, Preliminary Documents, etc.)
- **Automatic Filename Generation**: Context-aware naming based on document metadata
- **IndexedDB Storage**: Local file storage with efficient retrieval
- **Intelligent Parsing**: Filename-first + PDF content extraction strategy

### PDF Processing & Analysis
- **Desktop PDF Text Extraction**: Full pdf-parse library integration via Electron main process
- **Automated Field Population**: Court reference numbers, judge names, document types
- **UK Court Pattern Recognition**: Case numbers (AB12C34567), form types (C100, FL401), judge abbreviations (HHJ, DJ, DDJ)
- **High-Quality PDF Renderer**: Offline-first PDF.js integration with local assets
- **Carousel Navigation**: Floating navigation buttons around PDF for intuitive page control
- **Full-Screen PDF View**: Maximized PDF preview area (95vw × 90vh) with controls in right panel

### Desktop Experience
- **Native Desktop App**: Electron wrapper providing full Node.js capabilities
- **Secure IPC**: Preload script ensures safe communication between renderer and main process
- **Cross-Platform**: Windows, macOS, and Linux support via electron-builder
- **Calm Aesthetic**: Clean, uncluttered design following UI specification principles
- **Progressive Disclosure**: Complexity revealed only when needed
- **Visual Feedback**: Clear status indicators and interactive elements

## 🚀 Getting Started

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn package manager
- Operating System: Windows, macOS, or Linux
- System libraries for Electron (auto-installed on most systems)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd mycasefiles
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```
   This automatically sets up PDF.js assets and Electron dependencies.

3. **Launch desktop application**
   ```bash
   npm run build && npm run electron
   ```
   Builds the React app and launches the Electron desktop application.

### System Setup (Linux/WSL)
If Electron fails to launch, install required system libraries:
```bash
sudo apt install -y libnss3-dev libatk-bridge2.0-dev libdrm2 libxkbcommon-dev libxcomposite-dev libxdamage-dev libxrandr-dev libgbm-dev libxss-dev libasound2-dev
```

### Development Mode

**React Development Server** (limited PDF parsing)
```bash
npm start
```
Opens [http://localhost:3000](http://localhost:3000) for UI development.

**Electron Development** (full PDF parsing capabilities)
```bash
npm run electron-dev
```
Launches Electron app connected to React dev server with hot reload.

### Available Scripts

**Development:**
- **`npm start`** - React development server (web mode, limited PDF parsing)
- **`npm run electron-dev`** - Electron development with hot reload (full desktop features)

**Production:**
- **`npm run build`** - Build React app with PDF.js assets
- **`npm run electron`** - Launch Electron desktop app (requires build first)
- **`npm run build-electron`** - Build React app and launch Electron
- **`npm run dist`** - Create distributable desktop packages (Windows/macOS/Linux)

**Utilities:**
- **`npm test`** - Run test suite
- **`npm run setup-pdfjs`** - Manually copy PDF.js assets to public directory

## 🏗️ Project Structure

```
src/
├── components/
│   ├── Dashboard.tsx           # Main dashboard interface
│   ├── DocumentVault.tsx       # Document library view
│   ├── FilePreviewModal.tsx    # Dynamic organize dialog with auto-population
│   ├── PDFRenderer.tsx         # High-quality PDF viewer with carousel navigation
│   ├── EmailManager.tsx        # Email import functionality
│   └── BundleList.tsx          # Document bundle management
├── services/
│   ├── indexedDBService.ts     # Local storage management
│   ├── emailParser.ts          # Email parsing utilities
│   └── documentParser/         # PDF text extraction and parsing
│       ├── index.ts            # Main parser exports
│       ├── filenameParser.ts   # Extract info from filenames
│       ├── pdfContentParser.ts # PDF text analysis and extraction
│       ├── sectionMapper.ts    # Map documents to correct sections
│       └── types.ts            # TypeScript interfaces
├── pdfConfig.ts                # PDF.js configuration for offline use
├── pdfWorker.ts                # PDF.js worker setup
└── App.css                     # Application styling

public/
├── electron.js                 # Electron main process with PDF parsing
├── preload.js                  # Secure IPC bridge for renderer
└── pdfjs-dist/                 # Local PDF.js assets for offline functionality
    ├── build/                  # PDF.js core files and workers
    ├── cmaps/                  # Character mapping files (170+ files)
    └── standard_fonts/         # Standard PDF fonts

docs/
├── UI_SPEC.md                  # Comprehensive UI specification
├── react_PDF.md               # PDF processing documentation
└── DOC_PARSER.md              # Document parsing algorithm and patterns
```

## 🔧 Technical Architecture

### Desktop Application
- **Electron**: Native desktop wrapper with full Node.js capabilities
- **IPC Communication**: Secure main/renderer process communication via preload script
- **Cross-Platform**: Windows, macOS, and Linux support via electron-builder
- **Security**: Context isolation and disabled node integration for security

### PDF Processing & Intelligence
- **pdf-parse**: Server-side PDF text extraction in Electron main process
- **react-pdf**: PDF viewing and rendering in React frontend
- **PDF.js**: High-quality rendering engine with local assets
- **Offline-first**: All PDF.js dependencies served locally
- **Intelligent Parsing**: Two-stage extraction (filename → PDF content → form population)

### Document Intelligence
- **Pattern Recognition**: UK court case numbers, form types, judge names
- **Auto-Population**: Smart field mapping based on document section and extracted data
- **UK Legal System**: Specialized patterns for family court documents
- **Judge Abbreviations**: Automatic conversion (Her Honour Judge → HHJ, etc.)

### Data Management
- **IndexedDB**: Browser-native storage for documents and metadata
- **TypeScript**: Type-safe development with interfaces for all data structures
- **Dynamic metadata**: Section-specific form fields based on document type
- **Filename-first Strategy**: Prioritize structured filename data over PDF parsing

### Styling & UI
- **CSS Custom Properties**: Consistent design system with calm color palette
- **Flexbox layouts**: Responsive and accessible interface design
- **Carousel Navigation**: Floating PDF controls for intuitive document review
- **Progressive enhancement**: Features gracefully degrade for older browsers

## 🎨 Design System

### Color Palette
- **Primary Blue**: `#4A90E2` - Active states and primary actions
- **Secondary Blue**: `#357ABD` - Hover states and secondary elements
- **Light Gray**: `#F5F7FA` - Background areas
- **Medium Gray**: `#E1E4E8` - Borders and subtle elements
- **Dark Gray**: `#586069` - Secondary text
- **Text Primary**: `#24292E` - Main content text

### Typography
- **Primary Font**: System font stack for optimal performance
- **Font Weights**: 400 (normal), 500 (medium), 600 (semibold)
- **Line Height**: 1.6 for optimal readability

## 📋 Development Status

### ✅ Completed Features
- **Electron Desktop App**: Native desktop application with full Node.js capabilities ✅ **TESTED & WORKING**
- **PDF Text Extraction**: Automated extraction of court references, judge names, and document types ✅ **TESTED & WORKING**
- **Dual-Strategy Parsing**: Filename-first approach with PDF content fallback for optimal accuracy ✅ **TESTED & WORKING**
- **UK Court Integration**: Pattern recognition for case numbers (AB12C34567), form types (C100, FL401), judge abbreviations (HHJ, DJ, DDJ) ✅ **TESTED & WORKING**
- **Smart Auto-Population**: Intelligent form field pre-filling works for both text-based and scanned PDFs ✅ **TESTED & WORKING**
- **Professional Menu System**: Custom legal document management menus with keyboard shortcuts ✅ **WORKING**
- **Dynamic Document Organization**: Section-specific metadata fields for UK family court structure
- **Carousel PDF Navigation**: Floating buttons around PDF for intuitive page control
- **Full-Screen PDF View**: Maximized preview area with controls panel layout
- **High-Quality PDF Rendering**: Offline-first PDF.js integration with local assets
- **Secure IPC Architecture**: Safe communication between main and renderer processes
- **Cross-Platform Support**: Windows, macOS, and Linux desktop packaging

### 🚧 In Development
- **Enhanced PDF Parsing**: Party name extraction and children information parsing
- **Court Name Recognition**: Automatic detection of family court locations
- **Application Type Classification**: Advanced form type detection beyond basic patterns
- **Bundle Generation**: Automatic page numbering and document compilation
- **Email Integration**: Import functionality for court correspondence

### 📅 Planned Features
- **Advanced Document Intelligence**: Full court order parsing with dates and conditions
- **Professional Export**: PDF bundle generation with table of contents
- **Search & Filter**: Advanced search across document text content
- **Redaction Tools**: Privacy protection for sensitive information
- **Multi-Case Management**: Support for multiple concurrent family court cases
- **Backup & Sync**: Cloud storage integration for document safety

## 🔄 Git Workflow

### Commit Guidelines
- Standard commit messages (Claude attribution excluded per CLAUDE.md)
- Feature branches for new development
- Main branch protection for stable releases

### Branch Structure
- `main` - Production-ready code
- `develop` - Integration branch for features
- `feature/*` - Individual feature development

## 🐛 Known Issues & Limitations

### Desktop Application
1. **System Requirements**: Electron requires modern desktop operating systems
2. **Large File Performance**: Files over 50MB may experience slower PDF text extraction
3. **Memory Usage**: Electron apps use more memory than native applications

### Document Intelligence
1. **Scanned/Image PDFs**: PDFs without text layers (scanned images) fall back to filename parsing only
2. **Text-Based PDFs**: Modern court PDFs with text layers enable full content extraction
3. **Complex Layouts**: Some court documents use non-standard layouts that may reduce parsing accuracy
4. **Case Number Variations**: New case number formats may require pattern updates
5. **OCR Not Included**: For scanned documents, consider manual entry or external OCR preprocessing

## 📚 Documentation

- **[UI Specification](docs/UI_SPEC.md)** - Complete design system and user experience guidelines
- **[PDF Processing Guide](docs/react_PDF.md)** - Technical notes on PDF handling and rendering
- **[Document Parser Guide](docs/DOC_PARSER.md)** - PDF text extraction patterns and algorithms
- **[CLAUDE.md](CLAUDE.md)** - Development configuration and project context

## 🤝 Contributing

### Development Guidelines
1. **Code Style**: Follow established TypeScript patterns and ESLint configuration
2. **Security**: Maintain Electron security best practices (context isolation, no node integration)
3. **PDF Assets**: Ensure all PDF.js assets remain local for offline functionality
4. **Testing**: Test PDF parsing and rendering across different UK court document types
5. **Documentation**: Update relevant documentation for new features or pattern changes

### Adding New Document Patterns
1. Update pattern arrays in `src/services/documentParser/pdfContentParser.ts`
2. Add corresponding mapping in `src/services/documentParser/sectionMapper.ts`
3. Test with real court documents to validate pattern accuracy
4. Document new patterns in `docs/DOC_PARSER.md`

## 📄 License

This project is proprietary software designed for legal document management.

---

**Built with React, TypeScript, Electron, and intelligent PDF parsing for professional UK family court document management.**