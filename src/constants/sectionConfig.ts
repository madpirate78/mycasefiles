/**
 * Section configuration for document metadata forms.
 *
 * Defines field definitions and display-name formatters for each vault type
 * (child / finance). Consumed by FilePreviewModal to render dynamic forms
 * and generate display names on save.
 */
import { VaultType } from '../types/vault';

// ─── Types ───────────────────────────────────────────────────────

export interface FormField {
  key: string;
  label: string;
  type: 'text' | 'date' | 'select' | 'textarea';
  placeholder?: string;
  required?: boolean;
  options?: { value: string; label: string }[];
  showIf?: (metadata: any) => boolean;
}

export interface FileMetadata {
  name: string;
  displayName?: string;
  section: string;
  description?: string;
  courtReference?: string;
  applicationDate?: string;
  [key: string]: string | undefined;
}

export interface SectionConfig {
  id: string;
  label: string;
  fields: FormField[];
  displayNameFormat?: (metadata: FileMetadata) => string;
}

// ─── Helpers ─────────────────────────────────────────────────────

/** Safely coerce a metadata value to string for display name generation. */
const toSafeString = (value: any): string => {
  if (value === null || value === undefined) return '';
  return String(value);
};

// ─── Child vault sections ────────────────────────────────────────

const CHILD_SECTIONS: SectionConfig[] = [
  {
    id: 'preliminary',
    label: 'Preliminary Documents',
    fields: [
      { key: 'documentType', label: 'Document Type', type: 'select', required: true,
        options: [
          { value: 'case_summary', label: 'Case Summary' },
          { value: 'statement_of_issues', label: 'Statement of Issues' },
          { value: 'position_statements', label: 'Position Statements' },
          { value: 'chronology', label: 'Chronology' },
          { value: 'skeleton_arguments', label: 'Skeleton Arguments' },
          { value: 'list_essential_reading', label: 'List of Essential Reading' }
        ]
      },
      { key: 'date', label: 'Date Filed', type: 'date' },
      { key: 'reference', label: 'Reference Number', type: 'text', placeholder: 'e.g., REF001' }
    ],
    displayNameFormat: (meta) => {
      const parts = ['preliminary'];
      if (meta.documentType) parts.push(String(meta.documentType));
      if (meta.reference) parts.push(String(meta.reference));
      if (meta.date) parts.push(String(meta.date));
      return parts.join('_');
    }
  },
  {
    id: 'orders',
    label: 'Applications, Orders & Judgments',
    fields: [
      { key: 'orderType', label: 'Document Type', type: 'select', required: true,
        options: [
          { value: 'application', label: 'Application' },
          { value: 'order', label: 'Order' },
          { value: 'judgment', label: 'Judgement' },
          { value: 'transcript', label: 'Transcript' }
        ]
      },
      { key: 'courtReference', label: 'Court Reference', type: 'text', placeholder: 'e.g., AB12C34567', required: true },
      { key: 'date', label: 'Date', type: 'date', required: true },
      { key: 'judgeName', label: 'Judge Name', type: 'text', placeholder: 'e.g., HHJ Smith',
        showIf: (meta) => meta.orderType !== 'application' },
    ],
    displayNameFormat: (meta) => {
      const parts = [toSafeString(meta.orderType) || 'court'];
      if (meta.courtReference) parts.push(toSafeString(meta.courtReference).replace(/\s+/g, '_'));
      if (meta.judgeName) parts.push(toSafeString(meta.judgeName).replace(/\s+/g, '_'));
      if (meta.date) parts.push(toSafeString(meta.date));
      return parts.join('_');
    }
  },
  {
    id: 'statements',
    label: 'Statements and Affidavits',
    fields: [
      { key: 'personName', label: 'Person Name', type: 'text', placeholder: 'Name of person making statement', required: true },
      { key: 'courtReference', label: 'Court Reference Number', type: 'text', placeholder: 'e.g., FL401, C100', required: true },
      { key: 'date', label: 'Date', type: 'date' }
    ],
    displayNameFormat: (meta) => {
      const parts = ['statement'];
      if (meta.personName) parts.push(meta.personName.replace(/\s+/g, '_'));
      if (meta.courtReference) parts.push(meta.courtReference);
      if (meta.date) parts.push(meta.date);
      return parts.join('_');
    }
  },
  {
    id: 'care',
    label: 'Care Plans',
    fields: [
      { key: 'childName', label: 'Child Name', type: 'text', placeholder: 'Child\'s name', required: true },
      { key: 'planType', label: 'Plan Type', type: 'select', required: true,
        options: [
          { value: 'initial', label: 'Initial Care Plan' },
          { value: 'review', label: 'Review Care Plan' },
          { value: 'final', label: 'Final Care Plan' },
          { value: 'placement', label: 'Placement Plan' }
        ]
      },
      { key: 'reviewDate', label: 'Review Date', type: 'date' },
      { key: 'socialWorker', label: 'Social Worker', type: 'text', placeholder: 'Social worker name' }
    ],
    displayNameFormat: (meta) => {
      const parts = ['care_plan'];
      if (meta.planType) parts.push(meta.planType);
      if (meta.childName) parts.push(meta.childName.replace(/\s+/g, '_'));
      if (meta.reviewDate) parts.push(meta.reviewDate);
      return parts.join('_');
    }
  },
  {
    id: 'experts',
    label: 'Experts\' Reports',
    fields: [
      { key: 'expertType', label: 'Expert Type', type: 'select', required: true,
        options: [
          { value: 'cafcass', label: 'CAFCASS' },
          { value: 'social_services', label: 'Social Services' },
          { value: 'police', label: 'Police' },
          { value: 'counsellor', label: 'Counsellor' },
          { value: 'psychiatrist', label: 'Psychiatrist' },
          { value: 'psychologist', label: 'Psychologist' },
          { value: 'guardian', label: 'Guardian ad Litem' },
          { value: 'other', label: 'Other Expert' }
        ]
      },
      { key: 'expertName', label: 'Expert Name', type: 'text', placeholder: 'Expert\'s name', required: true },
      { key: 'reportDate', label: 'Report Date', type: 'date' }
    ],
    displayNameFormat: (meta) => {
      const parts = ['expert'];
      if (meta.expertType) parts.push(meta.expertType);
      if (meta.expertName) parts.push(meta.expertName.replace(/\s+/g, '_'));
      if (meta.reportDate) parts.push(meta.reportDate);
      return parts.join('_');
    }
  },
  {
    id: 'other',
    label: 'Other Documents',
    fields: [
      { key: 'documentType', label: 'Document Type', type: 'text', placeholder: 'Type of document' },
      { key: 'date', label: 'Date', type: 'date' },
      { key: 'reference', label: 'Reference', type: 'text', placeholder: 'Any reference number' }
    ],
    displayNameFormat: (meta) => {
      const parts = ['other'];
      if (meta.documentType) parts.push(meta.documentType.replace(/\s+/g, '_'));
      if (meta.reference) parts.push(meta.reference);
      if (meta.date) parts.push(meta.date);
      return parts.join('_');
    }
  }
];

