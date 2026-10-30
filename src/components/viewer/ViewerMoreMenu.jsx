import React from 'react';

export default function ViewerMoreMenu({
  menuRef,
  moreMenuRect,
  onClose,
  item,
  directUrl,
  postOrPage,
  isDirectValid,
  isPostDifferent,
  onCopyText,
  onReverseSearch,
  onRemoveSavedFile
}) {
  if (!moreMenuRect) return null;

  return (
    <div
      className="card-action-menu viewer-action-menu"
      ref={menuRef}
      style={{
        position: 'fixed',
        zIndex: 2200,
        left: `${Math.min((moreMenuRect?.right || 0) - 230, window.innerWidth - 238)}px`,
        top: `${Math.max(8, (moreMenuRect?.top || 0) - 200)}px`
      }}
    >
      {isDirectValid && (
        <>
          <button onClick={() => { window.open(directUrl, '_blank', 'noopener'); onClose(); }}>
            Open direct media link ↗
          </button>
          <button onClick={() => onCopyText(directUrl)}>
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
          <button onClick={() => onCopyText(postOrPage)}>
            Copy source page link
          </button>
        </>
      )}

      {item.type === 'image' && isDirectValid && (
        <>
          <button onClick={() => onReverseSearch('lens', directUrl)}>
            Search with Google Lens
          </button>
          <button onClick={() => onReverseSearch('yandex', directUrl)}>
            Search with Yandex Images
          </button>
          <button onClick={() => onReverseSearch('bing', directUrl)}>
            Search with Bing Visual Search
          </button>
          <button onClick={() => onReverseSearch('tineye', directUrl)}>
            Search with TinEye
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
          <button onClick={() => { onRemoveSavedFile(item); onClose(); }}>
            Remove from Saved
          </button>
        </>
      ) : null}
    </div>
  );
}
