import { useState, useEffect, useRef, useCallback } from 'react';
import { defaultSiteProfile } from '../constants/defaults.js';
import {
  canonicalMediaId,
  getRedditPostId,
  parseRedditResolution,
  pageIdentity
} from '../utils/mediaHelpers.js';
import { resolveXVideos } from '../utils/xSyndication.js';
import {
  scanPageInTab,
  scanLiveNowInTab,
  startLiveWatcherInTab,
  advanceTabScroll
} from '../services/scanner.js';

const isExtensionValid = () => {
  try {
    return !!(typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id);
  } catch {
    return false;
  }
};

export function usePageScanner({
  tabId,
  prefsRef,
  activeTypeRef,
  filteredLengthRef,
  perPage,
  setPage,
  showToast
}) {
  const [media, setMedia] = useState([]);
  const [siteProfile, setSiteProfile] = useState(defaultSiteProfile);
  const [scanStatus, setScanStatus] = useState('Ready to explore');
  const [loading, setLoading] = useState(true);
  const [isAdvancing, setIsAdvancing] = useState(false);
  const [hasReachedEnd, setHasReachedEnd] = useState(false);

  // Operational references
  const currentPageIdentityRef = useRef('');
  const liveScanBusyRef = useRef(false);
  const liveScanQueuedRef = useRef(false);
  const sourceAdvanceBusyRef = useRef(false);
  const sourceAdvancePausedRef = useRef(false);
  const consecutiveEmptyAdvancesRef = useRef(0);
  const lastSourceAdvanceRef = useRef(0);
  const hasReachedEndRef = useRef(false);
  hasReachedEndRef.current = hasReachedEnd;

  const mediaRef = useRef(media);
  mediaRef.current = media;
  const checkGalleryFillRef = useRef(null);

  // Merge Scanned Media with Deduplication & In-place Updates
  const mergeMedia = useCallback((items) => {
    if (!items || !items.length) return 0;
    let addedCount = 0;

    setMedia(prevMedia => {
      const known = new Map(prevMedia.map(item => [item.id || canonicalMediaId(item.url, item), item]));
      const nextMedia = [...prevMedia];
      let changed = false;

      for (const x of items) {
        if (!x?.url) continue;
        const id = canonicalMediaId(String(x.url), x);
        const old = known.get(id);

        // Check if there's an existing placeholder image for Reddit video from same post
        if (x.site === 'reddit' && x.type === 'video' && x.postUrl) {
          const pId = getRedditPostId(x.postUrl);
          if (pId) {
            const imgIndex = nextMedia.findIndex(m => m.site === 'reddit' && m.type === 'image' && getRedditPostId(m.postUrl) === pId);
            if (imgIndex !== -1) {
              const oldImg = { ...nextMedia[imgIndex] };
              oldImg.type = 'video';
              oldImg.url = x.url;
              oldImg.source = x.source || x.url;
              oldImg.fallbackUrls = x.fallbackUrls || [];
              oldImg.poster = x.poster || oldImg.previewUrl || oldImg.url;
              oldImg.width = Math.max(oldImg.width || 0, Number(x.width) || 0);
              oldImg.height = Math.max(oldImg.height || 0, Number(x.height) || 0);
              oldImg.playbackPage = x.playbackPage || '';
              oldImg.unavailable = false;
              nextMedia[imgIndex] = oldImg;
              known.set(id, oldImg);
              changed = true;
              continue;
            }
          }
        }

        // If an image arrives for a Reddit post where we already have a video, skip duplicate
        if (x.site === 'reddit' && x.type === 'image' && x.postUrl) {
          const pId = getRedditPostId(x.postUrl);
          if (pId && nextMedia.some(m => m.site === 'reddit' && m.type === 'video' && getRedditPostId(m.postUrl) === pId)) {
            continue;
          }
        }

        if (!old && x.site === 'x' && x.type === 'video' && !x.playbackPage && x.postUrl) {
          const fallbackIdx = nextMedia.findIndex(item => item.site === 'x' && item.type === 'video' && item.playbackPage && item.postUrl === x.postUrl);
          if (fallbackIdx !== -1) {
            const fallback = { ...nextMedia[fallbackIdx] };
            fallback.url = x.url;
            fallback.source = x.source || x.url;
            fallback.fallbackUrls = x.fallbackUrls || fallback.fallbackUrls || [];
            fallback.playbackPage = '';
            fallback.poster = fallback.poster || x.poster || '';
            fallback.width = Math.max(fallback.width || 0, Number(x.width) || 0);
            fallback.height = Math.max(fallback.height || 0, Number(x.height) || 0);
            nextMedia[fallbackIdx] = fallback;
            known.set(id, fallback);
            changed = true;
            continue;
          }
        }

        if (old) {
          const idx = nextMedia.findIndex(m => m.id === old.id);
          if (idx !== -1) {
            const updated = { ...nextMedia[idx] };
            const w = Math.max(updated.width || 0, Number(x.width) || 0);
            const h = Math.max(updated.height || 0, Number(x.height) || 0);
            if (w !== updated.width || h !== updated.height) {
              updated.width = w;
              updated.height = h;
              changed = true;
            }
            if (!updated.alt && x.alt) updated.alt = x.alt;
            if (!updated.previewUrl && x.previewUrl) updated.previewUrl = x.previewUrl;
            if (x.type === 'video' && updated.type !== 'video') {
              updated.type = 'video';
              updated.poster = updated.poster || x.poster || x.previewUrl || '';
              updated.playbackPage = updated.playbackPage || x.playbackPage || '';
              updated.postUrl = updated.postUrl || x.postUrl || '';
              updated.site = updated.site || x.site || '';
              updated.unavailable = false;
              changed = true;
            }
            if (x.type === 'video') {
              if (x.site === 'reddit') {
                const oldRes = parseRedditResolution(updated.url);
                const newRes = parseRedditResolution(x.url);
                if (newRes > oldRes) {
                  updated.url = x.url;
                  updated.source = x.source || x.url;
                  changed = true;
                }
                if (x.fallbackUrls?.length) {
                  updated.fallbackUrls = [...new Set([...(updated.fallbackUrls || []), ...x.fallbackUrls])].sort((a, b) => parseRedditResolution(b) - parseRedditResolution(a));
                }
                if (x.poster && !updated.poster) {
                  updated.poster = x.poster;
                  changed = true;
                }
                updated.unavailable = false;
              } else if (x.site === 'x' && x.url !== updated.url && !x.playbackPage) {
                updated.url = x.url;
                updated.source = x.source || x.url;
                updated.fallbackUrls = x.fallbackUrls || updated.fallbackUrls || [];
                updated.playbackPage = '';
                updated.unavailable = false;
                changed = true;
              } else {
                updated.fallbackUrls = x.fallbackUrls || updated.fallbackUrls || [];
                updated.poster = updated.poster || x.poster || '';
                updated.unavailable = false;
              }
            }
            nextMedia[idx] = updated;
          }
          continue;
        }

        const item = {
          ...x,
          id,
          index: nextMedia.length,
          size: 0,
          width: Number(x.width) || (x.site === 'youtube' ? 1280 : 0),
          height: Number(x.height) || (x.site === 'youtube' ? 720 : 0)
        };
        nextMedia.push(item);
        known.set(id, item);
        addedCount++;
        changed = true;
      }

      if (changed) {
        if (addedCount > 0) {
          sourceAdvancePausedRef.current = false;
          consecutiveEmptyAdvancesRef.current = 0;
          setHasReachedEnd(false);
          hasReachedEndRef.current = false;
          setScanStatus(`${nextMedia.filter(x => !x.unavailable).length} items · live`);
        }
        return nextMedia;
      }
      return prevMedia;
    });

    return addedCount;
  }, []);

  // Scan live now in tab
  const scanLiveNow = useCallback(async () => {
    if (!tabId || liveScanBusyRef.current || !isExtensionValid()) {
      liveScanQueuedRef.current = true;
      return;
    }
    liveScanBusyRef.current = true;
    try {
      if (!isExtensionValid()) return;
      const [res] = await chrome.scripting.executeScript({
        target: { tabId },
        func: scanLiveNowInTab
      });
      const items = res?.result?.items || [];
      if (res?.result?.url && pageIdentity(res.result.url) !== currentPageIdentityRef.current) {
        currentPageIdentityRef.current = pageIdentity(res.result.url);
      }
      const xItems = items.filter(item => item.site === 'x' && item.type === 'video');
      if (xItems.length) await resolveXVideos(xItems);
      mergeMedia(items);

      if (items.length) {
        const hasYt = items.some(x => x.site === 'youtube');
        const hasX = items.some(x => x.site === 'x');
        const hasReddit = items.some(x => x.site === 'reddit');
        if (hasYt) {
          setSiteProfile({ key: 'youtube', name: 'YouTube', glyph: '▶', hint: 'Watch videos · shorts · embedded players' });
        } else if (hasX) {
          setSiteProfile({ key: 'x', name: 'X', glyph: '𝕏', hint: 'Loaded posts · playable clips · originals' });
        } else if (hasReddit) {
          setSiteProfile({ key: 'reddit', name: 'Reddit', glyph: 'r', hint: 'Post images · hosted videos · discussions' });
        }
      }
    } catch {} finally {
      liveScanBusyRef.current = false;
      if (liveScanQueuedRef.current) {
        liveScanQueuedRef.current = false;
        setTimeout(scanLiveNow, 100);
      }
    }
  }, [tabId, mergeMedia]);

  // Advance Source Page (Infinite Scroll in Background)
  const advanceSourcePage = useCallback(async () => {
    if (
      !tabId ||
      !isExtensionValid() ||
      sourceAdvanceBusyRef.current ||
      sourceAdvancePausedRef.current ||
      hasReachedEndRef.current ||
      Date.now() - lastSourceAdvanceRef.current < 350
    ) return;

    sourceAdvanceBusyRef.current = true;
    setIsAdvancing(true);
    let steps = 0;
    try {
      while (
        steps < 2 &&
        !document.body.classList.contains('modal-open') &&
        activeTypeRef.current !== 'favorites' &&
        activeTypeRef.current !== 'files'
      ) {
        const beforeCount = mediaRef.current.length;
        lastSourceAdvanceRef.current = Date.now();
        const [res] = await chrome.scripting.executeScript({
          target: { tabId },
          func: advanceTabScroll
        });
        const scrollInfo = res?.result;
        steps++;
        await new Promise(resolve => setTimeout(resolve, 400));
        await scanLiveNow();
        const noNewMedia = mediaRef.current.length === beforeCount;
        if (noNewMedia) {
          consecutiveEmptyAdvancesRef.current++;
          if (scrollInfo?.atBottom || consecutiveEmptyAdvancesRef.current >= 3) {
            sourceAdvancePausedRef.current = true;
            setHasReachedEnd(true);
            hasReachedEndRef.current = true;
            break;
          }
        } else {
          consecutiveEmptyAdvancesRef.current = 0;
          sourceAdvancePausedRef.current = false;
          setHasReachedEnd(false);
          hasReachedEndRef.current = false;
        }
      }
    } catch {} finally {
      sourceAdvanceBusyRef.current = false;
      setIsAdvancing(false);
    }
  }, [tabId, scanLiveNow, activeTypeRef]);

  // Check Gallery Fill and Auto-Load Beforehand
  const checkGalleryFill = useCallback(() => {
    const scroller = document.querySelector('.app-shell');
    if (!scroller || document.body.classList.contains('modal-open')) return;

    const isScrollable = scroller.scrollHeight > scroller.clientHeight + 80;
    const remainingScroll = isScrollable
      ? scroller.scrollHeight - (scroller.scrollTop + scroller.clientHeight)
      : 0;

    // 1. Auto-advance the gallery visible page beforehand when within 1500px of bottom or not scrollable
    if (!isScrollable || remainingScroll < 1500) {
      setPage(prevPage => {
        if (prevPage * perPage < filteredLengthRef.current) {
          return prevPage + 1;
        }
        return prevPage;
      });
    }

    // 2. Auto-advance the source page in tab beforehand (only for live page media)
    if (activeTypeRef.current === 'favorites' || activeTypeRef.current === 'files') return;

    if (sourceAdvanceBusyRef.current || hasReachedEndRef.current || sourceAdvancePausedRef.current) return;

    // If gallery is not scrollable, or within 2000px of bottom, or has fewer than 100 items: advance tab beforehand
    if (!isScrollable || remainingScroll < 2000 || filteredLengthRef.current < 100) {
      const wait = 350 - (Date.now() - lastSourceAdvanceRef.current);
      if (wait <= 0) {
        advanceSourcePage();
      }
    }
  }, [advanceSourcePage, perPage, setPage, activeTypeRef, filteredLengthRef]);

  checkGalleryFillRef.current = checkGalleryFill;

  // Preload initial batches beforehand so media is ready in advance
  const preloadInitialMedia = useCallback(async () => {
    if (!tabId || activeTypeRef.current === 'favorites' || activeTypeRef.current === 'files') return;
    sourceAdvancePausedRef.current = false;
    consecutiveEmptyAdvancesRef.current = 0;
    setHasReachedEnd(false);
    hasReachedEndRef.current = false;

    let cycles = 0;
    const maxCycles = 5;
    const targetBuffer = 120;

    while (
      cycles < maxCycles &&
      mediaRef.current.length < targetBuffer &&
      !sourceAdvancePausedRef.current &&
      !hasReachedEndRef.current &&
      !document.body.classList.contains('modal-open')
    ) {
      cycles++;
      await advanceSourcePage();
      await new Promise(resolve => setTimeout(resolve, 350));
    }
    checkGalleryFill();
  }, [tabId, advanceSourcePage, checkGalleryFill, activeTypeRef]);

  // Full Initial Page Scan
  const scanPage = useCallback(async () => {
    if (!tabId || !isExtensionValid()) return;
    sourceAdvancePausedRef.current = false;
    consecutiveEmptyAdvancesRef.current = 0;
    setHasReachedEnd(false);
    hasReachedEndRef.current = false;
    setPage(1);
    setLoading(true);
    setScanStatus('Looking for media…');

    try {
      if (!isExtensionValid()) return;
      const [res] = await chrome.scripting.executeScript({
        target: { tabId },
        func: scanPageInTab,
        args: [prefsRef.current.backgrounds]
      });
      const result = res?.result;
      const identity = pageIdentity(result?.pageUrl || '');
      if (currentPageIdentityRef.current && identity && identity !== currentPageIdentityRef.current) {
        setMedia([]);
      }
      currentPageIdentityRef.current = identity;

      const scannedItems = result?.items || [];
      if (result?.site?.key === 'x') {
        await resolveXVideos(scannedItems);
      }
      mergeMedia(scannedItems);
      if (result?.site) setSiteProfile(result.site);

      setScanStatus(`${scannedItems.length} items · live`);
      setLoading(false);

      // Start live watcher
      if (isExtensionValid()) {
        chrome.scripting.executeScript({
          target: { tabId },
          func: startLiveWatcherInTab,
          args: [prefsRef.current.backgrounds, tabId]
        }).catch(() => {});
      }

      // Auto-load media beforehand in the background
      preloadInitialMedia();
    } catch (e) {
      setLoading(false);
      setScanStatus('Page could not be scanned');
      showToast(`Could not scan page: ${e?.message || 'access denied'}`);
    }
  }, [tabId, mergeMedia, showToast, preloadInitialMedia, prefsRef, setPage]);

  // Start Live Scan Loop and Connect Port
  useEffect(() => {
    if (!tabId || !isExtensionValid()) return;

    let port = null;
    let reconnectTimer = null;
    let isDisposed = false;

    const connectLivePort = () => {
      if (isDisposed || !isExtensionValid()) return;
      try {
        port = chrome.runtime.connect({ name: `mosaic-gallery:${tabId}` });
        port.onMessage.addListener(async (message) => {
          if (isDisposed) return;
          if (message?.source === 'mosaic-live' && message.tabId === tabId && message.media) {
            const item = message.media;
            if (!item.pageUrl) return;
            const identity = pageIdentity(item.pageUrl);
            if (!currentPageIdentityRef.current) currentPageIdentityRef.current = identity;
            if (currentPageIdentityRef.current && identity !== currentPageIdentityRef.current) return;
            if (item.site === 'x' && item.type === 'video') await resolveXVideos([item]);
            mergeMedia([item]);
            setHasReachedEnd(false);
            hasReachedEndRef.current = false;
          }
        });
        port.onDisconnect.addListener(() => {
          if (isDisposed || !isExtensionValid()) return;
          reconnectTimer = setTimeout(connectLivePort, 500);
        });
      } catch {
        if (!isDisposed && isExtensionValid()) {
          reconnectTimer = setTimeout(connectLivePort, 1000);
        }
      }
    };
    connectLivePort();

    const pollInterval = setInterval(() => {
      if (isDisposed || !isExtensionValid()) {
        clearInterval(pollInterval);
        return;
      }
      scanLiveNow();
      checkGalleryFill();
    }, 1800);

    scanPage();

    return () => {
      isDisposed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      clearInterval(pollInterval);
      if (port) {
        try { port.disconnect(); } catch {}
      }
    };
  }, [tabId, scanLiveNow, scanPage, mergeMedia, checkGalleryFill]);

  const handleGalleryScroll = useCallback(() => {
    if (!hasReachedEndRef.current) {
      sourceAdvancePausedRef.current = false;
      consecutiveEmptyAdvancesRef.current = 0;
    }
    checkGalleryFill();
  }, [checkGalleryFill]);

  return {
    media,
    setMedia,
    mediaRef,
    siteProfile,
    scanStatus,
    loading,
    isAdvancing,
    hasReachedEnd,
    setHasReachedEnd,
    hasReachedEndRef,
    sourceAdvancePausedRef,
    consecutiveEmptyAdvancesRef,
    checkGalleryFillRef,
    mergeMedia,
    scanPage,
    scanLiveNow,
    advanceSourcePage,
    preloadInitialMedia,
    checkGalleryFill,
    onGalleryScroll: handleGalleryScroll
  };
}
