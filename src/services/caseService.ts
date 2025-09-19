import { openDB, IDBPDatabase } from 'idb';
import { Case, CaseMetadata, CaseType } from '../types/case';

class CaseService {
  private dbName = 'MyCaseFilesDB';
  private caseStoreName = 'cases';
  private metadataStoreName = 'caseMetadata';
  private db: IDBPDatabase | null = null;

  async initDB() {
    if (this.db) return this.db;

    this.db = await openDB(this.dbName, 3, {
      upgrade(db, oldVersion) {
        // Create cases store if it doesn't exist
        if (!db.objectStoreNames.contains('cases')) {
          db.createObjectStore('cases', { keyPath: 'id' });
        }
        
        // Create metadata store if it doesn't exist
        if (!db.objectStoreNames.contains('caseMetadata')) {
          db.createObjectStore('caseMetadata');
        }
      },
    });

    return this.db;
  }

  async createCase(caseData: Omit<Case, 'id' | 'createdAt' | 'lastModified'>): Promise<Case> {
    const db = await this.initDB();
    
    const newCase: Case = {
      ...caseData,
      id: `case_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date(),
      lastModified: new Date()
    };

    await db.put(this.caseStoreName, newCase);
    
    // Set as current case if it's the first one
    const metadata = await this.getCaseMetadata();
    if (!metadata.currentCaseId) {
      await this.setCurrentCase(newCase.id);
    }

    return newCase;
  }

  async updateCase(caseId: string, updates: Partial<Omit<Case, 'id' | 'createdAt'>>): Promise<Case | null> {
    const db = await this.initDB();
    const existingCase = await db.get(this.caseStoreName, caseId);
    
    if (!existingCase) return null;

    const updatedCase: Case = {
      ...existingCase,
      ...updates,
      lastModified: new Date()
    };

    await db.put(this.caseStoreName, updatedCase);
    return updatedCase;
  }

  async deleteCase(caseId: string): Promise<boolean> {
    const db = await this.initDB();
    
    // Check if this is the current case
    const metadata = await this.getCaseMetadata();
    if (metadata.currentCaseId === caseId) {
      // Find another case to set as current
      const allCases = await this.getAllCases();
      const otherCase = allCases.find(c => c.id !== caseId);
      await this.setCurrentCase(otherCase?.id || null);
    }

    await db.delete(this.caseStoreName, caseId);
    
    // TODO: Delete all files associated with this case
    
    return true;
  }

  async getCase(caseId: string): Promise<Case | null> {
    const db = await this.initDB();
    const caseData = await db.get(this.caseStoreName, caseId);
    return caseData || null;
  }

  async getAllCases(): Promise<Case[]> {
    const db = await this.initDB();
    const cases = await db.getAll(this.caseStoreName);
    return cases.sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime());
  }

  async getCasesByType(type: CaseType): Promise<Case[]> {
    const allCases = await this.getAllCases();
    return allCases.filter(c => c.type === type);
  }

  async setCurrentCase(caseId: string | null): Promise<void> {
    const db = await this.initDB();
    const metadata: CaseMetadata = {
      currentCaseId: caseId,
      cases: [] // This is maintained separately in the cases store
    };
    await db.put(this.metadataStoreName, metadata, 'metadata');
  }

  async getCurrentCase(): Promise<Case | null> {
    const metadata = await this.getCaseMetadata();
    if (!metadata.currentCaseId) return null;
    return await this.getCase(metadata.currentCaseId);
  }

  async getCaseMetadata(): Promise<CaseMetadata> {
    const db = await this.initDB();
    const metadata = await db.get(this.metadataStoreName, 'metadata');
    return metadata || { currentCaseId: null, cases: [] };
  }

  // Helper method to get case-specific sections
  getCaseSections(caseType: CaseType) {
    if (caseType === 'child') {
      return [
        { id: 'preliminary', label: 'Preliminary Documents' },
        { id: 'applications', label: 'Applications' },
        { id: 'orders', label: 'Orders' },
        { id: 'statements', label: 'Statements and Affidavits' },
        { id: 'experts', label: 'Expert Reports' },
        { id: 'care', label: 'Care Plans' },
        { id: 'correspondence', label: 'Correspondence' },
        { id: 'other', label: 'Other Documents' }
      ];
    } else {
      return [
        { id: 'preliminary', label: 'Preliminary Documents' },
        { id: 'applications', label: 'Financial Applications' },
        { id: 'orders', label: 'Financial Orders' },
        { id: 'statements', label: 'Statements and Affidavits' },
        { id: 'disclosure', label: 'Financial Disclosure' },
        { id: 'valuations', label: 'Property Valuations' },
        { id: 'correspondence', label: 'Correspondence' },
        { id: 'other', label: 'Other Documents' }
      ];
    }
  }
}

const caseService = new CaseService();
export default caseService;