import { useState, useRef, useEffect } from 'react';
import type { DragEvent, ChangeEvent } from 'react';
import type { Session } from '@supabase/supabase-js';
import exifr from 'exifr';

interface UploadViewProps {
  session: Session;
}

interface UploadStatus {
  filename: string;
  status: 'compressing' | 'uploading' | 'pending' | 'review' | 'skip' | 'error' | 'duplicate';
  message?: string;
}

interface BatchSummary {
  total: number;
  completed: number;
  pending: number;
  review: number;
  skip: number;
  error: number;
  duplicate: number;
  cancelled: boolean;
}

type ServiceStatus = 'idle' | 'loading' | 'ok' | 'error' | 'no_credits';

interface HealthState {
  r2: ServiceStatus;
  supabase: ServiceStatus;
  anthropic: ServiceStatus;
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

// Recursively walk a drag-and-drop FileSystemEntry, returning every image file.
// readEntries() only returns ~100 entries per call, so we loop until empty.
async function getFilesFromEntry(entry: FileSystemEntry): Promise<File[]> {
  if (entry.isFile) {
    const fileEntry = entry as FileSystemFileEntry;
    const file = await new Promise<File>((resolve, reject) =>
      fileEntry.file(resolve, reject)
    );
    return file.type.startsWith('image/') ? [file] : [];
  }

  if (entry.isDirectory) {
    const dirEntry = entry as FileSystemDirectoryEntry;
    const reader = dirEntry.createReader();
    const allChildren: FileSystemEntry[] = [];
    let batch: FileSystemEntry[];
    do {
      batch = await new Promise<FileSystemEntry[]>((resolve, reject) =>
        reader.readEntries(resolve, reject)
      );
      allChildren.push(...batch);
    } while (batch.length > 0);

    const nested = await Promise.all(allChildren.map(getFilesFromEntry));
    return nested.flat();
  }

  return [];
}

function formatRemaining(ms: number): string {
  const totalSec = Math.max(0, Math.round(ms / 1000));
  if (totalSec < 60) return `~${totalSec} sec remaining`;
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `~${min} min ${sec} sec remaining`;
}

export function UploadView({ session }: UploadViewProps) {
  const [dragOver, setDragOver] = useState(false);
  const [uploads, setUploads] = useState<UploadStatus[]>([]);
  const [totalFiles, setTotalFiles] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);
  const [batchSummary, setBatchSummary] = useState<BatchSummary | null>(null);
  const [health, setHealth] = useState<HealthState>({
    r2: 'idle',
    supabase: 'idle',
    anthropic: 'idle',
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const isCancelled = useRef(false);

  const checkHealth = async () => {
    setHealth({ r2: 'loading', supabase: 'loading', anthropic: 'loading' });

    try {
      const response = await fetch('/api/health', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        setHealth({ r2: 'error', supabase: 'error', anthropic: 'error' });
        return;
      }

      const result = await response.json();
      setHealth({
        r2: result.r2,
        supabase: result.supabase,
        anthropic: result.anthropic,
      });
    } catch (error) {
      console.error('Health check failed:', error);
      setHealth({ r2: 'error', supabase: 'error', anthropic: 'error' });
    }
  };

  useEffect(() => {
    checkHealth();
  }, []);

  const getDotClass = (status: ServiceStatus) => {
    if (status === 'ok') return 'ok';
    if (status === 'error') return 'error';
    if (status === 'no_credits') return 'warning';
    return 'loading'; // idle or loading
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleDrop = async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);

    const items = Array.from(e.dataTransfer.items);
    const hasEntryApi = items.length > 0 && typeof items[0].webkitGetAsEntry === 'function';

    let files: File[];
    if (hasEntryApi) {
      const entries = items
        .map((item) => item.webkitGetAsEntry())
        .filter((entry): entry is FileSystemEntry => entry !== null);
      const nested = await Promise.all(entries.map(getFilesFromEntry));
      files = nested.flat();
    } else {
      files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith('image/'));
    }

    if (files.length > 0) {
      handleFiles(files);
    }
  };

