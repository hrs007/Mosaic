import React from 'react';
import { useGallery } from '../context/GalleryContext.jsx';

export default function LoadingState() {
  const { loading } = useGallery();

  if (!loading) return null;

  return (
    <div id="loadingState" className="loading-state">
      <span className="spinner"></span> Gathering the visuals…
    </div>
  );
}
