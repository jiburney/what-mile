import { createContext, useContext, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import exifr from 'exifr';

export interface UploadStatus {
  filename: string;
  status: 'compressing' | 'uploading' | 'pending' | 'review' | 'skip' | 'error' | 'duplicate';
  message?: string;
}

export interface BatchSummary {
  total: number;
  completed: number;
  pending: number;
  review: number;
  skip: number;
  error: number;
  duplicate: number;
  cancelled: boolean;
}

interface UploadContextValue {
  uploads: UploadStatus[];
  totalFiles: number;
  completedCount: number;
  timeRemaining: string;
  isUploading: boolean;
  batchSummary: BatchSummary | null;
  startUpload: (files: File[]) => Promise<void>;
  cancelUpload: () => void;
}

async function compressImage(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    let settled = false;

    // Backstop: some formats (notably HEIC/HEIF in Chrome/Firefox) fire neither
    // onload nor onerror, leaving this promise unsettled and hanging the batch.
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      URL.revokeObjectURL(url);
      reject(new Error('Image decode timed out (unsupported format?)'));
    }, 15000);

    img.onload = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      const canvas = document.createElement('canvas');
      let { width, height } = img;
      const maxDim = 2000;
      if (width > maxDim || height > maxDim) {
        const ratio = Math.min(maxDim / width, maxDim / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(url);
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Image encode failed'));
          }
        },
        'image/jpeg',
        0.85
      );
    };
    img.onerror = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      URL.revokeObjectURL(url);
      reject(new Error('Could not decode image (unsupported format?)'));
    };
    img.src = url;
  });
}

function formatRemaining(ms: number): string {
  const totalSec = Math.max(0, Math.round(ms / 1000));
  if (totalSec < 60) return `~${totalSec} sec remaining`;
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `~${min} min ${sec} sec remaining`;
}

const UploadContext = createContext<UploadContextValue | null>(null);

export function UploadProvider({ children }: { children: ReactNode }) {
  const [uploads, setUploads] = useState<UploadStatus[]>([]);
  const [totalFiles, setTotalFiles] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);
  const [batchSummary, setBatchSummary] = useState<BatchSummary | null>(null);
  const isCancelled = useRef(false);

  const startUpload = async (files: File[]) => {
    if (isUploading) return;

    isCancelled.current = false;
    setIsUploading(true);
    setBatchSummary(null);
    setTotalFiles(files.length);
    setCompletedCount(0);
    setTimeRemaining('Calculating…');

    const statuses: UploadStatus[] = files.map((f) => ({
      filename: f.name,
      status: 'compressing',
    }));
    setUploads(statuses);

    const startTime = Date.now();
    let localCompleted = 0;
    let pendingCount = 0;
    let reviewCount = 0;
    let skipCount = 0;
    let errorCount = 0;
    let duplicateCount = 0;

    for (let i = 0; i < files.length; i++) {
      if (isCancelled.current) break;
      const file = files[i];

      try {
        const lower = file.name.toLowerCase();
        if (lower.endsWith('.heic') || lower.endsWith('.heif') || file.type === 'image/heic' || file.type === 'image/heif') {
          throw new Error('HEIC/HEIF not supported in-browser — re-export as JPEG');
        }

        setUploads((prev) =>
          prev.map((u, idx) => (idx === i ? { ...u, status: 'compressing' } : u))
        );

        // Extract EXIF from original file BEFORE compression
        const exif = await exifr.parse(file).catch(() => null);

        // Compute content hash from original file bytes
        const buf = await file.arrayBuffer();
        const digest = await crypto.subtle.digest('SHA-256', buf);
        const hash = [...new Uint8Array(digest)]
          .map(b => b.toString(16).padStart(2, '0'))
          .join('');

        const compressed = await compressImage(file);

        setUploads((prev) =>
          prev.map((u, idx) => (idx === i ? { ...u, status: 'uploading' } : u))
        );

        const formData = new FormData();
        formData.append('file', compressed, file.name);
        formData.append('source', 'owner');
        formData.append('content_hash', hash);

        // Append EXIF data if present
        if (typeof exif?.latitude === 'number') {
          formData.append('lat', String(exif.latitude));
        }
        if (typeof exif?.longitude === 'number') {
          formData.append('lng', String(exif.longitude));
        }
        if (exif?.DateTimeOriginal instanceof Date) {
          formData.append('taken_at', exif.DateTimeOriginal.toISOString());
        }

        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          const stepInfo = errorData.step ? ` [${errorData.step}]` : '';
          throw new Error(`${errorData.error || 'Upload failed'}${stepInfo}`);
        }

        const result = await response.json();
        const triageStatus = result.status;

        if (triageStatus === 'pending') pendingCount++;
        else if (triageStatus === 'review') reviewCount++;
        else if (triageStatus === 'skip') skipCount++;
        else if (triageStatus === 'duplicate') duplicateCount++;

        setUploads((prev) =>
          prev.map((u, idx) =>
            idx === i
              ? {
                  ...u,
                  status: triageStatus,
                  message: result.message,
                }
              : u
          )
        );
      } catch (err) {
        console.error(`Error uploading ${file.name}:`, err);
        errorCount++;
        setUploads((prev) =>
          prev.map((u, idx) =>
            idx === i
              ? {
                  ...u,
                  status: 'error',
                  message: err instanceof Error ? err.message : 'Upload failed',
                }
              : u
          )
        );
      }

      localCompleted++;
      setCompletedCount(localCompleted);

      if (localCompleted < 2) {
        setTimeRemaining('Calculating…');
      } else {
        const elapsed = Date.now() - startTime;
        const avgMs = elapsed / localCompleted;
        const remainingMs = avgMs * (files.length - localCompleted);
        setTimeRemaining(formatRemaining(remainingMs));
      }

      // Add 250ms delay between uploads (skip on last file or if cancelled)
      if (localCompleted < files.length && !isCancelled.current) {
        await new Promise(resolve => setTimeout(resolve, 250));
      }
    }

    setBatchSummary({
      total: files.length,
      completed: localCompleted,
      pending: pendingCount,
      review: reviewCount,
      skip: skipCount,
      error: errorCount,
      duplicate: duplicateCount,
      cancelled: isCancelled.current,
    });
    setIsUploading(false);
  };

  const cancelUpload = () => {
    isCancelled.current = true;
  };

  return (
    <UploadContext.Provider
      value={{
        uploads,
        totalFiles,
        completedCount,
        timeRemaining,
        isUploading,
        batchSummary,
        startUpload,
        cancelUpload,
      }}
    >
      {children}
    </UploadContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components -- provider + its hook are intentionally co-located
export function useUpload(): UploadContextValue {
  const ctx = useContext(UploadContext);
  if (!ctx) {
    throw new Error('useUpload must be used within an UploadProvider');
  }
  return ctx;
}
