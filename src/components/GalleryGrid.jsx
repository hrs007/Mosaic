import React, { useMemo, useState, useEffect, useRef } from 'react';
import { useGallery } from '../context/GalleryContext.jsx';
import MediaCard from './MediaCard.jsx';

function getColumnCount(width, userColumns) {
  if (width <= 480) return 2;
  if (width <= 760) return 3;
  if (width <= 1100) return Math.min(Number(userColumns) || 4, 4);
  const cols = Number(userColumns) || 6;
  if (width >= 1500 && !userColumns) return 7;
  return cols;
}

export default function GalleryGrid() {
  const { filtered, viewMode, page, perPage, prefs, sortBy, activeType } = useGallery();

  // Dynamic column count calculation based on window width and user preferences
  const [columnCount, setColumnCount] = useState(() =>
    getColumnCount(typeof window !== 'undefined' ? window.innerWidth : 1200, prefs.columns)
  );

  useEffect(() => {
    const handleResize = () => {
      setColumnCount(getColumnCount(window.innerWidth, prefs.columns));
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [prefs.columns]);

  // Create an IntersectionObserver for video grid autoplay
  const observer = useMemo(() => {
    if (typeof IntersectionObserver === 'undefined') return null;
    return new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        const video = entry.target;
        if (!video) return;
        if (entry.isIntersecting) {
          if (prefs.autoplayMode === 'grid') {
            video.muted = true;
            video.defaultMuted = true;
            video.play().catch(() => {});
          }
        } else {
          video.pause();
        }
      });
    }, { rootMargin: '200px 0px', threshold: 0.05 });
  }, [prefs.autoplayMode]);

  const visibleItems = useMemo(() => {
    return filtered.slice(0, page * perPage);
  }, [filtered, page, perPage]);

  // Stable Column Assignments for Masonry View
  // Ensures existing media items NEVER shift or jump when new media is appended
  const assignedColumnsRef = useRef(new Map());
  const prevColumnCountRef = useRef(columnCount);
  const prevSortRef = useRef(sortBy);
  const prevTypeRef = useRef(activeType);

  // If column count, sort order, or category filter changes, re-partition columns
  if (
    prevColumnCountRef.current !== columnCount ||
    prevSortRef.current !== sortBy ||
    prevTypeRef.current !== activeType
  ) {
    assignedColumnsRef.current.clear();
    prevColumnCountRef.current = columnCount;
    prevSortRef.current = sortBy;
    prevTypeRef.current = activeType;
  }

  const masonryColumns = useMemo(() => {
    if (viewMode !== 'masonry') return [];

    const numCols = Math.max(1, columnCount);
    const cols = Array.from({ length: numCols }, () => []);
    const heights = new Array(numCols).fill(0);

    visibleItems.forEach((item, index) => {
      let colIdx;
      if (assignedColumnsRef.current.has(item.id)) {
        colIdx = assignedColumnsRef.current.get(item.id);
        if (colIdx >= numCols) colIdx = 0;
      } else {
        // Find column with minimum height for balanced Pinterest-style packing
        let minCol = 0;
        let minH = heights[0];
        for (let i = 1; i < numCols; i++) {
          if (heights[i] < minH) {
            minH = heights[i];
            minCol = i;
          }
        }
        colIdx = minCol;
        assignedColumnsRef.current.set(item.id, colIdx);
      }

      cols[colIdx].push({ item, index });

      // Estimate item height for subsequent balance
      const ratio = (item.width && item.height) ? (item.width / item.height) : (item.ratio || 1.1);
      const h = Math.max(0.5, Math.min(2.5, 1 / ratio)) + 0.35;
      heights[colIdx] += h;
    });

    return cols;
  }, [visibleItems, viewMode, columnCount, sortBy, activeType]);

  if (!visibleItems.length) return null;

  if (viewMode === 'masonry') {
    return (
      <div id="gallery" className="gallery-grid masonry">
        {masonryColumns.map((colItems, colIdx) => (
          <div key={colIdx} className="masonry-col">
            {colItems.map(({ item, index }) => (
              <MediaCard
                key={item.id}
                item={item}
                index={index}
                observer={observer}
              />
            ))}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div
      id="gallery"
      className="gallery-grid"
    >
      {visibleItems.map((item, index) => (
        <MediaCard
          key={item.id}
          item={item}
          index={index}
          observer={observer}
        />
      ))}
    </div>
  );
}
