import { FilenameData } from './types';

export class FilenameParser {
  private patterns = {
    // Case number patterns in filename
    caseNumber: [
      /([A-Z]{2}\d{2}[A-Z]\d{5})/i,  // e.g., AB12C34567
      /([A-Z]{2}\d{2}[A-Z]{1,2}\d{4,5})/i,  // variations
      /case[_\s-]?([A-Z0-9]+)/i
    ],
    
    // Form type patterns
    formType: [
      /(C\d{1,3}[A-Z]?)/,  // C100, C1A, C78, etc.
      /(FL\d{3})/,  // FL401
      /(Form[_\s-]?[A-Z0-9]+)/i
    ],
    
    // Date patterns in filename
    date: [
      /(\d{1,2}[._-]\d{1,2}[._-]\d{2,4})/,  // 22.3.22, 22-3-22, 22_3_22
      /(\d{4}[._-]\d{1,2}[._-]\d{1,2})/,  // 2022-03-22
      /(\d{1,2}[._-](?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[._-]\d{2,4})/i
    ],
    
    // Document type indicators
    orderIndicators: ['order', 'judgment', 'decree', 'ruling'],
    applicationIndicators: ['application', 'app', 'form', 'C100', 'C1A', 'C78', 'FL401']
  };

  /**
   * Extract information from filename
   */
  parse(filename: string): FilenameData {
    const data: FilenameData = {};
    
    // Remove file extension
    const nameWithoutExt = filename.replace(/\.[^.]+$/, '');
    
    // Extract case number
    for (const pattern of this.patterns.caseNumber) {
      const match = nameWithoutExt.match(pattern);
      if (match) {
        data.caseNumber = match[1].toUpperCase();
        break;
      }
    }
    
    // Extract form type
    for (const pattern of this.patterns.formType) {
      const match = nameWithoutExt.match(pattern);
      if (match) {
        data.formType = match[1].toUpperCase();
        break;
      }
    }
    
    // Determine document type from filename
    const lowerName = nameWithoutExt.toLowerCase();
    
    // Check for order indicators
    if (this.patterns.orderIndicators.some(indicator => lowerName.includes(indicator))) {
      data.documentType = 'order';
    }
    // Check for application indicators
    else if (this.patterns.applicationIndicators.some(indicator => lowerName.includes(indicator))) {
      data.documentType = 'application';
      
      // Try to extract application type from form number
      if (data.formType) {
        data.applicationType = this.getApplicationTypeFromForm(data.formType);
      }
    }
    
    // Extract date from filename
    for (const pattern of this.patterns.date) {
      const match = nameWithoutExt.match(pattern);
      if (match) {
        data.date = this.parseDateFromFilename(match[1]);
        break;
      }
    }
    
    return data;
  }

  /**
   * Map form types to application types
   */
  private getApplicationTypeFromForm(formType: string): string | null {
    const formMap: { [key: string]: string } = {
      'C100': 'c100',
      'C1A': 'c1',
      'C78': 'c1',
      'C79': 'c1',
      'FL401': 'fl401',
      'FL402': 'fl402',
      'FL403': 'fl401'
    };
    
    return formMap[formType] || null;
  }

  /**
   * Parse date from filename format
   */
  private parseDateFromFilename(dateStr: string): Date | null {
    // Replace separators with standard format
    const normalized = dateStr.replace(/[._-]/g, '/');
    
    // Try different date formats
    if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(normalized)) {
      // DD/MM/YY or DD/MM/YYYY
      const parts = normalized.split('/');
      const day = parseInt(parts[0]);
      const month = parseInt(parts[1]) - 1;
      let year = parseInt(parts[2]);
      
      // Handle 2-digit years
      if (year < 100) {
        year += 2000;
      }
      
      return new Date(year, month, day);
    } else if (/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(normalized)) {
      // YYYY/MM/DD (ISO format)
      const parts = normalized.split('/');
      return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    }
    
    return null;
  }
}