import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { isItemGif } from '../utils/mediaHelpers.js';

export function useGalleryFilters({ media, savedMedia, savedFiles, prefs, onFilterChange }) {
  const [activeType, setActiveTypeState] = useState('all');
  const [savedFilter, setSavedFilterState] = useState('all');
  const [siteFilter, setSiteFilterState] = useState('');
  const [sortBy, setSortByState] = useState('largest');
  const [minKb, setMinKbState] = useState(0);
  const [orientation, setOrientationState] = useState('any');
  const [viewMode, setViewMode] = useState('grid');
  const [search, setSearchState] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [page, setPage] = useState(1);
  const perPage = 60;

  const userSortTriggeredRef = useRef(true);
  const orderedIdsRef = useRef([]);
  const filteredLengthRef = useRef(0);
  const activeTypeRef = useRef(activeType);
  activeTypeRef.current = activeType;

  // Handlers that reset page and trigger callback
  const setActiveType = useCallback((type) => {
    userSortTriggeredRef.current = true;
    setPage(1);
    setActiveTypeState(type);
    onFilterChange?.(type);
  }, [onFilterChange]);

  const setSavedFilter = useCallback((filter) => {
    userSortTriggeredRef.current = true;
    setPage(1);
    setSavedFilterState(filter);
    onFilterChange?.();
  }, [onFilterChange]);

  const setSiteFilter = useCallback((filter) => {
    userSortTriggeredRef.current = true;
    setPage(1);
    setSiteFilterState(filter);
    onFilterChange?.();
  }, [onFilterChange]);

  const setSortBy = useCallback((sort) => {
    userSortTriggeredRef.current = true;
    setPage(1);
    setSortByState(sort);
  }, []);

  const setMinKb = useCallback((kb) => {
    userSortTriggeredRef.current = true;
    setPage(1);
    setMinKbState(kb);
    onFilterChange?.();
  }, [onFilterChange]);

  const setOrientation = useCallback((ori) => {
    userSortTriggeredRef.current = true;
    setPage(1);
    setOrientationState(ori);
    onFilterChange?.();
  }, [onFilterChange]);

  const setSearch = useCallback((s) => {
    userSortTriggeredRef.current = true;
    setPage(1);
    setSearchState(s);
    onFilterChange?.();
  }, [onFilterChange]);

  // Persist Gallery Filter State
  useEffect(() => {
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime?.id && chrome.storage?.local) {
        chrome.storage.local.set({
          mosaicGalleryState: {
            activeType,
            savedFilter,
            siteFilter,
            sortBy,
            minKb,
            orientation,
            viewMode,
            search,
            filtersOpen
          }
        });
      }
    } catch {}
  }, [activeType, savedFilter, siteFilter, sortBy, minKb, orientation, viewMode, search, filtersOpen]);

  // Filtered & Sorted Media Computation
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    let list = [];

    if (activeType === 'favorites') {
      list = [...savedMedia.values()];
    } else if (activeType === 'files') {
      list = savedFiles
        .filter(x => savedFilter === 'all' || x.type === savedFilter)
        .map(x => ({
          ...x,
          id: x.id,
          savedFile: true,
          url: x.sourceUrl || '',
          sourceUrl: x.sourceUrl
        }));
    } else {
      list = media.filter(x => !x.unavailable && (activeType === 'all' || x.type === activeType));
    }

    if (siteFilter === 'x') list = list.filter(x => x.site === 'x');
    else if (siteFilter === 'x-playable') list = list.filter(x => x.site === 'x' && x.type === 'video' && /^https:\/\/video\.twimg\.com\//i.test(x.url));
    else if (siteFilter === 'reddit' || siteFilter === 'reddit-hosted') list = list.filter(x => x.site === 'reddit' && (siteFilter !== 'reddit-hosted' || /redd\.it|reddit\.com/i.test(x.url)));
    else if (siteFilter === 'youtube') list = list.filter(x => x.site === 'youtube');

    if (term) {
      list = list.filter(x =>
        `${x.alt} ${x.url} ${x.pageTitle} ${x.fileName || ''} ${x.site || ''} ${isItemGif(x) ? 'gif' : ''}`
          .toLowerCase()
          .includes(term)
      );
    }

    if (minKb) {
      list = list.filter(x => {
        const bytes = x.size || (x.width && x.height ? x.width * x.height * 0.3 : 0);
        return !bytes || bytes >= minKb * 1024;
      });
    }

    if (orientation !== 'any') {
      list = list.filter(x => {
        if (!x.width || !x.height) return true;
        const ratio = x.width / x.height;
        return orientation === 'landscape' ? ratio > 1.12 : orientation === 'portrait' ? ratio < 0.88 : ratio >= 0.88 && ratio <= 1.12;
      });
    }

    if (prefs.hideSmall) {
      list = list.filter(x => x.type === 'video' || !x.width || !x.height || (x.width >= 120 && x.height >= 120));
    }

    if (prefs.hideDuplicates) {
      const seen = new Set();
      list = list.filter(x => {
        const key = `${x.width}x${x.height}:${x.url.split('?')[0].replace(/[-_](\d+x\d+|\d+)(?=\.[a-z]+$)/i, '')}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }

    // Stable sort logic: preserve existing cards at their exact display positions
    if (userSortTriggeredRef.current || !orderedIdsRef.current.length) {
      list.sort((a, b) => {
        if (sortBy === 'smallest') return (a.size || Infinity) - (b.size || Infinity);
        if (sortBy === 'newest') return (a.index || 0) - (b.index || 0);
        if (sortBy === 'name') return a.url.localeCompare(b.url);
        return (b.size || b.width * b.height) - (a.size || a.width * a.height);
      });
      userSortTriggeredRef.current = false;
    } else {
      const existingOrder = new Map(orderedIdsRef.current.map((id, idx) => [id, idx]));
      const alreadyShown = list
        .filter(item => existingOrder.has(item.id))
        .sort((a, b) => existingOrder.get(a.id) - existingOrder.get(b.id));
      const newArrivals = list.filter(item => !existingOrder.has(item.id));

      if (sortBy === 'smallest') {
        newArrivals.sort((a, b) => (a.size || Infinity) - (b.size || Infinity));
      } else if (sortBy === 'newest') {
        newArrivals.sort((a, b) => (a.index || 0) - (b.index || 0));
      } else if (sortBy === 'name') {
        newArrivals.sort((a, b) => a.url.localeCompare(b.url));
      } else {
        newArrivals.sort((a, b) => (b.size || b.width * b.height) - (a.size || a.width * a.height));
      }

      list = [...alreadyShown, ...newArrivals];
    }

    orderedIdsRef.current = list.map(x => x.id);
    filteredLengthRef.current = list.length;

    return list;
  }, [media, savedMedia, savedFiles, activeType, savedFilter, siteFilter, search, minKb, orientation, prefs.hideSmall, prefs.hideDuplicates, sortBy]);

  // Counts
  const counts = useMemo(() => {
    const available = media.filter(x => !x.unavailable);
    return {
      all: available.length,
      image: available.filter(x => x.type === 'image').length,
      video: available.filter(x => x.type === 'video').length,
      saved: savedFiles.length,
      favorites: savedMedia.size
    };
  }, [media, savedFiles, savedMedia]);

  return {
    activeType,
    setActiveType,
    savedFilter,
    setSavedFilter,
    siteFilter,
    setSiteFilter,
    sortBy,
    setSortBy,
    minKb,
    setMinKb,
    orientation,
    setOrientation,
    viewMode,
    setViewMode,
    search,
    setSearch,
    filtersOpen,
    setFiltersOpen,
    page,
    setPage,
    perPage,
    filtered,
    counts,
    activeTypeRef,
    filteredLengthRef,
    userSortTriggeredRef,
    orderedIdsRef,
    setActiveTypeState,
    setSavedFilterState,
    setSortByState,
    setMinKbState,
    setOrientationState
  };
}
