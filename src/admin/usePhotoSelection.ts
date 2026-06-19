import { useState, useMemo } from 'react';
import type { AdminPhoto } from '../types';

export function usePhotoSelection(photos: AdminPhoto[]) {
  // Create a stable key based on photo IDs to detect when the photo list changes
  const photosKey = useMemo(() => photos.map(p => p.id).join(','), [photos]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set(photos.map((p) => p.id)));
  const [lastPhotosKey, setLastPhotosKey] = useState(photosKey);

  // Reset selection when photos change (without using useEffect)
  if (photosKey !== lastPhotosKey) {
    setSelectedIds(new Set(photos.map((p) => p.id)));
    setLastPhotosKey(photosKey);
  }

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIds(new Set(photos.map((p) => p.id)));
  };

  const deselectAll = () => {
    setSelectedIds(new Set());
  };

  return {
    selectedIds,
    toggleSelection,
    selectAll,
    deselectAll,
  };
}
