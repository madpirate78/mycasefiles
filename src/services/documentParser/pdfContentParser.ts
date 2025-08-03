import { CourtDocumentData } from './types';


export class PDFContentParser {
  private patterns = {
    // Case/Court reference patterns - most important!
    caseNumber: [
      // Exact "Case Number" labels
      /Case\s+Number[:\s]+([A-Z0-9]+)/i,
      /Case\s+no[:\s.]+([A-Z0-9]+)/i,
      /Case\s+#[:\s]+([A-Z0-9]+)/i,
      
      // UK Family Court case number patterns - ENHANCED FOR STATEMENTS (FIXED: removed /g flag)
      /([A-Z]{2}\d{2}[A-Z]\d{5})/,  // Exact pattern: e.g., AB12C34567
      /([A-Z]{2}\d{2}[A-Z]{1,2}\d{4,5})/,  // variations
      /([A-Z]{1,3}\d{2,4}[A-Z]?\d{3,6})/,  // broader pattern
      
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
      /About\s+you\s+\(the\s+applicant\)[\s\S]+?State\s+your\s+[\s\S]+?:\s*([^\n]+)/i,
      /Applicant.*?Name[:\s]+([^\n]+)/i
    ],
    
    respondent: [
      /The\s+(?:first\s+)?respondent\s+(?:father\s+)?is\s+([^,\n]+)/i,
      /Respondent[:\s]+([^\n]+)/i,
      /About\s+the\s+respondent[\s\S]+?State\s+the\s+respondent['']s\s+name[^:]*:\s*([^\n]+)/i,
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
    
    // Document type identifiers - Order patterns first (most specific)
    documentType: [
      // Order patterns - CHECK FIRST (highest priority)
      { pattern: /C21\s+Blank\s+Order/i, type: 'order' },
      { pattern: /General\s+Form\s+of\s+Order/i, type: 'order' },
      { pattern: /ORDER\s+MADE\s+BY/i, type: 'order' },
      { pattern: /Ordered\s+by/i, type: 'order' },
      { pattern: /THE\s+COURT\s+ORDERS/i, type: 'order' },
      { pattern: /INTERIM\s+ORDER/i, type: 'order' },
      { pattern: /FINAL\s+ORDER/i, type: 'order' },
      { pattern: /Court\s+Order/i, type: 'order' },
      { pattern: /IT\s+IS\s+ORDERED/i, type: 'order' },
      
      // Application patterns
      { pattern: /Application\s+for/i, type: 'application' },
      { pattern: /FL401\s+Application/i, type: 'application' },
      { pattern: /C100.*Application/i, type: 'application' },
      { pattern: /C78.*Application/i, type: 'application' },
      { pattern: /C1A.*Allegations/i, type: 'application' },
      
      // Statement patterns - CHECK LAST (more specific patterns)
      { pattern: /Witness\s+Statement/i, type: 'statement' },
      { pattern: /Statement\s+of\s+(?:Mr|Mrs|Ms|Miss|Dr)\s+[A-Z]/i, type: 'statement' }, // More specific
      { pattern: /I,\s+[A-Z][a-z]+.*?make\s+oath/i, type: 'statement' },
      { pattern: /I\s+[A-Z][a-z]+.*?(?:swear|affirm)/i, type: 'statement' },
      { pattern: /Position\s+Statement/i, type: 'statement' },
      { pattern: /Statement\s+in\s+support/i, type: 'statement' },
      { pattern: /Affidavit/i, type: 'statement' },
      { pattern: /Form\s+C100/i, type: 'application' },
      { pattern: /Form\s+FL401/i, type: 'application' }
    ]
  };

  /**
   * Extract text from PDF buffer and parse document info
   */
  async extractFromPDF(pdfBuffer: ArrayBuffer): Promise<CourtDocumentData> {
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
  extractFromText(pdfText: string): CourtDocumentData {
    console.log('📄 Parsing document text (', pdfText.length, 'chars)');
    
    // 1. Extract court reference number (MOST IMPORTANT)
    const caseNumber = this.extractCaseNumber(pdfText);

    // 2. Determine document type (SECOND MOST IMPORTANT)
    const documentType = this.identifyDocumentType(pdfText);

    // 3. Extract judge name (THIRD MOST IMPORTANT - for orders)
    const judgeName = this.extractJudgeName(pdfText);

    // 4. Extract person name (FOR STATEMENTS - look in first part of document)
    const personName = this.extractStatementPersonName(pdfText);

    console.log('📊 Extracted:', { caseNumber, documentType, judgeName, personName });

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
    // Try each pattern in order of specificity
    for (let i = 0; i < this.patterns.caseNumber.length; i++) {
      const pattern = this.patterns.caseNumber[i];
      const match = text.match(pattern);
      if (match && match[1]) {
        const caseNum = match[1].trim().toUpperCase();
        // Validate it looks like a UK court reference
        if (this.isValidCaseNumber(caseNum)) {
          console.log('✅ Case number extracted:', caseNum);
          return caseNum;
        }
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
   * Extract judge name with UK court abbreviations - scan first page, last page, then entire document
   */
  private extractJudgeName(text: string): string | null {
    // Scan first page (first 1500 chars) where judge names typically appear
    const firstPageText = text.substring(0, 1500);
    // Also scan last page (last 800 chars) for signature blocks
    const lastPageText = text.substring(Math.max(0, text.length - 800));
    
    const judgePatterns = [
      // Standard patterns
      /Ordered\s+by\s+(.+?)\s+on\s+\d+/i,
      /ORDER\s+MADE\s+BY\s+(.+?)\s+SITTING/i,
      /Before\s+(.+?)\s+sitting/i,
      
      // UK Judge titles with abbreviations
      /(?:Her\s+Honour\s+Judge|HHJ)\s+([A-Z][a-z]+)/i,
      /(?:His\s+Honour\s+Judge|HHJ)\s+([A-Z][a-z]+)/i,
      /(?:District\s+Judge|DJ)\s+([A-Z][a-z]+)/i,
      /District\s+Judge\s+\(Magistrates['']\s+Court\)\s+([A-Z][a-z]+)/i,
      /(?:Deputy\s+District\s+Judge|DDJ)\s+([A-Z][a-z]+)/i,
      /Recorder\s+([A-Z][a-z]+)/i,
      /Circuit\s+Judge\s+([A-Z][a-z]+)/i,
      
      // Simpler patterns
      /Judge\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i,
      
      // End-of-document signature patterns
      /Signed:\s*(.+?Judge.+)/i,
      /Signature:\s*(.+?Judge.+)/i,
      /((?:HHJ|DJ|DDJ|Recorder|Circuit\s+Judge)\s+[A-Z][a-z]+)/i
    ];

    // First try the first page (most common location)
    for (const pattern of judgePatterns) {
      const match = firstPageText.match(pattern);
      if (match && match[1]) {
        const judgeName = this.cleanJudgeName(match[1].trim());
        console.log('👨‍⚖️ Judge found in first page:', judgeName);
        return judgeName;
      }
    }
    
    // Then try the last page (signature blocks)
    for (const pattern of judgePatterns) {
      const match = lastPageText.match(pattern);
      if (match && match[1]) {
        const judgeName = this.cleanJudgeName(match[1].trim());
        console.log('👨‍⚖️ Judge found in last page:', judgeName);
        return judgeName;
      }
    }
    
    // Finally, scan the entire document (fallback for judges mentioned anywhere)
    console.log('🔍 Scanning entire document for judge name...');
    for (const pattern of judgePatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        const judgeName = this.cleanJudgeName(match[1].trim());
        console.log('👨‍⚖️ Judge found in full document:', judgeName);
        return judgeName;
      }
    }
    
    return null;
  }

  /**
   * Clean judge name and add UK abbreviations
   */
  private cleanJudgeName(name: string): string {
    console.log('🧹 Cleaning judge name:', name);
    
    // Remove full titles and replace with abbreviations
    let cleaned = name
      .replace(/^Her\s+Honour\s+Judge\s+/i, 'HHJ ')
      .replace(/^His\s+Honour\s+Judge\s+/i, 'HHJ ')
      .replace(/^District\s+Judge\s+\(Magistrates['']\s+Court\)\s+/i, 'DJ (MC) ')
      .replace(/^District\s+Judge(?:\s+\(Magistrates['']\s+Court\))?\s+/i, 'DJ ')
      .replace(/^Deputy\s+District\s+Judge\s+/i, 'DDJ ')
      .replace(/^Recorder\s+/i, 'Recorder ')
      .replace(/^Circuit\s+Judge\s+/i, 'CJ ')
      .trim();

    console.log('🧹 After title replacement:', cleaned);

    // If no title found, check if it starts with a title and add appropriate abbreviation
    if (!cleaned.match(/^(HHJ|DJ|DDJ|Recorder|CJ)/)) {
      console.log('🧹 No title found, defaulting to DJ');
      // Default to DJ if no title specified
      cleaned = 'DJ ' + cleaned;
    }
    
    // Handle the magistrate's court pattern specifically
    if (cleaned.match(/^DJ\s+\(MC\)/)) {
      // Already formatted correctly
      console.log('🧹 Magistrate court pattern detected');
      return cleaned;
    }

    console.log('🧹 Final cleaned judge name:', cleaned);
    return cleaned;
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
    // Focus on first 800 characters where names typically appear in headers
    const firstPart = text.substring(0, 800);
    
    // Try each pattern specifically designed for statement headers
    for (let i = 0; i < this.patterns.statementPersonName.length; i++) {
      const pattern = this.patterns.statementPersonName[i];
      const match = firstPart.match(pattern);
      if (match && match[1]) {
        const name = match[1].trim();
        
        // Validate it looks like a real name
        if (this.isValidPersonName(name)) {
          const cleanedName = this.cleanPersonName(name);
          console.log('🔍 Person name found:', cleanedName);
          return cleanedName;
        }
      }
    }
    
    // If no name found in header, check signature area at end
    const lastPart = text.substring(Math.max(0, text.length - 500));
    
    // Try signature patterns
    for (let i = 0; i < this.patterns.signaturePatterns.length; i++) {
      const pattern = this.patterns.signaturePatterns[i];
      const match = lastPart.match(pattern);
      if (match) {
        // For signature patterns, name might be in match[1] or match[2] depending on pattern
        const name = (match[1] || match[2] || '').trim();
        if (name && this.isValidPersonName(name)) {
          const cleanedName = this.cleanPersonName(name);
          console.log('🔍 Person name found in signature:', cleanedName);
          return cleanedName;
        }
      }
    }
    
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
    
    return result;
  }

}