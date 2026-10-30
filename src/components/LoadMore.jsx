import React, { useEffect, useRef } from 'react';
import { useGallery } from '../context/GalleryContext.jsx';

export default function LoadMore() {
  const {
    filtered,
    page,
    setPage,
    perPage,
    advanceSourcePage,
    isAdvancing,
    loading,
    hasReachedEnd,
    activeType
  } = useGallery();

  const sentinelRef = useRef(null);
  const lastAdvanceTimeRef = useRef(0);
  const remain = filtered.length - page * perPage;
  const isPageMedia = activeType !== 'favorites' && activeType !== 'files';

  // Automatically load media beforehand when the sentinel approaches the viewport
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const scroller = sentinel.closest('.app-shell') || null;
    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting) {
          const now = Date.now();
          if (now - lastAdvanceTimeRef.current < 250) return;
          lastAdvanceTimeRef.current = now;

          // Auto-load next batch of media beforehand if remaining
          if (remain > 0) {
            setPage(p => p + 1);
          }

          // Auto-advance the source page in tab beforehand (only if not already reached end)
          if (isPageMedia && !hasReachedEnd) {
            advanceSourcePage();
          }
        }
      },
      {
        root: scroller,
        rootMargin: '1000px 0px 1000px 0px',
        threshold: 0
      }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [remain, isPageMedia, hasReachedEnd, setPage, advanceSourcePage]);

  // If there are no items in current filter, don't show anything (EmptyState will handle)
  if (!filtered.length) return null;

  // Show end indicator when all filtered items are rendered and page end is confirmed
  const showEndIndicator = remain <= 0 && (!isPageMedia || hasReachedEnd);

  return (
    <div
      ref={sentinelRef}
      className="load-more-wrap"
      id="loadMoreWrap"
      aria-live="polite"
    >
      {showEndIndicator ? (
        <div className="gallery-end-indicator" id="galleryEndIndicator" role="status">
          <div className="gallery-end-divider" />
          <div
            className="gallery-end-badge"
            role="button"
            tabIndex={0}
            title="Click to check for more media"
            onClick={() => {
              if (isPageMedia) advanceSourcePage(true);
            }}
          >
            <span className="gallery-end-icon" aria-hidden="true">✓</span>
            <span className="gallery-end-title">End of page reached</span>
            <span className="gallery-end-count">• {filtered.length} {filtered.length === 1 ? 'item' : 'items'} found</span>
          </div>
        </div>
      ) : (isAdvancing || loading) ? (
        <>
          <span className="spinner"></span>
          <span>Loading more media…</span>
        </>
      ) : (
        <span style={{ display: 'inline-block', height: '1px', width: '1px', opacity: 0 }}></span>
      )}
    </div>
  );
}
