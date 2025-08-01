# Court Document Parser - Approach

## Overview

Automated extraction of key information from UK family court PDFs using a filename-first parsing strategy.

## Two-Stage Extraction

### 1. Filename Parsing (Priority)

- **Case Numbers**: `AB12C34567` patterns
- **Document Type**: "Order" vs "Application" keywords
- **Form Codes**: C100, FL401 → application types
- **Dates**: Multiple formats (22.3.22, 2022-03-22)

### 2. PDF Content Parsing (Fallback)

- **Court Details**: Name, judge, dates
- **Parties**: Applicant/respondent names & relationships
- **Children**: Names, DOB, gender
- **Missing Data**: Fills gaps from filename parsing

## Key Benefits

- ✅ Filename data is more reliable/structured
- ✅ Faster initial classification
- ✅ Fallback ensures complete extraction
- ✅ Handles multiple date/case formats

## Usage

```typescript
const data = extractCourtDocumentInfo(pdfText, filename);
// Returns: case number, court, judge, dates, parties, etc.
```

sample algorithm:
// Types for extracted data
interface CourtDocumentData {
caseNumber: string | null;
courtName: string | null;
documentType: 'order' | 'application' | null;
applicationType?: string | null;
judgeName: string | null;
orderDate: Date | null;
applicationDate: Date | null;
applicant: {
name: string | null;
relationship?: string | null;
};
respondent: {
name: string | null;
relationship?: string | null;
};
children?: Array<{
name: string;
dateOfBirth: Date | null;
gender: string | null;
}>;
}

// Filename extraction result
interface FilenameData {
caseNumber?: string | null;
documentType?: 'order' | 'application' | null;
applicationType?: string | null;
date?: Date | null;
formType?: string | null;
}

// Main extraction algorithm
export class CourtDocumentExtractor {
private filenamePatterns = {
// Case number patterns in filename
caseNumber: [
/([A-Z]{2}\d{2}[A-Z]\d{5})/i, // e.g., AB12C34567
/([A-Z]{2}\d{2}[A-Z]{1,2}\d{4,5})/i, // variations
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

/\*\*

- Extract information from filename first
  \*/
  private extractFromFilename(filename: string): FilenameData {
  const data: FilenameData = {};


    // Remove file extension
    const nameWithoutExt = filename.replace(/\.[^.]+$/, '');

    // Extract case number
    for (const pattern of this.filenamePatterns.caseNumber) {
      const match = nameWithoutExt.match(pattern);
      if (match) {
        data.caseNumber = match[1].toUpperCase();
        break;
      }
    }

    // Extract form type
    for (const pattern of this.filenamePatterns.formType) {
      const match = nameWithoutExt.match(pattern);
      if (match) {
        data.formType = match[1].toUpperCase();
        break;
      }
    }

    // Determine document type from filename
    const lowerName = nameWithoutExt.toLowerCase();

    // Check for order indicators
    if (this.filenamePatterns.orderIndicators.some(indicator => lowerName.includes(indicator))) {
      data.documentType = 'order';
    }
    // Check for application indicators
    else if (this.filenamePatterns.applicationIndicators.some(indicator => lowerName.includes(indicator))) {
      data.documentType = 'application';

      // Try to extract application type from form number
      if (data.formType) {
        data.applicationType = this.getApplicationTypeFromForm(data.formType);
      }
    }

    // Extract date from filename
    for (const pattern of this.filenamePatterns.date) {
      const match = nameWithoutExt.match(pattern);
      if (match) {
        data.date = this.parseDateFromFilename(match[1]);
        break;
      }
    }

    return data;

}

/\*\*

- Map form types to application types
  \*/
  private getApplicationTypeFromForm(formType: string): string | null {
  const formMap: { [key: string]: string } = {
  'C100': 'Child Arrangements Order',
  'C1A': 'Allegations of Harm',
  'C78': 'Application for Order',
  'C79': 'Application to Enforce Order',
  'FL401': 'Non-Molestation/Occupation Order',
  'FL402': 'Application to Vary/Discharge Order',
  'FL403': 'Application for Arrest Warrant'
  };


    return formMap[formType] || null;

}

/\*\*

- Parse date from filename format
  \*/
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
      // YYYY/MM/DD
      const parts = normalized.split('/');
      return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    }

    return null;

}
private patterns = {
// Case number patterns
caseNumber: [
/Case\s+Number[:\s]+([A-Z0-9]+)/i,
/Case\s+no[:\s]+([A-Z0-9]+)/i,
/Case\s+#[:\s]+([A-Z0-9]+)/i
],

    // Court name patterns
    courtName: [
      /(?:In\s+the\s+)?Family\s+Court\s+at\s+([A-Z\s]+)/i,
      /The\s+Family\s+Court\s+at\s+([^,]+)/i,
      /sitting\s+at\s+([A-Z\s]+\s+COURT)/i
    ],

    // Judge name patterns
    judgeName: [
      /Ordered\s+by\s+(.+?)\s+on\s+\d+/i,
      /ORDER\s+MADE\s+BY\s+(.+?)\s+SITTING/i,
      /Before\s+(.+?)\s+sitting/i,
      /(?:District\s+)?Judge\s+([A-Z][a-z]+)/i,
      /Recorder\s+([A-Z][a-z]+)/i,
      /Deputy\s+District\s+Judge\s+([A-Z][a-z]+)/i
    ],

    // Date patterns
    orderDate: [
      /Ordered\s+by\s+.+?\s+on\s+(\d{1,2}(?:st|nd|rd|th)?\s+[A-Z][a-z]+\s+\d{4})/i,
      /on\s+(\d{1,2}(?:st|nd|rd|th)?\s+[A-Z][a-z]+\s+\d{4})$/i,
      /dated?\s+(\d{1,2}[/.]\d{1,2}[/.]\d{2,4})/i
    ],

    // Application types
    applicationType: [
      /Application\s+for[:\s]+(.+?)(?:\n|$)/i,
      /applied\s+for\s+a?\s*(.+?)(?:\s+and|\s*$)/i,
      /Order\(s\)\s+applied\s+for[:\s]+(.+?)(?:\n|$)/i
    ],

    // Party names
    applicant: [
      /The\s+applicant\s+(?:mother\s+)?is\s+([^,\n]+)/i,
      /Applicant[:\s]+([^\n]+)/i,
      /About\s+you\s+\(the\s+applicant\)[^}]+?State\s+your\s+.+?:\s*([^\n]+)/is
    ],

