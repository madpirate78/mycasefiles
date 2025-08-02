export type VaultType = 'child' | 'finance';

export interface VaultSettings {
  type: VaultType;
  // For child matters - parents can be applicant/respondent in different cases
  fatherName?: string;
  motherName?: string;
  children?: Array<{
    name: string;
    dateOfBirth?: Date;
  }>;
  // For finance matters - typically fixed roles
  applicantName?: string;
  respondentName?: string;
  // Common court details
  primaryCourtName?: string;
}