# MyCaseFiles - Legal Document Management System

A comprehensive legal case management application designed for self-represented litigants and legal professionals. Built with React and TypeScript, featuring advanced PDF document organization, preview capabilities, and intelligent metadata management.

## 🎯 Current Features

### Document Management
- **Dynamic Organize Dialog**: Section-specific metadata fields that adapt based on document type
- **Smart File Organization**: Supports preliminary documents, applications & orders, statements, care plans, expert reports, and more
- **Automatic Filename Generation**: Context-aware naming based on document metadata
- **IndexedDB Storage**: Local file storage with efficient retrieval

### PDF Viewing & Analysis
- **High-Quality PDF Renderer**: Offline-first PDF.js integration with local assets
- **Rectangular Magnifier**: Draggable 200×80px banner magnifier with 2x zoom for examining reference numbers and fine details
- **Page Navigation**: Full navigation controls (first, previous, next, last) for multi-page documents
- **Toggle Controls**: Easy show/hide magnifier functionality integrated into modal interface

### User Interface
- **Calm Aesthetic**: Clean, uncluttered design following UI specification principles
- **Progressive Disclosure**: Complexity revealed only when needed
- **Visual Feedback**: Clear status indicators and interactive elements
- **Responsive Design**: Consistent experience across different screen sizes

## 🚀 Getting Started

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn package manager

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

3. **Set up PDF.js assets** (automatic)
   ```bash
   npm run setup-pdfjs
   ```
   This copies PDF.js assets locally for offline functionality.

4. **Start development server**
   ```bash
   npm start
   ```
   Opens [http://localhost:3000](http://localhost:3000) in your browser.

### Available Scripts

- **`npm start`** - Development server with hot reload
- **`npm run dev`** - Alias for `npm start`
- **`npm run build`** - Production build with PDF.js asset setup
- **`npm test`** - Run test suite
- **`npm run setup-pdfjs`** - Manually copy PDF.js assets to public directory

## 🏗️ Project Structure

```
src/
├── components/
│   ├── Dashboard.tsx           # Main dashboard interface
│   ├── DocumentVault.tsx       # Document library view
│   ├── FilePreviewModal.tsx    # Dynamic organize dialog
│   ├── PDFRenderer.tsx         # High-quality PDF viewer with magnifier
│   ├── EmailManager.tsx        # Email import functionality
│   └── BundleList.tsx          # Document bundle management
├── services/
│   ├── indexedDBService.ts     # Local storage management
│   └── emailParser.ts          # Email parsing utilities
├── pdfConfig.ts                # PDF.js configuration for offline use
├── pdfWorker.ts                # PDF.js worker setup
└── App.css                     # Application styling

docs/
├── UI_SPEC.md                  # Comprehensive UI specification
└── react_PDF.md               # PDF processing documentation

public/pdfjs-dist/              # Local PDF.js assets for offline functionality
├── build/                      # PDF.js core files and workers
├── cmaps/                      # Character mapping files (170+ files)
└── standard_fonts/             # Standard PDF fonts
```

## 🔧 Technical Architecture

### PDF Processing
- **react-pdf**: PDF viewing and rendering
- **PDF.js**: High-quality rendering engine with local assets
- **Offline-first**: All PDF.js dependencies served locally
- **High-DPI rendering**: 2x devicePixelRatio for magnifier quality

### Data Management
- **IndexedDB**: Browser-native storage for documents and metadata
- **TypeScript**: Type-safe development with interfaces for all data structures
- **Dynamic metadata**: Section-specific form fields based on document type

### Styling & UI
- **CSS Custom Properties**: Consistent design system with calm color palette
- **Flexbox layouts**: Responsive and accessible interface design
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
- Dynamic document organization with section-specific metadata
- High-quality PDF rendering with offline assets
- Rectangular banner magnifier with 2x zoom
- Page navigation controls for multi-page documents
- Toggle controls for magnifier visibility
- Local PDF.js asset management and build integration
- TypeScript interfaces for all major data structures

### 🚧 In Development
- Bundle generation with automatic page numbering
- Email parsing and import functionality
- Advanced search and filtering capabilities
- Document pruning and page selection tools

### 📅 Planned Features
- Professional tier with watermark removal
- Advanced redaction tools
- Email summarization with LLM integration
- Export functionality for various document formats
- Multi-user collaboration features

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

1. **PDF.js Version Compatibility**: Using react-pdf's bundled PDF.js version to avoid conflicts
2. **Large File Performance**: Files over 50MB may experience slower rendering
3. **Browser Compatibility**: Full functionality requires modern browsers with IndexedDB support

## 📚 Documentation

- **[UI Specification](docs/UI_SPEC.md)** - Complete design system and user experience guidelines
- **[PDF Processing Guide](docs/react_PDF.md)** - Technical notes on PDF handling
- **[CLAUDE.md](CLAUDE.md)** - Development configuration and project context

## 🤝 Contributing

1. Follow the established code style and TypeScript patterns
2. Ensure all PDF.js assets remain local for offline functionality
3. Test magnifier and PDF rendering across different document types
4. Update documentation for any new features or changes

## 📄 License

This project is proprietary software designed for legal document management.

---

**Built with React, TypeScript, and PDF.js for professional legal document management.**