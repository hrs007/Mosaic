import React from 'react';
import { useGallery } from '../context/GalleryContext.jsx';

export default function SettingsDrawer() {
  const {
    settingsOpen,
    setSettingsOpen,
    prefs,
    setPrefs,
    clearFavorites,
    clearLibrary,
    scanPage
  } = useGallery();

  const handleRescan = () => {
    setSettingsOpen(false);
    scanPage();
  };

  return (
    <>
      {settingsOpen && (
        <div
          className="drawer-backdrop"
          id="drawerBackdrop"
          onClick={() => setSettingsOpen(false)}
        />
      )}

      <aside
        className={`settings-drawer ${settingsOpen ? 'open' : ''}`}
        id="settingsDrawer"
        aria-hidden={!settingsOpen}
      >
        <div className="drawer-head">
          <div>
            <div className="eyebrow">YOUR MOSAIC</div>
            <h2>Settings</h2>
          </div>
          <button
            className="icon-button"
            id="settingsClose"
            onClick={() => setSettingsOpen(false)}
          >
            ×
          </button>
        </div>

        <p className="drawer-intro">Make Mosaic feel like yours.</p>

        {/* Gallery Section */}
        <div className="setting-section">
          <h3>Gallery</h3>
          <label className="setting-row">
            <span>
              <b>Show image dimensions</b>
              <small>Display width × height on cards</small>
            </span>
            <input
              type="checkbox"
              id="settingDimensions"
              checked={!!prefs.dimensions}
              onChange={e => setPrefs({ dimensions: e.target.checked })}
            />
          </label>

          <label className="setting-row">
            <span>
              <b>Show file sizes</b>
              <small>Display estimated size when available</small>
            </span>
            <input
              type="checkbox"
              id="settingSizes"
              checked={!!prefs.sizes}
              onChange={e => setPrefs({ sizes: e.target.checked })}
            />
          </label>

          <label className="setting-row">
            <span>
              <b>Open links in new tab</b>
              <small>Keep this gallery right where it is</small>
            </span>
            <input
              type="checkbox"
              id="settingNewTab"
              checked={!!prefs.newTab}
              onChange={e => setPrefs({ newTab: e.target.checked })}
            />
          </label>

          <label className="setting-row">
            <span>
              <b>Include background images</b>
              <small>Scan CSS backgrounds, too</small>
            </span>
            <input
              type="checkbox"
              id="settingBackgrounds"
              checked={!!prefs.backgrounds}
              onChange={e => {
                setPrefs({ backgrounds: e.target.checked });
                scanPage();
              }}
            />
          </label>

          <div className="setting-row">
            <span>
              <b>Tiny image threshold</b>
              <small>Minimum dimension for images when hiding tiny media</small>
            </span>
            <select
              id="settingMinImageDimension"
              value={prefs.minImageDimension || 200}
              onChange={e => setPrefs({ minImageDimension: Number(e.target.value) })}
            >
              <option value={80}>80 px</option>
              <option value={120}>120 px</option>
              <option value={150}>150 px</option>
              <option value={200}>200 px (Default)</option>
              <option value={250}>250 px</option>
              <option value={300}>300 px</option>
              <option value={400}>400 px</option>
            </select>
          </div>

          <div className="setting-row">
            <span>
              <b>On exit scroll position</b>
              <small>Return to previous scroll or keep scrolled position</small>
            </span>
            <select
              id="settingExitScroll"
              value={prefs.exitScroll || 'previous'}
              onChange={e => setPrefs({ exitScroll: e.target.value })}
            >
              <option value="previous">Previous scroll</option>
              <option value="scrolled">Keep scrolled position</option>
            </select>
          </div>
        </div>

        {/* Playback Section */}
        <div className="setting-section">
          <h3>Playback</h3>
          <div className="setting-row">
            <span>
              <b>Gallery autoplay</b>
              <small>How videos play in the gallery grid</small>
            </span>
            <select
              id="settingAutoplayMode"
              value={prefs.autoplayMode || 'hover'}
              onChange={e => setPrefs({ autoplayMode: e.target.value })}
            >
              <option value="hover">On hover</option>
              <option value="grid">All in grid</option>
              <option value="off">Off</option>
            </select>
          </div>

          <label className="setting-row">
            <span>
              <b>Autoplay in viewer</b>
              <small>Start playback when opening the media viewer</small>
            </span>
            <input
              type="checkbox"
              id="settingAutoplayViewer"
              checked={!!prefs.autoplayViewer}
              onChange={e => setPrefs({ autoplayViewer: e.target.checked })}
            />
          </label>
        </div>

        {/* Appearance Section */}
        <div className="setting-section">
          <h3>Appearance</h3>
          <div className="setting-row">
            <span>
              <b>Gallery density</b>
              <small>Choose your card size</small>
            </span>
            <select
              id="settingDensity"
              value={prefs.density || 'comfortable'}
              onChange={e => setPrefs({ density: e.target.value })}
            >
              <option value="comfortable">Comfortable</option>
              <option value="compact">Compact</option>
              <option value="dense">Dense</option>
              <option value="extra-dense">Extra dense</option>
            </select>
          </div>

          <div className="setting-row">
            <span>
              <b>Columns</b>
              <small>Set the number of gallery columns</small>
            </span>
            <select
              id="settingColumns"
              value={prefs.columns || 'auto'}
              onChange={e => setPrefs({ columns: e.target.value })}
            >
              <option value="auto">Automatic</option>
              <option value="3">3 columns</option>
              <option value="4">4 columns</option>
              <option value="5">5 columns</option>
              <option value="6">6 columns</option>
              <option value="7">7 columns</option>
              <option value="8">8 columns</option>
            </select>
          </div>

          <div className="setting-row">
            <span>
              <b>Theme</b>
              <small>Light, dark, or true black</small>
            </span>
            <select
              id="settingTheme"
              value={prefs.theme || 'light'}
              onChange={e => setPrefs({ theme: e.target.value })}
            >
              <option value="light">Light</option>
              <option value="dark">Dark</option>
              <option value="amoled">AMOLED black</option>
              <option value="system">System</option>
            </select>
          </div>
        </div>

        {/* Shortcuts Section */}
        <div className="setting-section">
          <h3>Shortcuts</h3>
          <div className="setting-row">
            <span>
              <b>Toggle extension</b>
              <small>Press anytime on any webpage</small>
            </span>
            <span className="setting-badge">⌘⌥M / Alt+Shift+M</span>
          </div>

          <div className="setting-row">
            <span>
              <b>Search media</b>
              <small>Focus search bar</small>
            </span>
            <span className="setting-badge">⌘K / Ctrl+K</span>
          </div>

          <div className="setting-row">
            <span>
              <b>Close gallery / viewer</b>
              <small>Dismiss current view</small>
            </span>
            <span className="setting-badge">Esc</span>
          </div>
        </div>

        {/* On this page Section */}
        <div className="setting-section">
          <h3>On this page</h3>
          <div className="setting-row">
            <span>
              <b>Clear saved favorites</b>
              <small>Remove favorites stored on this device</small>
            </span>
            <button className="text-button" id="clearFavorites" onClick={clearFavorites}>
              Clear
            </button>
          </div>

          <div className="setting-row">
            <span>
              <b>Clear Mosaic library</b>
              <small>Remove items from Mosaic; downloaded files stay in Downloads / Mosaic</small>
            </span>
            <button className="text-button" id="clearLibrary" onClick={clearLibrary}>
              Clear
            </button>
          </div>

          <div className="setting-row">
            <span>
              <b>Scan page again</b>
              <small>Find media added since your last scan</small>
            </span>
            <button className="text-button" id="rescanButton" onClick={handleRescan}>
              Scan ↗
            </button>
          </div>
        </div>

        <div className="drawer-footer">
          Mosaic <span>v1.4.6 · Saved in Downloads / Mosaic</span>
        </div>
      </aside>
    </>
  );
}
