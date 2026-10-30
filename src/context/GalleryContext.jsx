import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { defaultPrefs } from '../constants/defaults.js';
import {
  useGalleryFilters,
  useGalleryDownloads,
  usePageScanner,
  useViewerState,
  useKeyboardShortcuts
} from '../hooks/index.js';

const GalleryContext = createContext(null);

export function GalleryProvider({ children }) {
  const [tabId, setTabId] = useState(() => {
    const p = new URLSearchParams(window.location.search);
    return Number(p.get('tabId')) || 0;
  });

  const [prefs, setPrefsState] = useState(defaultPrefs);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  const toastTimerRef = useRef(null);
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;

  // Show Toast
  const showToast = useCallback((msg) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToastMessage(msg);
    toastTimerRef.current = setTimeout(() => {
      setToastMessage('');
    }, 2600);
  }, []);

  // Update Prefs
  const updatePrefs = useCallback((updates) => {
    if (updates.hideSmall !== undefined || updates.hideDuplicates !== undefined || updates.sortBy !== undefined) {
      if (filterState?.userSortTriggeredRef) filterState.userSortTriggeredRef.current = true;
    }
    setPrefsState(prev => {
      const next = { ...prev, ...updates };
      try {
        if (typeof chrome !== 'undefined' && chrome.runtime?.id && chrome.storage?.local) {
          chrome.storage.local.set({ mosaicPrefs: next });
        }
      } catch {}
      return next;
    });
  }, []);

  // Apply Theme & Attributes to <html>
  useEffect(() => {
    const theme = prefs.theme === 'system'
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : prefs.theme;
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.density = prefs.density;
    document.documentElement.dataset.columns = prefs.columns;
  }, [prefs.theme, prefs.density, prefs.columns]);

  // Load Initial Prefs and Active Tab
  useEffect(() => {
    (async () => {
      try {
        let activeTabId = tabId;
        if (!activeTabId && typeof chrome !== 'undefined' && chrome.runtime?.id && chrome.tabs?.query) {
          try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tab?.id) {
              activeTabId = tab.id;
              setTabId(tab.id);
            }
          } catch {}
        }

        let initialPrefs = defaultPrefs;
        let savedState = {};
        if (typeof chrome !== 'undefined' && chrome.runtime?.id && chrome.storage?.local) {
          try {
            const stored = await chrome.storage.local.get(['mosaicPrefs', 'mosaicGalleryState']);
            if (stored.mosaicPrefs) initialPrefs = { ...defaultPrefs, ...stored.mosaicPrefs };
            if (stored.mosaicGalleryState) savedState = stored.mosaicGalleryState;
          } catch {}
        }
        setPrefsState(initialPrefs);
        prefsRef.current = initialPrefs;

        if (savedState.activeType) filterState.setActiveTypeState(savedState.activeType);
        if (savedState.savedFilter) filterState.setSavedFilterState(savedState.savedFilter);
        if (savedState.sortBy) filterState.setSortByState(savedState.sortBy);
        if (savedState.minKb !== undefined) filterState.setMinKbState(savedState.minKb);
        if (savedState.orientation) filterState.setOrientationState(savedState.orientation);
        if (savedState.viewMode) filterState.setViewMode(savedState.viewMode);
        if (savedState.filtersOpen !== undefined) filterState.setFiltersOpen(savedState.filtersOpen);
      } catch (err) {
        console.warn('Could not initialize Mosaic gallery:', err);
      }
    })();
  }, []);

  // Scanner Hook reference for forward callback
  const scannerRef = useRef(null);

  // Hook 1: Downloads and Saved Files
  const downloadsState = useGalleryDownloads({
    mediaRef: scannerRef.current?.mediaRef || { current: [] },
    showToast,
    onFilterRefresh: () => filterState?.setPage(p => p)
  });

  // Hook 2: Filters and Sorting
  const filterState = useGalleryFilters({
    media: scannerRef.current?.media || [],
    savedMedia: downloadsState.savedMedia,
    savedFiles: downloadsState.savedFiles,
    prefs,
    onFilterChange: (newType) => {
      if (scannerRef.current) {
        scannerRef.current.sourceAdvancePausedRef.current = false;
        scannerRef.current.consecutiveEmptyAdvancesRef.current = 0;
        scannerRef.current.setHasReachedEnd(false);
        scannerRef.current.hasReachedEndRef.current = false;
        setTimeout(() => scannerRef.current.checkGalleryFillRef.current?.(), 50);
      }
    }
  });

  // Hook 3: Page Scanner and Tab Injections
  const scannerState = usePageScanner({
    tabId,
    prefsRef,
    activeTypeRef: filterState.activeTypeRef,
    filteredLengthRef: filterState.filteredLengthRef,
    perPage: filterState.perPage,
    setPage: filterState.setPage,
    showToast
  });
  scannerRef.current = scannerState;

  // Hook 4: Lightbox Viewer State
  const viewerState = useViewerState({
    filteredCount: filterState.filtered.length
  });

  // Close extension overlay
  const closeGallery = useCallback(() => {
    // 1. PostMessage to parent frame directly (works even if extension context was invalidated)
    try {
      window.parent?.postMessage({
        type: 'mosaic-close-frame',
        restoreScroll: (prefs.exitScroll || 'previous') === 'previous'
      }, '*');
    } catch {}

    // 2. Notify background script if context is still valid
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime?.id && chrome.runtime?.sendMessage) {
        chrome.runtime.sendMessage({
          type: 'mosaic-close-overlay',
          tabId,
          restoreScroll: (prefs.exitScroll || 'previous') === 'previous'
        });
      }
    } catch {}
  }, [tabId, prefs.exitScroll]);

  // Hook 5: Keyboard Shortcuts
  useKeyboardShortcuts({
    viewerIndex: viewerState.viewerIndex,
    settingsOpen,
    closeGallery,
    closeViewer: viewerState.closeViewer,
    navigateViewer: viewerState.navigateViewer,
    setSettingsOpen
  });

  const value = {
    tabId,
    prefs,
    setPrefs: updatePrefs,
    media: scannerState.media,
    filtered: filterState.filtered,
    counts: filterState.counts,
    favorites: downloadsState.favorites,
    savedMedia: downloadsState.savedMedia,
    savedFiles: downloadsState.savedFiles,
    siteProfile: scannerState.siteProfile,
    activeType: filterState.activeType,
    setActiveType: filterState.setActiveType,
    savedFilter: filterState.savedFilter,
    setSavedFilter: filterState.setSavedFilter,
    siteFilter: filterState.siteFilter,
    setSiteFilter: filterState.setSiteFilter,
    sortBy: filterState.sortBy,
    setSortBy: filterState.setSortBy,
    minKb: filterState.minKb,
    setMinKb: filterState.setMinKb,
    orientation: filterState.orientation,
    setOrientation: filterState.setOrientation,
    viewMode: filterState.viewMode,
    setViewMode: filterState.setViewMode,
    search: filterState.search,
    setSearch: filterState.setSearch,
    filtersOpen: filterState.filtersOpen,
    setFiltersOpen: filterState.setFiltersOpen,
    page: filterState.page,
    setPage: filterState.setPage,
    perPage: filterState.perPage,
    viewerIndex: viewerState.viewerIndex,
    openViewer: viewerState.openViewer,
    closeViewer: viewerState.closeViewer,
    navigateViewer: viewerState.navigateViewer,
    settingsOpen,
    setSettingsOpen,
    toastMessage,
    showToast,
    scanStatus: scannerState.scanStatus,
    loading: scannerState.loading,
    scanPage: scannerState.scanPage,
    scanLiveNow: scannerState.scanLiveNow,
    advanceSourcePage: scannerState.advanceSourcePage,
    checkGalleryFill: scannerState.checkGalleryFill,
    onGalleryScroll: scannerState.onGalleryScroll,
    toggleFavorite: downloadsState.toggleFavorite,
    downloadItem: downloadsState.downloadItem,
    removeSavedFile: downloadsState.removeSavedFile,
    clearFavorites: downloadsState.clearFavorites,
    clearLibrary: downloadsState.clearLibrary,
    closeGallery,
    isAdvancing: scannerState.isAdvancing,
    hasReachedEnd: scannerState.hasReachedEnd
  };

  return (
    <GalleryContext.Provider value={value}>
      {children}
    </GalleryContext.Provider>
  );
}

export function useGallery() {
  const ctx = useContext(GalleryContext);
  if (!ctx) throw new Error('useGallery must be used within a GalleryProvider');
  return ctx;
}
