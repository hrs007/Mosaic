import React from 'react';
import { useGallery } from '../context/GalleryContext.jsx';

export default function SavedTools() {
  const { activeType, savedFilter, setSavedFilter, setPrefs } = useGallery();

  if (activeType !== 'files') return null;

  const handleSavedFilter = (filter) => {
    setSavedFilter(filter);
    setPrefs({ savedFilter: filter });
  };

  return (
    <section className="site-tools" id="savedTools">
      <div className="site-profile">
        <span>💾</span>
        <div>
          <b>Saved media collection</b>
          <small>Locally stored on this device in Downloads / Mosaic</small>
        </div>
      </div>

      <div className="site-actions" id="savedActions">
        <button
          className={`site-action ${savedFilter === 'all' ? 'active' : ''}`}
          data-saved-filter="all"
          onClick={() => handleSavedFilter('all')}
        >
          All saved
        </button>
        <button
          className={`site-action ${savedFilter === 'image' ? 'active' : ''}`}
          data-saved-filter="image"
          onClick={() => handleSavedFilter('image')}
        >
          Saved images
        </button>
        <button
          className={`site-action ${savedFilter === 'video' ? 'active' : ''}`}
          data-saved-filter="video"
          onClick={() => handleSavedFilter('video')}
        >
          Saved videos
        </button>
      </div>
    </section>
  );
}
