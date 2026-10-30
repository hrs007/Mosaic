import React from 'react';
import { useGallery } from '../context/GalleryContext.jsx';

export default function Header() {
  const {
    counts,
    siteProfile,
    prefs,
    setPrefs,
    setSettingsOpen,
    closeGallery
  } = useGallery();

  const handleThemeToggle = () => {
    const nextTheme = prefs.theme === 'light' ? 'dark' : prefs.theme === 'dark' ? 'amoled' : 'light';
    setPrefs({ theme: nextTheme });
  };

  const itemsCountText = `${counts.all} ${counts.all === 1 ? 'item' : 'items'}`;

  return (
    <header className="topbar">
      <a className="brand" href="#" aria-label="Mosaic home" onClick={e => e.preventDefault()}>
        <span className="brand-mark">
          <i></i><i></i><i></i><i></i>
        </span>
        <span>mosaic</span>
      </a>

      <div className="top-context">
        <span className="live-dot"></span>
        <span id="siteLabel">{siteProfile.name || 'Current page'}</span>
        <span className="context-sep">/</span>
        <span id="mediaCountTop">{itemsCountText}</span>
      </div>

      <div className="top-actions">
        <button
          className="icon-button"
          id="themeToggle"
          title="Toggle theme"
          aria-label="Toggle theme"
          onClick={handleThemeToggle}
        >
          ◐
        </button>

        <button
          className="icon-button"
          id="settingsOpen"
          title="Settings"
          aria-label="Settings"
          onClick={() => setSettingsOpen(true)}
        >
          ⚙
        </button>

        <button
          className="icon-button overlay-close"
          id="overlayClose"
          title="Close gallery (Esc)"
          aria-label="Close gallery"
          onClick={closeGallery}
        >
          ×
        </button>
      </div>
    </header>
  );
}
