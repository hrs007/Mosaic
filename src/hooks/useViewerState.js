import { useState, useCallback } from 'react';

export function useViewerState({ filteredCount }) {
  const [viewerIndex, setViewerIndex] = useState(-1);

  // Open viewer
  const openViewer = useCallback((index) => {
    if (index >= 0 && index < filteredCount) {
      setViewerIndex(index);
      document.body.classList.add('modal-open');
    }
  }, [filteredCount]);

  // Close viewer
  const closeViewer = useCallback(() => {
    setViewerIndex(-1);
    document.body.classList.remove('modal-open');
    if (document.fullscreenElement || document.webkitFullscreenElement) {
      try {
        if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
        else if (document.webkitExitFullscreen) document.webkitExitFullscreen().catch(() => {});
      } catch {}
    }
  }, []);

  // Navigate viewer next/prev
  const navigateViewer = useCallback((dir) => {
    if (!filteredCount) return;
    setViewerIndex(prev => (prev + dir + filteredCount) % filteredCount);
  }, [filteredCount]);

  return {
    viewerIndex,
    setViewerIndex,
    openViewer,
    closeViewer,
    navigateViewer
  };
}
