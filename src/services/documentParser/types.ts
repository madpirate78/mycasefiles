// Types for extracted data - simplified for current use
export interface CourtDocumentData {
  caseNumber: string | null;
  documentType: 'order' | 'application' | 'statement' | null;
  judgeName: string | null;
  personName?: string | null;  // For statements - the person making the statement
  
  // Optional fields for future expansion
  courtName?: string | null;
  applicationType?: string | null;
  orderDate?: Date | null;
  applicationDate?: Date | null;
  applicant?: {
    name: string | null;
    relationship?: string | null;
  };
  respondent?: {
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
export interface FilenameData {
  caseNumber?: string | null;
  documentType?: 'order' | 'application' | 'statement' | null;
  applicationType?: string | null;
  date?: Date | null;
  formType?: string | null;
}

// Suggested metadata for form pre-population
export interface SuggestedMetadata {
  [key: string]: string;
}