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
      generateDescription: (text: string, filename?: string) => Promise<{
        success: boolean;
        description?: string;
        fallback?: boolean;
        error?: string;
      }>;
      summarizeDocument: (text: string) => Promise<{
        success: boolean;
        summary?: string;
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
      
      // UK Family Court case number patterns - ENHANCED FOR STATEMENTS
      /([A-Z]{2}\d{2}[A-Z]\d{5})/g,  // Exact pattern: e.g., AB12C34567
      /([A-Z]{2}\d{2}[A-Z]{1,2}\d{4,5})/g,  // variations
      /([A-Z]{1,3}\d{2,4}[A-Z]?\d{3,6})/g,  // broader pattern
      
      // Statement-specific patterns (look for family court refs anywhere in text)
      /(?:case|matter|ref|reference|proceeding)[s]?[:\s]*([A-Z]{2}\d{2}[A-Z]\d{5})/i,
      /In\s+the\s+matter\s+of[^:]*:\s*([A-Z]{2}\d{2}[A-Z]\d{5})/i,
      /Between.*?([A-Z]{2}\d{2}[A-Z]\d{5})/i,
      
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
    
    // Party names - ENHANCED FOR STATEMENTS
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
    
    // Statement-specific person name patterns (look in first part of document)
    statementPersonName: [
      // "I, [Title] [Initial/Name] [Surname], of [address] make oath and say:" - BEST PATTERN
      /I,\s+((?:Mr|Mrs|Ms|Miss|Dr)\s+[A-Z]\.?\s+[A-Z][a-z]+|(?:Mr|Mrs|Ms|Miss|Dr)\s+[A-Z][a-z]+\s+[A-Z][a-z]+),?\s+of\s+/i,
      // "I, [First] [Last], of" - without title
      /I,\s+([A-Z][a-z]+\s+[A-Z][a-z]+),?\s+of\s+/i,
      // "I, [Name], will say" or "I, [Name], make oath"
      /I,\s+((?:Mr|Mrs|Ms|Miss|Dr)\s+[A-Z]\.?\s+[A-Z][a-z]+|(?:Mr|Mrs|Ms|Miss|Dr)\s+[A-Z][a-z]+\s+[A-Z][a-z]+|[A-Z][a-z]+\s+[A-Z][a-z]+),?\s+(?:will\s+say|make\s+oath)/i,
      
      // "Statement of Respondent: [Title] [Name]" or "Statement of Applicant: [Title] [Name]"
      /Statement\s+of\s+(?:Respondent|Applicant):\s+((?:Mr|Mrs|Ms|Miss|Dr)\s+[A-Z]\.?\s+[A-Z][a-z]+|(?:Mr|Mrs|Ms|Miss|Dr)\s+[A-Z][a-z]+\s+[A-Z][a-z]+)/i,
      // "Statement of [Title] [Name]" - direct format
      /Statement\s+of\s+((?:Mr|Mrs|Ms|Miss|Dr)\s+[A-Z]\.?\s+[A-Z][a-z]+|(?:Mr|Mrs|Ms|Miss|Dr)\s+[A-Z][a-z]+\s+[A-Z][a-z]+)/i,
      // "Witness Statement of [Title] [Name]"
      /Witness\s+Statement\s+of\s+((?:Mr|Mrs|Ms|Miss|Dr)\s+[A-Z]\.?\s+[A-Z][a-z]+|(?:Mr|Mrs|Ms|Miss|Dr)\s+[A-Z][a-z]+\s+[A-Z][a-z]+)/i,
      
      // Handle ALL CAPS names (scanned documents)
      // "STATEMENT OF MR A SMITH" or "STATEMENT OF MR ADAM SMITH"
      /STATEMENT\s+OF\s+(MR|MRS|MS|MISS|DR)\s+([A-Z]\.?\s+[A-Z]+|[A-Z]+\s+[A-Z]+)/i,
      // "I, MR ADAM SMITH, OF"
      /I,\s+(MR|MRS|MS|MISS|DR)\s+([A-Z]\.?\s+[A-Z]+|[A-Z]+\s+[A-Z]+),?\s+OF\s+/i,
      
      // Fallback patterns
      // "I [Name] of [address] swear/affirm:"
      /I\s+((?:Mr|Mrs|Ms|Miss|Dr)\s+[A-Z][a-z]+\s+[A-Z][a-z]+)\s+of\s+.*?(?:swear|affirm|make\s+oath)/i,
      // "[Name] - Witness Statement" or "[Name] - Statement"
      /^((?:Mr|Mrs|Ms|Miss|Dr)\s+[A-Z][a-z]+\s+[A-Z][a-z]+)\s*[-–]\s*(?:Witness\s+)?Statement/mi,
      // Look for "My name is [Title] [Name]"
      /My\s+name\s+is\s+((?:Mr|Mrs|Ms|Miss|Dr)\s+[A-Z][a-z]+\s+[A-Z][a-z]+)/i,
      // Look for names after "I am"
      /I\s+am\s+((?:Mr|Mrs|Ms|Miss|Dr)\s+[A-Z][a-z]+\s+[A-Z][a-z]+)/i,
      
      // Signature patterns at end of document - check last 500 chars
    ],
    
    // Signature patterns specifically for end of statements
    signaturePatterns: [
      // "Signed: [Title] [Name]" or "Signature: [Title] [Name]"
      /(?:Signed|Signature):\s*((?:Mr|Mrs|Ms|Miss|Dr)\s+[A-Z]\.?\s+[A-Z][a-z]+|(?:Mr|Mrs|Ms|Miss|Dr)\s+[A-Z][a-z]+\s+[A-Z][a-z]+)/i,
      // "[Title] [Name]" on its own line near end (after "Signed" or similar context)
      /(?:Signed|Signature|Print\s+name).*?\n\s*((?:Mr|Mrs|Ms|Miss|Dr)\s+[A-Z]\.?\s+[A-Z][a-z]+|(?:Mr|Mrs|Ms|Miss|Dr)\s+[A-Z][a-z]+\s+[A-Z][a-z]+)/i,
      // "Name: [Title] [Name]" or "Print Name: [Title] [Name]"
      /(?:Print\s+)?Name:\s*((?:Mr|Mrs|Ms|Miss|Dr)\s+[A-Z]\.?\s+[A-Z][a-z]+|(?:Mr|Mrs|Ms|Miss|Dr)\s+[A-Z][a-z]+\s+[A-Z][a-z]+)/i,
      // Just a name on its own line near signatures
      /(?:Signed|Date).*?\n\s*((?:Mr|Mrs|Ms|Miss|Dr)\s+[A-Z][a-z]+\s+[A-Z][a-z]+)\s*\n/i,
      // ALL CAPS signature patterns
      /(?:SIGNED|SIGNATURE|NAME):\s*(MR|MRS|MS|MISS|DR)\s+([A-Z]\.?\s+[A-Z]+|[A-Z]+\s+[A-Z]+)/i,
    ],
    
    // Document type identifiers - focus on key patterns
    documentType: [
      // Statement patterns - CHECK FIRST (most specific)
      { pattern: /Witness\s+Statement/i, type: 'statement' },
      { pattern: /Statement\s+of\s+[A-Z]/i, type: 'statement' },
      { pattern: /I,\s+[A-Z][a-z]+.*?make\s+oath/i, type: 'statement' },
      { pattern: /I\s+[A-Z][a-z]+.*?(?:swear|affirm)/i, type: 'statement' },
      { pattern: /Position\s+Statement/i, type: 'statement' },
      { pattern: /Statement\s+in\s+support/i, type: 'statement' },
      { pattern: /Affidavit/i, type: 'statement' },
      
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
  async extractFromPDF(pdfBuffer: ArrayBuffer): Promise<{ caseNumber: string | null; documentType: 'order' | 'application' | 'statement' | null; judgeName: string | null; personName?: string | null }> {
    try {
      console.log('🔧 PDF extraction started, buffer size:', pdfBuffer.byteLength);
      console.log('🌐 Environment check - electronAPI available:', !!window.electronAPI);
      
      // Check if we're in Electron environment
      if (window.electronAPI && window.electronAPI.parsePDF) {
        console.log('✅ Using Electron PDF parser...');
        const result = await window.electronAPI.parsePDF(pdfBuffer);
        console.log('📄 Electron PDF result:', { success: result.success, textLength: result.text?.length, error: result.error });
        
        if (result.success && result.text) {
          console.log('🎉 Electron PDF parsing successful, extracting patterns...');
          console.log('📝 First 200 chars of PDF text:', result.text.substring(0, 200));
          const extracted = this.extractFromText(result.text);
          console.log('🔍 Final extraction result:', extracted);
          return extracted;
        } else {
          console.error('❌ Electron PDF parsing failed:', result.error);
          return { caseNumber: null, documentType: null, judgeName: null, personName: null };
        }
      } else {
        // Fallback to browser-based parsing (limited functionality)
        console.warn('⚠️ Electron API not available, falling back to limited parsing');
        console.log('🌍 Running in browser mode - PDF parsing disabled');
        return { caseNumber: null, documentType: null, judgeName: null, personName: null };
      }
    } catch (error) {
      console.error('💥 PDF parsing failed:', error);
      return { caseNumber: null, documentType: null, judgeName: null, personName: null };
    }
  }

  /**
   * Extract ONLY the most important information from PDF text content
   * Focus: Court Reference Number, Document Type, Judge Name, and Person Name (for statements)
   */
  extractFromText(pdfText: string): { caseNumber: string | null; documentType: 'order' | 'application' | 'statement' | null; judgeName: string | null; personName?: string | null } {
    console.log('🔍 Extracting key info from PDF text, length:', pdfText.length);
    console.log('📃 First 500 chars of PDF text:', pdfText.substring(0, 500));
    
    // 1. Extract court reference number (MOST IMPORTANT)
    const caseNumber = this.extractCaseNumber(pdfText);
    console.log('🏛️ Extracted case number:', caseNumber);

    // 2. Determine document type (SECOND MOST IMPORTANT)
    const documentType = this.identifyDocumentType(pdfText);
    console.log('📋 Identified document type:', documentType);

    // 3. Extract judge name (THIRD MOST IMPORTANT - for orders)
    const judgeName = this.extractJudgeName(pdfText);
    console.log('👨‍⚖️ Extracted judge name:', judgeName);

    // 4. Extract person name (FOR STATEMENTS - look in first part of document)
    const personName = this.extractStatementPersonName(pdfText);
    console.log('👤 Extracted person name (statement):', personName);

    return {
      caseNumber,
      documentType,
      judgeName,
      personName
    };
  }

  /**
   * Extract case number with improved patterns using multi-pattern approach
   */
  private extractCaseNumber(text: string): string | null {
    console.log('🔎 Testing case number patterns...');
    // Try each pattern in order of specificity
    for (let i = 0; i < this.patterns.caseNumber.length; i++) {
      const pattern = this.patterns.caseNumber[i];
      console.log(`Pattern ${i + 1}:`, pattern.toString());
      const match = text.match(pattern);
      if (match) {
        console.log(`✅ Pattern ${i + 1} matched:`, match);
        if (match[1]) {
          const caseNum = match[1].trim().toUpperCase();
          console.log('🔍 Extracted case number candidate:', caseNum);
          // Validate it looks like a UK court reference
          if (this.isValidCaseNumber(caseNum)) {
            console.log('✅ Valid case number found:', caseNum);
            return caseNum;
          } else {
            console.log('❌ Invalid case number format:', caseNum);
          }
        }
      } else {
        console.log(`❌ Pattern ${i + 1} no match`);
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
   * Identify if document is an order, application, or statement
   */
  private identifyDocumentType(text: string): 'order' | 'application' | 'statement' | null {
    // Check each pattern with its type - statements checked first
    for (const item of this.patterns.documentType) {
      if (item.pattern.test(text)) {
        return item.type as 'order' | 'application' | 'statement';
      }
    }

    return null;
  }

  /**
   * Extract person name from statement documents - look in first 800 chars and last 500 chars (signature)
   */
  private extractStatementPersonName(text: string): string | null {
    console.log('👤 Looking for statement person name...');
    
    // Focus on first 800 characters where names typically appear in headers
    const firstPart = text.substring(0, 800);
    console.log('🔎 Searching in first 800 chars:', firstPart.substring(0, 200) + '...');
    
    // Try each pattern specifically designed for statement headers
    for (let i = 0; i < this.patterns.statementPersonName.length; i++) {
      const pattern = this.patterns.statementPersonName[i];
      console.log(`👤 Header Pattern ${i + 1}:`, pattern.toString());
      
      const match = firstPart.match(pattern);
      if (match && match[1]) {
        const name = match[1].trim();
        console.log(`✅ Header Pattern ${i + 1} matched:`, name);
        
        // Validate it looks like a real name
        if (this.isValidPersonName(name)) {
          const cleanedName = this.cleanPersonName(name);
          console.log('✅ Valid person name found in header, cleaned:', cleanedName);
          return cleanedName;
        } else {
          console.log('❌ Invalid person name format:', name);
        }
      } else {
        console.log(`❌ Header Pattern ${i + 1} no match`);
      }
    }
    
    // If no name found in header, check signature area at end
    console.log('🔎 No name in header, checking signature area...');
    const lastPart = text.substring(Math.max(0, text.length - 500));
    console.log('📝 Searching in last 500 chars:', lastPart.substring(0, 200) + '...');
    
    // Try signature patterns
    for (let i = 0; i < this.patterns.signaturePatterns.length; i++) {
      const pattern = this.patterns.signaturePatterns[i];
      console.log(`✍️ Signature Pattern ${i + 1}:`, pattern.toString());
      
      const match = lastPart.match(pattern);
      if (match) {
        // For signature patterns, name might be in match[1] or match[2] depending on pattern
        const name = (match[1] || match[2] || '').trim();
        if (name) {
          console.log(`✅ Signature Pattern ${i + 1} matched:`, name);
          
          if (this.isValidPersonName(name)) {
            const cleanedName = this.cleanPersonName(name);
            console.log('✅ Valid person name found in signature, cleaned:', cleanedName);
            return cleanedName;
          } else {
            console.log('❌ Invalid signature name format:', name);
          }
        }
      } else {
        console.log(`❌ Signature Pattern ${i + 1} no match`);
      }
    }
    
    console.log('❌ No person name found in statement or signature');
    return null;
  }

  /**
   * Validate that extracted text looks like a person name
   */
  private isValidPersonName(name: string): boolean {
    // Basic validation for person names
    if (!name || name.length < 2 || name.length > 50) {
      return false;
    }
    
    // Should contain at least one letter
    if (!/[A-Za-z]/.test(name)) {
      return false;
    }
    
    // Should not be all numbers
    if (/^\d+$/.test(name)) {
      return false;
    }
    
    // Should not contain too many special characters
    if ((name.match(/[^A-Za-z\s'-]/g) || []).length > 2) {
      return false;
    }
    
    // All caps names are OK if they're reasonable length (could be scanned documents)
    if (name === name.toUpperCase() && name.length > 30) {
      return false;
    }
    
    return true;
  }

  /**
   * Clean person name to format like "Mr First Surname" or "Mr Initial Surname"
   */
  private cleanPersonName(name: string): string {
    console.log('🧹 Cleaning person name:', name);
    
    let cleaned = name.trim();
    
    // Remove common prefixes that aren't titles
    cleaned = cleaned
      .replace(/^(?:Statement\s+of\s+)?(?:Respondent|Applicant)[:\s]*/, '') // Remove "Statement of Respondent:"
      .replace(/^(?:Witness\s+Statement\s+of\s+)/, '') // Remove "Witness Statement of"
      .replace(/^(?:Position\s+Statement\s+of\s+)/, '') // Remove "Position Statement of"
      .trim();
    
    // Handle formats like "I, John Smith, of" -> extract "John Smith"
    if (cleaned.startsWith('I,')) {
      const match = cleaned.match(/^I,\s+([^,]+),?/);
      if (match && match[1]) {
        cleaned = match[1].trim();
      }
    }
    
    // Split into parts to analyze
    const parts = cleaned.split(/\s+/).filter(part => part.length > 0);
    
    if (parts.length === 0) {
      return cleaned;
    }
    
    // Look for title + name patterns
    let title = '';
    let nameStart = 0;
    
    // Check if first part is a title (Mr, Mrs, Ms, Dr, etc.)
    const firstPart = parts[0].toLowerCase();
    if (['mr', 'mrs', 'ms', 'miss', 'dr', 'prof', 'professor'].includes(firstPart)) {
      title = parts[0];
      nameStart = 1;
    } else if (parts.length >= 2) {
      // Look for title in second position (e.g., "John Mr Smith" -> "Mr John Smith")
      const secondPart = parts[1].toLowerCase();
      if (['mr', 'mrs', 'ms', 'miss', 'dr'].includes(secondPart)) {
        title = parts[1];
        // Rearrange: first part is name, title goes first
        const rearranged = [title, parts[0], ...parts.slice(2)];
        parts.splice(0, parts.length, ...rearranged);
        nameStart = 1;
      }
    }
    
    // If no title found, assume "Mr" for male-sounding names or default
    if (!title && nameStart === 0) {
      // Simple heuristic: common male names get "Mr", others get "Mr" as default
      // This is a reasonable default for family court statements
      title = 'Mr';
    }
    
    // Extract name parts (skip title)
    const nameParts = parts.slice(nameStart);
    
    if (nameParts.length === 0) {
      return cleaned; // Fallback to original
    }
    
    // Format: "Title FirstName LastName" or "Title Initial LastName"
    let result = title;
    
    if (nameParts.length === 1) {
      // Single name: "Mr John" or "Mr Smith"
      result += ' ' + nameParts[0];
    } else if (nameParts.length === 2) {
      // Two parts: "Mr John Smith" or "Mr J Smith"
      result += ' ' + nameParts[0] + ' ' + nameParts[1];
    } else {
      // Multiple parts: take first and last, maybe middle initial
      const firstName = nameParts[0];
      const lastName = nameParts[nameParts.length - 1];
      
      // Check if there's a middle initial (single letter or letter+period)
      let middleInitial = '';
      if (nameParts.length > 2) {
        const middlePart = nameParts[1];
        if (middlePart.length === 1 || (middlePart.length === 2 && middlePart.endsWith('.'))) {
          middleInitial = ' ' + middlePart;
        }
      }
      
      result += ' ' + firstName + middleInitial + ' ' + lastName;
    }
    
    console.log('✨ Cleaned name result:', result);
    return result;
  }

}