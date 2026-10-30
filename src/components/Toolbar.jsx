import React, { useState, useEffect, useRef } from 'react';
import { useGallery } from '../context/GalleryContext.jsx';

const sortOptions = [
  { id: 'largest', label: 'Largest first' },
  { id: 'smallest', label: 'Smallest first' },
  { id: 'newest', label: 'Oldest → newest' },
  { id: 'name', label: 'Name A–Z' },
];

export default function Toolbar() {
  const {
    activeType,
    setActiveType,
    setSiteFilter,
    counts,
    search,
    setSearch,
    filtersOpen,
    setFiltersOpen,
    sortBy,
    setSortBy,
    setPrefs
  } = useGallery();

  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const sortWrapRef = useRef(null);

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (sortWrapRef.current && !sortWrapRef.current.contains(e.target)) {
        setSortMenuOpen(false);
      }
    };
    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, []);

  const handleTabChange = (type) => {
    setActiveType(type);
    setSiteFilter('');
    setPrefs({ activeType: type });
  };

  const handleSortSelect = (id) => {
    setSortBy(id);
    setPrefs({ sortBy: id });
    setSortMenuOpen(false);
  };

  const currentSortLabel = sortOptions.find(o => o.id === sortBy)?.label || 'Largest first';

  return (
    <div className="toolbar">
      <div className="tabs" role="tablist">
        <button
          className={`tab ${activeType === 'all' ? 'active' : ''}`}
          data-type="all"
          onClick={() => handleTabChange('all')}
        >
          Everything <span id="countAll">{counts.all}</span>
        </button>
        <button
          className={`tab ${activeType === 'image' ? 'active' : ''}`}
          data-type="image"
          onClick={() => handleTabChange('image')}
        >
          Images <span id="countImage">{counts.image}</span>
        </button>
        <button
          className={`tab ${activeType === 'video' ? 'active' : ''}`}
          data-type="video"
          onClick={() => handleTabChange('video')}
        >
          Videos <span id="countVideo">{counts.video}</span>
        </button>
        <button
          className={`tab ${activeType === 'files' ? 'active' : ''}`}
          data-type="files"
          onClick={() => handleTabChange('files')}
        >
          Saved <span id="countSaved">{counts.saved}</span>
        </button>
        <button
          className={`tab ${activeType === 'favorites' ? 'active' : ''}`}
          data-type="favorites"
          onClick={() => handleTabChange('favorites')}
        >
          Favorites <span id="countFavorites">{counts.favorites}</span>
        </button>
      </div>

      <div className="toolbar-controls">
        <label className="searchbox">
          <span>⌕</span>
          <input
            id="searchInput"
            placeholder="Search media…"
            autoComplete="off"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <kbd>⌘ K</kbd>
        </label>

        <button
          className={`filter-button ${filtersOpen ? 'active' : ''}`}
          id="filterToggle"
          onClick={() => {
            const next = !filtersOpen;
            setFiltersOpen(next);
            setPrefs({ filtersOpen: next });
          }}
        >
          ☷ <span>Filters</span>
          <b id="filterIndicator"></b>
        </button>

        <div className="sort-wrap" ref={sortWrapRef}>
          <button
            className="sort-button"
            id="sortButton"
            onClick={() => setSortMenuOpen(prev => !prev)}
          >
            ↕ <span id="sortLabel">{currentSortLabel}</span>
            <span className="chevron">⌄</span>
          </button>

          {sortMenuOpen && (
            <div className="sort-menu" id="sortMenu">
              {sortOptions.map(opt => (
                <button
                  key={opt.id}
                  data-sort={opt.id}
                  className={sortBy === opt.id ? 'font-semibold' : ''}
                  onClick={() => handleSortSelect(opt.id)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
