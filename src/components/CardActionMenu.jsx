import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useGallery } from '../context/GalleryContext.jsx';
import {
  getInstagramProfileUrl,
  getInstagramHashtagUrl
} from '../utils/mediaHelpers.js';

export default function CardActionMenu({ item, anchorRect, onClose, onOpenViewer }) {
  const { downloadItem, removeSavedFile, showToast, navigateToInstagram } = useGallery();
  const menuRef = useRef(null);

  useEffect(() => {
    let active = true;

    const handleOutsideClick = (e) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target) &&
        !e.target.closest('.card-more')
      ) {
        onClose();
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    // Attach outside listener on next tick so the opening click does not immediately close the menu
    const timer = setTimeout(() => {
      if (!active) return;
      document.addEventListener('click', handleOutsideClick);
      document.addEventListener('keydown', handleKeyDown);
    }, 0);

    return () => {
      active = false;
      clearTimeout(timer);
      document.removeEventListener('click', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
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
      yandex: `https://yandex.com/images/search?rpt=imageview&url=${encoded}`,
      bing: `https://www.bing.com/images/searchbyimage?cbir=sbi&imgurl=${encoded}`,
      tineye: `https://tineye.com/search?url=${encoded}`
    };
    window.open(targets[engine] || targets.lens, '_blank', 'noopener');
    onClose();
  };

  // Position calculation: keep menu within viewport
  const menuWidth = 185;
  const menuEstimatedHeight = 230;
  const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 800;
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 600;

  let left = Math.min((anchorRect?.right || 0) - menuWidth + 20, viewportWidth - menuWidth - 10);
  if (left < 10) left = 10;

  // Open upwards if not enough room below the trigger button
  const spaceBelow = viewportHeight - (anchorRect?.bottom || 0);
  let top = (anchorRect?.bottom || 0) + 4;
  if (spaceBelow < menuEstimatedHeight && (anchorRect?.top || 0) > menuEstimatedHeight) {
    top = Math.max(10, (anchorRect?.top || 0) - menuEstimatedHeight - 4);
  } else {
    top = Math.max(10, Math.min(top, viewportHeight - menuEstimatedHeight - 10));
  }

  const style = {
    position: 'fixed',
    zIndex: 99999,
    left: `${left}px`,
    top: `${top}px`
  };

  const menuContent = (
    <div
      className="card-action-menu"
      ref={menuRef}
      style={style}
      onClick={e => e.stopPropagation()}
    >
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
          <button onClick={() => {
            if (item.site === 'instagram' && navigateToInstagram) {
              navigateToInstagram(postOrPage);
            } else {
              window.open(postOrPage, '_blank', 'noopener');
            }
            onClose();
          }}>
            {item.site === 'x' ? 'Open X post ↗'
              : item.site === 'reddit' ? 'Open Reddit thread ↗'
              : item.site === 'youtube' ? 'Watch on YouTube ↗'
              : item.site === 'tumblr' ? 'Open Tumblr post ↗'
              : item.site === 'instagram' ? 'Open Instagram post in extension view ↗'
              : 'Open source page ↗'}
          </button>
          <button onClick={() => copyText(postOrPage)}>
            Copy source page link
          </button>
        </>
      )}

      {item.site === 'instagram' && (
        <>
          {item.author && (
            <button onClick={() => {
              if (navigateToInstagram) navigateToInstagram(getInstagramProfileUrl(item.author));
              else window.open(getInstagramProfileUrl(item.author), '_blank', 'noopener');
              onClose();
            }}>
              Open @{item.author} profile in extension view ↗
            </button>
          )}
          {item.hashtags?.length > 0 && (
            <button onClick={() => {
              if (navigateToInstagram) navigateToInstagram(getInstagramHashtagUrl(item.hashtags[0]));
              else window.open(getInstagramHashtagUrl(item.hashtags[0]), '_blank', 'noopener');
              onClose();
            }}>
              Explore #{item.hashtags[0]} in extension view ↗
            </button>
          )}
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
        <>
          <button onClick={() => openReverseSearch('lens', directUrl)}>
            Reverse search (Google Lens)
          </button>
          <button onClick={() => openReverseSearch('yandex', directUrl)}>
            Reverse search (Yandex)
          </button>
        </>
      )}
    </div>
  );

  return createPortal(menuContent, document.body);
}
