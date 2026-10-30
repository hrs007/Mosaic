import React, { useState, useEffect, useRef } from 'react';
import { useGallery } from '../context/GalleryContext.jsx';
import {
  filename,
  formatSize,
  isItemDownloaded,
  getPlayableVideoUrl
} from '../utils/mediaHelpers.js';
import { getSavedObjectUrl } from '../services/storage.js';
import {
  ViewerVideoControls,
  ViewerInfoBar,
  ViewerMoreMenu
} from './viewer/index.js';

export default function MediaViewer() {
  const {
    filtered,
    viewerIndex,
    closeViewer,
    navigateViewer,
    prefs,
    setPrefs,
    savedFiles,
    downloadItem,
    removeSavedFile,
    showToast
  } = useGallery();

  const item = filtered[viewerIndex];

  const [resolvedUrl, setResolvedUrl] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isLooping, setIsLooping] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [fitMode, setFitMode] = useState(prefs.viewerFit || 'fit');
  const [moreMenuRect, setMoreMenuRect] = useState(null);
  const [videoFullscreen, setVideoFullscreen] = useState(false);

  const videoRef = useRef(null);
  const menuRef = useRef(null);
  const videoStageRef = useRef(null);

  const isVideo = item?.type === 'video';
  const isEmbed = item?.site === 'youtube';
  const isXFallback = item?.site === 'x' && item?.type === 'video' && item?.playbackPage && !getPlayableVideoUrl(item);
  const isDownloaded = item ? isItemDownloaded(item, savedFiles) : false;

  // Resolve object URL for saved file
  useEffect(() => {
    let active = true;
    if (!item) return;

    if (item.savedFile) {
      getSavedObjectUrl(item).then(url => {
        if (active && url) setResolvedUrl(url);
      });
    } else {
      setResolvedUrl(item.url || '');
    }
    return () => { active = false; };
  }, [item]);

  // Autoplay video on load
  useEffect(() => {
    if (isVideo && videoRef.current && !isEmbed && !isXFallback) {
      if (prefs.autoplayViewer) {
        videoRef.current.play().catch(() => {});
      } else {
        videoRef.current.pause();
      }
    }
  }, [item, isVideo, isEmbed, isXFallback, prefs.autoplayViewer]);

  // Dismiss more menu on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target) && !e.target.closest('#viewerMore')) {
        setMoreMenuRect(null);
      }
    };
    if (moreMenuRect) {
      document.addEventListener('click', handleOutsideClick);
      return () => document.removeEventListener('click', handleOutsideClick);
    }
  }, [moreMenuRect]);

  if (!item) return null;

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
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
      setVideoFullscreen(false);
    } else {
      if (video.requestFullscreen) {
        video.requestFullscreen().then(() => setVideoFullscreen(true)).catch(() => {});
      } else if (video.webkitRequestFullscreen) {
        video.webkitRequestFullscreen();
        setVideoFullscreen(true);
      }
    }
  };

  const toggleFitMode = () => {
    setFitMode(prev => {
      const next = prev === 'fill' ? 'fit' : 'fill';
      setPrefs({ viewerFit: next });
      return next;
    });
  };

  const directUrl = item.source || item.url || '';
  const postOrPage = item.postUrl || item.pageUrl || '';
  const isDirectValid = directUrl && !/^(blob|data):/i.test(directUrl);
  const isPostDifferent = postOrPage && postOrPage !== directUrl;

  const copyText = (txt) => {
    navigator.clipboard?.writeText(txt).then(() => {
      showToast('Copied link to clipboard');
    });
    setMoreMenuRect(null);
  };

  const openReverseSearch = (engine, url) => {
    let searchUrl = '';
    if (engine === 'lens') searchUrl = `https://lens.google.com/uploadbyurl?url=${encodeURIComponent(url)}`;
    if (engine === 'bing') searchUrl = `https://www.bing.com/images/search?view=detailv2&iss=sbi&FORM=SBIHMP&sbisrc=UrlPaste&q=imgurl:${encodeURIComponent(url)}`;
    if (engine === 'tineye') searchUrl = `https://tineye.com/search?url=${encodeURIComponent(url)}`;
    if (searchUrl) window.open(searchUrl, '_blank', 'noopener');
    setMoreMenuRect(null);
  };

  const isFill = fitMode === 'fill';

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
          {isEmbed ? (
            <iframe
              src={item.playbackPage || item.url}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
              title={item.alt || 'Video player'}
            />
          ) : isXFallback ? (
            <div className="x-video-fallback">
              {item.poster && (
                <img
                  src={item.poster}
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
                  src={getPlayableVideoUrl(item) || resolvedUrl}
                  className={isFill ? 'video-fill' : 'video-fit'}
                  playsInline
                  preload="auto"
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
                  onTimeUpdate={() => {
                    if (videoRef.current) setCurrentTime(videoRef.current.currentTime);
                  }}
                  onLoadedMetadata={() => {
                    if (videoRef.current) setDuration(videoRef.current.duration);
                  }}
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
              />
            </>
          ) : (
            <img
              src={resolvedUrl || item.previewUrl || item.url}
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
          onToggleFitMode={toggleFitMode}
          onDownloadItem={downloadItem}
          onMoreClick={e => {
            e.stopPropagation();
            setMoreMenuRect(e.currentTarget.getBoundingClientRect());
          }}
        />
      </div>

      <ViewerMoreMenu
        menuRef={menuRef}
        moreMenuRect={moreMenuRect}
        onClose={() => setMoreMenuRect(null)}
        item={item}
        directUrl={directUrl}
        postOrPage={postOrPage}
        isDirectValid={isDirectValid}
        isPostDifferent={isPostDifferent}
        onCopyText={copyText}
        onReverseSearch={openReverseSearch}
        onRemoveSavedFile={removeSavedFile}
      />
    </div>
  );
}
