import React, { useState, useEffect, useRef } from 'react';
import { useGallery } from '../context/GalleryContext.jsx';
import {
  filename,
  formatSize,
  isItemGif,
  isItemDownloaded,
  getPlayableVideoUrl
} from '../utils/mediaHelpers.js';
import { getSavedObjectUrl } from '../services/storage.js';
import { DownloadIcon } from '../constants/icons.jsx';
import CardActionMenu from './CardActionMenu.jsx';

function MediaCard({ item, index, observer }) {
  const {
    prefs,
    favorites,
    savedFiles,
    toggleFavorite,
    downloadItem,
    showToast,
    openViewer
  } = useGallery();

  const [resolvedSrc, setResolvedSrc] = useState('');
  const [hoverPreview, setHoverPreview] = useState(false);
  const [menuRect, setMenuRect] = useState(null);
  const [imgBroken, setImgBroken] = useState(false);

  const videoRef = useRef(null);
  const isFavorited = favorites.has(item.id);
  const isDownloaded = isItemDownloaded(item, savedFiles);

  const handleSave = (e) => {
    e.stopPropagation();
    if (isDownloaded) {
      showToast('Already saved in your Mosaic library.');
    } else {
      downloadItem(item);
    }
  };

  // Determine media dimension aspect ratio
  const ratio = item.width && item.height ? item.width / item.height : 0;
  const ratioClass = ratio > 1.12 ? 'landscape' : ratio < 0.88 && ratio > 0 ? 'portrait' : ratio > 0 ? 'square' : '';

  // Resolve object URL for saved library items
  useEffect(() => {
    let active = true;
    if (item.savedFile) {
      getSavedObjectUrl(item).then(url => {
        if (active && url) setResolvedSrc(url);
      });
    } else {
      setResolvedSrc(item.previewUrl || item.url || '');
    }
    return () => { active = false; };
  }, [item]);

  // Video IntersectionObserver for Grid Autoplay
  useEffect(() => {
    if (prefs.autoplayMode === 'grid' && item.type === 'video' && videoRef.current && observer) {
      observer.observe(videoRef.current);
      return () => {
        if (videoRef.current) observer.unobserve(videoRef.current);
      };
    }
  }, [prefs.autoplayMode, item.type, observer]);

  // Handle image load
  const handleImageLoad = (e) => {
    const img = e.target;
    if (img && (!item.width || !item.height)) {
      item.width = img.naturalWidth;
      item.height = img.naturalHeight;
    }
  };

  const handleImageError = () => {
    if (!item.savedFile && item.previewUrl && resolvedSrc !== item.url) {
      setResolvedSrc(item.url);
      return;
    }
    setImgBroken(true);
  };

  const playableUrl = getPlayableVideoUrl(item) || resolvedSrc;
  const poster = item.poster || item.thumbnail || item.previewImage;

  // File extension badge for saved library cards
  const ext = item.savedFile
    ? (item.fileName || item.sourceUrl || item.url).match(/\.([a-z0-9]{3,4})(?:[?#]|$)/i)?.[1]?.toUpperCase()
    : '';

  // Meta text
  const metaText = item.savedFile
    ? [
        item.type === 'video' ? 'VIDEO' : 'IMAGE',
        item.site?.toUpperCase(),
        item.savedAt ? new Date(item.savedAt).toLocaleDateString() : '',
        prefs.sizes && item.size ? formatSize(item.size) : ''
      ].filter(Boolean).join(' · ')
    : `${item.type === 'video' ? 'VIDEO' : 'IMAGE'}${prefs.dimensions && item.width && item.height ? ` · ${item.width} × ${item.height}` : ''}${prefs.sizes && item.size ? ` · ${formatSize(item.size)}` : ''}`;

  return (
    <article
      className={`media-card ${item.savedFile ? 'saved-library-card' : ''} ${isDownloaded ? 'is-downloaded' : ''}`}
      data-id={item.id}
    >
      <div
        className={`media-thumb ${ratioClass}`}
        style={item.width && item.height ? { '--ratio': `${item.width}/${item.height}` } : undefined}
        onClick={() => openViewer(index)}
        onMouseEnter={() => {
          if (prefs.autoplayMode === 'hover' && item.type === 'video') {
            setHoverPreview(true);
          }
        }}
        onMouseLeave={() => {
          if (hoverPreview) setHoverPreview(false);
        }}
      >
        {/* Badges */}
        {item.savedFile ? (
          <span className="media-type-badge">
            {ext || (item.type === 'video' ? 'VIDEO' : 'IMAGE')}
          </span>
        ) : isDownloaded ? (
          <span className="downloaded-badge" title="Already saved in your Mosaic downloads">
            ✓ Saved
          </span>
        ) : null}

        {item.type !== 'video' && isItemGif(item) && (
          <span className="gif-badge">GIF</span>
        )}

        {/* Video or Image Presentation */}
        {item.type === 'video' ? (
          <>
            {poster ? (
              <img
                src={poster}
                alt={item.alt || 'Video poster'}
                referrerPolicy="no-referrer"
                decoding="async"
                className={item.savedFile ? 'saved-video-poster' : ''}
              />
            ) : (
              <div className="video-placeholder">
                <span>▶</span>
                <small>VIDEO</small>
              </div>
            )}

            {prefs.autoplayMode !== 'grid' && (
              <span className="play-badge">▶</span>
            )}

            {/* Grid Autoplay Video */}
            {prefs.autoplayMode === 'grid' && playableUrl && (
              <video
                ref={videoRef}
                className="grid-card-video"
                src={playableUrl}
                referrerPolicy="no-referrer"
                muted
                playsInline
                loop
                preload="metadata"
                autoPlay
              />
            )}

            {/* Hover Preview Video */}
            {hoverPreview && playableUrl && (
              <video
                className="hover-preview-video"
                src={playableUrl}
                referrerPolicy="no-referrer"
                muted
                playsInline
                loop
                preload="auto"
                autoPlay
              />
            )}
          </>
        ) : (
          <img
            src={resolvedSrc || item.previewUrl || item.url}
            alt={item.alt || ''}
            referrerPolicy="no-referrer"
            decoding="async"
            className={imgBroken ? 'broken' : ''}
            onLoad={handleImageLoad}
            onError={handleImageError}
          />
        )}

        {/* Hover View Hint */}
        <div className="card-hover">
          <span className="open-hint">↗ &nbsp; View</span>
        </div>

        {/* Quick Save Button (only when not already saved) */}
        {!item.savedFile && !isDownloaded && (
          <button
            className="card-save-button"
            title="Save to Mosaic library"
            aria-label="Save to Mosaic library"
            onClick={handleSave}
          >
            <DownloadIcon size={14} />
          </button>
        )}

        {/* Favorite Button */}
        {!item.savedFile && (
          <button
            className={`favorite-button ${isFavorited ? 'favorited' : ''}`}
            title="Save favorite"
            onClick={e => {
              e.stopPropagation();
              toggleFavorite(item.id);
            }}
          >
            {isFavorited ? '♥' : '♡'}
          </button>
        )}
      </div>

      {/* Info bar */}
      <div className="card-info">
        <span
          className="card-name"
          title={item.fileName || item.alt || filename(item.url)}
        >
          {item.fileName || item.alt || filename(item.url)}
        </span>

        <span className="card-meta">
          {metaText}
        </span>

        {item.downloadId && item.type === 'video' && (
          <button
            className="card-more saved-play"
            title="Open saved video"
            aria-label="Open saved video"
            onClick={e => {
              e.stopPropagation();
              chrome.downloads?.open(item.downloadId);
            }}
          >
            ▶
          </button>
        )}

        {item.downloadId && (
          <button
            className="card-more saved-reveal"
            title="Show in Finder"
            aria-label="Show downloaded file in Finder"
            onClick={e => {
              e.stopPropagation();
              chrome.downloads?.show(item.downloadId);
            }}
          >
            ▣
          </button>
        )}

        <button
          className="card-more"
          title="More actions"
          onClick={e => {
            e.stopPropagation();
            setMenuRect(e.currentTarget.getBoundingClientRect());
          }}
        >
          ···
        </button>
      </div>

      {menuRect && (
        <CardActionMenu
          item={item}
          anchorRect={menuRect}
          onClose={() => setMenuRect(null)}
          onOpenViewer={() => openViewer(index)}
        />
      )}
    </article>
  );
}

export default React.memo(MediaCard);
