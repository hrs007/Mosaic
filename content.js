// Mosaic global keyboard listener on host page
(() => {
  // Helper to safely check if the extension runtime context is valid and active
  function isExtensionContextValid() {
    try {
      return Boolean(
        typeof chrome !== 'undefined' &&
        chrome &&
        chrome.runtime &&
        chrome.runtime.id &&
        typeof chrome.runtime.sendMessage === 'function'
      );
    } catch {
      return false;
    }
  }

  // Remove any previously attached listener to prevent duplicate events on re-injection
  if (window.__mosaicKeydownListener) {
    window.removeEventListener('keydown', window.__mosaicKeydownListener, true);
    window.__mosaicKeydownListener = null;
  }

  const handleKeyDown = (e) => {
    // Check for Mosaic toggle shortcut:
    // 1. Command+Option+M (Mac)
    // 2. Ctrl+Alt+M (Windows/Linux)
    // 3. Alt+Shift+M (cross-platform fallback & Chrome commands shortcut)
    // Note: On Mac, Option+M produces 'µ', and non-QWERTY layouts may map physical KeyM differently.
    const isMKey = e.code === 'KeyM' || e.key?.toLowerCase() === 'm' || e.key === 'µ';
    const isToggleShortcut = isMKey && (
      ((e.metaKey || e.ctrlKey) && e.altKey) ||
      (e.altKey && e.shiftKey && !e.metaKey && !e.ctrlKey)
    );

    if (isToggleShortcut) {
      if (!isExtensionContextValid()) {
        // Extension was reloaded, updated, or uninstalled in chrome://extensions.
        // Clean up orphaned listener so it stops intercepting keys and throwing TypeError.
        window.removeEventListener('keydown', handleKeyDown, true);
        window.__mosaicKeydownListener = null;
        console.debug('Mosaic: Extension context was invalidated, cleaned up shortcut listener.');
        return;
      }

      e.preventDefault();
      e.stopPropagation();

      try {
        const sendPromise = chrome.runtime.sendMessage({ type: 'mosaic-toggle-overlay' });
        if (sendPromise && typeof sendPromise.catch === 'function') {
          sendPromise.catch((err) => {
            // Context might have become invalidated immediately during or after dispatch
            if (err?.message?.includes('context invalidated')) {
              window.removeEventListener('keydown', handleKeyDown, true);
              window.__mosaicKeydownListener = null;
            }
          });
        }
      } catch (err) {
        if (err?.message?.includes('context invalidated')) {
          window.removeEventListener('keydown', handleKeyDown, true);
          window.__mosaicKeydownListener = null;
        }
      }
      return;
    }

    // Close overlay on Escape if focus is currently on the host webpage
    if (e.key === 'Escape' || e.code === 'Escape') {
      try {
        const overlay = document.getElementById('mosaic-gallery-overlay');
        if (overlay) {
          e.preventDefault();
          e.stopPropagation();
          overlay.remove();
          if (window.__mosaicInitialScroll) {
            window.scrollTo(window.__mosaicInitialScroll.x, window.__mosaicInitialScroll.y);
          }
        }
      } catch {}
    }
  };

  window.__mosaicKeydownListener = handleKeyDown;
  window.addEventListener('keydown', handleKeyDown, true);
})();
