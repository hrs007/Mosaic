import React from 'react';
import { useGallery } from '../context/GalleryContext.jsx';
import { ResetIcon } from '../constants/icons.jsx';

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
      hideDuplicates: false,
      hideAvatars: true
    });
  };

  const isFilterActive = Boolean(
    minKb > 0 ||
    orientation !== 'any' ||
    prefs.hideSmall ||
    prefs.hideDuplicates ||
    prefs.hideAvatars === false
  );

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

      <div className="filter-group filter-rules-group">
        <span className="filter-title">CLEANUP</span>
        <div className="filter-rules-row">
          {/* Hide tiny with integrated threshold dropdown */}
          <div className={`filter-rule-pill has-select ${prefs.hideSmall ? 'active' : ''}`}>
            <label className="rule-label" htmlFor="hideSmall" title="Filter out images smaller than the selected threshold">
              <input
                type="checkbox"
                id="hideSmall"
                className="rule-checkbox"
                checked={!!prefs.hideSmall}
                onChange={e => setPrefs({ hideSmall: e.target.checked })}
              />
              <span className="rule-text">Hide tiny</span>
            </label>
            <div className="rule-divider" />
            <div className="rule-select-wrap">
              <span className="rule-lt">&lt;</span>
              <select
                id="tinySizeSelect"
                className="rule-select"
                value={prefs.minImageDimension || 200}
                onChange={e => {
                  setPrefs({
                    minImageDimension: Number(e.target.value),
                    hideSmall: true
                  });
                }}
                title="Select tiny image size threshold"
              >
                <option value={80}>80px</option>
                <option value={120}>120px</option>
                <option value={150}>150px</option>
                <option value={200}>200px</option>
                <option value={250}>250px</option>
                <option value={300}>300px</option>
                <option value={400}>400px</option>
              </select>
              <span className="rule-select-arrow" aria-hidden="true">▾</span>
            </div>
          </div>

          {/* Hide duplicates */}
          <label
            className={`filter-rule-pill ${prefs.hideDuplicates ? 'active' : ''}`}
            htmlFor="hideDuplicates"
            title="Filter out repeated or duplicate images"
          >
            <input
              type="checkbox"
              id="hideDuplicates"
              className="rule-checkbox"
              checked={!!prefs.hideDuplicates}
              onChange={e => setPrefs({ hideDuplicates: e.target.checked })}
            />
            <span className="rule-text">Hide duplicates</span>
          </label>

          {/* Hide avatars / profile pictures */}
          <label
            className={`filter-rule-pill ${prefs.hideAvatars !== false ? 'active' : ''}`}
            htmlFor="hideAvatars"
            title="Filter out profile pictures and avatars"
          >
            <input
              type="checkbox"
              id="hideAvatars"
              className="rule-checkbox"
              checked={prefs.hideAvatars !== false}
              onChange={e => setPrefs({ hideAvatars: e.target.checked })}
            />
            <span className="rule-text">Hide avatars</span>
          </label>
        </div>
      </div>

      <div className="filter-group filter-actions-group">
        <span className="filter-title">&nbsp;</span>
        <button
          id="clearFilters"
          className={`clear-filters-btn ${isFilterActive ? 'has-active' : ''}`}
          onClick={handleClearAll}
          title="Reset all filters to default"
        >
          <ResetIcon size={12} className="clear-icon" />
          <span>Clear all</span>
        </button>
      </div>
    </div>
  );
}
