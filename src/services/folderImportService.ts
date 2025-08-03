import { VaultType } from '../types/vault';
import vaultService from './vaultService';

export interface FolderMapping {
  folderName: string;
  sectionId: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface ImportResult {
  successful: number;
  failed: number;
  duplicates: number;
  mappings: Array<{
    folderName: string;
    sectionId: string;
    fileCount: number;
  }>;
}

/**
 * Service for importing files from organized folder structures
 * Maps common folder naming patterns to bundle sections
 */
class FolderImportService {
  
  /**
   * Get folder to section mappings for a specific vault type
   */
  getFolderMappings(vaultType: VaultType): FolderMapping[] {
    const sections = vaultService.getVaultSections(vaultType);
    const mappings: FolderMapping[] = [];

    sections.forEach((section, index) => {
      // Map standard section patterns
      const sectionLetter = String.fromCharCode(65 + index); // A, B, C, D...
      const sectionNumber = (index + 1).toString(); // 1, 2, 3, 4...
      
      // High confidence mappings
      mappings.push(
        { folderName: `Section ${sectionLetter}`, sectionId: section.id, confidence: 'high' },
        { folderName: `section ${sectionLetter}`, sectionId: section.id, confidence: 'high' },
        { folderName: `SECTION ${sectionLetter}`, sectionId: section.id, confidence: 'high' },
        { folderName: `${sectionLetter}`, sectionId: section.id, confidence: 'high' },
        { folderName: `${sectionNumber}`, sectionId: section.id, confidence: 'high' },
        { folderName: `Part ${sectionLetter}`, sectionId: section.id, confidence: 'high' },
        { folderName: `Bundle ${sectionLetter}`, sectionId: section.id, confidence: 'high' }
      );

      // Medium confidence mappings based on section name
      const sectionNameWords = section.label.toLowerCase().split(' ');
      sectionNameWords.forEach(word => {
        if (word.length > 3) { // Skip short words like "and", "of"
          mappings.push(
            { folderName: word, sectionId: section.id, confidence: 'medium' },
            { folderName: word.charAt(0).toUpperCase() + word.slice(1), sectionId: section.id, confidence: 'medium' }
          );
        }
      });
    });

    // Add specific pattern mappings
    this.addSpecificPatternMappings(mappings, vaultType);

    return mappings;
  }

  /**
   * Add vault-specific pattern mappings
   */
  private addSpecificPatternMappings(mappings: FolderMapping[], vaultType: VaultType): void {
    // Common court bundle patterns
    const commonPatterns = [
      { patterns: ['orders', 'court orders', 'judicial orders'], sectionId: 'orders', confidence: 'high' as const },
      { patterns: ['applications', 'forms', 'court forms'], sectionId: 'applications', confidence: 'high' as const },
      { patterns: ['statements', 'witness statements', 'position statements'], sectionId: 'statements', confidence: 'high' as const },
      { patterns: ['evidence', 'exhibits'], sectionId: 'evidence', confidence: 'high' as const },
      { patterns: ['experts', 'expert reports', 'cafcass'], sectionId: 'experts', confidence: 'high' as const },
      { patterns: ['correspondence', 'letters', 'emails'], sectionId: 'correspondence', confidence: 'high' as const },
      { patterns: ['chronology', 'timeline'], sectionId: 'chronology', confidence: 'high' as const },
      { patterns: ['preliminary', 'prelim', 'preliminary docs'], sectionId: 'preliminary', confidence: 'high' as const },
      { patterns: ['other', 'miscellaneous', 'misc'], sectionId: 'other', confidence: 'medium' as const }
    ];

    // Child-specific patterns
    if (vaultType === 'child') {
      const childPatterns = [
        { patterns: ['cafcass reports', 'section 7', 's7'], sectionId: 'experts', confidence: 'high' as const },
        { patterns: ['child arrangements', 'contact', 'residence'], sectionId: 'applications', confidence: 'medium' as const }
      ];
      commonPatterns.push(...childPatterns);
    }

    // Finance-specific patterns
    if (vaultType === 'finance') {
      const financePatterns = [
        { patterns: ['financial', 'form e', 'forme', 'financial disclosure'], sectionId: 'applications', confidence: 'high' as const },
        { patterns: ['valuations', 'property', 'assets'], sectionId: 'evidence', confidence: 'medium' as const }
      ];
      commonPatterns.push(...financePatterns);
    }

    // Add all patterns to mappings
    commonPatterns.forEach(({ patterns, sectionId, confidence }) => {
      patterns.forEach(pattern => {
        mappings.push({ folderName: pattern, sectionId, confidence });
        mappings.push({ folderName: pattern.toUpperCase(), sectionId, confidence });
        mappings.push({ folderName: this.toTitleCase(pattern), sectionId, confidence });
      });
    });
  }

