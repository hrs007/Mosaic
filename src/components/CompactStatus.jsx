import React from 'react';
import { useGallery } from '../context/GalleryContext.jsx';

export default function CompactStatus() {
  const { scanStatus } = useGallery();

  return (
    <div className="scan-status compact-status">
      <span className="status-dot"></span>
      <span id="scanStatus">{scanStatus}</span>
    </div>
  );
}
