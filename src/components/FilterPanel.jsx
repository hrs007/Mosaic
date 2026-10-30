import React from 'react';
import { useGallery } from '../context/GalleryContext.jsx';

export default function FilterPanel() {
  const {
    filtersOpen,
    prefs,
    setPrefs,
    minKb,
    setMinKb,
    orientation,
    setOrientation,
    setActiveType,
    setSiteFilter,
    setSearch
  } = useGallery();

  if (!filtersOpen) return null;

  const handleAutoplayChange = (mode) => {
    setPrefs({ autoplayMode: mode });
  };

  const handleMinKbChange = (size) => {
    setMinKb(size);
    setPrefs({ minKb: size });
  };

  const handleOrientationChange = (ori) => {
    setOrientation(ori);
    setPrefs({ orientation: ori });
  };

  const handleClearAll = () => {
    setActiveType('all');
    setSiteFilter('');
    setMinKb(0);
    setOrientation('any');
    setSearch('');
    setPrefs({
      activeType: 'all',
      minKb: 0,
      orientation: 'any',
      hideSmall: false,
      hideDuplicates: false
    });
  };

  return (
    <div className="filter-panel" id="filterPanel">
      <div className="filter-group">
        <span className="filter-title">AUTOPLAY</span>
        <div className="size-options">
          <button
            className={`size-chip autoplay-chip ${prefs.autoplayMode === 'hover' ? 'active' : ''}`}
            data-mode="hover"
            onClick={() => handleAutoplayChange('hover')}
          >
            On hover
          </button>
          <button
            className={`size-chip autoplay-chip ${prefs.autoplayMode === 'grid' ? 'active' : ''}`}
            data-mode="grid"
            onClick={() => handleAutoplayChange('grid')}
          >
            All in grid
          </button>
          <button
            className={`size-chip autoplay-chip ${prefs.autoplayMode === 'off' ? 'active' : ''}`}
            data-mode="off"
            onClick={() => handleAutoplayChange('off')}
          >
            Off
          </button>
        </div>
      </div>

      <div className="filter-group">
        <span className="filter-title">MINIMUM SIZE</span>
        <div className="size-options">
          <button
            className={`size-chip ${minKb === 0 ? 'active' : ''}`}
            data-size="0"
            onClick={() => handleMinKbChange(0)}
          >
            Any
          </button>
          <button
            className={`size-chip ${minKb === 100 ? 'active' : ''}`}
            data-size="100"
            onClick={() => handleMinKbChange(100)}
          >
            100 KB+
          </button>
          <button
            className={`size-chip ${minKb === 500 ? 'active' : ''}`}
            data-size="500"
            onClick={() => handleMinKbChange(500)}
          >
            500 KB+
          </button>
          <button
            className={`size-chip ${minKb === 1000 ? 'active' : ''}`}
            data-size="1000"
            onClick={() => handleMinKbChange(1000)}
          >
            1 MB+
          </button>
        </div>
      </div>

      <div className="filter-group">
        <span className="filter-title">ORIENTATION</span>
        <div className="size-options">
          <button
            className={`orientation-chip ${orientation === 'any' ? 'active' : ''}`}
            data-orientation="any"
            onClick={() => handleOrientationChange('any')}
          >
            Any
          </button>
          <button
            className={`orientation-chip ${orientation === 'landscape' ? 'active' : ''}`}
            data-orientation="landscape"
            onClick={() => handleOrientationChange('landscape')}
          >
            Landscape
          </button>
          <button
            className={`orientation-chip ${orientation === 'portrait' ? 'active' : ''}`}
            data-orientation="portrait"
            onClick={() => handleOrientationChange('portrait')}
          >
            Portrait
          </button>
          <button
            className={`orientation-chip ${orientation === 'square' ? 'active' : ''}`}
            data-orientation="square"
            onClick={() => handleOrientationChange('square')}
          >
            Square
          </button>
        </div>
      </div>

      <div className="filter-group filter-checks">
        <label>
          <input
            type="checkbox"
            id="hideSmall"
            checked={!!prefs.hideSmall}
            onChange={e => setPrefs({ hideSmall: e.target.checked })}
          />
          {' '}Hide tiny images (&lt; 120px)
        </label>
        <label>
          <input
            type="checkbox"
            id="hideDuplicates"
            checked={!!prefs.hideDuplicates}
            onChange={e => setPrefs({ hideDuplicates: e.target.checked })}
          />
          {' '}Hide duplicates
        </label>
        <button id="clearFilters" onClick={handleClearAll}>
          Clear all
        </button>
      </div>
    </div>
  );
}
