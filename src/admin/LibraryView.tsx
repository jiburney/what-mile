import { useState, useEffect, useMemo } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { AdminPhoto } from '../types';
import { PhotoCard } from './PhotoCard';

interface LibraryViewProps {
  photos: AdminPhoto[];
  loading: boolean;
  session: Session;
  refetch: () => void;
}

export function LibraryView({ photos, loading, session, refetch }: LibraryViewProps) {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sectionFilter, setSectionFilter] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'name'>('newest');

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 200);

    return () => clearTimeout(timer);
  }, [search]);

  // Derive unique sections from photos
  const sections = useMemo(() => {
    const uniqueSections = new Set<string>();
    photos.forEach((photo) => {
      const section = photo.trail_section || 'Unknown';
      uniqueSections.add(section);
    });
    return Array.from(uniqueSections).sort((a, b) => a.localeCompare(b));
  }, [photos]);

  // Filter and sort photos
  const filtered = useMemo(() => {
    let result = [...photos];

    // Filter by search
    if (debouncedSearch) {
      const query = debouncedSearch.toLowerCase();
      result = result.filter((photo) => {
        const location = photo.locationName?.toLowerCase() || '';
        const description = photo.description?.toLowerCase() || '';
        const section = photo.trail_section?.toLowerCase() || '';
        return location.includes(query) || description.includes(query) || section.includes(query);
      });
    }

    // Filter by section
    if (sectionFilter) {
      result = result.filter((photo) => {
        if (sectionFilter === 'Unknown') {
          return !photo.trail_section;
        }
        return photo.trail_section === sectionFilter;
      });
    }

    // Sort
    result.sort((a, b) => {
      if (sortBy === 'newest') {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      if (sortBy === 'oldest') {
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      }
      // sortBy === 'name'
      return a.locationName.localeCompare(b.locationName);
    });

    return result;
  }, [photos, debouncedSearch, sectionFilter, sortBy]);

  if (loading) {
    return (
      <div className="admin-empty">
        <div className="admin-empty-text">Loading...</div>
      </div>
    );
  }

  if (photos.length === 0) {
    return (
      <div className="admin-empty">
        <div className="admin-empty-icon">📚</div>
        <div className="admin-empty-text">No approved photos yet</div>
      </div>
    );
  }

  const isFiltered = debouncedSearch || sectionFilter;
  const countText = isFiltered
    ? `${filtered.length} of ${photos.length}`
    : `${photos.length} photo${photos.length === 1 ? '' : 's'}`;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="library-toolbar">
        <input
          type="search"
          className="library-search"
          placeholder="Search by location or description…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="library-select"
          value={sectionFilter}
          onChange={(e) => setSectionFilter(e.target.value)}
        >
          <option value="">All sections</option>
          {sections.map((section) => (
            <option key={section} value={section}>
              {section}
            </option>
          ))}
        </select>
        <select
          className="library-select"
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as 'newest' | 'oldest' | 'name')}
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="name">Name A–Z</option>
        </select>
        <span className="library-count">{countText}</span>
      </div>

      {filtered.length === 0 && (
        <div className="admin-empty">
          <div className="admin-empty-text">No photos match your search</div>
        </div>
      )}

      {filtered.length > 0 && (
        <div className="photo-grid library-grid">
          {filtered.map((photo) => (
            <PhotoCard
              key={photo.id}
              photo={photo}
              session={session}
              onAction={refetch}
              mode="library"
            />
          ))}
        </div>
      )}
    </div>
  );
}
