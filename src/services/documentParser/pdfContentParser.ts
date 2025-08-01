import { CourtDocumentData } from './types';

// Type declaration for Electron API
declare global {
  interface Window {
    electronAPI?: {
      parsePDF: (pdfBuffer: ArrayBuffer) => Promise<{
        success: boolean;
        text?: string;
        pages?: number;
        error?: string;
      }>;
    };
  }
}

export class PDFContentParser {
  private patterns = {
    // Case/Court reference patterns - most important!
    caseNumber: [
      // Exact "Case Number" labels
      /Case\s+Number[:\s]+([A-Z0-9]+)/i,
      /Case\s+no[:\s\.]+([A-Z0-9]+)/i,
      /Case\s+#[:\s]+([A-Z0-9]+)/i,
      
      // UK Family Court case number patterns
      /([A-Z]{2}\d{2}[A-Z]\d{5})/g,  // e.g., AB12C34567
      /([A-Z]{2}\d{2}[A-Z]{1,2}\d{4,5})/g,  // variations
      /([A-Z]{1,3}\d{2,4}[A-Z]?\d{3,6})/g,  // broader pattern
      
      // Common court reference formats
      /Court\s+Reference[:\s]+([A-Z0-9]+)/i,
      /Reference[:\s]+([A-Z0-9]+)/i,
      /Ref[:\s]+([A-Z0-9]+)/i,
      
      // Form-specific references
      /FL401.*?([A-Z]{2}\d{2}[A-Z]\d{5})/i,
      /C100.*?([A-Z]{2}\d{2}[A-Z]\d{5})/i
    ],
    
    // Court name patterns
    courtName: [
      /(?:In\s+the\s+)?Family\s+Court\s+at\s+([A-Z\s]+)/i,
      /The\s+Family\s+Court\s+at\s+([^,\n]+)/i,
      /sitting\s+at\s+([A-Z\s]+\s+COURT)/i,
      /Family\s+Court\s+sitting\s+at\s+([^,\n]+)/i
    ],
    
    // Judge name patterns
    judgeName: [
      /Ordered\s+by\s+(.+?)\s+on\s+\d+/i,
      /ORDER\s+MADE\s+BY\s+(.+?)\s+SITTING/i,
      /Before\s+(.+?)\s+sitting/i,
      /(?:District\s+)?Judge\s+([A-Z][a-z]+)/i,
      /Recorder\s+([A-Z][a-z]+)/i,
      /Deputy\s+District\s+Judge\s+([A-Z][a-z]+)/i,
      /(?:Her\s+Honour\s+)?Judge\s+([A-Z][a-z]+)/i
    ],
    
    // Date patterns
    orderDate: [
      /Ordered\s+by\s+.+?\s+on\s+(\d{1,2}(?:st|nd|rd|th)?\s+[A-Z][a-z]+\s+\d{4})/i,
      /on\s+(\d{1,2}(?:st|nd|rd|th)?\s+[A-Z][a-z]+\s+\d{4})$/i,
      /dated?\s+(\d{1,2}[/.]\d{1,2}[/.]\d{2,4})/i,
      /(\d{1,2}(?:st|nd|rd|th)?\s+[A-Z][a-z]+\s+\d{4})/i
    ],
    
    // Party names
    applicant: [
      /The\s+applicant\s+(?:mother\s+)?is\s+([^,\n]+)/i,
      /Applicant[:\s]+([^\n]+)/i,
      /About\s+you\s+\(the\s+applicant\)[^}]+?State\s+your\s+.+?:\s*([^\n]+)/is,
      /Applicant.*?Name[:\s]+([^\n]+)/i
    ],
    
