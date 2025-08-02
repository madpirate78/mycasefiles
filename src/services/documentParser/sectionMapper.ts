import { FilenameData, SuggestedMetadata } from './types';
import { FilenameParser } from './filenameParser';
import { CaseType } from '../../types/case';

export class SectionMapper {
  private filenameParser = new FilenameParser();

  /**
   * Get suggested section based on filename analysis and case type
   */
  getSuggestedSection(filename: string, caseType?: CaseType): string {
    const data = this.filenameParser.parse(filename);
    
    // Map document types and form types to sections
    if (data.formType) {
      const formType = data.formType.toUpperCase();
      
      // Child arrangements forms
      if (['C100', 'C1A', 'C78', 'C79', 'FL401', 'FL402', 'FL403'].includes(formType)) {
        return 'applications';
      }
      
      // Financial forms
      if (['FORM A', 'FORM E', 'D81'].includes(formType)) {
        return 'applications';
      }
    }
    
    // Check filename for keywords
    const lowerName = filename.toLowerCase();
    
    if (lowerName.includes('statement') || lowerName.includes('affidavit')) {
      return 'statements';
    }
    
    if (lowerName.includes('expert') || lowerName.includes('cafcass') || lowerName.includes('social')) {
      return 'experts';
    }
    
    if (lowerName.includes('care') || lowerName.includes('plan')) {
      return 'care';
    }

    if (caseType === 'finance' && (lowerName.includes('disclosure') || lowerName.includes('form e'))) {
      return 'disclosure';
    }
    
    if (lowerName.includes('valuation') || lowerName.includes('property') || lowerName.includes('pension')) {
      return 'valuations';
    }

    // Check for preliminary document keywords
    const prelimKeywords = ['case summary', 'statement of issues', 'position statement', 'chronology', 'skeleton', 'essential reading'];
    if (prelimKeywords.some(keyword => lowerName.includes(keyword))) {
      return 'preliminary';
    }
    
    // Default to applications for court documents
    if (data.documentType === 'application') {
      return 'applications';
    }
    
    if (data.documentType === 'order') {
      return 'orders';
    }
    
    return 'other';
  }

  /**
   * Detect vault type based on document content and filename
   */
  detectVaultType(filename: string, pdfText?: string): 'child' | 'finance' | null {
    const lowerName = filename.toLowerCase();
    const lowerText = pdfText?.toLowerCase() || '';
    
    // Child matter indicators
    const childKeywords = [
      'children act', 'child arrangements', 'contact', 'residence', 
      'prohibited steps', 'specific issue', 'parental responsibility',
      'c100', 'fl401', 'non-molestation', 'occupation order', 'cafcass'
    ];
    
    // Finance matter indicators  
    const financeKeywords = [
      'matrimonial causes act', 'financial remedy', 'ancillary relief',
      'form a', 'form e', 'financial dispute resolution', 'fdr',
      'pension sharing', 'clean break', 'maintenance', 'property adjustment',
      'financial order', 'matrimonial'
    ];
    
    // Check filename first
    if (childKeywords.some(keyword => lowerName.includes(keyword))) {
      return 'child';
    }
    
    if (financeKeywords.some(keyword => lowerName.includes(keyword))) {
      return 'finance';
    }
    
    // Check PDF content if available
    if (pdfText) {
      const childScore = childKeywords.filter(keyword => lowerText.includes(keyword)).length;
      const financeScore = financeKeywords.filter(keyword => lowerText.includes(keyword)).length;
      
      if (childScore > financeScore && childScore > 0) {
        return 'child';
      }
      
      if (financeScore > childScore && financeScore > 0) {
        return 'finance';
      }
    }
    
    return null; // Cannot determine
  }

  /**
   * Get suggested metadata based on filename analysis and case type
   */
  getSuggestedMetadata(filename: string, caseType?: CaseType): SuggestedMetadata {
    console.log('Parsing filename:', filename);
    const data = this.filenameParser.parse(filename);
    console.log('Parsed data:', data);
    
    const metadata: SuggestedMetadata = {};
    
    // Set suggested section
    metadata.section = this.getSuggestedSection(filename, caseType);
    console.log('Suggested section:', metadata.section);
    
    // Set document type if found
    if (data.formType) {
      const formType = data.formType.toUpperCase();
      
      // Map form types to document types for applications
      const formToDocType: { [key: string]: string } = {
        'C100': 'c100',
        'FL401': 'fl401',
        'FL402': 'fl402',
        'C1A': 'c1',
        'C78': 'c1',
        'FORM A': 'form_a',
        'FORM E': 'form_e',
        'D81': 'd81'
      };
      
      if (formToDocType[formType]) {
        metadata.documentType = formToDocType[formType];
      }
    }

    // Map preliminary document types
    const lowerName = filename.toLowerCase();
    if (metadata.section === 'preliminary') {
      if (lowerName.includes('case summary')) {
        metadata.documentType = 'case_summary';
      } else if (lowerName.includes('statement of issues')) {
        metadata.documentType = 'statement_of_issues';
      } else if (lowerName.includes('position statement')) {
        metadata.documentType = 'position_statements';
      } else if (lowerName.includes('chronology')) {
        metadata.documentType = 'chronology';
      } else if (lowerName.includes('skeleton')) {
        metadata.documentType = 'skeleton_arguments';
      } else if (lowerName.includes('essential reading')) {
        metadata.documentType = 'list_essential_reading';
      }
    }

    // Map expert types
    if (metadata.section === 'experts') {
      if (lowerName.includes('cafcass')) {
        metadata.expertType = 'cafcass';
      } else if (lowerName.includes('social')) {
        metadata.expertType = 'social_services';
      } else if (lowerName.includes('police')) {
        metadata.expertType = 'police';
      } else if (lowerName.includes('counsell')) {
        metadata.expertType = 'counsellor';
      } else if (lowerName.includes('psychiatrist')) {
        metadata.expertType = 'psychiatrist';
      } else if (lowerName.includes('psychologist')) {
        metadata.expertType = 'psychologist';
      } else if (lowerName.includes('guardian')) {
        metadata.expertType = 'guardian';
      }
    }
    
    // Set reference/case number
    if (data.caseNumber) {
      metadata.reference = data.caseNumber;
      metadata.courtReference = data.caseNumber;
    }
    
    // Set date
    if (data.date) {
      metadata.date = this.formatDateForInput(data.date);
      metadata.reportDate = this.formatDateForInput(data.date);
    }

    // Extract person name from filename for statements and experts
    if (metadata.section === 'statements' || metadata.section === 'experts') {
      const personName = this.extractPersonName(filename);
      if (personName) {
        if (metadata.section === 'statements') {
          metadata.personName = personName;
        } else {
          metadata.expertName = personName;
        }
      }
    }
    
    return metadata;
  }

  /**
   * Format date as YYYY-MM-DD for form inputs
   */
  private formatDateForInput(date: Date | null): string {
    if (!date) return '';
    return date.toISOString().split('T')[0];
  }

  /**
   * Extract person name from filename (basic implementation)
   */
  private extractPersonName(filename: string): string | null {
    // Remove common words and file extension
    const cleaned = filename
      .replace(/\.[^.]+$/, '')
      .replace(/statement|expert|report|cafcass|social|services/gi, '')
      .replace(/[_-]/g, ' ')
      .trim();

    // Look for name patterns (basic approach)
    const nameMatch = cleaned.match(/([A-Z][a-z]+\s+[A-Z][a-z]+)/);
    return nameMatch ? nameMatch[1] : null;
  }
}