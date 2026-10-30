import React from 'react';
import { useGallery } from '../context/GalleryContext.jsx';

export default function Toast() {
  const { toastMessage } = useGallery();

  return (
    <div className={`toast ${toastMessage ? 'show' : ''}`} id="toast">
      {toastMessage}
    </div>
  );
}
