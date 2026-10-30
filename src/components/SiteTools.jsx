import React from 'react';
import { useGallery } from '../context/GalleryContext.jsx';

export default function SiteTools() {
  const {
    activeType,
    siteProfile,
    siteFilter,
    setSiteFilter,
    setActiveType,
    scanPage
  } = useGallery();

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
              : 'Page media'}
          </b>
          <small id="siteHint">
            {siteProfile.key === 'x' ? 'Loaded posts · playable clips · originals'
              : siteProfile.key === 'reddit' ? 'Post images · hosted videos · discussions'
              : siteProfile.key === 'youtube' ? 'Watch videos · shorts · embedded players'
              : siteProfile.key === 'tumblr' ? 'Photosets · GIFs · original sizes · posts'
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
