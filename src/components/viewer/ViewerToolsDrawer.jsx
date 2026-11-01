import React from 'react';
import {
  filename,
  formatSize,
  getInstagramProfileUrl,
  getInstagramHashtagUrl,
  extractHashtags
} from '../../utils/mediaHelpers.js';
import {
  StarIcon,
  PipIcon,
  CopyIcon,
  ExternalLinkIcon,
  SearchIcon,
  CheckIcon,
  DownloadIcon,
  LoopIcon,
  AutoIcon
} from '../../constants/icons.jsx';

export default function ViewerToolsDrawer({
  isOpen,
  onClose,
  item,
  currentVideoUrl,
  videoVariants = [],
  onSelectResolution,
  isFavorite,
  onToggleFavorite,
  isDownloaded,
  onDownloadItem,
  onRemoveSavedFile,
  onCopyText,
  onReverseSearch,
  onTogglePip,
  hasPip,
  directUrl,
  postOrPage,
  isDirectValid,
  isPostDifferent,
  playbackRate = 1,
  onSelectPlaybackRate,
  isLooping,
  onToggleLoop,
  autoplayViewer,
  onToggleAutoplay,
  onNavigateToInstagram
}) {
  if (!isOpen || !item) return null;

  const isVideo = item.type === 'video' || Boolean(currentVideoUrl);
  const isImage = item.type === 'image' && !isVideo;
  const isReddit = item.site === 'reddit';
  const isX = item.site === 'x';
  const isInstagram = item.site === 'instagram';
  const altAuthor = item.alt ? ((item.alt.match(/(?:Photo|Video)\s+by\s+([^.]+?)\s+on/i)?.[1]) || (item.alt.match(/by\s+@?([a-zA-Z0-9_\.]+)/i)?.[1]) || '') : '';
  const igAuthor = item.author || altAuthor;
  const igLikes = item.likes != null ? item.likes : (item.likeCount != null ? item.likeCount : '');
  const hasIgLikes = (typeof igLikes === 'number' && igLikes > 0) || (typeof igLikes === 'string' && igLikes && !/^(?:0|0\s*likes?)$/i.test(igLikes.trim()));
  const igComments = item.commentCount != null ? item.commentCount : (item.comments != null ? item.comments : '');
  const hasIgComments = (typeof igComments === 'number' && igComments > 0) || (typeof igComments === 'string' && igComments && !/^(?:0|0\s*comments?)$/i.test(igComments.trim()));
  const igHashtags = Array.isArray(item.hashtags) && item.hashtags.length ? item.hashtags : extractHashtags(item.caption || item.alt || '');

  const subreddit = item.subreddit || '';
  const redditAuthor = item.author || '';
  const redditScore = item.score || '';
  const redditComments = item.commentCount || '';
  const postTitle = item.pageTitle || item.alt || '';

  const authorName = item.authorName || '';
  const authorHandle = item.authorHandle || '';
  const tweetText = item.tweetText || '';
  const likes = item.likes || 0;
  const replies = item.replies || 0;

  const playbackRates = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];

  return (
    <div className="viewer-drawer-backdrop" onClick={onClose}>
      <div
        className="viewer-drawer-panel"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-label="Media Tools and Details"
      >
        {/* Drawer Header */}
        <div className="viewer-drawer-header">
          <div className="viewer-drawer-title-row">
            <span className="viewer-drawer-heading">Media Tools & Details</span>
            <span className="viewer-drawer-site-tag">
              {isReddit ? 'Reddit' : isX ? '𝕏' : isInstagram ? 'Instagram' : (item.site?.toUpperCase() || 'WEB')}
            </span>
          </div>
          <button
            className="viewer-drawer-close"
            onClick={onClose}
            aria-label="Close tools panel"
            title="Close"
          >
            ×
          </button>
        </div>

        <div className="viewer-drawer-content">
          {/* Section 1: Platform Context (Reddit / X / Web) */}
          {isReddit && (
            <div className="viewer-drawer-section platform-section">
              <div className="viewer-drawer-section-title">Reddit Post</div>
              <div className="reddit-meta-card">
                <div className="reddit-meta-chips">
                  {subreddit && (
                    <button
                      className="meta-chip subreddit-chip"
                      onClick={() => window.open(`https://reddit.com/${subreddit.replace(/^\/?/, '')}`, '_blank', 'noopener')}
                      title="Open Subreddit in new tab"
                    >
                      {subreddit.startsWith('r/') ? subreddit : `r/${subreddit}`} ↗
                    </button>
                  )}
                  {redditAuthor && (
                    <button
                      className="meta-chip author-chip"
                      onClick={() => window.open(`https://reddit.com/user/${redditAuthor.replace(/^u\//, '')}`, '_blank', 'noopener')}
                      title="Open Author Profile in new tab"
                    >
                      u/{redditAuthor.replace(/^u\//, '')} ↗
                    </button>
                  )}
                  {redditScore && (
                    <span className="meta-chip stat-chip" title="Post score">
                      ▲ {redditScore}
                    </span>
                  )}
                  {redditComments && (
                    <span className="meta-chip stat-chip" title="Comments count">
                      💬 {redditComments}
                    </span>
                  )}
                  {item.galleryTotal > 1 && (
                    <span className="meta-chip gallery-chip">
                      Slide {(item.galleryIndex ?? 0) + 1} of {item.galleryTotal}
                    </span>
                  )}
                </div>

                {postTitle && (
                  <div className="platform-post-title" title={postTitle}>
                    {postTitle}
                  </div>
                )}

                <div className="drawer-btn-row">
                  {postTitle && (
                    <button
                      className="drawer-action-btn"
                      onClick={() => onCopyText(postTitle, 'Post title')}
                    >
                      <CopyIcon size={13} />
                      <span>Copy Title</span>
                    </button>
                  )}
                  {postOrPage && (
                    <button
                      className="drawer-action-btn primary"
                      onClick={() => window.open(postOrPage, '_blank', 'noopener')}
                    >
                      <ExternalLinkIcon size={13} />
                      <span>Open Thread</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {isX && (
            <div className="viewer-drawer-section platform-section">
              <div className="viewer-drawer-section-title">𝕏 Post</div>
              <div className="x-meta-card">
                <div className="x-author-row">
                  {authorHandle ? (
                    <button
                      className="x-author-btn"
                      onClick={() => window.open(`https://x.com/${authorHandle}`, '_blank', 'noopener')}
                      title={`Open @${authorHandle} on X`}
                    >
                      <span className="x-author-name">{authorName || authorHandle}</span>
                      <span className="x-author-handle">@{authorHandle} ↗</span>
                    </button>
                  ) : authorName ? (
                    <span className="x-author-name">{authorName}</span>
                  ) : null}

                  <div className="x-stats-row">
                    {likes > 0 && <span className="x-stat-badge">♥ {likes.toLocaleString()}</span>}
                    {replies > 0 && <span className="x-stat-badge">💬 {replies.toLocaleString()}</span>}
                  </div>
                </div>

                {tweetText && (
                  <div className="x-tweet-caption">
                    {tweetText}
                  </div>
                )}

                <div className="drawer-btn-row">
                  {tweetText && (
                    <button
                      className="drawer-action-btn"
                      onClick={() => onCopyText(tweetText, 'Tweet text')}
                    >
                      <CopyIcon size={13} />
                      <span>Copy Tweet Text</span>
                    </button>
                  )}
                  {postOrPage && (
                    <button
                      className="drawer-action-btn primary"
                      onClick={() => window.open(postOrPage, '_blank', 'noopener')}
                    >
                      <ExternalLinkIcon size={13} />
                      <span>Open on 𝕏</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {isInstagram && (
            <div className="viewer-drawer-section platform-section">
              <div className="viewer-drawer-section-title">Instagram Post</div>
              <div className="instagram-meta-card">
                <div className="x-author-row">
                  {igAuthor ? (
                    <button
                      className="x-author-btn"
                      onClick={() => onNavigateToInstagram ? onNavigateToInstagram(getInstagramProfileUrl(igAuthor)) : window.open(getInstagramProfileUrl(igAuthor), '_blank', 'noopener')}
                      title={`Open @${igAuthor} profile in extension view`}
                    >
                      <span className="x-author-name">@{igAuthor}</span>
                      <span className="x-author-handle" style={{ color: '#f43f5e' }}>↗</span>
                    </button>
                  ) : (
                    <span className="x-author-name">Instagram Media</span>
                  )}

                  <div className="x-stats-row">
                    {hasIgLikes && (
                      <span className="x-stat-badge">♥ {typeof igLikes === 'number' ? Number(igLikes).toLocaleString() : igLikes}</span>
                    )}
                    {hasIgComments && (
                      <span className="x-stat-badge">💬 {typeof igComments === 'number' ? Number(igComments).toLocaleString() : igComments}</span>
                    )}
                    {item.galleryTotal > 1 && (
                      <span className="meta-chip gallery-chip" style={{ fontSize: '10.5px', padding: '2px 8px' }}>
                        Slide {(item.galleryIndex ?? 0) + 1} of {item.galleryTotal}
                      </span>
                    )}
                  </div>
                </div>

                {/* Hashtag List */}
                {igHashtags.length > 0 && (
                  <div className="instagram-drawer-hashtags">
                    <div style={{ fontSize: '11px', color: '#94a3b8', margin: '4px 0 2px' }}>
                      Hashtags (Click to open in extension view):
                    </div>
                    <div className="reddit-meta-chips" style={{ gap: '5px' }}>
                      {igHashtags.map(tag => (
                        <button
                          key={tag}
                          className="meta-chip instagram-tag-chip"
                          onClick={() => onNavigateToInstagram ? onNavigateToInstagram(getInstagramHashtagUrl(tag)) : window.open(getInstagramHashtagUrl(tag), '_blank', 'noopener')}
                          title={`Explore #${tag} on Instagram in extension view`}
                        >
                          #{tag} ↗
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {item.caption && (
                  <div className="x-tweet-caption">
                    {item.caption}
                  </div>
                )}

                <div className="drawer-btn-row">
                  {item.caption && (
                    <button
                      className="drawer-action-btn"
                      onClick={() => onCopyText(item.caption, 'Caption')}
                    >
                      <CopyIcon size={13} />
                      <span>Copy Caption</span>
                    </button>
                  )}
                  {postOrPage && (
                    <button
                      className="drawer-action-btn primary"
                      onClick={() => onNavigateToInstagram ? onNavigateToInstagram(postOrPage) : window.open(postOrPage, '_blank', 'noopener')}
                    >
                      <ExternalLinkIcon size={13} />
                      <span>Open in Extension View ↗</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Section 2: Video Stream & Playback Options (If Video) */}
          {isVideo && (
            <div className="viewer-drawer-section">
              <div className="viewer-drawer-section-title">Video Quality & Playback</div>

              {/* Resolution Switcher */}
              {videoVariants && videoVariants.length > 0 && (
                <div className="drawer-subsection">
                  <div className="drawer-subheading">Stream Resolution</div>
                  <div className="resolution-chips-grid">
                    {videoVariants.map((v, idx) => {
                      const isActive = currentVideoUrl === v.url || (!currentVideoUrl && idx === 0);
                      return (
                        <button
                          key={`res-${idx}-${v.url}`}
                          className={`res-chip ${isActive ? 'active' : ''}`}
                          onClick={() => onSelectResolution(v.url, v.label)}
                          title={`Switch to ${v.label}`}
                        >
                          <span className="res-chip-label">{v.label}</span>
                          {isActive && <span className="res-active-dot">●</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Playback Speed */}
              <div className="drawer-subsection">
                <div className="drawer-subheading">Playback Speed</div>
                <div className="speed-chips-grid">
                  {playbackRates.map(rate => (
                    <button
                      key={`rate-${rate}`}
                      className={`speed-chip ${playbackRate === rate ? 'active' : ''}`}
                      onClick={() => onSelectPlaybackRate(rate)}
                    >
                      {rate}x
                    </button>
                  ))}
                </div>
              </div>

              {/* Mini Player / Loop / Autoplay */}
              <div className="drawer-toggle-grid">
                {hasPip && (
                  <button className="drawer-toggle-btn" onClick={onTogglePip}>
                    <PipIcon size={15} />
                    <span>Picture-in-Picture (PiP)</span>
                  </button>
                )}
                <button
                  className={`drawer-toggle-btn ${isLooping ? 'active' : ''}`}
                  onClick={onToggleLoop}
                >
                  <LoopIcon className="viewer-svg-icon" />
                  <span>Loop: {isLooping ? 'ON' : 'OFF'}</span>
                </button>
                <button
                  className={`drawer-toggle-btn ${autoplayViewer ? 'active' : ''}`}
                  onClick={onToggleAutoplay}
                >
                  <AutoIcon className="viewer-svg-icon" />
                  <span>Viewer Autoplay: {autoplayViewer ? 'ON' : 'OFF'}</span>
                </button>
              </div>
            </div>
          )}

          {/* Section 3: Visual Search & Discovery (If Image) */}
          {isImage && isDirectValid && (
            <div className="viewer-drawer-section">
              <div className="viewer-drawer-section-title">Visual Search</div>
              <div className="search-engines-list">
                <button
                  className="drawer-search-btn"
                  onClick={() => onReverseSearch('lens', directUrl)}
                >
                  <SearchIcon size={14} />
                  <span>Google Lens Search ↗</span>
                </button>
                <button
                  className="drawer-search-btn"
                  onClick={() => onReverseSearch('yandex', directUrl)}
                >
                  <SearchIcon size={14} />
                  <span>Yandex Image Search ↗</span>
                </button>
                <button
                  className="drawer-search-btn"
                  onClick={() => onReverseSearch('bing', directUrl)}
                >
                  <SearchIcon size={14} />
                  <span>Bing Visual Search ↗</span>
                </button>
                <button
                  className="drawer-search-btn"
                  onClick={() => onReverseSearch('tineye', directUrl)}
                >
                  <SearchIcon size={14} />
                  <span>TinEye Reverse Search ↗</span>
                </button>
              </div>
            </div>
          )}

          {/* Section 4: Direct Links & Sharing */}
          <div className="viewer-drawer-section">
            <div className="viewer-drawer-section-title">Links & Sharing</div>
            <div className="drawer-link-rows">
              {isDirectValid && (
                <div className="drawer-link-card">
                  <div className="drawer-link-info">
                    <span className="drawer-link-label">Direct Media URL</span>
                    <span className="drawer-link-url" title={directUrl}>{directUrl}</span>
                  </div>
                  <div className="drawer-link-actions">
                    <button
                      className="drawer-mini-btn"
                      onClick={() => onCopyText(directUrl, 'Media address')}
                      title="Copy media URL"
                    >
                      <CopyIcon size={13} />
                      <span>Copy</span>
                    </button>
                    <button
                      className="drawer-mini-btn"
                      onClick={() => window.open(directUrl, '_blank', 'noopener')}
                      title="Open in new tab"
                    >
                      <ExternalLinkIcon size={13} />
                      <span>Open</span>
                    </button>
                  </div>
                </div>
              )}

              {isPostDifferent && (
                <div className="drawer-link-card">
                  <div className="drawer-link-info">
                    <span className="drawer-link-label">
                      {isReddit ? 'Reddit Post URL' : isX ? '𝕏 Tweet URL' : 'Source Page URL'}
                    </span>
                    <span className="drawer-link-url" title={postOrPage}>{postOrPage}</span>
                  </div>
                  <div className="drawer-link-actions">
                    <button
                      className="drawer-mini-btn"
                      onClick={() => onCopyText(postOrPage, 'Source link')}
                      title="Copy page link"
                    >
                      <CopyIcon size={13} />
                      <span>Copy</span>
                    </button>
                    <button
                      className="drawer-mini-btn"
                      onClick={() => window.open(postOrPage, '_blank', 'noopener')}
                      title="Open source in new tab"
                    >
                      <ExternalLinkIcon size={13} />
                      <span>Open</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Section 5: File & Storage */}
          <div className="viewer-drawer-section">
            <div className="viewer-drawer-section-title">File & Library</div>
            <div className="file-details-table">
              <div className="file-row">
                <span className="file-key">Filename</span>
                <span className="file-val" title={filename(item.url)}>{filename(item.url)}</span>
              </div>
              <div className="file-row">
                <span className="file-key">Dimensions</span>
                <span className="file-val">{item.width || '—'} × {item.height || '—'} px</span>
              </div>
              {item.size > 0 && (
                <div className="file-row">
                  <span className="file-key">Size</span>
                  <span className="file-val">{formatSize(item.size)}</span>
                </div>
              )}
              {item.duration > 0 && (
                <div className="file-row">
                  <span className="file-key">Duration</span>
                  <span className="file-val">{item.duration}s</span>
                </div>
              )}
            </div>

            <div className="drawer-library-actions">
              <button
                className={`drawer-lib-btn ${isFavorite ? 'active-fav' : ''}`}
                onClick={onToggleFavorite}
              >
                <StarIcon filled={isFavorite} size={15} />
                <span>{isFavorite ? 'In Favorites' : 'Add to Favorites'}</span>
              </button>

              <button
                className="drawer-lib-btn save-btn"
                disabled={isDownloaded}
                onClick={onDownloadItem}
              >
                {isDownloaded ? <CheckIcon size={15} /> : <DownloadIcon size={15} />}
                <span>{isDownloaded ? 'Saved in Mosaic' : 'Save to Library'}</span>
              </button>
            </div>

            {(item.savedFile || item.saved) && item.downloadId && (
              <div className="drawer-btn-row download-ops-row">
                <button
                  className="drawer-action-btn"
                  onClick={() => chrome.downloads?.open(item.downloadId)}
                >
                  Open Downloaded File
                </button>
                <button
                  className="drawer-action-btn"
                  onClick={() => chrome.downloads?.show(item.downloadId)}
                >
                  Show in Finder / Folder
                </button>
                <button
                  className="drawer-action-btn danger"
                  onClick={() => onRemoveSavedFile(item)}
                >
                  Remove from Saved
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
