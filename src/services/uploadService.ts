/**
 * Upload & file management service.
 *
 * Extracts business logic that previously lived in App.tsx:
 *  - File upload with duplicate detection
 *  - Post-upload PDF processing (filename parsing + metadata extraction)
 *  - Metadata persistence (the 30+ field spread)
 *  - Page selection updates
 *  - File deletion
 *  - Upload result → notification message mapping
 */
import { addFile, getFiles, updateFile, deleteFile, StoredFile } from './indexedDBService';
import { parsePDF } from './electronAPI';
import { VaultType } from '../types/vault';

// Re-export for convenience - App.tsx can import FileWithOCR from here or from the modal
import type { FileWithOCR } from '../components/documents/FilePreviewModal';

// ─── Types ───────────────────────────────────────────────────────

export interface UploadResult {
  successCount: number;
  duplicateCount: number;
  errorCount: number;
  duplicateFiles: string[];
  newFileIds: string[];
}

export type NotificationType = 'success' | 'warning' | 'error' | 'processing';

export interface UploadNotification {
  type: NotificationType;
  message: string;
}

// ─── Upload ──────────────────────────────────────────────────────

/** Check if a file already exists in the vault (name + size match). */
async function isDuplicateFile(newFile: File, vaultType: VaultType): Promise<boolean> {
  try {
    const existingFiles = await getFiles(vaultType);
    return existingFiles.some(existing => {
      const nameMatch = (existing.originalName || existing.name) === newFile.name;
      const sizeMatch = existing.data.size === newFile.size;
      return nameMatch && sizeMatch;
    });
  } catch (error) {
    console.error('Error checking duplicates:', error);
    return false; // If we can't check, allow the upload
  }
}

/** Add files to the vault, skipping duplicates. Returns counts and new IDs. */
export async function uploadFiles(files: FileList, vaultType: VaultType): Promise<UploadResult> {
  let successCount = 0;
  let duplicateCount = 0;
  let errorCount = 0;
  const duplicateFiles: string[] = [];
  const newFileIds: string[] = [];

  for (const file of Array.from(files) as File[]) {
    try {
      if (await isDuplicateFile(file, vaultType)) {
        duplicateFiles.push(file.name);
        duplicateCount++;
        continue;
      }
      const fileId = await addFile(file, vaultType);
      successCount++;
      newFileIds.push(fileId);
    } catch (error) {
      console.error(`Error adding file ${file.name} to IndexedDB:`, error);
      errorCount++;
    }
  }

  return { successCount, duplicateCount, errorCount, duplicateFiles, newFileIds };
}

// ─── Post-upload processing ──────────────────────────────────────

/**
 * Run filename parsing + PDF text extraction for newly uploaded files.
 * Calls `onProgress` before each file so the UI can update.
 */
export async function processUploadedPDFs(
  fileIds: string[],
  vaultType: VaultType,
  onProgress: (current: number, total: number, fileName: string) => void
): Promise<void> {
  const allFiles = await getFiles(vaultType);
  const pdfFiles = fileIds
    .map(id => allFiles.find(f => f.id === parseInt(id)))
    .filter((f): f is StoredFile => !!f && f.type.includes('pdf'));

  if (pdfFiles.length === 0) return;

  console.log(`🚀 Starting automatic processing for ${pdfFiles.length} PDF files`);

  for (let i = 0; i < pdfFiles.length; i++) {
    const storedFile = pdfFiles[i];
    onProgress(i + 1, pdfFiles.length, storedFile.name);

    try {
      console.log(`🔍 Processing: ${storedFile.name}`);
      const arrayBuffer = await storedFile.data.arrayBuffer();

      // Get filename suggestions
      const { getSuggestedMetadata } = await import('./documentParser');
      const suggestions = getSuggestedMetadata(storedFile.name, vaultType);

      // Extract PDF text
      const pdfResult = await parsePDF(arrayBuffer);

      // Merge metadata
      const finalMetadata = {
        ...suggestions,
        ocrPerformed: true,
        totalPages: pdfResult.pages || storedFile.totalPages
      };

      if (storedFile.id) {
        await updateFile(storedFile.id, finalMetadata);
      }
      console.log(`✅ Processing completed for: ${storedFile.name}`);
    } catch (error) {
      console.error(`❌ Processing failed for ${storedFile.name}:`, error);
    }
  }
}

