import { useEffect } from 'react';

export function useKeyboardShortcuts({
  viewerIndex,
  settingsOpen,
  closeGallery,
  closeViewer,
  navigateViewer,
  setSettingsOpen
}) {
  useEffect(() => {
    const onKeyDown = (e) => {
      const isMKey = e.code === 'KeyM' || e.key?.toLowerCase() === 'm' || e.key === 'µ';
      const isToggleShortcut = isMKey && (
        ((e.metaKey || e.ctrlKey) && e.altKey) ||
        (e.altKey && e.shiftKey && !e.metaKey && !e.ctrlKey)
      );

      if (isToggleShortcut) {
        e.preventDefault();
        closeGallery();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        document.getElementById('searchInput')?.focus();
        return;
      }
      if (e.key === 'Escape') {
        if (viewerIndex >= 0) {
          closeViewer();
        } else if (settingsOpen) {
          setSettingsOpen(false);
        } else {
          closeGallery();
        }
        return;
      }
      if (viewerIndex >= 0) {
        if (e.key === 'ArrowRight') navigateViewer(1);
        if (e.key === 'ArrowLeft') navigateViewer(-1);
        if (e.key.toLowerCase() === 'f') {
          const btn = document.querySelector('.viewer-fs');
          if (btn) btn.click();
        }
        if (e.code === 'Space' && !e.target.matches('input,textarea')) {
          e.preventDefault();
          const playBtn = document.querySelector('.viewer-play');
          if (playBtn) playBtn.click();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [viewerIndex, settingsOpen, closeGallery, closeViewer, navigateViewer, setSettingsOpen]);
}
