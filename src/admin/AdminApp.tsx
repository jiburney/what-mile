import { useState } from 'react';
import { useAdminAuth } from './useAdminAuth';
import { AdminLogin } from './AdminLogin';
import { UploadView } from './UploadView';
import { PendingView } from './PendingView';
import { ReviewView } from './ReviewView';
import { SkipView } from './SkipView';
import { LibraryView } from './LibraryView';
import { usePhotos } from './usePhotos';
import { UploadProvider, useUpload } from './UploadContext';
import './admin.css';

type Tab = 'upload' | 'pending' | 'review' | 'skip' | 'library';

// Lives inside UploadProvider so it can read live upload progress for the tab badge.
function UploadTabLabel() {
  const { isUploading, completedCount, totalFiles } = useUpload();
  return (
    <>
      Upload
      {isUploading && (
        <span className="admin-tab-count">
          {completedCount}/{totalFiles}
        </span>
      )}
    </>
  );
}

export function AdminApp() {
  const { session, signOut, loading } = useAdminAuth();
  const [activeTab, setActiveTab] = useState<Tab>('upload');

  const pendingPhotos = usePhotos('pending', session);
  const reviewPhotos = usePhotos('review', session);
  const skipPhotos = usePhotos('skip', session);
  const approvedPhotos = usePhotos('approved', session);

  if (loading) {
    return (
      <div className="admin-login">
        <div className="admin-login-card">
          <div style={{ textAlign: 'center', color: 'var(--stone)' }}>Loading...</div>
        </div>
      </div>
    );
  }

  if (!session) {
    return <AdminLogin />;
  }

  return (
    <UploadProvider>
    <div className="admin-layout">
      <header className="admin-header">
        <div className="admin-header-title">What Mile? Admin</div>
        <button
          onClick={signOut}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--white)',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 600,
          }}
        >
          Sign Out
        </button>
      </header>

      <div className="admin-tabs">
        <button
          className={`admin-tab ${activeTab === 'upload' ? 'active' : ''}`}
          onClick={() => setActiveTab('upload')}
        >
          <UploadTabLabel />
        </button>
        <button
          className={`admin-tab ${activeTab === 'pending' ? 'active' : ''}`}
          onClick={() => setActiveTab('pending')}
        >
          Pending
          {pendingPhotos.photos.length > 0 && (
            <span className="admin-tab-count">{pendingPhotos.photos.length}</span>
          )}
        </button>
        <button
          className={`admin-tab ${activeTab === 'review' ? 'active' : ''}`}
          onClick={() => setActiveTab('review')}
        >
          Review
          {reviewPhotos.photos.length > 0 && (
            <span className="admin-tab-count">{reviewPhotos.photos.length}</span>
          )}
        </button>
        <button
          className={`admin-tab ${activeTab === 'skip' ? 'active' : ''}`}
          onClick={() => setActiveTab('skip')}
        >
          Skip
          {skipPhotos.photos.length > 0 && (
            <span className="admin-tab-count">{skipPhotos.photos.length}</span>
          )}
        </button>
        <button
          className={`admin-tab ${activeTab === 'library' ? 'active' : ''}`}
          onClick={() => setActiveTab('library')}
        >
          Library
        </button>
      </div>

      <div style={{ flex: 1, overflow: 'hidden' }}>
        {activeTab === 'upload' && <UploadView session={session} />}
        {activeTab === 'pending' && (
          <PendingView
            photos={pendingPhotos.photos}
            loading={pendingPhotos.loading}
            session={session}
            refetch={pendingPhotos.refetch}
          />
        )}
        {activeTab === 'review' && (
          <ReviewView
            photos={reviewPhotos.photos}
            loading={reviewPhotos.loading}
            session={session}
            refetch={reviewPhotos.refetch}
          />
        )}
        {activeTab === 'skip' && (
          <SkipView
            photos={skipPhotos.photos}
            loading={skipPhotos.loading}
            session={session}
            refetch={skipPhotos.refetch}
          />
        )}
        {activeTab === 'library' && (
          <LibraryView
            photos={approvedPhotos.photos}
            loading={approvedPhotos.loading}
            session={session}
            refetch={approvedPhotos.refetch}
          />
        )}
      </div>
    </div>
    </UploadProvider>
  );
}
