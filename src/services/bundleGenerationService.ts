// Bundle generation service for creating professional court bundle PDFs
import { Bundle } from './bundleService';
import { StoredFile } from './indexedDBService';
import vaultService from './vaultService';

export interface BundleDocument {
  file: StoredFile;
  fileBuffer: ArrayBuffer;
  section: string;
  sectionLetter: string;
  documentNumber: number;
  bundleStartPage?: number;
  bundleEndPage?: number;
  bundlePageCount?: number;
}

export interface BundleSection {
  id: string;
  label: string;
  letter: string;
  documents: BundleDocument[];
  startPage: number;
  endPage: number;
}

export interface BundleGenerationOptions {
  includeWatermark: boolean;
  addPageNumbers: boolean;
  createIndex: boolean;
  sections: BundleSection[];
}

class BundleGenerationService {
  async generateBundle(
    bundle: Bundle, 
    documents: StoredFile[]
  ): Promise<{ success: boolean; error?: string; filename?: string; size?: number }> {
    try {
      console.log('📁 BundleGenerationService: Starting bundle generation');
      console.log('📄 Bundle:', bundle.name);
      console.log('📋 Documents count:', documents.length);
      
      // Validate inputs
      if (!bundle || !documents || documents.length === 0) {
        throw new Error('Invalid bundle data or no documents provided');
      }
      
      // Organize documents by sections
      const sections = await this.organizeDocumentsBySections(documents);
      console.log('📂 Organized into sections:', sections.length);
      
      // Convert documents to format suitable for Electron IPC
      const bundleData = await this.prepareBundleData(bundle, sections);
      
      // Call Electron main process to create PDF
      if (window.electronAPI && window.electronAPI.createPDFBundle) {
        const result = await window.electronAPI.createPDFBundle(bundleData);
        
        if (result.success) {
          console.log('✅ Bundle created successfully:', result.filename);
          console.log('📂 Bundle location:', result.filePath);
          
          // PDF is already saved and opened by Electron
          return {
            success: true,
            filename: result.filename,
            size: result.size
          };
        } else {
          throw new Error(result.error || 'Bundle creation failed');
        }
      } else {
        throw new Error('Electron API not available');
      }
      
    } catch (error) {
      console.error('💥 Bundle generation failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
  
  private async organizeDocumentsBySections(documents: StoredFile[]): Promise<BundleSection[]> {
    const vaultSections = vaultService.getVaultSections('child'); // Use child vault sections
    const sections: BundleSection[] = [];
    
    // Initialize sections
    vaultSections.forEach((section, index) => {
      sections.push({
        id: section.id,
        label: section.label,
        letter: String.fromCharCode(65 + index), // A, B, C, etc.
        documents: [],
        startPage: 0,
        endPage: 0
      });
    });
    
    // Group documents by section
    documents.forEach((file, docIndex) => {
      const sectionId = file.section || 'other';
      const section = sections.find(s => s.id === sectionId) || sections.find(s => s.id === 'other');
      
      if (section) {
        section.documents.push({
          file,
          fileBuffer: new ArrayBuffer(0), // Will be populated later
          section: sectionId,
          sectionLetter: section.letter,
          documentNumber: docIndex + 1
        });
      }
    });
    
    // Sort documents within each section by date
    sections.forEach(section => {
      section.documents.sort((a, b) => {
        const aDate = a.file.date;
        const bDate = b.file.date;
        
        // Files without dates go to the bottom
        if (!aDate && !bDate) return 0;
        if (!aDate) return 1;
        if (!bDate) return -1;
        
        // Sort by date (most recent first)
        return new Date(bDate).getTime() - new Date(aDate).getTime();
      });
    });
    
    // Filter out empty sections
    const nonEmptySections = sections.filter(section => section.documents.length > 0);
    
    // Calculate pagination for each section
    await this.calculateSectionPagination(nonEmptySections);
    
    return nonEmptySections;
  }
  
  private async calculateSectionPagination(sections: BundleSection[]): Promise<void> {
    let currentPage = 1; // Bundle pages start from 1
    
    console.log('📄 Calculating pagination for bundle sections...');
    
    for (const section of sections) {
      section.startPage = currentPage;
      let sectionPageCount = 0;
      
      console.log(`📂 Section ${section.letter}: ${section.label} starts at page ${currentPage}`);
      
      for (const doc of section.documents) {
        let docPageCount = 0;
        
        // Calculate page count based on selected pages or total pages
        if (doc.file.selectedPages && doc.file.selectedPages.length > 0) {
          // Use selected pages count
          docPageCount = doc.file.selectedPages.length;
          console.log(`📄 Document "${doc.file.name}": ${docPageCount} selected pages`);
        } else if (doc.file.totalPages && doc.file.totalPages > 0) {
          // Use total pages if no selection
          docPageCount = doc.file.totalPages;
          console.log(`📄 Document "${doc.file.name}": ${docPageCount} total pages (no selection)`);
        } else {
          // Default to 1 page if no page info available
          docPageCount = 1;
          console.log(`📄 Document "${doc.file.name}": defaulting to 1 page (no page info)`);
        }
        
        // Store document-specific bundle pagination
        const docStartPage = currentPage + sectionPageCount;
        const docEndPage = docStartPage + docPageCount - 1;
        
        // Add pagination info to the document object
        (doc as any).bundleStartPage = docStartPage;
        (doc as any).bundleEndPage = docEndPage;
        (doc as any).bundlePageCount = docPageCount;
        
        console.log(`📄 Document "${doc.file.name}": bundle pages ${docStartPage}-${docEndPage}`);
        
        sectionPageCount += docPageCount;
      }
      
      section.endPage = currentPage + sectionPageCount - 1;
      currentPage = section.endPage + 1;
      
      console.log(`📂 Section ${section.letter}: pages ${section.startPage}-${section.endPage} (${sectionPageCount} pages total)`);
    }
    
    const totalPages = currentPage - 1;
    console.log(`📚 Bundle total pages: ${totalPages}`);
    
    // Log final pagination structure
    sections.forEach(section => {
      console.log(`🗂️ Final Section ${section.letter}: ${section.label} (pages ${section.startPage}-${section.endPage})`);
      section.documents.forEach(doc => {
        console.log(`  📄 ${doc.file.name}: pages ${(doc as any).bundleStartPage}-${(doc as any).bundleEndPage}`);
      });
    });
  }
  
  private async prepareBundleData(bundle: Bundle, sections: BundleSection[]) {
    // Get vault settings for party names
    const vaultSettings = await vaultService.getVaultSettings('child'); // Using child vault for now
    
    // Convert File objects to ArrayBuffers for IPC with pagination
    const documentsData = [];
    
    for (const section of sections) {
      for (const doc of section.documents) {
        const arrayBuffer = await this.fileToArrayBuffer(doc.file.data);
        
        documentsData.push({
          id: doc.file.id,
          name: doc.file.displayName || doc.file.name,
          originalName: doc.file.name,
          section: section.id,
          sectionLabel: section.label,
          sectionLetter: section.letter,
          date: doc.file.date,
          courtReference: doc.file.courtReference,
          judgeName: doc.file.judgeName,
          description: doc.file.description,
          arrayBuffer: Array.from(new Uint8Array(arrayBuffer)), // Convert to regular array for IPC
          selectedPages: doc.file.selectedPages || null,
          totalPages: doc.file.totalPages || null,
          // Bundle pagination - use calculated values from calculateSectionPagination
          bundleStartPage: (doc as any).bundleStartPage,
          bundleEndPage: (doc as any).bundleEndPage,
          bundlePageCount: (doc as any).bundlePageCount
        });
      }
    }
    
    // Prepare party information
    let applicantName = '';
    let respondentName = '';
    let childrenInfo: any[] = [];
    
    if (vaultSettings.type === 'child') {
      applicantName = vaultSettings.fatherName || '[Father Name]';
      respondentName = vaultSettings.motherName || '[Mother Name]';
      childrenInfo = vaultSettings.children || [];
    } else {
      applicantName = vaultSettings.applicantName || '[Applicant Name]';
      respondentName = vaultSettings.respondentName || '[Respondent Name]';
    }
    
    return {
      bundleName: bundle.name,
      caseReference: bundle.caseReference,
      hearingDate: bundle.hearingDate,
      court: bundle.court,
      watermarked: bundle.watermarked,
      applicantName,
      respondentName,
      children: childrenInfo,
      documents: documentsData,
      totalPages: sections.length > 0 ? sections[sections.length - 1].endPage : 0, // Total pages in the bundle
      sections: sections.map(s => ({
        id: s.id,
        label: s.label,
        letter: s.letter,
        documentCount: s.documents.length,
        startPage: s.startPage,
        endPage: s.endPage,
        pageCount: s.endPage - s.startPage + 1
      }))
    };
  }
  
  private async fileToArrayBuffer(file: File): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsArrayBuffer(file);
    });
  }
  
  // Setup progress listening
  setupProgressListener(onProgress: (progress: any) => void): () => void {
    if (window.electronAPI && window.electronAPI.onBundleProgress) {
      const progressHandler = (_event: any, progress: any) => {
        onProgress(progress);
      };
      
      window.electronAPI.onBundleProgress(progressHandler);
      
      // Return cleanup function
      return () => {
        if (window.electronAPI && window.electronAPI.removeBundleProgressListener) {
          window.electronAPI.removeBundleProgressListener(progressHandler);
        }
      };
    }
    
    return () => {}; // No-op cleanup if API not available
  }
}

const bundleGenerationService = new BundleGenerationService();
export default bundleGenerationService;