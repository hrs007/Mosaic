import React from 'react';
import { useGallery } from '../context/GalleryContext.jsx';

export default function EmptyState() {
  const {
    filtered,
    loading,
    activeType,
    setActiveType,
    media,
    scanPage,
    setMinKb,
    setOrientation,
    setSearch,
    setPrefs
  } = useGallery();

  if (loading || filtered.length > 0) return null;

  const hasAnyAvailableMedia = media.some(x => !x.unavailable);

  if (activeType === 'files') {
    return (
      <div id="emptyState" className="empty-state">
        <div className="empty-icon">⌕</div>
        <h3>Your saved collection is empty</h3>
        <p>Save photos or videos to access them anytime from your local library.</p>
        <button
          className="primary-button"
          id="rescanEmpty"
          onClick={() => {
            setActiveType('all');
            setPrefs({ activeType: 'all' });
          }}
        >
          Browse page media
        </button>
      </div>
    );
  }

  if (hasAnyAvailableMedia) {
    return (
      <div id="emptyState" className="empty-state">
        <div className="empty-icon">⌕</div>
        <h3>No media matches these filters</h3>
        <p>Clear the search or filters to see everything found on this page.</p>
        <button
          className="primary-button"
          id="rescanEmpty"
          onClick={() => {
            setActiveType('all');
            setMinKb(0);
            setOrientation('any');
            setSearch('');
            setPrefs({
              activeType: 'all',
              minKb: 0,
              orientation: 'any',
              hideSmall: false,
              hideDuplicates: false
            });
          }}
        >
          Clear filters
        </button>
      </div>
    );
  }

  return (
    <div id="emptyState" className="empty-state">
      <div className="empty-icon">⌕</div>
      <h3>No media found here</h3>
      <p>Try another filter or scan this page again.</p>
      <button
        className="primary-button"
        id="rescanEmpty"
        onClick={() => scanPage()}
      >
        ↻ &nbsp; Scan page
      </button>
    </div>
  );
}
