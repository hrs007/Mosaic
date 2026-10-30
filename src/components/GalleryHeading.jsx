import React from 'react';
import { useGallery } from '../context/GalleryContext.jsx';

export default function GalleryHeading() {
  const {
    activeType,
    filtered,
    viewMode,
    setViewMode,
    setPrefs
  } = useGallery();

  const handleViewModeChange = (mode) => {
    setViewMode(mode);
    setPrefs({ viewMode: mode });
  };

  const titlePrefix = activeType === 'all' ? 'All media'
    : activeType === 'image' ? 'Images'
    : activeType === 'gif' ? 'GIFs'
    : activeType === 'video' ? 'Videos'
    : activeType === 'files' ? 'Saved media'
    : 'Favorites';

  const subtitle = filtered.length
    ? (activeType === 'favorites' ? 'Your saved favorites.'
      : activeType === 'files' ? 'Stored locally on this device in Downloads / Mosaic.'
      : activeType === 'gif' ? 'Animated GIFs and looping clips discovered on this page.'
      : 'A little visual inspiration from this page.')
    : 'Nothing matches your current filters.';

  return (
    <div className="gallery-heading">
      <div>
        <h2 id="galleryTitle">
          {titlePrefix} <span id="visibleCount">{filtered.length}</span>
        </h2>
        <p id="gallerySubtitle">{subtitle}</p>
      </div>

      <div className="view-switch">
        <button
          className={`view-button ${viewMode === 'grid' ? 'active' : ''}`}
          data-view="grid"
          title="Grid view"
          onClick={() => handleViewModeChange('grid')}
        >
          ▦
        </button>
        <button
          className={`view-button ${viewMode === 'masonry' ? 'active' : ''}`}
          data-view="masonry"
          title="Masonry view"
          onClick={() => handleViewModeChange('masonry')}
        >
          ▤
        </button>
      </div>
    </div>
  );
}
