# MyCaseFiles - Desktop Legal Document Management System

⚠️ **DESKTOP APPLICATION ONLY** - This app requires Electron for PDF text extraction and must be run as a desktop application. Browser mode has limited functionality and is not recommended for production use.

A comprehensive legal case management desktop application designed for self-represented litigants and legal professionals. Built with React, TypeScript, and Electron, featuring advanced PDF document organization, intelligent text extraction, automated metadata population for UK family court documents, and manual OCR for scanned documents.

## 🎯 Current Features

### Document Management
- **Two-Step Organization System**: 🔥 **NEW** - Smart file organization prioritizing bundle preparation over complex metadata
- **Folder Structure Import**: 🔥 **NEW** - Import pre-organized folders (Section A/B/C, Orders, Statements) with automatic section mapping
- **Auto-Assignment for High-Confidence Files**: Orders, applications, and expert reports automatically organize themselves
- **Smart Section Dropdowns**: Intelligent suggestions with confidence levels (high/medium/low) for quick manual organization
- **"Take a Closer Look" Feature**: 🔥 **NEW** - PDF preview modal for visual document inspection when filename alone isn't clear
- **Simplified Organization Modal**: Clean interface focusing on section assignment with vault type confirmation and mismatch warnings
- **Two-Vault System**: Separate Child and Financial matter workspaces with independent file organization
- **Vault Switching**: Easy toggling between Child Matters and Financial Matters with dedicated interfaces
- **Streamlined Bundle Workflow**: Focus on getting files into correct sections quickly for court bundle creation
- **Duplicate Detection**: Intelligent file duplicate prevention with user feedback notifications
- **IndexedDB Storage**: Local file storage with vault-based filtering and efficient retrieval
- **Intelligent Parsing**: Filename-first + PDF content extraction strategy with vault type detection

### PDF Processing & Analysis
- **Desktop PDF Text Extraction**: Full pdf-parse library integration via Electron main process
- **Automated Field Population**: Court reference numbers, judge names, document types, person names
- **UK Court Pattern Recognition**: Case numbers (AB12C34567), form types (C100, FL401), judge abbreviations (HHJ, DJ, DDJ)
- **Enhanced Statement Processing**: Comprehensive name extraction from headers, "I, [Name]" patterns, and signature areas
- **Smart Document Classification**: Auto-detects statements, orders, and applications with section-specific field mapping
- **UK Legal Name Formatting**: Proper title handling (Mr/Mrs/Ms + Initial/First + Surname) with intelligent cleaning
- **High-Quality PDF Renderer**: Offline-first PDF.js integration with local assets
- **Carousel Navigation**: Floating navigation buttons around PDF for intuitive page control
- **Full-Screen PDF View**: Maximized PDF preview area (95vw × 90vh) with controls in right panel

### OCR & Text Processing
- **Manual OCR Control**: User-triggered OCR for scanned PDFs with visual feedback and confidence scoring
- **Tesseract.js Integration**: High-quality text extraction from scanned documents
- **PDF Text Extraction**: Direct text extraction from digital PDFs using pdf-parse

### Document Vault
- **Enhanced Document View**: 🔥 **NEW** - Compact row-based layout with hyperlink-style titles and metadata
- **Document Status Indicators**: 🔥 **NEW** - Visual badges showing page selections (📄 5/10), metadata completion (✓), and OCR status (🔍)
- **Page Selection Interface**: 🔥 **NEW** - Carousel-style page pruning with 400×600px PDF previews and mouse wheel horizontal scrolling
- **Advanced Filtering**: Filter documents by bundle section with accurate file counts
- **Smart Search**: Search across file names, descriptions, judge names, and references
- **Flexible Sorting**: Sort by date (newest first), name, type, or section
- **Section Indicators**: Visual badges showing which bundle section each document belongs to
- **Inline Metadata**: See judge names, court references, and dates at a glance
- **Quick Actions**: Page Select, Edit, and Delete documents with confirmation dialogs
- **Empty State Handling**: Different messages for empty vault vs. no search results

### Desktop Experience
- **Native Desktop App**: Electron wrapper providing full Node.js capabilities
- **Secure IPC**: Preload script ensures safe communication between renderer and main process
- **Cross-Platform**: Windows, macOS, and Linux support via electron-builder
- **Vault-Based Interface**: Clean separation between Child and Financial matter workspaces
- **Compact Form Layout**: Horizontal field arrangement for efficient space usage
- **Real-time Upload Feedback**: Success, warning, and error notifications for file operations
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
   This automatically sets up Electron dependencies and PDF processing libraries.