    respondent: [
      /The\s+(?:first\s+)?respondent\s+(?:father\s+)?is\s+([^,\n]+)/i,
      /Respondent[:\s]+([^\n]+)/i,
      /About\s+the\s+respondent[^}]+?State\s+the\s+respondent['']s\s+name[^:]*:\s*([^\n]+)/is
    ],

    // Document type identifiers
    orderIdentifiers: [
      /C21\s+Blank\s+Order/i,
      /General\s+Form\s+of\s+Order/i,
      /ORDER\s+MADE\s+BY/i,
      /Ordered\s+by/i,
      /THE\s+COURT\s+ORDERS/i
    ],

    applicationIdentifiers: [
      /Application\s+for:/i,
      /FL401\s+Application/i,
      /C100.*Application/i,
      /C78.*Application/i,
      /C1A.*Allegations/i
    ]

};

/\*\*

- Extract all information from PDF text with filename priority
  \*/
  extractFromText(pdfText: string, filename?: string): CourtDocumentData {
  const data: CourtDocumentData = {
  caseNumber: null,
  courtName: null,
  documentType: null,
  judgeName: null,
  orderDate: null,
  applicationDate: null,
  applicant: { name: null },
  respondent: { name: null }
  };


    // Step 1: Extract from filename first (highest priority)
    let filenameData: FilenameData = {};
    if (filename) {
      filenameData = this.extractFromFilename(filename);

      // Apply filename data with priority
      if (filenameData.caseNumber) {
        data.caseNumber = filenameData.caseNumber;
      }
      if (filenameData.documentType) {
        data.documentType = filenameData.documentType;
      }
      if (filenameData.applicationType) {
        data.applicationType = filenameData.applicationType;
      }
    }

    // Step 2: Extract from PDF content (fill in missing data)

    // Determine document type if not found in filename
    if (!data.documentType) {
      data.documentType = this.identifyDocumentType(pdfText);
    }

    // Extract case number if not found in filename
    if (!data.caseNumber) {
      data.caseNumber = this.extractPattern(pdfText, this.patterns.caseNumber);
    }

    // Extract court name (always from PDF content)
    data.courtName = this.extractPattern(pdfText, this.patterns.courtName);
    if (data.courtName) {
      data.courtName = this.cleanCourtName(data.courtName);
    }

    // Extract judge name (only for orders)
    if (data.documentType === 'order') {
      data.judgeName = this.extractPattern(pdfText, this.patterns.judgeName);
      if (data.judgeName) {
        data.judgeName = this.cleanJudgeName(data.judgeName);
      }
    }

    // Extract dates
    if (filenameData.date) {
      // Use filename date as priority
      if (data.documentType === 'order') {
        data.orderDate = filenameData.date;
      } else if (data.documentType === 'application') {
        data.applicationDate = filenameData.date;
      }
    } else {
      // Extract from PDF content
      const dateInfo = this.extractDates(pdfText, data.documentType);
      data.orderDate = dateInfo.orderDate;
      data.applicationDate = dateInfo.applicationDate;
    }

    // Extract parties (always from PDF content)
    data.applicant.name = this.extractPattern(pdfText, this.patterns.applicant);
    data.respondent.name = this.extractPattern(pdfText, this.patterns.respondent);

    // Extract application type if not found in filename
    if (data.documentType === 'application' && !data.applicationType) {
      data.applicationType = this.extractApplicationType(pdfText);
    }

    // Extract children information (always from PDF content)
    data.children = this.extractChildrenInfo(pdfText);

    // Extract party relationships (always from PDF content)
    this.extractPartyRelationships(pdfText, data);

    return data;

}

