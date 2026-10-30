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
          if (now - lastAdvanceTimeRef.current < 200) return;
          lastAdvanceTimeRef.current = now;

          // Auto-load next batch of media beforehand if remaining
          if (remain > 0) {
            setPage(p => p + 1);
          }

          // Auto-advance the source page in tab beforehand only if not yet reached end
          if (isPageMedia && !hasReachedEnd) {
            advanceSourcePage();
          }
        }
      },
      {
        root: scroller,
        rootMargin: '1200px 0px 1200px 0px',
        threshold: 0
      }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [remain, isPageMedia, hasReachedEnd, setPage, advanceSourcePage]);

  // If there are no items in current filter, don't show anything (EmptyState will handle)
  if (!filtered.length) return null;

  // When all items in the gallery are visible and the page reached the end (or in favorites/files), render nothing!
  if (remain <= 0 && (!isPageMedia || hasReachedEnd)) {
    return null;
  }

  return (
    <div
      ref={sentinelRef}
      className="load-more-wrap"
      id="loadMoreWrap"
      aria-live="polite"
    >
      {isAdvancing && !hasReachedEnd ? (
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
