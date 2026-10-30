import React, { useEffect, useRef } from 'react';
import { useGallery } from '../context/GalleryContext.jsx';

export default function CardActionMenu({ item, anchorRect, onClose, onOpenViewer }) {
  const { downloadItem, removeSavedFile, showToast } = useGallery();
  const menuRef = useRef(null);

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        onClose();
      }
    };
    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, [onClose]);

  const directUrl = item.sourceUrl || item.source || item.url;
  const isDirectValid = directUrl && !/^(blob|data):/i.test(directUrl);
  const postOrPage = item.postUrl || item.pageUrl;
  const isPostDifferent = postOrPage && postOrPage !== directUrl;

  const copyText = (val) => {
    if (!val) return;
    navigator.clipboard?.writeText(val)
      .then(() => showToast('Copied to clipboard.'))
      .catch(() => showToast('Clipboard access is unavailable.'));
    onClose();
  };

  const openReverseSearch = (engine, url) => {
    if (!url) return;
    const encoded = encodeURIComponent(url);
    const targets = {
      lens: `https://lens.google.com/uploadbyurl?url=${encoded}`,
      bing: `https://www.bing.com/images/searchbyimage?cbir=sbi&imgurl=${encoded}`,
      tineye: `https://tineye.com/search?url=${encoded}`
    };
    window.open(targets[engine] || targets.lens, '_blank', 'noopener');
    onClose();
  };

  // Position calculation
  const style = {
    position: 'fixed',
    zIndex: 2100,
    left: `${Math.min((anchorRect?.right || 0) - 160, window.innerWidth - 170)}px`,
    top: `${Math.min((anchorRect?.bottom || 0) + 4, window.innerHeight - 160)}px`
  };

  return (
    <div className="card-action-menu" ref={menuRef} style={style}>
      <button onClick={() => { onClose(); onOpenViewer(); }}>
        Open in viewer
      </button>

      {isDirectValid && (
        <>
          <button onClick={() => { window.open(directUrl, '_blank', 'noopener'); onClose(); }}>
            Open direct media link ↗
          </button>
          <button onClick={() => copyText(directUrl)}>
            Copy media address
          </button>
        </>
      )}

      {isPostDifferent && (
        <>
          <button onClick={() => { window.open(postOrPage, '_blank', 'noopener'); onClose(); }}>
            {item.site === 'x' ? 'Open X post ↗'
              : item.site === 'reddit' ? 'Open Reddit thread ↗'
              : 'Open source page ↗'}
          </button>
          <button onClick={() => copyText(postOrPage)}>
            Copy source page link
          </button>
        </>
      )}

      {item.savedFile || item.saved ? (
        <>
          {item.downloadId && (
            <>
              <button onClick={() => { chrome.downloads?.open(item.downloadId); onClose(); }}>
                Open downloaded file
              </button>
              <button onClick={() => { chrome.downloads?.show(item.downloadId); onClose(); }}>
                Show in Finder / Folder
              </button>
            </>
          )}
          <button onClick={() => { removeSavedFile(item); onClose(); }}>
            Remove from Saved
          </button>
        </>
      ) : (
        <button onClick={() => { downloadItem(item); onClose(); }}>
          Save to Mosaic library
        </button>
      )}

      {item.type === 'image' && isDirectValid && (
        <button onClick={() => openReverseSearch('lens', directUrl)}>
          Reverse image search (Lens)
        </button>
      )}
    </div>
  );
}