// ─── Finance vault sections ──────────────────────────────────────

const FINANCE_SECTIONS: SectionConfig[] = [
  {
    id: 'preliminary',
    label: 'Preliminary Documents',
    fields: [
      { key: 'documentType', label: 'Document Type', type: 'select', required: true,
        options: [
          { value: 'case_summary', label: 'Case Summary' },
          { value: 'statement_of_issues', label: 'Statement of Issues' },
          { value: 'position_statements', label: 'Position Statements' },
          { value: 'chronology', label: 'Chronology' },
          { value: 'skeleton_arguments', label: 'Skeleton Arguments' },
          { value: 'list_essential_reading', label: 'List of Essential Reading' }
        ]
      },
      { key: 'date', label: 'Date Filed', type: 'date' },
      { key: 'reference', label: 'Reference Number', type: 'text', placeholder: 'e.g., REF001' }
    ],
    displayNameFormat: (meta) => {
      const parts = ['preliminary'];
      if (meta.documentType) parts.push(meta.documentType);
      if (meta.reference) parts.push(meta.reference);
      if (meta.date) parts.push(meta.date);
      return parts.join('_');
    }
  },
  {
    id: 'orders',
    label: 'Applications, Orders & Judgments',
    fields: [
      { key: 'orderType', label: 'Document Type', type: 'select', required: true,
        options: [
          { value: 'application', label: 'Application' },
          { value: 'order', label: 'Order' },
          { value: 'judgment', label: 'Judgement' },
          { value: 'transcript', label: 'Transcript' }
        ]
      },
      { key: 'courtReference', label: 'Court Reference', type: 'text', placeholder: 'e.g., FD23D00123', required: true },
      { key: 'date', label: 'Date', type: 'date', required: true },
      { key: 'judgeName', label: 'Judge Name', type: 'text', placeholder: 'e.g., DJ Smith',
        showIf: (meta) => meta.orderType !== 'application' },
    ],
    displayNameFormat: (meta) => {
      const parts = [toSafeString(meta.orderType) || 'court'];
      if (meta.courtReference) parts.push(toSafeString(meta.courtReference).replace(/\s+/g, '_'));
      if (meta.judgeName) parts.push(toSafeString(meta.judgeName).replace(/\s+/g, '_'));
      if (meta.date) parts.push(toSafeString(meta.date));
      return parts.join('_');
    }
  },
  {
    id: 'statements',
    label: 'Statements and Affidavits',
    fields: [
      { key: 'personName', label: 'Person Name', type: 'text', placeholder: 'Name of person making statement', required: true },
      { key: 'courtReference', label: 'Court Reference Number', type: 'text', placeholder: 'e.g., FD23D00123', required: true },
      { key: 'date', label: 'Date', type: 'date' }
    ],
    displayNameFormat: (meta) => {
      const parts = ['statement'];
      if (meta.personName) parts.push(meta.personName.replace(/\s+/g, '_'));
      if (meta.courtReference) parts.push(meta.courtReference);
      if (meta.date) parts.push(meta.date);
      return parts.join('_');
    }
  },
  {
    id: 'disclosure',
    label: 'Financial Disclosure',
    fields: [
      { key: 'disclosureType', label: 'Disclosure Type', type: 'select', required: true,
        options: [
          { value: 'bank_statements', label: 'Bank Statements' },
          { value: 'payslips', label: 'Payslips' },
          { value: 'tax_returns', label: 'Tax Returns' },
          { value: 'business_accounts', label: 'Business Accounts' },
          { value: 'pension_statements', label: 'Pension Statements' },
          { value: 'investment_portfolio', label: 'Investment Portfolio' },
          { value: 'other_disclosure', label: 'Other Financial Disclosure' }
        ]
      },
      { key: 'period', label: 'Period Covered', type: 'text', placeholder: 'e.g., Jan-Dec 2023' },
      { key: 'date', label: 'Date Provided', type: 'date', required: true }
    ],
    displayNameFormat: (meta) => {
      const parts = ['disclosure', meta.disclosureType || 'document'];
      if (meta.period) parts.push(meta.period.replace(/\s+/g, '_'));
      if (meta.date) parts.push(meta.date);
      return parts.join('_');
    }
  },
  {
    id: 'valuations',
    label: 'Property Valuations',
    fields: [
      { key: 'propertyAddress', label: 'Property Address', type: 'text', placeholder: 'Property address', required: true },
      { key: 'valuationType', label: 'Valuation Type', type: 'select', required: true,
        options: [
          { value: 'property_valuation', label: 'Property Valuation' },
          { value: 'pension_valuation', label: 'Pension Valuation' },
          { value: 'business_valuation', label: 'Business Valuation' },
          { value: 'contents_valuation', label: 'Contents Valuation' },
          { value: 'other_valuation', label: 'Other Valuation' }
        ]
      },
      { key: 'valuer', label: 'Valuer Name', type: 'text', placeholder: 'Name of valuer/company' },
      { key: 'valuationDate', label: 'Valuation Date', type: 'date', required: true },
      { key: 'value', label: 'Valuation Amount', type: 'text', placeholder: '\u00a3000,000' }
    ],
    displayNameFormat: (meta) => {
      const parts = ['valuation', meta.valuationType || 'property'];
      if (meta.propertyAddress) parts.push(meta.propertyAddress.replace(/\s+/g, '_').substring(0, 20));
      if (meta.valuationDate) parts.push(meta.valuationDate);
      return parts.join('_');
    }
  },
  {
    id: 'correspondence',
    label: 'Correspondence',
    fields: [
      { key: 'sender', label: 'Sender', type: 'text', placeholder: 'Who sent this', required: true },
      { key: 'recipient', label: 'Recipient', type: 'text', placeholder: 'Who received this' },
      { key: 'subject', label: 'Subject', type: 'text', placeholder: 'Subject matter' },
      { key: 'date', label: 'Date', type: 'date', required: true }
    ],
    displayNameFormat: (meta) => {
      const parts = ['correspondence'];
      if (meta.sender) parts.push(meta.sender.replace(/\s+/g, '_'));
      if (meta.subject) parts.push(meta.subject.replace(/\s+/g, '_').substring(0, 20));
      if (meta.date) parts.push(meta.date);
      return parts.join('_');
    }
  },
  {
    id: 'other',
    label: 'Other Documents',
    fields: [
      { key: 'documentType', label: 'Document Type', type: 'text', placeholder: 'Type of document' },
      { key: 'date', label: 'Date', type: 'date' },
      { key: 'reference', label: 'Reference', type: 'text', placeholder: 'Any reference number' }
    ],
    displayNameFormat: (meta) => {
      const parts = ['other'];
      if (meta.documentType) parts.push(meta.documentType.replace(/\s+/g, '_'));
      if (meta.reference) parts.push(meta.reference);
      if (meta.date) parts.push(meta.date);
      return parts.join('_');
    }
  }
];

// ─── Public API ──────────────────────────────────────────────────

/** Return the section configs for the given vault type. */
export function getSectionConfigs(vaultType: VaultType): SectionConfig[] {
  return vaultType === 'child' ? CHILD_SECTIONS : FINANCE_SECTIONS;
}
