import React, { useEffect } from 'react';
import { useGallery } from './context/GalleryContext.jsx';
import Header from './components/Header.jsx';
import CompactStatus from './components/CompactStatus.jsx';
import SiteTools from './components/SiteTools.jsx';
import SavedTools from './components/SavedTools.jsx';
import Toolbar from './components/Toolbar.jsx';
import FilterPanel from './components/FilterPanel.jsx';
import GalleryHeading from './components/GalleryHeading.jsx';
import GalleryGrid from './components/GalleryGrid.jsx';
import EmptyState from './components/EmptyState.jsx';
import LoadingState from './components/LoadingState.jsx';
import LoadMore from './components/LoadMore.jsx';
import Footer from './components/Footer.jsx';
import SettingsDrawer from './components/SettingsDrawer.jsx';
import MediaViewer from './components/MediaViewer.jsx';
import Toast from './components/Toast.jsx';

export default function App() {
  const { onGalleryScroll } = useGallery();

  // Focus the gallery window on mount so keyboard shortcuts work immediately
  useEffect(() => {
    try {
      window.focus();
    } catch {}
  }, []);

  return (
    <div
      className="app-shell"
      onScroll={onGalleryScroll}
    >
      <Header />
      <main>
        <CompactStatus />
        <SiteTools />
        <SavedTools />
        <section className="toolbar-wrap">
          <Toolbar />
          <FilterPanel />
        </section>
        <section className="gallery-section">
          <GalleryHeading />
          <GalleryGrid />
          <EmptyState />
          <LoadingState />
          <LoadMore />
        </section>
      </main>
      <Footer />
      <SettingsDrawer />
      <MediaViewer />
      <Toast />
    </div>
  );
}