3. **Launch desktop application**
   ```bash
   npm run build && npm run electron
   ```
   Builds the React app and launches the Electron desktop application.

   ⚠️ **IMPORTANT**: This app must be run in Electron mode for full functionality including PDF text extraction and OCR capabilities.

### System Setup (Linux/WSL)
If Electron fails to launch, install required system libraries:
```bash
sudo apt install -y libnss3-dev libatk-bridge2.0-dev libdrm2 libxkbcommon-dev libxcomposite-dev libxdamage-dev libxrandr-dev libgbm-dev libxss-dev libasound2-dev
```

### Development Mode

**Recommended for Testing** (fresh build every time, no caching issues)
```bash
npm run dev-electron
```
Builds React app and launches Electron with guaranteed fresh code - best for reliable testing.

**Quick Development** (may have caching issues)
```bash
npm run electron
```
Launches Electron with existing build - faster but may serve cached code.

**React Development Server** ⚠️ **NOT RECOMMENDED** (severely limited functionality)
```bash
npm start
```
Opens [http://localhost:3000](http://localhost:3000) for UI development only. **WARNING**: Browser mode cannot perform PDF text extraction, OCR, or document parsing. Use only for UI styling work.

### Available Scripts

**Development & Testing:**
- **`npm run dev-electron`** - **RECOMMENDED** Build and launch with fresh code (no caching issues)
- **`npm run electron`** - Quick launch (may use cached build)
- **`npm start`** - ⚠️ React development server (web mode, **severely limited** - no PDF parsing, no OCR)
- **`npm run electron-dev`** - Electron development with hot reload (connects to React dev server)

**Production:**
- **`npm run build`** - Build React app for production
- **`npm run build-electron`** - Build and package Electron app
- **`npm run dist`** - Create distributable desktop packages (Windows/macOS/Linux)

**Utilities:**
- **`npm test`** - Run test suite

## 🏗️ Project Structure

```
src/
├── components/
│   ├── Dashboard.tsx           # Main dashboard with smart file organization dropdowns and auto-assignment
│   ├── DocumentVault.tsx       # Document library view with vault filtering
│   ├── FilePreviewModal.tsx    # Full metadata edit dialog (legacy/detailed workflow)
│   ├── SimpleOrganizeModal.tsx # 🔥 NEW - Simplified "Take a Closer Look" modal for section assignment
│   ├── VaultSelector.tsx       # Child/Financial matter vault switching interface
│   ├── VaultSettings.tsx       # Vault-specific party and court information management
│   ├── PDFRenderer.tsx         # High-quality PDF viewer with carousel navigation
│   ├── EmailManager.tsx        # Email import functionality
│   └── BundleList.tsx          # Document bundle management
├── services/
│   ├── indexedDBService.ts     # Local storage management with vault-based filtering
│   ├── vaultService.ts         # Vault settings and file migration management
│   ├── emailParser.ts          # Email parsing utilities
│   └── documentParser/         # PDF text extraction and parsing
│       ├── index.ts            # Main parser exports with vault type detection
│       ├── filenameParser.ts   # Extract info from filenames
│       ├── pdfContentParser.ts # PDF text analysis and extraction
│       ├── sectionMapper.ts    # Map documents to correct sections with vault awareness
│       └── types.ts            # TypeScript interfaces
├── types/
│   └── vault.ts                # Vault system TypeScript interfaces
├── pdfConfig.ts                # PDF rendering configuration  
├── pdfWorker.ts                # PDF worker setup
└── App.css                     # Application styling with vault selector and compact forms

public/
├── electron.js                 # Electron main process with PDF parsing
├── preload.js                  # Secure IPC bridge for renderer
├── favicon.ico                 # Application icon
├── index.html                  # Main HTML template
└── manifest.json               # Web app manifest

docs/
├── UI_SPEC.md                  # Comprehensive UI specification
├── react_PDF.md               # PDF processing documentation
├── DOC_PARSER.md              # Document parsing algorithm and patterns
└── LOCAL_LLM.md               # Local AI model documentation and setup
```

## 🔧 Technical Architecture

### Desktop Application
- **Electron**: Native desktop wrapper with full Node.js capabilities
- **IPC Communication**: Secure main/renderer process communication via preload script
- **Cross-Platform**: Windows, macOS, and Linux support via electron-builder
- **Security**: Context isolation and disabled node integration for security
- **Native Menus**: Custom menu bar with legal document management shortcuts

### Smart File Organization System
- **Confidence-Based Assignment**: Three-tier system (high/medium/low) for intelligent file organization
- **Auto-Assignment Logic**: High-confidence patterns (orders, applications, expert reports) trigger immediate section assignment
- **Smart Dropdown Interface**: Section selectors with intelligent suggestions for medium/low confidence files
- **Visual Document Inspection**: "Take a Closer Look" button opens PDF preview modal when filename alone isn't sufficient
- **Bundle-First Approach**: Prioritizes getting files into sections over detailed metadata collection
- **Two-Step Workflow**: Quick organization → detailed metadata (when needed)
- **Vault Type Confirmation**: Prevents mixing child and finance documents with clear warnings and visual feedback

### PDF Processing & Intelligence
- **pdf-parse**: Server-side PDF text extraction in Electron main process
- **react-pdf**: PDF viewing and rendering in React frontend
- **Intelligent Parsing**: Two-stage extraction (filename → PDF content → section assignment)

### Document Intelligence
- **Pattern Recognition**: UK court case numbers, form types, judge names, person names
- **Confidence Scoring**: Smart classification system for reliable auto-assignment
- **UK Legal System**: Specialized patterns for family court documents and statements
- **Judge Abbreviations**: Automatic conversion (Her Honour Judge → HHJ, etc.)
- **Statement Processing**: Multi-pattern name extraction from headers, "I, [Name]" clauses, and signatures
- **Name Formatting**: Intelligent cleaning and formatting (Mr/Mrs/Ms + Initial/First + Surname)
- **Family Court References**: Perfect XX##X##### pattern matching (e.g., AB12C34567)

### OCR Technology
- **Tesseract.js**: Advanced OCR engine for text extraction from scanned documents
- **Confidence Scoring**: Real-time feedback on OCR accuracy
- **Multi-page Processing**: Handles complex legal documents with multiple pages
- **High Resolution Support**: Optimized for high-quality document scanning

### Data Management
- **IndexedDB**: Browser-native storage for documents and metadata
- **TypeScript**: Type-safe development with interfaces for all data structures
- **Section-First Architecture**: Optimized for court bundle preparation workflow
- **Filename-first Strategy**: Prioritize structured filename data over PDF parsing

### Organization Strategy & Workflow
- **Three-Tier Confidence System**: High (auto-assign) → Medium (suggest) → Low (manual)
- **Bundle Preparation Focus**: Section assignment prioritized over metadata complexity
- **Smart Pattern Matching**: UK court case numbers, form types, judge names, and person names
- **Visual Inspection Fallback**: "Take a Closer Look" PDF preview when automatic detection is insufficient
- **Vault Type Safety**: Prevents document mixing with clear warnings and confirmation dialogs
- **Flexible Override System**: Users can always change auto-assignments and add detailed metadata later

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
- **Two-Step File Organization**: Smart auto-assignment + manual dropdown system prioritizing bundle preparation ⚠️ **NEEDS TESTING**
- **Intelligent Auto-Assignment**: High-confidence files (orders, applications, expert reports) organize automatically ⚠️ **NEEDS TESTING**  
- **Smart Suggestion System**: Medium/low confidence files show intelligent suggestions with dropdown selection ⚠️ **NEEDS TESTING**
- **"Take a Closer Look" Feature**: PDF preview modal for visual document inspection when filenames are unclear ⚠️ **NEEDS TESTING**
- **Simplified Organization Modal**: Clean interface focusing on section assignment with vault type warnings ⚠️ **NEEDS TESTING**
- **Folder Structure Import**: Import pre-organized folders with automatic section mapping ⚠️ **NEEDS TESTING**
- **Enhanced Document Vault**: Compact row layout with search, filtering, sorting, and delete functionality ⚠️ **NEEDS TESTING**
- **Two-Vault System**: Complete separation of Child and Financial matter workspaces ✅ **TESTED & WORKING**
- **Vault Switching Interface**: Clean vault selector with party-specific metadata ✅ **TESTED & WORKING**
- **Duplicate File Detection**: Smart prevention with user-friendly notifications ✅ **TESTED & WORKING**
- **Immediate File Loading**: Uncategorized files appear instantly on app startup ✅ **TESTED & WORKING**
- **Compact Form Layout**: Horizontal field arrangement for efficient space usage ✅ **TESTED & WORKING**
- **Vault-Specific Metadata**: Child matters track father/mother, finance tracks applicant/respondent ✅ **TESTED & WORKING**
- **Electron Desktop App**: Native desktop application with full Node.js capabilities ✅ **TESTED & WORKING**
- **PDF Text Extraction**: Automated extraction of court references, judge names, and document types ✅ **TESTED & WORKING**
- **Manual OCR Control**: User-triggered OCR for scanned PDFs with visual feedback and confidence scoring ✅ **TESTED & WORKING**
- **Dual-Strategy Parsing**: Filename-first approach with PDF content fallback for optimal accuracy ✅ **TESTED & WORKING**
- **UK Court Integration**: Pattern recognition for case numbers (AB12C34567), form types (C100, FL401), judge abbreviations (HHJ, DJ, DDJ) ✅ **TESTED & WORKING**
- **Smart Auto-Population**: Intelligent form field pre-filling with vault type detection ✅ **TESTED & WORKING**
- **Enhanced Statement Processing**: Comprehensive person name extraction from headers, patterns, and signatures ✅ **TESTED & WORKING**
- **UK Legal Name Formatting**: Proper title and name cleaning (Mr/Mrs/Ms + Initial/First + Surname) ✅ **TESTED & WORKING**
- **UK Date Formatting**: DD/MM/YYYY date inputs and "March 5, 2025" display format throughout ✅ **TESTED & WORKING**
- **Browser Mode Prevention**: Comprehensive warnings against browser-only usage with runtime detection ✅ **TESTED & WORKING**
- **Professional Menu System**: Custom legal document management menus with keyboard shortcuts ✅ **WORKING**
- **Dynamic Document Organization**: Section-specific metadata fields for UK family court structure
- **Carousel PDF Navigation**: Floating buttons around PDF for intuitive page control
- **Full-Screen PDF View**: Maximized preview area with controls panel layout
- **High-Quality PDF Rendering**: react-pdf integration for document viewing
- **Secure IPC Architecture**: Safe communication between main and renderer processes
- **Cross-Platform Support**: Windows, macOS, and Linux desktop packaging

### 🚧 In Development
- **Visual Vault Mode Feedback**: Color schemes (blue for child, green for finance) to clearly indicate current vault mode
- **Advanced Bundle Generation**: Automatic page numbering and document compilation with vault separation
- **Enhanced File Organization Interface**: Refinements to auto-assignment accuracy and dropdown usability
- **Court Bundle Templates**: Pre-configured section orders and formatting for different court types
- **Email Integration**: Import functionality for court correspondence with vault assignment
- **Detailed Metadata Enhancement**: Secondary workflow for adding comprehensive document details after section assignment

### ✅ Completed Features
- **PDF Page Pruning**: ✅ **COMPLETE** - Carousel-style interface for manual page selection with real PDF previews and mouse wheel scrolling
- **Document Status Indicators**: ✅ **COMPLETE** - Visual badges showing page selections, metadata completion, and OCR status in document vault
### 🚧 In Development
- **Advanced Bundle Generation**: One-click court bundle creation with automatic page numbering, table of contents, and professional formatting
- **Enhanced Bundle Builder**: Visual interface for organizing sections and reordering documents within court bundles
- **Advanced Document Intelligence**: Full court order parsing with dates and conditions
- **Professional Export**: PDF bundle generation with comprehensive table of contents and pagination
- **Search & Filter**: Advanced search across document text content
- **Redaction Tools**: Privacy protection for sensitive information
- **Backup & Sync**: Cloud storage integration for document safety

### 📅 Planned Features
- **Server-Side PDF Thumbnails**: Real PDF page thumbnails via Electron main process using pdf-poppler or similar
- **Enhanced Page Selection**: Per-page text extraction and improved blank detection using server-side PDF processing

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
1. **Scanned/Image PDFs**: Manual OCR available for scanned documents with visual feedback and confidence scoring
2. **Text-Based PDFs**: Modern court PDFs with text layers enable full content extraction
3. **Complex Layouts**: Some court documents use non-standard layouts that may reduce parsing accuracy
4. **Case Number Variations**: New case number formats may require pattern updates
5. **OCR Processing**: Manual OCR takes 10-15 seconds but provides high-quality text extraction for scanned documents

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

**Built with React, TypeScript, Electron, intelligent PDF parsing, and OCR technology for professional UK family court document management.**