  const handleFileInput = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
      ? Array.from(e.target.files).filter((f) => f.type.startsWith('image/'))
      : [];
    if (files.length > 0) {
      handleFiles(files);
    }
    // Reset so the same file can be reselected later.
    e.target.value = '';
  };

  const handleFiles = async (files: File[]) => {
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

  const handleCancel = () => {
    isCancelled.current = true;
  };

  const getStatusClass = (status: string) => {
    if (status === 'pending') return 'status-ready';
    if (status === 'review') return 'status-review';
    if (status === 'skip' || status === 'error' || status === 'duplicate') return 'status-skip';
    return 'status-pending';
  };

  const getStatusLabel = (status: string) => {
    if (status === 'compressing') return 'Compressing...';
    if (status === 'uploading') return 'Uploading...';
    if (status === 'pending') return 'Ready';
    if (status === 'review') return 'Review';
    if (status === 'skip') return 'Skipped';
    if (status === 'error') return 'Error';
    if (status === 'duplicate') return 'Duplicate';
    return status;
  };

  const progressPct = totalFiles > 0 ? (completedCount / totalFiles) * 100 : 0;

  return (
    <div style={{ height: '100%', overflowY: 'auto' }}>
      <div className="health-bar">
        <div className="health-indicator">
          <span className={`health-dot health-dot-${getDotClass(health.r2)}`} />
          R2
        </div>
        <div className="health-indicator">
          <span className={`health-dot health-dot-${getDotClass(health.supabase)}`} />
          Supabase
        </div>
        <div className="health-indicator">
          <span className={`health-dot health-dot-${getDotClass(health.anthropic)}`} />
          Anthropic{health.anthropic === 'no_credits' ? ' (no credits)' : ''}
        </div>
        <button
          className="btn-health-refresh"
          onClick={checkHealth}
          disabled={health.r2 === 'loading'}
        >
          ↻ Refresh
        </button>
      </div>

      <div
        className={`upload-dropzone ${dragOver ? 'dragover' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <div className="upload-dropzone-icon">📷</div>
        <div className="upload-dropzone-text">
          Drop photos here or click to select
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          style={{ display: 'none' }}
          onChange={handleFileInput}
        />
      </div>

      <div className="upload-folder-link">
        <button
          type="button"
          className="btn-folder-select"
          onClick={() => folderInputRef.current?.click()}
        >
          or select a folder
        </button>
        <input
          ref={folderInputRef}
          type="file"
          multiple
          style={{ display: 'none' }}
          onChange={handleFileInput}
          {...({ webkitdirectory: '', directory: '' } as Record<string, string>)}
        />
      </div>

      {isUploading && (
        <div className="upload-progress-header">
          <div style={{ flex: 1 }}>
            <div style={{ marginBottom: 6 }}>
              {completedCount} of {totalFiles} — {timeRemaining}
            </div>
            <div className="upload-progress-bar-wrap">
              <div
                className="upload-progress-bar-fill"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
          <button type="button" className="btn-cancel" onClick={handleCancel}>
            Cancel
          </button>
        </div>
      )}

      {uploads.length > 0 && (
        <div className="upload-progress">
          {uploads.map((upload, idx) => (
            <div key={idx} className="upload-item">
              <div className="upload-item-name">{upload.filename}</div>
              <div className={`upload-item-status ${getStatusClass(upload.status)}`}>
                {getStatusLabel(upload.status)}
              </div>
            </div>
          ))}
        </div>
      )}

      {batchSummary && (
        <div className="upload-summary">
          {batchSummary.cancelled
            ? `Cancelled after ${batchSummary.completed} of ${batchSummary.total} — ${batchSummary.pending} ready, ${batchSummary.review} need review, ${batchSummary.skip} skipped, ${batchSummary.duplicate} duplicate`
            : `Batch complete — ${batchSummary.pending} ready, ${batchSummary.review} need review, ${batchSummary.skip} skipped, ${batchSummary.duplicate} duplicate`}
        </div>
      )}
    </div>
  );
}
