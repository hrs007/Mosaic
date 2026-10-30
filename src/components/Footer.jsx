import React from 'react';
import { useGallery } from '../context/GalleryContext.jsx';

export default function Footer() {
  const { setSettingsOpen } = useGallery();

  return (
    <footer>
      <span>
        Made for the curious eye <b>✳</b>
      </span>
      <span>
        Media stays on your device ·{' '}
        <button id="privacyLink" onClick={() => setSettingsOpen(true)}>
          Privacy & controls
        </button>
      </span>
    </footer>
  );
}