/\*\*

- Identify if document is an order or application
  \*/
  private identifyDocumentType(text: string): 'order' | 'application' | null {
  // Check for order identifiers
  for (const pattern of this.patterns.orderIdentifiers) {
  if (pattern.test(text)) {
  return 'order';
  }
  }


    // Check for application identifiers
    for (const pattern of this.patterns.applicationIdentifiers) {
      if (pattern.test(text)) {
        return 'application';
      }
    }

    return null;

}

/\*\*

- Extract pattern from text using multiple regex patterns
  \*/
  private extractPattern(text: string, patterns: RegExp[]): string | null {
  for (const pattern of patterns) {
  const match = text.match(pattern);
  if (match && match[1]) {
  return match[1].trim();
  }
  }
  return null;
  }

/\*\*

- Extract dates based on document type
  \*/
  private extractDates(text: string, docType: 'order' | 'application' | null): {
  orderDate: Date | null;
  applicationDate: Date | null;
  } {
  const result = { orderDate: null as Date | null, applicationDate: null as Date | null };


    if (docType === 'order') {
      // Look for order date
      const dateStr = this.extractPattern(text, this.patterns.orderDate);
      if (dateStr) {
        result.orderDate = this.parseDate(dateStr);
      }
    } else if (docType === 'application') {
      // Look for date issued
      const dateIssuedMatch = text.match(/Date\s+issued[:\s]+([^\n]+)/i);
      if (dateIssuedMatch) {
        result.applicationDate = this.parseDate(dateIssuedMatch[1]);
      }
    }

    return result;

}

/\*\*

- Extract application type
  */
  private extractApplicationType(text: string): string | null {
  const type = this.extractPattern(text, this.patterns.applicationType);
  if (type) {
  // Clean up common application types
  return type
  .replace(/\s+/g, ' ')
  .replace(/^\s*a\s+/i, '')
  .replace(/\s\*order$/i, ' Order')
  .trim();
  }
  return null;
  }

/\*\*

- Extract children information
  \*/
  private extractChildrenInfo(text: string): Array<{
  name: string;
  dateOfBirth: Date | null;
  gender: string | null;
  }> {
  const children = [];


    // Pattern for child information in tables
    const childPattern = /([A-Z][a-z]+\s+[A-Z][a-z]+)\s+(Boy|Girl|Male|Female)\s+(\d{1,2}(?:st|nd|rd|th)?\s+[A-Z][a-z]+\s+\d{4}|\d{1,2}\s+[A-Z][a-z]+\s+\d{4})/gi;

    let match;
    while ((match = childPattern.exec(text)) !== null) {
      children.push({
        name: match[1].trim(),
        gender: match[2].toLowerCase(),
        dateOfBirth: this.parseDate(match[3])
      });
    }

    return children;

}

/\*\*

- Extract party relationships (mother/father)
  \*/
  private extractPartyRelationships(text: string, data: CourtDocumentData): void {
  // Look for patterns like "applicant mother" or "respondent father"
  const applicantRelMatch = text.match(/applicant\s+(?:is\s+)?(?:the\s+)?(\w+)/i);
  if (applicantRelMatch && ['mother', 'father'].includes(applicantRelMatch[1].toLowerCase())) {
  data.applicant.relationship = applicantRelMatch[1].toLowerCase();
  }


    const respondentRelMatch = text.match(/respondent\s+(?:is\s+)?(?:the\s+)?(\w+)/i);
    if (respondentRelMatch && ['mother', 'father'].includes(respondentRelMatch[1].toLowerCase())) {
      data.respondent.relationship = respondentRelMatch[1].toLowerCase();
    }

}

/\*\*

- Clean judge name
  \*/
  private cleanJudgeName(name: string): string {
  return name
  .replace(/^(Deputy\s+)?District\s+Judge(?:\s+\(Magistrates['']\s+Court\))?\s+/i, '')
  .replace(/^Recorder\s+/i, '')
  .replace(/^Assistant\s+Justices['']\s+Clerk/i, 'Assistant Justices\' Clerk')
  .trim();
  }

/\*\*

- Clean court name
  \*/
  private cleanCourtName(name: string): string {
  return name
  .replace(/\s+/g, ' ')
  .replace(/COURT$/i, 'Court')
  .replace(/^at\s+/i, '')
  .trim();
  }

/\*\*

- Parse various date formats
  \*/
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
}

// Example usage function
export function extractCourtDocumentInfo(pdfText: string, filename?: string): CourtDocumentData {
const extractor = new CourtDocumentExtractor();
return extractor.extractFromText(pdfText, filename);
}

// Advanced usage with filename parsing only
export function parseFilenameOnly(filename: string): FilenameData {
const extractor = new CourtDocumentExtractor();
return extractor['extractFromFilename'](filename);
}
