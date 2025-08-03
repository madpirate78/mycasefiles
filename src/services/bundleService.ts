// Bundle service for managing court document bundles
import { openDB, IDBPDatabase } from 'idb';

export interface Bundle {
  id?: number;
  name: string;
  caseReference?: string;
  hearingDate?: string;
  court?: string;
  createdDate: string;
  documentCount: number;
  status: 'draft' | 'completed';
  watermarked: boolean;
  documentIds: number[]; // Array of document IDs included in this bundle
}

class BundleService {
  private dbName = 'MyCaseFilesDB';
  private storeName = 'bundles';
  private db: IDBPDatabase | null = null;

  async initDB() {
    if (this.db) {
      console.log('BundleService: Using existing DB connection');
      return this.db;
    }

    console.log('BundleService: Opening database...');
    
    // Try version 5 to force an upgrade that includes bundles store
    this.db = await openDB(this.dbName, 5, {
      upgrade(db, oldVersion) {
        console.log('BundleService: Database upgrade triggered, oldVersion:', oldVersion);
        
        // Create documents store if it doesn't exist (from other services)
        if (!db.objectStoreNames.contains('documents')) {
          console.log('BundleService: Creating documents store');
          db.createObjectStore('documents', { keyPath: 'id', autoIncrement: true });
        }
        
        // Create vaultSettings store if it doesn't exist (from other services) 
        if (!db.objectStoreNames.contains('vaultSettings')) {
          console.log('BundleService: Creating vaultSettings store');
          db.createObjectStore('vaultSettings');
        }
        
        // Create bundles store if it doesn't exist
        if (!db.objectStoreNames.contains('bundles')) {
          console.log('BundleService: Creating bundles store');
          db.createObjectStore('bundles', { keyPath: 'id', autoIncrement: true });
        } else {
          console.log('BundleService: Bundles store already exists');
        }
      },
    });

    console.log('BundleService: Database opened successfully');
    console.log('BundleService: Available stores:', Array.from(this.db.objectStoreNames));
    return this.db;
  }

  async createBundle(bundleData: Omit<Bundle, 'id' | 'createdDate' | 'documentCount' | 'status' | 'watermarked' | 'documentIds'>): Promise<Bundle> {
    console.log('BundleService: createBundle called with:', bundleData);
    
    const db = await this.initDB();
    console.log('BundleService: Database initialized');
    
    const bundle: Omit<Bundle, 'id'> = {
      ...bundleData,
      createdDate: new Date().toISOString(),
      documentCount: 0,
      status: 'draft',
      watermarked: true,
      documentIds: []
    };

    console.log('BundleService: Bundle object created:', bundle);
    
    try {
      const id = await db.add(this.storeName, bundle);
      console.log('BundleService: Bundle added to DB with ID:', id);
      const result = { ...bundle, id: Number(id) };
      console.log('BundleService: Returning bundle:', result);
      return result;
    } catch (error) {
      console.error('BundleService: Error adding bundle to DB:', error);
      throw error;
    }
  }

  async getAllBundles(): Promise<Bundle[]> {
    console.log('BundleService: getAllBundles called');
    const db = await this.initDB();
    console.log('BundleService: Database initialized for getAllBundles');
    
    try {
      const bundles = await db.getAll(this.storeName);
      console.log('BundleService: Retrieved bundles from DB:', bundles);
      return bundles;
    } catch (error) {
      console.error('BundleService: Error getting bundles from DB:', error);
      throw error;
    }
  }

  async getBundle(id: number): Promise<Bundle | undefined> {
    const db = await this.initDB();
    return await db.get(this.storeName, id);
  }

  async updateBundle(id: number, updates: Partial<Bundle>): Promise<void> {
    const db = await this.initDB();
    const existing = await db.get(this.storeName, id);
    if (existing) {
      await db.put(this.storeName, { ...existing, ...updates });
    }
  }

  async deleteBundle(id: number): Promise<void> {
    const db = await this.initDB();
    await db.delete(this.storeName, id);
  }

  async addDocumentToBundle(bundleId: number, documentId: number): Promise<void> {
    const bundle = await this.getBundle(bundleId);
    if (bundle) {
      const updatedDocumentIds = [...bundle.documentIds, documentId];
      await this.updateBundle(bundleId, {
        documentIds: updatedDocumentIds,
        documentCount: updatedDocumentIds.length
      });
    }
  }

  async removeDocumentFromBundle(bundleId: number, documentId: number): Promise<void> {
    const bundle = await this.getBundle(bundleId);
    if (bundle) {
      const updatedDocumentIds = bundle.documentIds.filter(id => id !== documentId);
      await this.updateBundle(bundleId, {
        documentIds: updatedDocumentIds,
        documentCount: updatedDocumentIds.length
      });
    }
  }
}

const bundleService = new BundleService();
export default bundleService;