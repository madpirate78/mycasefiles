import { openDB, IDBPDatabase } from 'idb';
import { VaultSettings, VaultType } from '../types/vault';

class VaultService {
  private dbName = 'MyCaseFilesDB';
  private vaultStoreName = 'vaultSettings';
  private db: IDBPDatabase | null = null;

  async initDB() {
    if (this.db) return this.db;

    this.db = await openDB(this.dbName, 4, {
      upgrade(db, oldVersion) {
        // Create vault settings store if it doesn't exist
        if (!db.objectStoreNames.contains('vaultSettings')) {
          db.createObjectStore('vaultSettings');
        }
      },
    });

    // Initialize default vault settings if none exist
    await this.initializeVaults();
    
    // Migrate existing files to have vault types
    await this.migrateExistingFiles();
    
    return this.db;
  }

  async initializeVaults() {
    const db = await this.initDB();
    
    // Check if vaults are already initialized
    const childVault = await db.get(this.vaultStoreName, 'child');
    const financeVault = await db.get(this.vaultStoreName, 'finance');
    
    // Create default vault settings if they don't exist
    if (!childVault) {
      await this.updateVaultSettings('child', {
        type: 'child',
        fatherName: '',
        motherName: '',
        children: []
      });
    }
    
    if (!financeVault) {
      await this.updateVaultSettings('finance', {
        type: 'finance',
        applicantName: '',
        respondentName: ''
      });
    }
  }

  async getVaultSettings(type: VaultType): Promise<VaultSettings> {
    const db = await this.initDB();
    const settings = await db.get(this.vaultStoreName, type);
    
    if (type === 'child') {
      return settings || {
        type,
        fatherName: '',
        motherName: '',
        children: []
      };
    } else {
      return settings || {
        type,
        applicantName: '',
        respondentName: ''
      };
    }
  }

  async updateVaultSettings(type: VaultType, settings: VaultSettings): Promise<void> {
    const db = await this.initDB();
    await db.put(this.vaultStoreName, settings, type);
  }

  async migrateExistingFiles() {
    try {
      const db = await this.initDB();
      
      // Check if documents store exists
      if (!db.objectStoreNames.contains('documents')) {
        return; // No documents to migrate
      }
      
      const transaction = db.transaction(['documents'], 'readwrite');
      const store = transaction.objectStore('documents');
      const allFiles = await store.getAll();
      
      // Update files that don't have vaultType or section
      for (const file of allFiles) {
        let needsUpdate = false;
        
        if (!file.vaultType) {
          // Default to child vault for existing files
          file.vaultType = 'child';
          needsUpdate = true;
          console.log(`Migrated file ${file.name} to child vault`);
        }
        
        if (!file.section) {
          // Default to uncategorized for existing files
          file.section = 'uncategorized';
          needsUpdate = true;
          console.log(`Migrated file ${file.name} to uncategorized section`);
        }
        
        if (needsUpdate) {
          await store.put(file);
        }
      }
      
      console.log(`Migration complete: ${allFiles.filter(f => !f.vaultType).length} files migrated`);
    } catch (error) {
      console.warn('File migration failed (this is normal for new installations):', error);
    }
  }

  // Get sections based on vault type
  getVaultSections(vaultType: VaultType) {
    if (vaultType === 'child') {
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

export default new VaultService();