// src/services/indexedDBService.ts

const DB_NAME = 'MyCaseFilesDB';
const DB_VERSION = 1;
const STORE_NAME = 'documents';

let db: IDBDatabase;

export interface StoredFile {
  id?: number;
  name: string;
  type: string;
  data: File;
  section?: string;
  orderReference?: string;
  judgeName?: string;
  date?: string;
  description?: string;
  originalName?: string;
  addedDate?: string;
}

export const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
      db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
      }
    };

    request.onsuccess = (event: Event) => {
      db = (event.target as IDBOpenDBRequest).result;
      resolve(db);
    };

    request.onerror = (event: Event) => {
      console.error("IndexedDB error:", (event.target as IDBOpenDBRequest).error?.message);
      reject("Error opening database");
    };
  });
};

export const addFile = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject("Database not open.");
      return;
    }
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const fileData: StoredFile = {
      name: file.name,
      originalName: file.name,
      type: file.type,
      data: file,
      section: 'uncategorized',
      addedDate: new Date().toISOString()
    };
    const request = store.add(fileData);

    request.onsuccess = () => {
      resolve("File added successfully");
    };

    request.onerror = (event: Event) => {
      console.error("Error adding file:", (event.target as IDBRequest).error?.message);
      reject("Error adding file");
    };
  });
};

export const getFiles = (): Promise<StoredFile[]> => {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject("Database not open.");
      return;
    }
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
      resolve(request.result as StoredFile[]);
    };

    request.onerror = (event: Event) => {
      console.error("Error getting files:", (event.target as IDBRequest).error?.message);
      reject("Error getting files");
    };
  });
};

export const updateFile = (fileId: number, updates: Partial<StoredFile>): Promise<string> => {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject("Database not open.");
      return;
    }
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    // First get the existing file
    const getRequest = store.get(fileId);
    
    getRequest.onsuccess = () => {
      const existingFile = getRequest.result as StoredFile;
      if (!existingFile) {
        reject("File not found");
        return;
      }
      
      // Merge updates with existing file
      const updatedFile = { ...existingFile, ...updates };
      const putRequest = store.put(updatedFile);
      
      putRequest.onsuccess = () => {
        resolve("File updated successfully");
      };
      
      putRequest.onerror = (event: Event) => {
        console.error("Error updating file:", (event.target as IDBRequest).error?.message);
        reject("Error updating file");
      };
    };
    
    getRequest.onerror = (event: Event) => {
      console.error("Error getting file:", (event.target as IDBRequest).error?.message);
      reject("Error getting file");
    };
  });
};
