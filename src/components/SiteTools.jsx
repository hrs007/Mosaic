import React, { useMemo } from 'react';
import { useGallery } from '../context/GalleryContext.jsx';
import { getInstagramHashtagUrl } from '../utils/mediaHelpers.js';

export default function SiteTools() {
  const {
    activeType,
    siteProfile,
    siteFilter,
    setSiteFilter,
    setActiveType,
    scanPage,
    filtered,
    navigateToInstagram
  } = useGallery();

  const popularHashtags = useMemo(() => {
    if (siteProfile?.key !== 'instagram' || !Array.isArray(filtered)) return [];
    const counts = new Map();
    filtered.forEach(item => {
      const tags = Array.isArray(item.hashtags) ? item.hashtags : (Array.isArray(item.tags) ? item.tags : []);
      tags.forEach(t => {
        const clean = String(t).toLowerCase();
        counts.set(clean, (counts.get(clean) || 0) + 1);
      });
    });
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(e => e[0])
      .slice(0, 5);
  }, [siteProfile?.key, filtered]);

  if (activeType === 'files') return null;

  const handleSiteFilter = (type, filter = '') => {
    setActiveType(type);
    setSiteFilter(filter);
  };

  return (
    <section className="site-tools" id="siteTools">
      <div className="site-profile">
        <span id="siteGlyph">{siteProfile.glyph || '◉'}</span>
        <div>
          <b id="siteName">
            {siteProfile.key === 'x' ? 'X media'
              : siteProfile.key === 'reddit' ? 'Reddit media'
              : siteProfile.key === 'youtube' ? 'YouTube videos'
              : siteProfile.key === 'tumblr' ? 'Tumblr media'
              : siteProfile.key === 'instagram' ? 'Instagram media'
              : 'Page media'}
          </b>
          <small id="siteHint">
            {siteProfile.key === 'x' ? 'Loaded posts · playable clips · originals'
              : siteProfile.key === 'reddit' ? 'Post images · hosted videos · discussions'
              : siteProfile.key === 'youtube' ? 'Watch videos · shorts · embedded players'
              : siteProfile.key === 'tumblr' ? 'Photosets · GIFs · original sizes · posts'
              : siteProfile.key === 'instagram' ? 'Loaded posts · high-res photos · reels · carousels'
              : 'Actions for media on this page'}
          </small>
        </div>
      </div>

      <div className="site-actions" id="siteActions">
        <button className="site-action" onClick={() => scanPage()}>
          Scan loaded posts
        </button>

        {siteProfile.key === 'x' && (
          <>
            <button
              className={`site-action ${siteFilter === 'x' && activeType === 'all' ? 'active' : ''}`}
              onClick={() => handleSiteFilter('all', 'x')}
            >
              All X media
            </button>
            <button
              className={`site-action ${siteFilter === 'x-playable' ? 'active' : ''}`}
              onClick={() => handleSiteFilter('video', 'x-playable')}
            >
              Playable clips
            </button>
            <button
              className={`site-action ${siteFilter === 'x' && activeType === 'image' ? 'active' : ''}`}
              onClick={() => handleSiteFilter('image', 'x')}
            >
              X images
            </button>
            <button
              className={`site-action ${siteFilter === 'x' && activeType === 'gif' ? 'active' : ''}`}
              onClick={() => handleSiteFilter('gif', 'x')}
            >
              X GIFs
            </button>
          </>
        )}

        {siteProfile.key === 'reddit' && (
          <>
            <button
              className={`site-action ${siteFilter === 'reddit' && activeType === 'image' ? 'active' : ''}`}
              onClick={() => handleSiteFilter('image', 'reddit')}
            >
              Reddit images
            </button>
            <button
              className={`site-action ${siteFilter === 'reddit' && activeType === 'gif' ? 'active' : ''}`}
              onClick={() => handleSiteFilter('gif', 'reddit')}
            >
              Reddit GIFs
            </button>
            <button
              className={`site-action ${siteFilter === 'reddit' && activeType === 'video' ? 'active' : ''}`}
              onClick={() => handleSiteFilter('video', 'reddit')}
            >
              Reddit videos
            </button>
            <button
              className={`site-action ${siteFilter === 'reddit-hosted' ? 'active' : ''}`}
              onClick={() => handleSiteFilter('all', 'reddit-hosted')}
            >
              Reddit hosted
            </button>
          </>
        )}

        {siteProfile.key === 'youtube' && (
          <>
            <button
              className={`site-action ${siteFilter === 'youtube' && activeType === 'video' ? 'active' : ''}`}
              onClick={() => handleSiteFilter('video', 'youtube')}
            >
              All videos
            </button>
            <button
              className={`site-action ${siteFilter === 'youtube' && activeType === 'image' ? 'active' : ''}`}
              onClick={() => handleSiteFilter('image', 'youtube')}
            >
              Thumbnails
            </button>
          </>
        )}

        {siteProfile.key === 'tumblr' && (
          <>
            <button
              className={`site-action ${siteFilter === 'tumblr' && activeType === 'all' ? 'active' : ''}`}
              onClick={() => handleSiteFilter('all', 'tumblr')}
            >
              All Tumblr
            </button>
            <button
              className={`site-action ${siteFilter === 'tumblr-photosets' ? 'active' : ''}`}
              onClick={() => handleSiteFilter('all', 'tumblr-photosets')}
            >
              Photosets
            </button>
            <button
              className={`site-action ${siteFilter === 'tumblr' && activeType === 'gif' ? 'active' : ''}`}
              onClick={() => handleSiteFilter('gif', 'tumblr')}
            >
              Tumblr GIFs
            </button>
            <button
              className={`site-action ${siteFilter === 'tumblr' && activeType === 'image' ? 'active' : ''}`}
              onClick={() => handleSiteFilter('image', 'tumblr')}
            >
              Images
            </button>
            <button
              className={`site-action ${siteFilter === 'tumblr' && activeType === 'video' ? 'active' : ''}`}
              onClick={() => handleSiteFilter('video', 'tumblr')}
            >
              Videos
            </button>
          </>
        )}

        {siteProfile.key === 'instagram' && (
          <>
            <button
              className={`site-action ${siteFilter === 'instagram' && activeType === 'all' ? 'active' : ''}`}
              onClick={() => handleSiteFilter('all', 'instagram')}
            >
              All Instagram
            </button>
            <button
              className={`site-action ${siteFilter === 'instagram' && activeType === 'image' ? 'active' : ''}`}
              onClick={() => handleSiteFilter('image', 'instagram')}
            >
              Photos
            </button>
            <button
              className={`site-action ${siteFilter === 'instagram' && activeType === 'video' ? 'active' : ''}`}
              onClick={() => handleSiteFilter('video', 'instagram')}
            >
              Reels & Videos
            </button>
            <button
              className={`site-action ${siteFilter === 'instagram-carousels' ? 'active' : ''}`}
              onClick={() => handleSiteFilter('all', 'instagram-carousels')}
            >
              Carousels
            </button>
            {popularHashtags.map(tag => (
              <button
                key={tag}
                className="site-action tag-action"
                onClick={() => navigateToInstagram ? navigateToInstagram(getInstagramHashtagUrl(tag)) : window.open(getInstagramHashtagUrl(tag), '_blank', 'noopener')}
                title={`Explore #${tag} in extension view`}
              >
                #{tag} ↗
              </button>
            ))}
          </>
        )}

        {siteProfile.key === 'google-images' && (
          <button
            className={`site-action ${activeType === 'image' ? 'active' : ''}`}
            onClick={() => handleSiteFilter('image')}
          >
            Image results
          </button>
        )}
      </div>
    </section>
  );
}