  /**
   * Convert string to title case
   */
  private toTitleCase(str: string): string {
    return str.replace(/\w\S*/g, (txt) => 
      txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
    );
  }

  /**
   * Map a folder name to a section ID
   */
  mapFolderToSection(folderName: string, vaultType: VaultType): { sectionId: string; confidence: 'high' | 'medium' | 'low' } | null {
    const mappings = this.getFolderMappings(vaultType);
    
    // Try exact match first
    const exactMatch = mappings.find(m => m.folderName === folderName);
    if (exactMatch) {
      return { sectionId: exactMatch.sectionId, confidence: exactMatch.confidence };
    }

    // Try case-insensitive match
    const lowerFolderName = folderName.toLowerCase();
    const caseInsensitiveMatch = mappings.find(m => m.folderName.toLowerCase() === lowerFolderName);
    if (caseInsensitiveMatch) {
      return { sectionId: caseInsensitiveMatch.sectionId, confidence: caseInsensitiveMatch.confidence };
    }

    // Try partial match for longer folder names
    const partialMatch = mappings.find(m => 
      lowerFolderName.includes(m.folderName.toLowerCase()) || 
      m.folderName.toLowerCase().includes(lowerFolderName)
    );
    if (partialMatch) {
      return { sectionId: partialMatch.sectionId, confidence: 'low' };
    }

    return null;
  }

  /**
   * Get suggested mappings for preview before import
   */
  previewFolderMappings(fileList: FileList, vaultType: VaultType): Array<{
    folderName: string;
    fileCount: number;
    suggestedSection: string | null;
    confidence: 'high' | 'medium' | 'low' | null;
    files: string[];
  }> {
    const folderMap = new Map<string, string[]>();

    // Group files by folder path
    Array.from(fileList).forEach(file => {
      // Extract folder name from file path (webkitRelativePath)
      const path = (file as any).webkitRelativePath || file.name;
      const pathParts = path.split('/');
      
      if (pathParts.length > 1) {
        const folderName = pathParts[0];
        if (!folderMap.has(folderName)) {
          folderMap.set(folderName, []);
        }
        folderMap.get(folderName)!.push(file.name);
      } else {
        // Files in root
        if (!folderMap.has('Root')) {
          folderMap.set('Root', []);
        }
        folderMap.get('Root')!.push(file.name);
      }
    });

    // Map each folder to sections
    const preview: Array<{
      folderName: string;
      fileCount: number;
      suggestedSection: string | null;
      confidence: 'high' | 'medium' | 'low' | null;
      files: string[];
    }> = [];

    folderMap.forEach((files, folderName) => {
      const mapping = this.mapFolderToSection(folderName, vaultType);
      preview.push({
        folderName,
        fileCount: files.length,
        suggestedSection: mapping?.sectionId || null,
        confidence: mapping?.confidence || null,
        files
      });
    });

    return preview.sort((a, b) => b.fileCount - a.fileCount); // Sort by file count
  }
}

const folderImportService = new FolderImportService();
export default folderImportService;