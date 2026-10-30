# Mosaic — Page Media Gallery

A modern Chrome Manifest V3 extension built with React and Tailwind CSS that collects images and videos from the active page and presents them in a searchable, filterable gallery overlay.

## Development & Build

```bash
# Install dependencies
npm install

# Build the extension bundle (output to dist/)
npm run build

# Watch mode for live development
npm run watch
```

## Install in Chrome

1. Open `chrome://extensions`.
2. Turn on **Developer mode** (top right switch).
3. Click **Load unpacked** and select this directory.
4. Open any webpage (Reddit, YouTube, X, Google Images, or any website) and click the Mosaic extension icon or press **⌘⌥M** (Mac) / **Alt+Shift+M** (Windows/Linux).

## Tech Stack & Architecture

- **React 18**: Modular components (`Header`, `Toolbar`, `FilterPanel`, `GalleryGrid`, `MediaCard`, `MediaViewer`, `SettingsDrawer`, etc.)
- **Tailwind CSS**: Utility-first styling with custom theme tokens (Light, Dark, AMOLED Black, System)
- **Vite 6**: Fast ESM bundler producing optimized standalone assets (`dist/gallery.js` and `dist/gallery.css`)
- **Chrome Manifest V3**: Service worker (`background.js`), injected content script (`content.js`), iframe gallery overlay (`gallery.html`), Declarative Net Request rules for video streaming, and indexedDB (`mosaic-media-library`) for local offline media.

## Features

- **Site-Aware Scanners**: Dedicated extractors for YouTube, Reddit, X (Twitter), Google Images, Imgur, Instagram, Flickr, Tumblr, and generic web pages.
- **Deduplication & High-Res Picking**: Identifies canonical media IDs, selects highest resolution streams (e.g. Reddit DASH permutations, Twitter syndication API), and skips duplicates.
- **Interactive Lightbox (Media Viewer)**: Pure black fullscreen modal with video controls (play, pause, seek, volume, loop, autoplay, fullscreen), double-click Fit/Fill mode, and external actions (reverse image search via Google Lens/Bing/TinEye, original post links).
- **Offline Library & Downloads**: Saved media downloads into `Downloads/Mosaic` with Finder reveal and duplicate download avoidance.
- **Themes & Layouts**: Responsive grid and masonry views, column controls (Auto, 3–8 cols), density modes (comfortable, compact, dense, extra-dense), and themes (Light, Dark, AMOLED Black, System).
