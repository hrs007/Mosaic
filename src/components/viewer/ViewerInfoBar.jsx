import React from 'react';
import { filename, formatSize } from '../../utils/mediaHelpers.js';
import { FitIcon } from '../../constants/icons.jsx';

export default function ViewerInfoBar({
  item,
  isEmbed,
  isFill,
  isDownloaded,
  onToggleFitMode,
  onDownloadItem,
  onMoreClick
}) {
  return (
    <div className="viewer-info" id="viewerInfo">
      <div className="viewer-info-title">
        <span title={item.alt || filename(item.url)}>
          {item.alt || filename(item.url)}
        </span>
        <small>
          {item.width || '—'} × {item.height || '—'}
          {item.size ? ` · ${formatSize(item.size)}` : ''}
        </small>
      </div>

      <div className="viewer-info-actions">
        {item.site === 'youtube' && (
          <button
            id="viewerOpenSource"
            className="viewer-ctrl-btn viewer-ctrl-pill"
            onClick={() => window.open(item.postUrl || item.pageUrl, '_blank', 'noopener')}
          >
            Watch on YouTube ↗
          </button>
        )}

        {!isEmbed && (
          <button
            className={`viewer-ctrl-btn viewer-fit-toggle ${isFill ? 'active' : ''}`}
            title={isFill ? `Fit ${item.type} in viewer` : `Fill viewer with ${item.type}`}
            onClick={onToggleFitMode}
          >
            <FitIcon />
          </button>
        )}

        <button
          id="viewerDownload"
          className="viewer-ctrl-btn viewer-ctrl-pill"
          disabled={isDownloaded}
          title={isDownloaded ? 'Already saved in your Mosaic downloads' : undefined}
          onClick={() => onDownloadItem(item)}
        >
          {isDownloaded ? '✓ Saved' : '＋ Save file'}
        </button>

        <button
          id="viewerMore"
          className="viewer-ctrl-btn"
          aria-label="More media actions"
          title="More media actions"
          onClick={onMoreClick}
        >
          ···
        </button>
      </div>
    </div>
  );
}
