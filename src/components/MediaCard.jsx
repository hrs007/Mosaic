import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  filename,
  formatSize,
  formatDuration,
  isItemGif,
  isItemDownloaded,
  getPlayableVideoUrl,
  getGifAnimatedUrl,
  isDisallowedMediaUrl,
  isProfileOrAvatarUrl
} from '../utils/mediaHelpers.js';
import { getSavedObjectUrl } from '../services/storage.js';
import { resolveXVideos } from '../utils/xSyndication.js';
import { DownloadIcon, ResetIcon } from '../constants/icons.jsx';
import CardActionMenu from './CardActionMenu.jsx';

function MediaCard({
  item,
  index,
  observer,
  isFavorited = false,
  isDownloaded = false,
  prefs = {},
  onToggleFavorite,
  onDownloadItem,
  onOpenViewer,
  onShowToast
}) {
  const [resolvedSrc, setResolvedSrc] = useState('');
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [menuRect, setMenuRect] = useState(null);
  const [imgBroken, setImgBroken] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [fallbackIndex, setFallbackIndex] = useState(-1);
  const [retryNonce, setRetryNonce] = useState(0);
  const [videoDuration, setVideoDuration] = useState(item.duration || null);

  const videoRef = useRef(null);
  const retryTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (item.duration && !videoDuration) {
      setVideoDuration(item.duration);
    }
  }, [item.duration, videoDuration]);

  const handleSave = (e) => {
    e.stopPropagation();
    if (isDownloaded) {
      onShowToast?.('Already saved in your Mosaic library.');
    } else {
      onDownloadItem?.(item);
    }
  };

  // Determine media dimension aspect ratio
  const ratio = item.width && item.height ? item.width / item.height : 0;
  const ratioClass = ratio > 1.12 ? 'landscape' : ratio < 0.88 && ratio > 0 ? 'portrait' : ratio > 0 ? 'square' : '';

  const isGif = isItemGif(item);
  const playableUrl = item.savedFile ? (resolvedSrc || getPlayableVideoUrl(item)) : getPlayableVideoUrl(item);
  const isVideo = item.type === 'video' || Boolean(playableUrl);
  const gifAnimatedUrl = isGif ? getGifAnimatedUrl(item) : '';
  const poster = item.poster || item.previewUrl || item.thumbnail || item.previewImage;

  // Track video poster and playable URL with fallbacks
  const [posterSrc, setPosterSrc] = useState(poster || '');
  const [posterBroken, setPosterBroken] = useState(false);
  const [posterFallbackIndex, setPosterFallbackIndex] = useState(-1);
  const [posterRetryCount, setPosterRetryCount] = useState(0);

  const [currentVideoUrl, setCurrentVideoUrl] = useState(playableUrl || '');
  const [videoFallbackIndex, setVideoFallbackIndex] = useState(-1);

  useEffect(() => {
    setPosterSrc(item.poster || item.previewUrl || item.thumbnail || item.previewImage || '');
    setPosterBroken(false);
    setPosterFallbackIndex(-1);
    setPosterRetryCount(0);
  }, [item.poster, item.previewUrl, item.thumbnail, item.previewImage]);

  useEffect(() => {
    setCurrentVideoUrl(playableUrl || '');
    setVideoFallbackIndex(-1);
  }, [playableUrl]);

  // Resolve object URL for saved library items or animated GIF
  useEffect(() => {
    let active = true;
    if (item.savedFile) {
      getSavedObjectUrl(item).then(url => {
        if (active && url) setResolvedSrc(url);
      });
    } else if (isGif && gifAnimatedUrl && !playableUrl) {
      setResolvedSrc(gifAnimatedUrl);
    } else {
      setResolvedSrc(item.previewUrl || item.url || '');
    }
    setImgBroken(false);
    setIsRetrying(false);
    setRetryCount(0);
    setFallbackIndex(-1);
    return () => { active = false; };
  }, [item.id, item.url, item.previewUrl, isGif, gifAnimatedUrl, playableUrl]);

  // Autoplay GIFs by default in grid view
  useEffect(() => {
    if (isGif && currentVideoUrl && videoRef.current) {
      videoRef.current.muted = true;
      videoRef.current.defaultMuted = true;
      videoRef.current.play().catch(() => {});
    }
  }, [isGif, currentVideoUrl]);

  // Video IntersectionObserver for Grid Autoplay
  useEffect(() => {
    const shouldObserve = (prefs.autoplayMode === 'grid' || isGif) && isVideo && videoRef.current && observer;
    if (shouldObserve) {
      observer.observe(videoRef.current);
      return () => {
        if (videoRef.current) observer.unobserve(videoRef.current);
      };
    }
  }, [prefs.autoplayMode, isGif, isVideo, observer]);

  // Handle image load
  const handleImageLoad = (e) => {
    setImgBroken(false);
    setIsRetrying(false);
    const img = e.target;
    if (img && (!item.width || !item.height)) {
      item.width = img.naturalWidth;
      item.height = img.naturalHeight;
    }
  };

  const MAX_RETRIES = 3;

  // Compute all available unique candidate URLs for this image item
  const imageCandidates = useMemo(() => {
    if (item.savedFile) return [];
    const list = [
      item.url,
      item.previewUrl,
      item.source,
      item.sourceUrl,
      ...(item.fallbackUrls || [])
    ].filter(u => u && typeof u === 'string' && !isDisallowedMediaUrl(u) && !isProfileOrAvatarUrl(u));
    return [...new Set(list)];
  }, [item]);

  const handleImageError = () => {
    // 1. Try untried alternative candidate URLs in sequence
    const currentIdx = imageCandidates.indexOf(resolvedSrc);
    if (currentIdx !== -1 && currentIdx + 1 < imageCandidates.length) {
      setResolvedSrc(imageCandidates[currentIdx + 1]);
      return;
    }
    if (currentIdx === -1 && imageCandidates.length > 0 && resolvedSrc !== imageCandidates[0]) {
      setResolvedSrc(imageCandidates[0]);
      return;
    }

    // 2. Automatic retry with backoff on primary candidate
    if (retryCount < MAX_RETRIES) {
      setIsRetrying(true);
      const delay = Math.min(1000 * Math.pow(1.5, retryCount), 3000) + Math.random() * 200;
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      retryTimerRef.current = setTimeout(() => {
        setIsRetrying(false);
        setRetryCount(prev => prev + 1);
        setRetryNonce(prev => prev + 1);
        if (imageCandidates.length > 0) {
          setResolvedSrc(imageCandidates[0]);
        }
      }, delay);
      return;
    }

    setImgBroken(true);
    setIsRetrying(false);
  };

  const handlePosterError = () => {
    const posterCandidates = [
      item.poster,
      item.previewUrl,
      item.thumbnail,
      item.previewImage,
      item.source,
      ...(item.fallbackUrls || []).filter(u => !/\.(mp4|webm|mov|m4v)(?:[?#]|$)/i.test(u))
    ].filter(u => u && typeof u === 'string' && !isDisallowedMediaUrl(u) && !isProfileOrAvatarUrl(u));
    const unique = [...new Set(posterCandidates)];

    const currentIdx = unique.indexOf(posterSrc);
    if (currentIdx !== -1 && currentIdx + 1 < unique.length) {
      setPosterSrc(unique[currentIdx + 1]);
      return;
    }

    if (posterRetryCount < MAX_RETRIES) {
      const delay = 1000 * (posterRetryCount + 1);
      setTimeout(() => {
        setPosterRetryCount(prev => prev + 1);
        setRetryNonce(prev => prev + 1);
        if (unique.length > 0) setPosterSrc(unique[0]);
      }, delay);
      return;
    }
    setPosterBroken(true);
  };

  const handleVideoError = () => {
    const videoCandidates = [
      currentVideoUrl,
      playableUrl,
      item.sourceUrl,
      item.source,
      item.url,
      ...(item.fallbackUrls || [])
    ].filter(u => u && typeof u === 'string' && (/\.mp4(?:[?#]|$)/i.test(u) || /[?&]format=mp4/i.test(u)));
    const unique = [...new Set(videoCandidates)];

    const currentIdx = unique.indexOf(currentVideoUrl);
    if (currentIdx !== -1 && currentIdx + 1 < unique.length) {
      setCurrentVideoUrl(unique[currentIdx + 1]);
      return;
    }

    if (retryCount < MAX_RETRIES) {
      setIsRetrying(true);
      const delay = Math.min(1000 * Math.pow(1.5, retryCount), 3000);
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      retryTimerRef.current = setTimeout(() => {
        setIsRetrying(false);
        setRetryCount(prev => prev + 1);
        setRetryNonce(prev => prev + 1);
        if (unique.length > 0) setCurrentVideoUrl(unique[0]);
      }, delay);
      return;
    }
    setIsVideoPlaying(false);
  };

  const handleManualRetry = (e) => {
    if (e) e.stopPropagation();
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    setImgBroken(false);
    setPosterBroken(false);
    setIsRetrying(true);
    setRetryCount(0);
    setPosterRetryCount(0);
    setFallbackIndex(-1);
    setPosterFallbackIndex(-1);
    setVideoFallbackIndex(-1);
    setRetryNonce(prev => prev + 1);

    if (item.savedFile) {
      getSavedObjectUrl(item).then(url => {
        if (url) {
          setResolvedSrc(url);
          setIsRetrying(false);
        }
      });
    } else if (isGif && gifAnimatedUrl && !playableUrl) {
      setResolvedSrc(gifAnimatedUrl);
    } else {
      const initial = item.url || item.previewUrl || item.source || '';
      setResolvedSrc(initial);
    }

    if (poster) setPosterSrc(poster);
    if (playableUrl) setCurrentVideoUrl(playableUrl);

    // If this is an X video, fetch fresh syndication video variants
    if (item.site === 'x' && item.type === 'video') {
      resolveXVideos([item]).then(() => {
        const fresh = getPlayableVideoUrl(item);
        if (fresh) setCurrentVideoUrl(fresh);
      }).catch(() => {});
    }

    // Safety timeout in case browser never fires onLoad/onError
    setTimeout(() => {
      setIsRetrying(false);
    }, 8000);
  };

  // Resolve duration for direct playable videos if not provided by scanner
  useEffect(() => {
    if (item.type !== 'video' || videoDuration || item.duration) return;
    if (playableUrl && !item.isEmbed && !playableUrl.includes('youtube') && !playableUrl.includes('#mosaic-video-')) {
      const v = document.createElement('video');
      v.preload = 'metadata';
      v.muted = true;
      v.src = playableUrl;
      const onLoaded = () => {
        if (v.duration && Number.isFinite(v.duration) && v.duration > 0) {
          const d = Math.round(v.duration);
          setVideoDuration(d);
          item.duration = d;
        }
        cleanup();
      };
      const onError = () => cleanup();
      const cleanup = () => {
        v.removeEventListener('loadedmetadata', onLoaded);
        v.removeEventListener('error', onError);
        v.removeAttribute('src');
        v.load();
      };
      v.addEventListener('loadedmetadata', onLoaded, { once: true });
      v.addEventListener('error', onError, { once: true });
      return cleanup;
    }
  }, [item.type, item.isEmbed, playableUrl, videoDuration, item.duration]);

  // File extension badge for saved library cards
  const ext = item.savedFile
    ? (item.fileName || item.sourceUrl || item.url).match(/\.([a-z0-9]{3,4})(?:[?#]|$)/i)?.[1]?.toUpperCase()
    : '';

  const durationFormatted = formatDuration(videoDuration || item.duration);

  // Meta text
  const metaText = item.savedFile
    ? [
        item.type === 'video' ? 'VIDEO' : 'IMAGE',
        durationFormatted,
        item.site?.toUpperCase(),
        item.savedAt ? new Date(item.savedAt).toLocaleDateString() : '',
        prefs.sizes && item.size ? formatSize(item.size) : ''
      ].filter(Boolean).join(' · ')
    : [
        item.type === 'video' ? 'VIDEO' : 'IMAGE',
        durationFormatted,
        prefs.dimensions && item.width && item.height ? `${item.width} × ${item.height}` : '',
        prefs.sizes && item.size ? formatSize(item.size) : ''
      ].filter(Boolean).join(' · ');

  if (isDisallowedMediaUrl(item?.url)) return null;

  return (
    <article
      className={`media-card ${item.savedFile ? 'saved-library-card' : ''} ${isDownloaded ? 'is-downloaded' : ''}`}
      data-id={item.id}
    >
      <div
        className={`media-thumb ${ratioClass}`}
        style={item.width && item.height ? { '--ratio': `${item.width}/${item.height}` } : undefined}
        onClick={() => onOpenViewer?.(index)}
        onMouseEnter={() => {
          setIsHovered(true);
          if (isVideo && videoRef.current && playableUrl) {
            videoRef.current.muted = true;
            videoRef.current.defaultMuted = true;
            const playPromise = videoRef.current.play();
            if (playPromise !== undefined) {
              playPromise.catch(() => {});
            }
          }
        }}
        onMouseLeave={() => {
          setIsHovered(false);
          if (!isGif && prefs.autoplayMode !== 'grid' && isVideo && videoRef.current) {
            videoRef.current.pause();
            try {
              videoRef.current.currentTime = 0;
            } catch {}
            setIsVideoPlaying(false);
          }
        }}
      >
        {/* Badges */}
        {item.savedFile ? (
          <span className="media-type-badge">
            {ext || (isVideo ? 'VIDEO' : 'IMAGE')}
          </span>
        ) : isDownloaded ? (
          <span className="downloaded-badge" title="Already saved in your Mosaic downloads">
            ✓ Saved
          </span>
        ) : null}

        {isGif && (
          <span className="gif-badge">GIF</span>
        )}

        {/* Video Duration Badge (hidden for looping GIFs) */}
        {isVideo && !isGif && durationFormatted && (
          <span className="video-duration-badge" title={`Duration: ${durationFormatted}`}>
            {durationFormatted}
          </span>
        )}

        {/* Video or Image Presentation */}
        {isVideo ? (
          <>
            {posterSrc ? (
              <img
                key={`poster-${retryNonce}-${posterSrc}`}
                src={posterSrc}
                alt={item.alt || 'Video poster'}
                referrerPolicy="no-referrer"
                loading={retryNonce > 0 ? 'eager' : 'lazy'}
                decoding="async"
                className={`${item.savedFile ? 'saved-video-poster' : ''} ${posterBroken ? 'broken' : ''}`}
                onError={handlePosterError}
                onLoad={() => setPosterBroken(false)}
              />
            ) : (
              <div className="video-placeholder">
                <span>▶</span>
                <small>{isGif ? 'GIF' : 'VIDEO'}</small>
              </div>
            )}

            {/* Play Badge on Poster (hidden for GIFs or while video is playing) */}
            {prefs.autoplayMode !== 'grid' && !isGif && !isVideoPlaying && (
              <span className="play-badge">▶</span>
            )}

            {/* Seamless Preloaded Video / GIF Player */}
            {currentVideoUrl && (
              <video
                ref={videoRef}
                key={`vid-${retryNonce}-${currentVideoUrl}`}
                className={`card-video-player ${isVideoPlaying || isGif ? 'is-playing' : ''} ${isGif ? 'is-gif' : ''}`}
                src={currentVideoUrl}
                referrerPolicy="no-referrer"
                muted
                defaultMuted
                playsInline
                loop
                autoPlay={isGif}
                preload={isGif ? 'auto' : 'metadata'}
                data-is-gif={isGif ? 'true' : 'false'}
                onError={handleVideoError}
                onPlaying={() => {
                  setIsRetrying(false);
                  setIsVideoPlaying(true);
                }}
                onPause={() => {
                  if (!isGif && !isHovered && prefs.autoplayMode !== 'grid') {
                    setIsVideoPlaying(false);
                  }
                }}
                onLoadedMetadata={(e) => {
                  if (e.target.duration && Number.isFinite(e.target.duration) && e.target.duration > 0) {
                    const d = Math.round(e.target.duration);
                    setVideoDuration(d);
                    item.duration = d;
                  }
                }}
              />
            )}
          </>
        ) : (
          <img
            key={`img-${retryNonce}-${resolvedSrc || item.url}`}
            src={resolvedSrc || gifAnimatedUrl || item.url || item.previewUrl || ''}
            alt={item.alt || ''}
            referrerPolicy="no-referrer"
            loading={retryNonce > 0 ? 'eager' : 'lazy'}
            decoding="async"
            className={imgBroken ? 'broken' : ''}
            onLoad={handleImageLoad}
            onError={handleImageError}
          />
        )}

        {/* Failed to load with retry button */}
        {(imgBroken || (isVideo && posterBroken && !isVideoPlaying)) && (
          <div className="card-broken-overlay" onClick={e => e.stopPropagation()}>
            <span className="broken-icon" aria-hidden="true">⚠</span>
            <span className="broken-text">Failed to load</span>
            <button className="card-retry-btn" onClick={handleManualRetry} title="Retry loading media">
              <ResetIcon size={11} />
              <span>Retry</span>
            </button>
          </div>
        )}

        {/* Automatic Retrying Pill */}
        {isRetrying && (
          <div className="card-retrying-pill">
            <span className="retrying-spinner">↺</span>
            <span>Retrying…</span>
          </div>
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
              onToggleFavorite?.(item.id);
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
          aria-label="More actions"
          onClick={e => {
            e.stopPropagation();
            const rect = e.currentTarget?.getBoundingClientRect() || null;
            setMenuRect(prev => (prev ? null : rect));
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
          onOpenViewer={() => onOpenViewer?.(index)}
        />
      )}
    </article>
  );
}

export default React.memo(MediaCard);
