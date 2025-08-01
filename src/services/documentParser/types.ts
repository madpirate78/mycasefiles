// Types for extracted data
export interface CourtDocumentData {
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
export interface FilenameData {
  caseNumber?: string | null;
  documentType?: 'order' | 'application' | null;
  applicationType?: string | null;
  date?: Date | null;
  formType?: string | null;
}

// Suggested metadata for form pre-population
export interface SuggestedMetadata {
  [key: string]: string;
}