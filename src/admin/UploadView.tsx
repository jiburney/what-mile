import { useState, useRef } from 'react';
import type { DragEvent, ChangeEvent } from 'react';
import type { Session } from '@supabase/supabase-js';

interface UploadViewProps {
  session: Session;
}

interface UploadStatus {
  filename: string;
  status: 'compressing' | 'uploading' | 'pending' | 'review' | 'skip' | 'error';
  message?: string;
}

async function compressImage(file: File): Promise<Blob> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
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
          resolve(blob!);
        },
        'image/jpeg',
        0.85
      );
    };
    img.src = url;
  });
}

export function UploadView({}: UploadViewProps) {
  const [dragOver, setDragOver] = useState(false);
  const [uploads, setUploads] = useState<UploadStatus[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith('image/'));
    if (files.length > 0) {
      handleFiles(files);
    }
  };

  const handleFileInput = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (files.length > 0) {
      handleFiles(files);
    }
  };

  const handleFiles = async (files: File[]) => {
    const statuses: UploadStatus[] = files.map((f) => ({
      filename: f.name,
      status: 'compressing',
    }));
    setUploads(statuses);

    let pendingCount = 0;
    let reviewCount = 0;
    let skipCount = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      try {
        // Update status: compressing
        setUploads((prev) =>
          prev.map((u, idx) => (idx === i ? { ...u, status: 'compressing' } : u))
        );

        const compressed = await compressImage(file);

        // Update status: uploading
        setUploads((prev) =>
          prev.map((u, idx) => (idx === i ? { ...u, status: 'uploading' } : u))
        );

        const formData = new FormData();
        formData.append('file', compressed, file.name);
        formData.append('source', 'owner'); // or 'community' — for now hardcode owner

        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          throw new Error(`Upload failed: ${response.statusText}`);
        }

        const result = await response.json();
        const triageStatus = result.status;

        if (triageStatus === 'pending') pendingCount++;
        else if (triageStatus === 'review') reviewCount++;
        else if (triageStatus === 'skip') skipCount++;

        // Update status: triaged
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
    }

    // Show summary
    if (files.length > 0) {
      alert(
        `Upload complete!\n\n${pendingCount} ready for approval\n${reviewCount} need review\n${skipCount} skipped`
      );
    }
  };

  const getStatusClass = (status: string) => {
    if (status === 'pending') return 'status-ready';
    if (status === 'review') return 'status-review';
    if (status === 'skip' || status === 'error') return 'status-skip';
    return 'status-pending';
  };

  const getStatusLabel = (status: string) => {
    if (status === 'compressing') return 'Compressing...';
    if (status === 'uploading') return 'Uploading...';
    if (status === 'pending') return 'Ready';
    if (status === 'review') return 'Review';
    if (status === 'skip') return 'Skipped';
    if (status === 'error') return 'Error';
    return status;
  };

  return (
    <div style={{ height: '100%', overflowY: 'auto' }}>
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
    </div>
  );
}