    respondent: [
      /The\s+(?:first\s+)?respondent\s+(?:father\s+)?is\s+([^,\n]+)/i,
      /Respondent[:\s]+([^\n]+)/i,
      /About\s+the\s+respondent[^}]+?State\s+the\s+respondent['']s\s+name[^:]*:\s*([^\n]+)/is,
      /Respondent.*?Name[:\s]+([^\n]+)/i
    ],
    
    // Document type identifiers - focus on key patterns
    documentType: [
      // Order patterns
      { pattern: /C21\s+Blank\s+Order/i, type: 'order' },
      { pattern: /General\s+Form\s+of\s+Order/i, type: 'order' },
      { pattern: /ORDER\s+MADE\s+BY/i, type: 'order' },
      { pattern: /Ordered\s+by/i, type: 'order' },
      { pattern: /THE\s+COURT\s+ORDERS/i, type: 'order' },
      { pattern: /INTERIM\s+ORDER/i, type: 'order' },
      { pattern: /FINAL\s+ORDER/i, type: 'order' },
      
      // Application patterns
      { pattern: /Application\s+for/i, type: 'application' },
      { pattern: /FL401\s+Application/i, type: 'application' },
      { pattern: /C100.*Application/i, type: 'application' },
      { pattern: /C78.*Application/i, type: 'application' },
      { pattern: /C1A.*Allegations/i, type: 'application' },
      { pattern: /Form\s+C100/i, type: 'application' },
      { pattern: /Form\s+FL401/i, type: 'application' }
    ]
  };

  /**
   * Extract text from PDF buffer and parse document info
   */
  async extractFromPDF(pdfBuffer: ArrayBuffer): Promise<{ caseNumber: string | null; documentType: 'order' | 'application' | null; judgeName: string | null }> {
    try {
      // Check if we're in Electron environment
      if (window.electronAPI && window.electronAPI.parsePDF) {
        console.log('Using Electron PDF parser...');
        const result = await window.electronAPI.parsePDF(pdfBuffer);
        
        if (result.success && result.text) {
          console.log('Electron PDF parsing successful, text length:', result.text.length);
          return this.extractFromText(result.text);
        } else {
          console.error('Electron PDF parsing failed:', result.error);
          return { caseNumber: null, documentType: null, judgeName: null };
        }
      } else {
        // Fallback to browser-based parsing (limited functionality)
        console.log('Electron API not available, falling back to limited parsing');
        return { caseNumber: null, documentType: null, judgeName: null };
      }
    } catch (error) {
      console.error('PDF parsing failed:', error);
      return { caseNumber: null, documentType: null, judgeName: null };
    }
  }

  /**
   * Extract ONLY the most important information from PDF text content
   * Focus: Court Reference Number, Document Type, and Judge Name
   */
  extractFromText(pdfText: string): { caseNumber: string | null; documentType: 'order' | 'application' | null; judgeName: string | null } {
    console.log('Extracting key info from PDF text, length:', pdfText.length);
    
    // 1. Extract court reference number (MOST IMPORTANT)
    const caseNumber = this.extractCaseNumber(pdfText);
    console.log('Extracted case number:', caseNumber);

    // 2. Determine document type (SECOND MOST IMPORTANT)
    const documentType = this.identifyDocumentType(pdfText);
    console.log('Identified document type:', documentType);

    // 3. Extract judge name (THIRD MOST IMPORTANT)
    const judgeName = this.extractJudgeName(pdfText);
    console.log('Extracted judge name:', judgeName);

    return {
      caseNumber,
      documentType,
      judgeName
    };
  }

  /**
   * Extract case number with improved patterns using multi-pattern approach
   */
  private extractCaseNumber(text: string): string | null {
    // Try each pattern in order of specificity
    for (const pattern of this.patterns.caseNumber) {
      const match = text.match(pattern);
      if (match && match[1]) {
        const caseNum = match[1].trim().toUpperCase();
        // Validate it looks like a UK court reference
        if (this.isValidCaseNumber(caseNum)) {
          return caseNum;
        }
      }
    }
    return null;
  }

  /**
   * Extract pattern from text using multiple regex patterns (from DOC_PARSER.md)
   */
  private extractPattern(text: string, patterns: RegExp[]): string | null {
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }
    return null;
  }

  /**
   * Validate case number format
   */
  private isValidCaseNumber(caseNum: string): boolean {
    // UK Family Court patterns
    const validPatterns = [
      /^[A-Z]{2}\d{2}[A-Z]\d{5}$/,  // AB12C34567
      /^[A-Z]{2}\d{2}[A-Z]{1,2}\d{4,5}$/,  // variations
      /^[A-Z]{1,3}\d{2,4}[A-Z]?\d{3,6}$/  // broader
    ];
    
    return validPatterns.some(pattern => pattern.test(caseNum)) && caseNum.length >= 6;
  }

  /**
   * Extract judge name with UK court abbreviations
   */
  private extractJudgeName(text: string): string | null {
    const judgePatterns = [
      // Standard patterns
      /Ordered\s+by\s+(.+?)\s+on\s+\d+/i,
      /ORDER\s+MADE\s+BY\s+(.+?)\s+SITTING/i,
      /Before\s+(.+?)\s+sitting/i,
      
      // UK Judge titles with abbreviations
      /(?:Her\s+Honour\s+Judge|HHJ)\s+([A-Z][a-z]+)/i,
      /(?:His\s+Honour\s+Judge|HHJ)\s+([A-Z][a-z]+)/i,
      /(?:District\s+Judge|DJ)\s+([A-Z][a-z]+)/i,
      /(?:Deputy\s+District\s+Judge|DDJ)\s+([A-Z][a-z]+)/i,
      /Recorder\s+([A-Z][a-z]+)/i,
      /Circuit\s+Judge\s+([A-Z][a-z]+)/i,
      
      // Simpler patterns
      /Judge\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i
    ];

    for (const pattern of judgePatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        return this.cleanJudgeName(match[1].trim());
      }
    }
    return null;
  }

  /**
   * Clean judge name and add UK abbreviations
   */
  private cleanJudgeName(name: string): string {
    // Remove full titles and replace with abbreviations
    let cleaned = name
      .replace(/^Her\s+Honour\s+Judge\s+/i, 'HHJ ')
      .replace(/^His\s+Honour\s+Judge\s+/i, 'HHJ ')
      .replace(/^District\s+Judge(?:\s+\(Magistrates['']\s+Court\))?\s+/i, 'DJ ')
      .replace(/^Deputy\s+District\s+Judge\s+/i, 'DDJ ')
      .replace(/^Recorder\s+/i, 'Recorder ')
      .replace(/^Circuit\s+Judge\s+/i, 'CJ ')
      .trim();

    // If no title found, check if it starts with a title and add appropriate abbreviation
    if (!cleaned.match(/^(HHJ|DJ|DDJ|Recorder|CJ)/)) {
      // Default to DJ if no title specified
      cleaned = 'DJ ' + cleaned;
    }

    return cleaned;
  }

  /**
   * Enhanced date parsing from DOC_PARSER.md
   */
  private parseDate(dateStr: string): Date | null {
    if (!dateStr) return null;

    // Clean the date string
    dateStr = dateStr.trim();

    // Try different date formats
    const formats = [
      // "22nd March 2022", "1st January 2023"
      /(\d{1,2})(?:st|nd|rd|th)?\s+([A-Z][a-z]+)\s+(\d{4})/i,
      // "22 March 2022"
      /(\d{1,2})\s+([A-Z][a-z]+)\s+(\d{4})/i,
      // "22/03/2022" or "22.03.2022"
      /(\d{1,2})[/.](\d{1,2})[/.](\d{4})/,
      // "06 Jan 2016"
      /(\d{1,2})\s+([A-Z][a-z]{2,3})\s+(\d{4})/i,
      // "2022/03/23"
      /(\d{4})[/.](\d{1,2})[/.](\d{1,2})/
    ];

    for (const format of formats) {
      const match = dateStr.match(format);
      if (match) {
        try {
          if (match.length === 4) {
            // Day Month Year format
            const day = parseInt(match[1]);
            const monthStr = match[2];
            const year = parseInt(match[3]);

            const monthMap: { [key: string]: number } = {
              'january': 0, 'jan': 0,
              'february': 1, 'feb': 1,
              'march': 2, 'mar': 2,
              'april': 3, 'apr': 3,
              'may': 4,
              'june': 5, 'jun': 5,
              'july': 6, 'jul': 6,
              'august': 7, 'aug': 7,
              'september': 8, 'sep': 8, 'sept': 8,
              'october': 9, 'oct': 9,
              'november': 10, 'nov': 10,
              'december': 11, 'dec': 11
            };

            const month = monthMap[monthStr.toLowerCase()];
            if (month !== undefined) {
              return new Date(year, month, day);
            }
          } else if (dateStr.includes('/') || dateStr.includes('.')) {
            // Numeric date format
            if (match[3].length === 4) {
              // DD/MM/YYYY
              return new Date(parseInt(match[3]), parseInt(match[2]) - 1, parseInt(match[1]));
            } else {
              // YYYY/MM/DD
              return new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
            }
          }
        } catch (e) {
          // Continue to next format
        }
      }
    }

    return null;
  }

  /**
   * Identify if document is an order or application
   */
  private identifyDocumentType(text: string): 'order' | 'application' | null {
    // Check each pattern with its type
    for (const item of this.patterns.documentType) {
      if (item.pattern.test(text)) {
        return item.type as 'order' | 'application';
      }
    }

    return null;
  }

}