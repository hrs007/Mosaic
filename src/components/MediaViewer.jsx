import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useGallery } from '../context/GalleryContext.jsx';
import {
  filename,
  formatSize,
  isItemDownloaded,
  getPlayableVideoUrl,
  isItemGif,
  getGifAnimatedUrl,
  isDisallowedMediaUrl,
  isProfileOrAvatarUrl,
  canonicalMediaId,
  getRedditPostId,
  getInstagramMediaCode,
  parseRedditResolution,
  isDirectPlayableVideo
} from '../utils/mediaHelpers.js';
import { getSavedObjectUrl } from '../services/storage.js';
import { resolveXVideos } from '../utils/xSyndication.js';
import { ResetIcon } from '../constants/icons.jsx';
import {
  ViewerVideoControls,
  ViewerInfoBar,
  ViewerToolsDrawer
} from './viewer/index.js';

export default function MediaViewer() {
  const {
    filtered,
    viewerIndex,
    openViewer,
    closeViewer,
    navigateViewer,
    prefs,
    setPrefs,
    favorites,
    toggleFavorite,
    savedFiles,
    downloadItem,
    removeSavedFile,
    showToast,
    navigateToInstagram,
    navigateToSocial
  } = useGallery();

  const item = filtered[viewerIndex];

  const [resolvedUrl, setResolvedUrl] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isLooping, setIsLooping] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [fitMode, setFitMode] = useState(prefs.viewerFit || 'fit');
  const [isToolsOpen, setIsToolsOpen] = useState(false);
  const [videoFullscreen, setVideoFullscreen] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);

  // Auto-retry & error state
  const [viewerError, setViewerError] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [fallbackIndex, setFallbackIndex] = useState(-1);
  const [videoFallbackIndex, setVideoFallbackIndex] = useState(-1);
  const [retryNonce, setRetryNonce] = useState(0);

  const videoRef = useRef(null);
  const menuRef = useRef(null);
  const videoStageRef = useRef(null);
  const retryTimerRef = useRef(null);

  const isGif = isItemGif(item);
  const playableUrl = item?.savedFile ? (resolvedUrl || getPlayableVideoUrl(item)) : getPlayableVideoUrl(item);
  const [currentVideoUrl, setCurrentVideoUrl] = useState(playableUrl || '');
  const isVideo = item?.type === 'video' || Boolean(playableUrl);
  const isEmbed = Boolean(
    item?.isEmbed ||
    item?.site === 'youtube' ||
    (item?.playbackPage && /redgifs\.com\/ifr\/|streamable\.com\/e\/|giphy\.com\/embed\/|youtube\.com\/embed\/|youtu\.be/i.test(item.playbackPage))
  );
  const isXFallback = item?.site === 'x' && item?.type === 'video' && item?.playbackPage && !playableUrl;
  const isInstagramFallback = item?.site === 'instagram' && item?.type === 'video' && !playableUrl;
  const isDownloaded = item ? isItemDownloaded(item, savedFiles) : false;
  const gifAnimatedUrl = isGif ? getGifAnimatedUrl(item) : '';

  const isLikelyImageUrl = (u) => {
    if (!u || typeof u !== 'string') return false;
    if (/^data:image\//i.test(u)) return true;
    if (/\.(jpe?g|png|webp|avif|heic)(?:[?#]|$)/i.test(u)) return !isDirectPlayableVideo(u);
    if (isDirectPlayableVideo(u)) return false;
    if (/(?:cdninstagram\.com|fbcdn\.net)\/.*(?:[?&]stp=dst-jpg|\/t51\.|\.jpg|\.webp)/i.test(u)) return true;
    if (/(?:cdninstagram\.com|fbcdn\.net)/i.test(u) && !/\.(mp4|webm|mov)(?:[?#]|$)/i.test(u) && !/[?&]format=mp4/i.test(u)) return true;
    return false;
  };
  const viewerPoster = [
    [item?.poster, true], [item?.thumbnail, true], [item?.previewImage, true], [item?.previewUrl, true],
    [item?.url, false], [item?.source, false], ...(item?.fallbackUrls || []).map(url => [url, false])
  ].find(([url, explicit]) => {
    if (!url || typeof url !== 'string' || isDisallowedMediaUrl(url) || isProfileOrAvatarUrl(url) || isDirectPlayableVideo(url)) return false;
    if (/^data:image\/svg\+xml/i.test(url) || /instagram\.com\/(?:p|reel|reels)\//i.test(url)) return false;
    return isLikelyImageUrl(url) || (explicit && /^https?:\/\//i.test(url));
  })?.[0] || '';

  // Video resolution variants
  const videoVariants = useMemo(() => {
    if (!item) return [];
    if (Array.isArray(item?.videoVariants) && item.videoVariants.length > 0) {
      return item.videoVariants;
    }
    const rawUrls = [
      item?.url,
      item?.source,
      item?.sourceUrl,
      ...(item?.fallbackUrls || [])
    ].filter(u => typeof u === 'string' && isDirectPlayableVideo(u));
    const unique = [...new Set(rawUrls)];
    if (unique.length <= 1) return [];

    const withRes = unique.map(u => {
      let res = parseRedditResolution(u);
      if (!res) {
        const m = u.match(/\/vid\/(?:avc1\/)?(\d+)x(\d+)\//i);
        if (m) res = Math.min(parseInt(m[1], 10), parseInt(m[2], 10));
      }
      return { url: u, res };
    }).sort((a, b) => b.res - a.res);

    return withRes.map((v, i) => ({
      url: v.url,
      label: v.res ? `${v.res}p` : `Quality ${withRes.length - i}`,
      res: v.res
    }));
  }, [item]);

  // Reddit & Tumblr gallery sibling navigation
  const gallerySiblings = useMemo(() => {
    if (!item?.postId) return [];
    if (item.site === 'reddit') {
      const pId = String(item.postId).replace(/^t3_/, '').toLowerCase();
      return filtered
        .map((m, idx) => ({ item: m, index: idx }))
        .filter(x => {
          const otherId = x.item.postId
            ? String(x.item.postId).replace(/^t3_/, '').toLowerCase()
            : getRedditPostId(x.item.postUrl || x.item.url);
          return otherId === pId;
        });
    }
    if (item.site === 'tumblr') {
      const pId = String(item.postId || getInstagramMediaCode(item.postUrl || item.pageUrl || item.url)).toLowerCase();
      if (!pId) return [];
      return filtered
        .map((m, idx) => ({ item: m, index: idx }))
        .filter(x => x.item.site === 'tumblr' && String(x.item.postId || '').toLowerCase() === pId);
    }
    if (item.site === 'instagram') {
      const pId = String(item.postId || getInstagramMediaCode(item.postUrl || item.pageUrl || item.url)).toLowerCase();
      if (!pId) return [];
      const siblings = filtered
        .map((m, idx) => ({ item: m, index: idx }))
        .filter(x => x.item.site === 'instagram' && String(x.item.postId || getInstagramMediaCode(x.item.postUrl || x.item.pageUrl || x.item.url)).toLowerCase() === pId);
      return siblings.sort((a, b) => {
        const idxA = typeof a.item.galleryIndex === 'number' ? a.item.galleryIndex : 0;
        const idxB = typeof b.item.galleryIndex === 'number' ? b.item.galleryIndex : 0;
        return idxA - idxB;
      });
    }
    return [];
  }, [item?.postId, item?.site, filtered]);

  const currentGalleryPos = useMemo(() => {
    if (!gallerySiblings.length) return -1;
    return gallerySiblings.findIndex(s => s.index === viewerIndex);
  }, [gallerySiblings, viewerIndex]);

  // Close tools drawer on Escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isToolsOpen) {
        e.stopPropagation();
        setIsToolsOpen(false);
      }
    };
    if (isToolsOpen) {
      window.addEventListener('keydown', handleKeyDown, true);
      return () => window.removeEventListener('keydown', handleKeyDown, true);
    }
  }, [isToolsOpen]);

  // Clean up retry timer on unmount
  useEffect(() => {
    return () => {
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    };
  }, []);

  // Reset retry/error states when item or playableUrl changes
  useEffect(() => {
    setViewerError(false);
    setIsRetrying(false);
    setRetryCount(0);
    setFallbackIndex(-1);
    setVideoFallbackIndex(-1);
    setRetryNonce(0);
    setCurrentVideoUrl(playableUrl || '');
  }, [item?.id, playableUrl]);

  // Resolve object URL for saved file or animated GIF
  useEffect(() => {
    let active = true;
    if (!item || isDisallowedMediaUrl(item?.url)) return;

    if (item.savedFile) {
      getSavedObjectUrl(item).then(url => {
        if (active && url) setResolvedUrl(url);
      });
    } else if (isGif && gifAnimatedUrl && !isVideo) {
      setResolvedUrl(gifAnimatedUrl);
    } else {
      setResolvedUrl(item.url || '');
    }
    return () => { active = false; };
  }, [item, isGif, gifAnimatedUrl, isVideo]);

  const MAX_RETRIES = 3;

  const handleImageError = () => {
    // 1. Try alternative source (previewUrl -> direct url or vice versa)
    if (!item?.savedFile && item?.previewUrl && resolvedUrl === item.previewUrl && item.url && item.url !== item.previewUrl) {
      setResolvedUrl(item.url);
      return;
    }
    // 1. Try alternative candidate URLs
    const imageCandidates = [
      resolvedUrl,
      item?.url,
      item?.previewUrl,
      item?.source,
      item?.sourceUrl,
      ...(item?.fallbackUrls || [])
    ].filter(u => u && typeof u === 'string' && !isDisallowedMediaUrl(u) && !isProfileOrAvatarUrl(u));
    const unique = [...new Set(imageCandidates)];

    const currentIdx = unique.indexOf(resolvedUrl);
    if (currentIdx !== -1 && currentIdx + 1 < unique.length) {
      setResolvedUrl(unique[currentIdx + 1]);
      return;
    }
    if (currentIdx === -1 && unique.length > 0 && resolvedUrl !== unique[0]) {
      setResolvedUrl(unique[0]);
      return;
    }

    // 2. Automatic retry with exponential backoff
    if (retryCount < MAX_RETRIES) {
      setIsRetrying(true);
      const delay = Math.min(1000 * Math.pow(1.5, retryCount), 3000) + Math.random() * 200;
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      retryTimerRef.current = setTimeout(() => {
        setIsRetrying(false);
        setRetryCount(prev => prev + 1);
        setRetryNonce(prev => prev + 1);
        if (unique.length > 0) setResolvedUrl(unique[0]);
      }, delay);
      return;
    }

    setViewerError(true);
    setIsRetrying(false);
  };

  const handleVideoError = () => {
    // 1. Try video fallbacks
    const videoCandidates = [
      currentVideoUrl,
      playableUrl,
      item?.sourceUrl,
      item?.source,
      item?.url,
      ...(item?.fallbackUrls || [])
    ].filter(u => u && typeof u === 'string' && isDirectPlayableVideo(u));
    const unique = [...new Set(videoCandidates)];

    const currentIdx = unique.indexOf(currentVideoUrl);
    if (currentIdx !== -1 && currentIdx + 1 < unique.length) {
      setCurrentVideoUrl(unique[currentIdx + 1]);
      return;
    }

    setViewerError(true);
    setIsRetrying(false);
  };

  const handleViewerRetry = (e) => {
    if (e) e.stopPropagation();
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    setViewerError(false);
    setIsRetrying(true);
    setRetryCount(0);
    setFallbackIndex(-1);
    setVideoFallbackIndex(-1);
    setRetryNonce(prev => prev + 1);

    if (item?.savedFile) {
      getSavedObjectUrl(item).then(url => {
        if (url) {
          setResolvedUrl(url);
          setIsRetrying(false);
        }
      });
    } else if (isGif && gifAnimatedUrl && !isVideo) {
      setResolvedUrl(gifAnimatedUrl);
    } else if (item?.site === 'instagram' && item?.type === 'video') {
      const retryUrl = isDirectPlayableVideo(playableUrl) ? playableUrl : (item?.source || item?.url || '');
      setCurrentVideoUrl(retryUrl);
      setResolvedUrl(item?.poster || item?.previewUrl || '');
    } else {
      setResolvedUrl(item?.url || item?.previewUrl || item?.source || '');
    }

    if (playableUrl) setCurrentVideoUrl(playableUrl);

    // If this is an X video, re-resolve tweet variants
    if (item?.site === 'x' && item?.type === 'video') {
      resolveXVideos([item]).then(() => {
        const fresh = getPlayableVideoUrl(item);
        if (fresh) setCurrentVideoUrl(fresh);
      }).catch(() => {});
    }

    setTimeout(() => {
      setIsRetrying(false);
    }, 8000);
  };

  const getBustedUrl = (base) => {
    return base || '';
  };

  // Autoplay video on load
  useEffect(() => {
    if (isVideo && videoRef.current && !isEmbed && !isXFallback && !isInstagramFallback) {
      if (isGif || prefs.autoplayViewer) {
        if (isGif) {
          videoRef.current.muted = true;
          videoRef.current.defaultMuted = true;
        }
        videoRef.current.play().catch(() => {});
      } else {
        videoRef.current.pause();
      }
    }
  }, [item, isVideo, isGif, isEmbed, isXFallback, isInstagramFallback, prefs.autoplayViewer]);

  const handlePlayToggle = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play().catch(() => {});
    } else {
      videoRef.current.pause();
    }
  };

  const handleMuteToggle = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !videoRef.current.muted;
    setIsMuted(videoRef.current.muted);
  };

  const handleLoopToggle = () => {
    setIsLooping(prev => !prev);
  };

  const handleAutoplayToggle = () => {
    const next = !prefs.autoplayViewer;
    setPrefs({ autoplayViewer: next });
    showToast(`Viewer autoplay: ${next ? 'ON' : 'OFF'}`);
  };

  const handleFullscreenVideo = () => {
    const video = videoRef.current;
    if (!video) return;
    const isFullscreen = Boolean(
      document.fullscreenElement === video ||
      document.fullscreenElement === videoStageRef.current ||
      document.webkitFullscreenElement === video ||
      document.webkitFullscreenElement === videoStageRef.current ||
      video.webkitDisplayingFullscreen
    );
    if (isFullscreen) {
      try {
        const exit = document.exitFullscreen || document.webkitExitFullscreen;
        const result = exit?.call(document);
        result?.catch?.(() => {});
      } catch {}
      return;
    }

    const handleFailure = (error) => {
      // Some browsers permit fullscreening a video but deny arbitrary elements
      // inside an embed. Try the native video path before giving up.
      try {
        if (video.requestFullscreen) {
          video.requestFullscreen().catch(() => showToast('Fullscreen is blocked by the embedding page'));
        } else if (video.webkitEnterFullscreen) {
          video.webkitEnterFullscreen();
        } else {
          showToast('Fullscreen is blocked by the embedding page');
        }
      } catch {
        showToast('Fullscreen is blocked by the embedding page');
      }
      console.warn('Mosaic video fullscreen request failed:', error);
    };

    // The stage keeps Mosaic controls visible where the browser permits it.
    // Call directly from the click handler to preserve the user gesture.
    const target = videoStageRef.current || video;
    try {
      const request = target.requestFullscreen || target.webkitRequestFullscreen;
      if (request) {
        const result = request.call(target);
        result?.catch?.(handleFailure);
      } else if (video.webkitEnterFullscreen) {
        video.webkitEnterFullscreen();
      } else if (video.requestFullscreen) {
        video.requestFullscreen().catch(handleFailure);
      } else {
        showToast('Fullscreen is not supported by this browser');
      }
    } catch (error) {
      handleFailure(error);
    }
  };

  useEffect(() => {
    const syncFullscreen = () => {
      const video = videoRef.current;
      setVideoFullscreen(Boolean(
        document.fullscreenElement === video ||
        document.fullscreenElement === videoStageRef.current ||
        document.webkitFullscreenElement === video ||
        document.webkitFullscreenElement === videoStageRef.current ||
        video?.webkitDisplayingFullscreen
      ));
    };

    document.addEventListener('fullscreenchange', syncFullscreen);
    document.addEventListener('webkitfullscreenchange', syncFullscreen);
    videoRef.current?.addEventListener('webkitbeginfullscreen', syncFullscreen);
    videoRef.current?.addEventListener('webkitendfullscreen', syncFullscreen);
    return () => {
      document.removeEventListener('fullscreenchange', syncFullscreen);
      document.removeEventListener('webkitfullscreenchange', syncFullscreen);
      videoRef.current?.removeEventListener('webkitbeginfullscreen', syncFullscreen);
      videoRef.current?.removeEventListener('webkitendfullscreen', syncFullscreen);
    };
  }, [item, currentVideoUrl, retryNonce]);

  const handleTogglePip = async () => {
    const video = videoRef.current;
    if (!video) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (video.requestPictureInPicture) {
        await video.requestPictureInPicture();
      }
    } catch {
      showToast('Picture-in-Picture not available');
    }
  };

  const handleSelectPlaybackRate = (rate) => {
    setPlaybackRate(rate);
    if (videoRef.current) {
      videoRef.current.playbackRate = rate;
    }
    showToast(`Playback speed: ${rate}x`);
  };

  const toggleFitMode = () => {
    setFitMode(prev => {
      const next = prev === 'fill' ? 'fit' : 'fill';
      setPrefs({ viewerFit: next });
      return next;
    });
  };

  const directUrl = item?.site === 'reddit'
    ? [item.url, item.source, ...(item.fallbackUrls || [])].find(url => url && (/^https?:\/\/(?:i|preview|external-preview)\.redd\.it\//i.test(url) || /^https?:\/\/v\.redd\.it\//i.test(url) || /[?&]format=mp4(?:&|$)/i.test(url) || /\.(?:jpe?g|png|webp|avif|gif|mp4|webm)(?:[?#]|$)/i.test(url)) && !/reddit\.com\/(?:comments|user|r)\//i.test(url)) || ''
    : item?.source || item?.url || '';
  const postOrPage = item?.postUrl || item?.pageUrl || '';
  const isDirectValid = directUrl && !/^(blob|data):/i.test(directUrl);
  const isPostDifferent = postOrPage && postOrPage !== directUrl;

  const copyText = (txt, label = 'Link') => {
    if (!txt) return;
    navigator.clipboard?.writeText(txt).then(() => {
      showToast(`Copied ${label} to clipboard`);
    }).catch(() => {
      showToast('Could not copy to clipboard');
    });
  };

  const openReverseSearch = (engine, url) => {
    let searchUrl = '';
    const encoded = encodeURIComponent(url);
    if (engine === 'lens') searchUrl = `https://lens.google.com/uploadbyurl?url=${encoded}`;
    if (engine === 'yandex') searchUrl = `https://yandex.com/images/search?rpt=imageview&url=${encoded}`;
    if (engine === 'bing') searchUrl = `https://www.bing.com/images/search?view=detailv2&iss=sbi&FORM=SBIHMP&sbisrc=UrlPaste&q=imgurl:${encoded}`;
    if (engine === 'tineye') searchUrl = `https://tineye.com/search?url=${encoded}`;
    if (searchUrl) window.open(searchUrl, '_blank', 'noopener');
  };

  const handleSelectResolution = (variantUrl, label) => {
    if (!variantUrl || variantUrl === currentVideoUrl) return;
    const video = videoRef.current;
    const curTime = video ? video.currentTime : currentTime;
    const wasPlaying = video ? !video.paused : isPlaying;

    setCurrentVideoUrl(variantUrl);
    showToast(`Switched resolution to ${label || 'selected'}`);

    const onMeta = () => {
      if (video) {
        try {
          video.currentTime = curTime;
          if (wasPlaying) video.play().catch(() => {});
        } catch {}
        video.removeEventListener('loadedmetadata', onMeta);
      }
    };
    if (video) {
      video.addEventListener('loadedmetadata', onMeta, { once: true });
    }
  };

  const handleNavigateGallery = (step) => {
    if (currentGalleryPos === -1) return;
    const targetPos = currentGalleryPos + step;
    if (targetPos >= 0 && targetPos < gallerySiblings.length) {
      openViewer(gallerySiblings[targetPos].index);
    }
  };

  // Favorites
  const canonicalId = item ? (item.id || canonicalMediaId(item.url, item)) : '';
  const isFav = item ? (favorites?.has(canonicalId) || favorites?.has(item.id)) : false;
  const handleToggleFavorite = () => {
    if (canonicalId) toggleFavorite(canonicalId);
  };

  const isFill = fitMode === 'fill';

  if (!item || isDisallowedMediaUrl(item?.url)) return null;

  return (
    <div
      className="modal-backdrop"
      id="viewerBackdrop"
      onClick={(e) => {
        if (e.target.id === 'viewerBackdrop' || e.target.classList.contains('viewer-modal') || e.target.classList.contains('viewer-media')) {
          closeViewer();
        }
      }}
    >
      <button
        className="viewer-close"
        id="viewerClose"
        type="button"
        aria-label="Close viewer"
        title="Close viewer"
        onClick={closeViewer}
      >
        ×
      </button>

      <div className="viewer-modal" role="dialog" aria-modal="true">
        <button
          className="viewer-nav viewer-prev"
          id="viewerPrev"
          onClick={() => navigateViewer(-1)}
        >
          ‹
        </button>

        <div
          className={`viewer-media ${isVideo ? 'video-view' : ''} ${isFill ? 'mode-fill' : 'mode-fit'}`}
          id="viewerMedia"
        >
          {isRetrying && (
            <div className="viewer-retrying-badge">
              <span className="retrying-spinner">↺</span>
              <span>Retrying media…</span>
            </div>
          )}

          {viewerError ? (
            <div className="viewer-broken-state" onClick={e => e.stopPropagation()}>
              <div className="viewer-broken-icon" aria-hidden="true">⚠</div>
              <div className="viewer-broken-title">Failed to load media</div>
              <p className="viewer-broken-desc">
                The media couldn't be loaded. It may have expired or is being rate-limited by the server.
              </p>
              <button
                className="viewer-retry-btn"
                type="button"
                onClick={handleViewerRetry}
              >
                <ResetIcon size={14} />
                <span>Retry loading</span>
              </button>
            </div>
          ) : isEmbed ? (
            <div className="viewer-embed-stage" onClick={e => e.stopPropagation()}>
              <iframe
                src={item.playbackPage || item.url}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
                title={item.alt || 'Video player'}
              />
            </div>
          ) : isXFallback ? (
            <div className="x-video-fallback">
              {item.poster && (
                <img
                  src={getBustedUrl(item.poster)}
                  alt={item.alt || 'X video preview'}
                  referrerPolicy="no-referrer"
                />
              )}
              <p>Could not retrieve a playable MP4 for this post.</p>
              <button
                className="site-action"
                onClick={() => window.open(item.postUrl || item.pageUrl, '_blank', 'noopener')}
              >
                Play on X
              </button>
            </div>
          ) : isInstagramFallback ? (
            <div className="instagram-video-fallback">
              {viewerPoster && (
                <img
                  src={getBustedUrl(viewerPoster)}
                  alt={item.alt || 'Instagram reel preview'}
                  referrerPolicy="no-referrer"
                />
              )}
              <p>{item.playbackPage ? 'This Instagram video is streamed by the page and has no standalone playable file.' : 'Instagram did not provide a playable video file for this media.'}</p>
              <button
                className="site-action"
                onClick={() => navigateToInstagram ? navigateToInstagram(item.postUrl || item.pageUrl) : window.open(item.postUrl || item.pageUrl, '_blank', 'noopener')}
              >
                Watch Reel on Instagram in Extension View ↗
              </button>
            </div>
          ) : isVideo ? (
            <>
              <div
                className={`viewer-video-stage ${isFill ? 'mode-fill' : 'mode-fit'}`}
                ref={videoStageRef}
                onClick={(e) => {
                  if (e.target === videoStageRef.current) closeViewer();
                }}
              >
                <video
                  ref={videoRef}
                  key={`v-${retryNonce}-${currentVideoUrl || playableUrl || resolvedUrl}`}
                  src={getBustedUrl(currentVideoUrl || playableUrl || resolvedUrl)}
                  className={isFill ? 'video-fill' : 'video-fit'}
                  playsInline
                  autoPlay={isGif || prefs.autoplayViewer}
                  loop={isGif || isLooping}
                  muted={isGif ? true : isMuted}
                  defaultMuted={isGif ? true : isMuted}
                  preload="auto"
                  poster={viewerPoster}
                  referrerPolicy="no-referrer"
                  style={{
                    objectFit: isFill ? 'cover' : 'contain',
                    width: isFill ? '100%' : 'auto',
                    height: isFill ? '100%' : 'auto',
                    maxWidth: isFill ? 'none' : '100%',
                    maxHeight: isFill ? 'none' : '100%'
                  }}
                  onClick={handlePlayToggle}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    toggleFitMode();
                  }}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  onPlaying={() => {
                    setViewerError(false);
                    setIsRetrying(false);
                  }}
                  onTimeUpdate={() => {
                    if (videoRef.current) setCurrentTime(videoRef.current.currentTime);
                  }}
                  onLoadedMetadata={() => {
                    setViewerError(false);
                    setIsRetrying(false);
                    if (videoRef.current) {
                      setDuration(videoRef.current.duration);
                      if (playbackRate !== 1) videoRef.current.playbackRate = playbackRate;
                    }
                  }}
                  onError={handleVideoError}
                  onEnded={() => {
                    if (isLooping && videoRef.current) {
                      videoRef.current.currentTime = 0;
                      videoRef.current.play().catch(() => {});
                    }
                  }}
                />
              </div>

              <ViewerVideoControls
                videoRef={videoRef}
                isPlaying={isPlaying}
                onPlayToggle={handlePlayToggle}
                isFill={isFill}
                onToggleFitMode={toggleFitMode}
                isMuted={isMuted}
                onMuteToggle={handleMuteToggle}
                duration={duration}
                currentTime={currentTime}
                onSeek={setCurrentTime}
                isLooping={isLooping}
                onLoopToggle={handleLoopToggle}
                autoplayViewer={prefs.autoplayViewer}
                onAutoplayToggle={handleAutoplayToggle}
                videoFullscreen={videoFullscreen}
                onFullscreenVideo={handleFullscreenVideo}
                hasPip={Boolean(document.pictureInPictureEnabled)}
                onTogglePip={handleTogglePip}
              />
            </>
          ) : (
            <img
              key={`img-${retryNonce}-${resolvedUrl || item.url}`}
              src={getBustedUrl(resolvedUrl || gifAnimatedUrl || item.url || item.previewUrl)}
              alt={item.alt || ''}
              referrerPolicy="no-referrer"
              style={{
                objectFit: isFill ? 'cover' : 'contain',
                width: isFill ? '100%' : 'auto',
                height: isFill ? '100%' : 'auto',
                maxWidth: isFill ? 'none' : '100%',
                maxHeight: isFill ? 'none' : '100%'
              }}
              onDoubleClick={(e) => {
                e.stopPropagation();
                toggleFitMode();
              }}
              onLoad={() => {
                setViewerError(false);
                setIsRetrying(false);
              }}
              onError={handleImageError}
            />
          )}
        </div>

        <button
          className="viewer-nav viewer-next"
          id="viewerNext"
          onClick={() => navigateViewer(1)}
        >
          ›
        </button>

        <ViewerInfoBar
          item={item}
          isEmbed={isEmbed}
          isFill={isFill}
          isDownloaded={isDownloaded}
          isFavorite={isFav}
          isToolsOpen={isToolsOpen}
          onToggleFavorite={handleToggleFavorite}
          onToggleFitMode={toggleFitMode}
          onDownloadItem={downloadItem}
          onOpenTools={() => setIsToolsOpen(prev => !prev)}
          directUrl={directUrl}
          postOrPage={postOrPage}
          isDirectValid={isDirectValid}
          isPostDifferent={isPostDifferent}
          onCopyText={copyText}
          onReverseSearch={openReverseSearch}
          onTogglePip={handleTogglePip}
          hasPip={Boolean(document.pictureInPictureEnabled)}
          videoVariants={videoVariants}
          currentVideoUrl={currentVideoUrl}
          gallerySiblings={gallerySiblings}
          currentGalleryPos={currentGalleryPos}
          onNavigateGallery={handleNavigateGallery}
          onNavigateToInstagram={navigateToSocial || navigateToInstagram}
        />
      </div>

      <ViewerToolsDrawer
        isOpen={isToolsOpen}
        onClose={() => setIsToolsOpen(false)}
        item={item}
        currentVideoUrl={currentVideoUrl}
        videoVariants={videoVariants}
        onSelectResolution={handleSelectResolution}
        isFavorite={isFav}
        onToggleFavorite={handleToggleFavorite}
        isDownloaded={isDownloaded}
        onDownloadItem={() => downloadItem(item)}
        onRemoveSavedFile={removeSavedFile}
        onCopyText={copyText}
        onReverseSearch={openReverseSearch}
        onTogglePip={handleTogglePip}
        hasPip={Boolean(document.pictureInPictureEnabled)}
        directUrl={directUrl}
        postOrPage={postOrPage}
        isDirectValid={isDirectValid}
        isPostDifferent={isPostDifferent}
        playbackRate={playbackRate}
        onSelectPlaybackRate={handleSelectPlaybackRate}
        onNavigateToInstagram={navigateToSocial || navigateToInstagram}
        isLooping={isLooping}
        onToggleLoop={handleLoopToggle}
        autoplayViewer={prefs.autoplayViewer}
        onToggleAutoplay={handleAutoplayToggle}
      />
    </div>
  );
}