// ─── Notification helpers ────────────────────────────────────────

/** Derive the appropriate notification from an upload result. */
export function getUploadNotification(result: UploadResult): UploadNotification | null {
  const { successCount, duplicateCount, errorCount, duplicateFiles } = result;
  const totalFiles = successCount + duplicateCount + errorCount;

  if (totalFiles === 0) return null;

  if (totalFiles === 1) {
    if (duplicateCount === 1) return { type: 'warning', message: `"${duplicateFiles[0]}" is already uploaded` };
    if (errorCount === 1) return { type: 'error', message: 'Failed to upload file' };
    if (successCount === 1) return { type: 'success', message: 'File uploaded successfully' };
  } else {
    if (successCount === 0 && duplicateCount > 0) {
      if (duplicateCount === totalFiles) return { type: 'warning', message: `All ${totalFiles} files are already uploaded` };
      return { type: 'warning', message: `${duplicateCount} files already uploaded` };
    }
    if (successCount > 0 && duplicateCount === 0 && errorCount === 0) return { type: 'success', message: `${successCount} files uploaded successfully` };
    if (successCount > 0 && duplicateCount > 0) return { type: 'warning', message: `${successCount} uploaded, ${duplicateCount} duplicates skipped` };
    if (successCount > 0 && errorCount > 0) return { type: 'warning', message: `${successCount} uploaded, ${errorCount} failed` };
    if (errorCount > 0) return { type: 'error', message: `Failed to upload ${errorCount} files` };
  }

  return null;
}

// ─── Metadata persistence ────────────────────────────────────────

/** Persist all metadata fields for a file. Replaces the 30+ field spread in App.tsx. */
export async function saveFileMetadata(
  fileId: number,
  metadata: FileWithOCR,
  vaultType: VaultType
): Promise<void> {
  await updateFile(fileId, {
    name: metadata.name,
    displayName: metadata.displayName,
    section: metadata.section,
    description: metadata.description,
    vaultType,
    courtReference: metadata.courtReference,
    applicationDate: metadata.applicationDate,
    // Section-specific fields
    orderReference: metadata.orderReference,
    judgeName: metadata.judgeName,
    date: metadata.date,
    reference: metadata.reference,
    personName: metadata.personName,
    expertName: metadata.expertName,
    reportDate: metadata.reportDate,
    orderType: metadata.orderType,
    documentType: metadata.documentType,
    expertType: metadata.expertType,
    childName: metadata.childName,
    planType: metadata.planType,
    reviewDate: metadata.reviewDate,
    socialWorker: metadata.socialWorker,
    disclosureType: metadata.disclosureType,
    period: metadata.period,
    valuationType: metadata.valuationType,
    propertyAddress: metadata.propertyAddress,
    valuer: metadata.valuer,
    valuationDate: metadata.valuationDate,
    value: metadata.value,
    sender: metadata.sender,
    recipient: metadata.recipient,
    subject: metadata.subject,
    // Auto-population and OCR tracking
    autopopulationPerformed: metadata.autopopulationPerformed,
    ocrPerformed: metadata.ocrPerformed,
    ocrText: metadata.ocrText,
    ocrConfidence: metadata.ocrConfidence,
    ocrDate: metadata.ocrDate,
    // Page tracking
    totalPages: metadata.totalPages,
    selectedPages: metadata.selectedPages,
    // Include updated file data if present (e.g., searchable PDF after OCR)
    ...((metadata as any).data ? { data: (metadata as any).data } : {})
  });
}

/** Persist page selection for a file. */
export async function savePageSelection(
  fileId: number,
  selectedPages: number[],
  totalPages: number
): Promise<void> {
  await updateFile(fileId, { selectedPages, totalPages });
  console.log(`📄 Updated page selection for file ${fileId}: ${selectedPages.length}/${totalPages} pages selected`);
}

/** Delete a file from the database. */
export async function removeFile(fileId: number): Promise<void> {
  await deleteFile(fileId);
}
