export type CaseType = 'child' | 'finance';

export interface Case {
  id: string;
  name: string;
  type: CaseType;
  createdAt: Date;
  lastModified: Date;
  dateOfApplication?: Date;
  courtReference?: string;
  courtName?: string;
  parties?: {
    applicant?: string;
    respondent?: string;
  };
  children?: Array<{
    name: string;
    dateOfBirth?: Date;
  }>;
  description?: string;
}

export interface CaseMetadata {
  currentCaseId: string | null;
  cases: Case[];
}