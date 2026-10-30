# Mosaic — Page Media Gallery

A Chrome Manifest V3 extension that collects images and videos from the active page and presents them in a searchable, filterable gallery.

## Install in Chrome

1. Open `chrome://extensions`.
2. Turn on **Developer mode**.
3. Choose **Load unpacked** and select this folder.
4. Open a regular website and click the Mosaic extension icon.

## Features

- Scans page images, responsive image sources, video sources and posters, video links, and optional CSS background images.
- Search, image/video/saved-file/favorites tabs, orientation and minimum-size filters, duplicate/tiny-image controls, sorting, grid and masonry layouts.
- Full-screen preview with previous/next navigation, keyboard controls, favorites, and a private Mosaic media library.
- Newly saved media is downloaded once by Chrome into Downloads/Mosaic. The Library keeps the Chrome download ID and metadata, so it can show the file in Finder or open it in the default media app without creating a second copy. Previously saved items in a chosen folder remain there and continue to appear in the Library.
- The expanded viewer keeps save and navigation controls compact; its More menu offers Google Lens, Bing Visual Search, TinEye, copying media/post links, and opening the related X post or Reddit discussion.
- Saved media appears in a roomy grid with dates, site labels, Finder reveal, and saved-video open actions. The full-screen viewer has a Fit/Fill toggle and a saved autoplay preference.
- Live discovery checks the page while it changes and retains existing gallery cards as new media arrives.
- Light/dark/system appearance, density, image metadata, background scan, saved-video autoplay, and other stored preferences.
- Runs locally in your browser. Favorites and preferences are stored in Chrome local storage; newly saved files remain in Downloads/Mosaic and their download references are stored by the extension. Existing folder-based saves remain in their original folder.

Save a media item before the site removes it. The extension cannot recover a video after its source is unavailable, and some X or Reddit posts do not expose a downloadable video URL.
