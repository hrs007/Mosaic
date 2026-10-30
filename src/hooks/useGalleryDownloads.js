import { useState, useEffect, useRef, useCallback } from 'react';
import { canonicalMediaId, isItemGif, getGifAnimatedUrl } from '../utils/mediaHelpers.js';
import {
  refreshSavedFiles,
  clearLibraryStorage,
  deleteSavedFile
} from '../services/storage.js';

export function useGalleryDownloads({ mediaRef, showToast, onFilterRefresh }) {
  const [favorites, setFavorites] = useState(new Set());
  const [savedMedia, setSavedMedia] = useState(new Map());
  const [savedFiles, setSavedFiles] = useState([]);

  const favoritesRef = useRef(favorites);
  favoritesRef.current = favorites;
  const savedMediaRef = useRef(savedMedia);
  savedMediaRef.current = savedMedia;
  const savedFilesRef = useRef(savedFiles);
  savedFilesRef.current = savedFiles;

  // Load Saved Files & Favorites from Storage
  useEffect(() => {
    (async () => {
      try {
        const stored = await chrome.storage.local.get([
          'mosaicFavorites',
          'mosaicSavedMedia',
          'mosaicSavedFiles'
        ]);

        const loadedFavs = new Set(stored.mosaicFavorites || []);
        const loadedSaved = new Map(
          (stored.mosaicSavedMedia || [])
            .filter(item => item?.url)
            .map(item => {
              const id = item.id || canonicalMediaId(item.url);
              return [id, { ...item, id }];
            })
        );
        for (const id of loadedSaved.keys()) loadedFavs.add(id);
        setFavorites(loadedFavs);
        setSavedMedia(loadedSaved);

        const files = await refreshSavedFiles();
        setSavedFiles(files);
      } catch (err) {
        console.warn('Could not initialize Mosaic storage:', err);
      }
    })();
  }, []);

  // Listen to chrome.downloads changes to update saved files live
  useEffect(() => {
    if (!chrome.downloads?.onChanged) return;
    const handleDownloadChange = (delta) => {
      setSavedFiles(prev => {
        const idx = prev.findIndex(file => file.downloadId === delta.id);
        if (idx === -1) return prev;
        const next = [...prev];
        const item = { ...next[idx] };
        if (delta.state) item.downloadState = delta.state.current;
        if (delta.error) item.downloadError = delta.error.current;
        if (delta.filename) item.fileName = delta.filename.current.split(/[\\/]/).pop();
        next[idx] = item;
        chrome.storage.local.set({ mosaicSavedFiles: next });
        return next;
      });
      onFilterRefresh?.();
    };

    chrome.downloads.onChanged.addListener(handleDownloadChange);
    return () => {
      try {
        if (typeof chrome !== 'undefined' && chrome.downloads?.onChanged?.removeListener) {
          chrome.downloads.onChanged.removeListener(handleDownloadChange);
        }
      } catch {}
    };
  }, [onFilterRefresh]);

  // Toggle Favorite
  const toggleFavorite = useCallback(async (id) => {
    const item = mediaRef.current.find(x => x.id === id) || savedMediaRef.current.get(id);
    setFavorites(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        setSavedMedia(sm => {
          const updated = new Map(sm);
          updated.delete(id);
          try {
            if (typeof chrome !== 'undefined' && chrome.runtime?.id && chrome.storage?.local) {
              chrome.storage.local.set({
                mosaicFavorites: [...next],
                mosaicSavedMedia: [...updated.values()]
              });
            }
          } catch {}
          return updated;
        });
      } else {
        next.add(id);
        if (item) {
          setSavedMedia(sm => {
            const updated = new Map(sm);
            updated.set(id, { ...item });
            try {
              if (typeof chrome !== 'undefined' && chrome.runtime?.id && chrome.storage?.local) {
                chrome.storage.local.set({
                  mosaicFavorites: [...next],
                  mosaicSavedMedia: [...updated.values()]
                });
              }
            } catch {}
            return updated;
          });
        }
      }
      return next;
    });
  }, [mediaRef]);

  // Download Item to Downloads / Mosaic
  const downloadItem = useCallback(async (item) => {
    try {
      let sourceUrl = item.sourceUrl || item.source || item.url;
      let downloadType = item.type;
      if (item.site === 'youtube' && (sourceUrl === item.playbackPage || sourceUrl === item.url || !/\.(mp4|webm)/i.test(sourceUrl))) {
        // YouTube videos are embeds; save the highest-quality thumbnail image
        const bestThumb = (item.fallbackUrls || []).find(u => u && !u.includes('hqdefault.jpg')) || item.poster || item.previewUrl;
        if (bestThumb) {
          sourceUrl = bestThumb;
          downloadType = 'image';
        }
      } else if (isItemGif(item)) {
        const animUrl = getGifAnimatedUrl(item);
        if (animUrl) {
          sourceUrl = animUrl;
          if (/\.(mp4|webm|mov|m4v|ogv)(?:[?#]|$)/i.test(animUrl)) {
            downloadType = 'video';
          } else {
            downloadType = 'image';
          }
        }
      }

      if (!sourceUrl || /^(blob|data):/i.test(sourceUrl)) {
        showToast('This media has no downloadable file URL.');
        return;
      }
      if (downloadType === 'video' && item.playbackPage && sourceUrl === item.playbackPage) {
        showToast('This post does not expose a video file to save.');
        return;
      }
      const existing = savedFilesRef.current.find(file => file.sourceUrl === sourceUrl);
      if (existing) {
        showToast('Already saved in your Mosaic library.');
        return;
      }
      const sourceName = item.fileName || sourceUrl.split('/').pop()?.split('?')[0] || (downloadType === 'video' ? 'video.mp4' : 'image.jpg');
      const fallback = downloadType === 'video' ? 'video.mp4' : 'image.jpg';
      let name = (sourceName || fallback).replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').trim() || fallback;
      if (/\.gifv$/i.test(name)) {
        name = name.replace(/\.gifv$/i, '.gif');
      }
      if (!/\.(mp4|webm|mov|m4v|ogv|jpe?g|png|gif|webp|avif)$/i.test(name)) name += downloadType === 'video' ? '.mp4' : '.jpg';

      const downloadId = await chrome.downloads.download({
        url: sourceUrl,
        filename: `Mosaic/${name}`,
        conflictAction: 'uniquify',
        saveAs: false
      });

      const id = crypto.randomUUID();
      const entry = {
        id,
        downloadId,
        sourceUrl,
        type: downloadType === 'video' ? 'video' : 'image',
        alt: item.alt || name,
        fileName: name,
        pageTitle: item.pageTitle || '',
        site: item.site || '',
        pageUrl: item.pageUrl || '',
        postUrl: item.postUrl || '',
        poster: item.poster || '',
        width: item.width || 0,
        height: item.height || 0,
        size: item.size || 0,
        duration: item.duration || 0,
        savedAt: Date.now(),
        mime: item.mime || '',
        storageMode: 'download',
        downloadState: 'in_progress'
      };

      setSavedFiles(prev => {
        const next = [entry, ...prev];
        try {
          if (typeof chrome !== 'undefined' && chrome.runtime?.id && chrome.storage?.local) {
            chrome.storage.local.set({ mosaicSavedFiles: next });
          }
        } catch {}
        return next;
      });

      showToast(`Saving ${name} to Downloads / Mosaic…`);
    } catch (err) {
      showToast(err?.message || 'Could not save this media to Downloads / Mosaic.');
    }
  }, [showToast]);

  // Remove Saved File
  const removeSavedFile = useCallback(async (item) => {
    try {
      await deleteSavedFile(item);
      setSavedFiles(prev => {
        const next = prev.filter(f => f.id !== item.id && f.id !== item.libraryId);
        try {
          if (typeof chrome !== 'undefined' && chrome.runtime?.id && chrome.storage?.local) {
            chrome.storage.local.set({ mosaicSavedFiles: next });
          }
        } catch {}
        return next;
      });
      showToast('Removed from Saved.');
    } catch {
      showToast('Could not remove this saved item.');
    }
  }, [showToast]);

  // Clear Saved Favorites
  const clearFavorites = useCallback(async () => {
    setFavorites(new Set());
    setSavedMedia(new Map());
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime?.id && chrome.storage?.local) {
        await chrome.storage.local.set({ mosaicFavorites: [], mosaicSavedMedia: [] });
      }
    } catch {}
    showToast('Favorites cleared');
  }, [showToast]);

  // Clear Entire Mosaic Library
  const clearLibrary = useCallback(async () => {
    try {
      await clearLibraryStorage();
      setSavedFiles([]);
      showToast('Mosaic library cleared.');
    } catch {
      showToast('Could not clear the Mosaic library.');
    }
  }, [showToast]);

  return {
    favorites,
    setFavorites,
    savedMedia,
    setSavedMedia,
    savedFiles,
    setSavedFiles,
    toggleFavorite,
    downloadItem,
    removeSavedFile,
    clearFavorites,
    clearLibrary
  };
}
