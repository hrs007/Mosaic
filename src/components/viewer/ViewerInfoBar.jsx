import React, { useState } from 'react';
import {
  filename,
  formatSize,
  getInstagramProfileUrl,
  getInstagramHashtagUrl,
  extractHashtags
} from '../../utils/mediaHelpers.js';
import {
  FitIcon,
  StarIcon,
  PipIcon,
  CopyIcon,
  ExternalLinkIcon,
  SearchIcon,
  ToolsIcon
} from '../../constants/icons.jsx';

export default function ViewerInfoBar({
  item,
  isEmbed,
  isFill,
  isDownloaded,
  isFavorite,
  isToolsOpen,
  onToggleFavorite,
  onToggleFitMode,
  onDownloadItem,
  onOpenTools,
  directUrl,
  postOrPage,
  isDirectValid,
  isPostDifferent,
  onCopyText,
  onReverseSearch,
  onTogglePip,
  hasPip,
  videoVariants = [],
  currentVideoUrl,
  gallerySiblings = [],
  currentGalleryPos = -1,
  onNavigateGallery,
  onNavigateToInstagram
}) {
  const [postTextExpanded, setPostTextExpanded] = useState(false);
  const isVideo = item.type === 'video' || Boolean(currentVideoUrl);
  const isReddit = item.site === 'reddit';
  const isX = item.site === 'x';
  const isTumblr = item.site === 'tumblr';
  const isInstagram = item.site === 'instagram';

  const subreddit = item.subreddit || '';
  const redditAuthor = item.author || item.authorHandle || '';
  const redditUsername = (() => {
    const value = String(redditAuthor).trim();
    const fromUrl = value.match(/reddit\.com\/(?:user|u)\/([^/?#]+)/i)?.[1];
    const username = (fromUrl || value.replace(/^u\//i, '').replace(/^@/, '')).trim();
    return /^[a-zA-Z0-9_-]{2,24}$/.test(username) && !/^(?:deleted|automoderator)$/i.test(username) ? username : '';
  })();
  const redditScore = item.score || '';

  const authorHandle = item.authorHandle || '';
  const cleanXHandle = authorHandle.replace(/^@/, '');

  const blogName = item.blogName || '';
  const rebloggedFrom = item.rebloggedFrom || '';
  const tags = Array.isArray(item.tags) ? item.tags : [];

  const altAuthor = item.alt ? ((item.alt.match(/(?:Photo|Video)\s+by\s+([^.]+?)\s+on/i)?.[1]) || (item.alt.match(/by\s+@?([a-zA-Z0-9_\.]+)/i)?.[1]) || '') : '';
  const rawIgAuthor = item.author || altAuthor || '';
  const igAuthor = rawIgAuthor.match(/instagram\.com\/([^/?#]+)/i)?.[1] || rawIgAuthor.replace(/^@/, '');
  const igLikes = item.likes != null ? item.likes : (item.likeCount != null ? item.likeCount : '');
  const hasIgLikes = (typeof igLikes === 'number' && igLikes > 0) || (typeof igLikes === 'string' && igLikes && !/^(?:0|0\s*likes?)$/i.test(igLikes.trim()));
  const igComments = item.commentCount != null ? item.commentCount : (item.comments != null ? item.comments : '');
  const hasIgComments = (typeof igComments === 'number' && igComments > 0) || (typeof igComments === 'string' && igComments && !/^(?:0|0\s*comments?)$/i.test(igComments.trim()));
  const postText = item.tweetText || (isReddit ? item.caption || item.alt || item.pageTitle || '' : item.caption || '');
  const normalizedHashtags = [...new Set([
    ...(Array.isArray(item.hashtags) ? item.hashtags : []),
    ...(Array.isArray(item.tags) ? item.tags : []),
    ...extractHashtags(postText)
  ].map(tag => String(tag).trim().replace(/^#+/, '')).filter(Boolean))];
  const postHashtags = normalizedHashtags;
  const igHashtags = isInstagram ? postHashtags : [];

  // Get active variant label if available
  const activeVariant = videoVariants.find(v => v.url === currentVideoUrl) || videoVariants[0];

  return (
    <div className="viewer-info" id="viewerInfo">
      {/* Left side: Context, badges, title, dimensions */}
      <div className="viewer-info-title">
        {/* Reddit Subreddit / Author Pill */}
        {isReddit && (
          <div className="viewer-platform-pill-group">
            {subreddit && (
              <button
                className="viewer-badge-pill subreddit-pill"
                onClick={() => onNavigateToInstagram ? onNavigateToInstagram(`https://www.reddit.com/${subreddit.replace(/^\/?/, '')}`) : window.open(`https://www.reddit.com/${subreddit.replace(/^\/?/, '')}`, '_blank', 'noopener')}
                title="Open Subreddit in Mosaic"
              >
                {subreddit.startsWith('r/') ? subreddit : `r/${subreddit}`} ↗
              </button>
            )}
            {item.provider && (
              <span className="viewer-badge-pill provider-pill" title={`Hosted on ${item.provider}`}>
                {item.provider.toUpperCase()}
              </span>
            )}
            {redditScore && (
              <span className="viewer-badge-pill score-pill" title="Upvotes">
                ▲ {redditScore}
              </span>
            )}
            {redditUsername && (
              <button
                className="viewer-badge-pill author-pill"
                onClick={() => {
                  const url = `https://www.reddit.com/user/${encodeURIComponent(redditUsername)}/`;
                  onNavigateToInstagram ? onNavigateToInstagram(url) : window.open(url, '_blank', 'noopener');
                }}
                title="Open Reddit profile in Mosaic"
              >
                u/{redditUsername} ↗
              </button>
            )}
          </div>
        )}

        {/* X Author Pill */}
        {isX && authorHandle && (
          <div className="viewer-platform-pill-group">
            <button
              className="viewer-badge-pill x-pill"
              onClick={() => onNavigateToInstagram ? onNavigateToInstagram(`https://x.com/${encodeURIComponent(cleanXHandle)}`) : window.open(`https://x.com/${encodeURIComponent(cleanXHandle)}`, '_blank', 'noopener')}
              title={`Open @${cleanXHandle} on X in Mosaic`}
            >
              <span className="x-glyph">𝕏</span>
              <span>@{cleanXHandle} ↗</span>
            </button>
          </div>
        )}

        {isX && Array.isArray(item.hashtags) && item.hashtags.length > 0 && !postText && (
          <div className="viewer-platform-pill-group">
            {item.hashtags.slice(0, 3).map(tag => {
              const cleanTag = String(tag).replace(/^#/, '');
              const url = `https://x.com/hashtag/${encodeURIComponent(cleanTag)}`;
              return (
                <button
                  key={`x-${cleanTag}`}
                  className="viewer-badge-pill x-pill"
                  onClick={() => onNavigateToInstagram ? onNavigateToInstagram(url) : window.open(url, '_blank', 'noopener')}
                  title={`Explore #${cleanTag} on X in Mosaic`}
                >
                  #{cleanTag} ↗
                </button>
              );
            })}
          </div>
        )}

        {/* Tumblr Blog / Reblog / Tag Pills */}
        {isTumblr && (
          <div className="viewer-platform-pill-group">
            {blogName && (
              <button
                className="viewer-badge-pill tumblr-pill"
                onClick={() => window.open(`https://${blogName}.tumblr.com`, '_blank', 'noopener')}
                title={`Open ${blogName}'s Tumblr`}
              >
                <span className="tumblr-glyph">t/</span>
                <span>{blogName} ↗</span>
              </button>
            )}
            {rebloggedFrom && rebloggedFrom !== blogName && (
              <button
                className="viewer-badge-pill tumblr-reblog-pill"
                onClick={() => window.open(`https://${rebloggedFrom}.tumblr.com`, '_blank', 'noopener')}
                title={`Reblogged from ${rebloggedFrom}`}
              >
                <span>↺ {rebloggedFrom} ↗</span>
              </button>
            )}
            {tags.slice(0, 3).map(tag => (
              <button
                key={tag}
                className="viewer-badge-pill tumblr-tag-pill"
                onClick={() => window.open(`https://www.tumblr.com/tagged/${encodeURIComponent(tag)}`, '_blank', 'noopener')}
                title={`Browse #${tag} on Tumblr`}
              >
                #{tag}
              </button>
            ))}
          </div>
        )}

        {/* Instagram Author & Stats Pill */}
        {isInstagram && (
          <div className="viewer-platform-pill-group">
            {igAuthor && (
              <button
                className="viewer-badge-pill instagram-pill"
                onClick={() => onNavigateToInstagram ? onNavigateToInstagram(getInstagramProfileUrl(igAuthor)) : window.open(getInstagramProfileUrl(igAuthor), '_blank', 'noopener')}
                title={`Open @${igAuthor} in extension view`}
              >
                <span className="ig-glyph">◎</span>
                <span>@{igAuthor} ↗</span>
              </button>
            )}
            {hasIgLikes && (
              <span className="viewer-badge-pill score-pill" title="Likes">
                ♥ {typeof igLikes === 'number' ? Number(igLikes).toLocaleString() : igLikes}
              </span>
            )}
            {hasIgComments && (
              <span className="viewer-badge-pill comment-pill" title="Comments">
                💬 {typeof igComments === 'number' ? Number(igComments).toLocaleString() : igComments}
              </span>
            )}
            {igHashtags.map(tag => (
              <button
                key={tag}
                className="viewer-badge-pill instagram-tag-pill"
                onClick={() => onNavigateToInstagram ? onNavigateToInstagram(getInstagramHashtagUrl(tag)) : window.open(getInstagramHashtagUrl(tag), '_blank', 'noopener')}
                title={`Explore #${tag} on Instagram in extension view`}
              >
                #{tag} ↗
              </button>
            ))}
          </div>
        )}

        {/* Multi-image Gallery / Photoset Stepper */}
        {gallerySiblings.length > 1 && currentGalleryPos !== -1 && (
          <div className="viewer-gallery-stepper" title={isTumblr ? "Tumblr Photoset Slide" : isInstagram ? "Instagram Carousel Slide" : "Reddit Gallery Slide"}>
            <button
              className="stepper-arrow"
              disabled={currentGalleryPos <= 0}
              onClick={() => onNavigateGallery(-1)}
              title={isTumblr ? "Previous slide in this photoset" : isInstagram ? "Previous slide in this Instagram carousel" : "Previous slide in this Reddit post"}
            >
              ‹
            </button>
            <span className="stepper-count">
              {currentGalleryPos + 1} / {gallerySiblings.length}
            </span>
            <button
              className="stepper-arrow"
              disabled={currentGalleryPos >= gallerySiblings.length - 1}
              onClick={() => onNavigateGallery(1)}
              title={isTumblr ? "Next slide in this photoset" : isInstagram ? "Next slide in this Instagram carousel" : "Next slide in this Reddit post"}
            >
              ›
            </button>
          </div>
        )}

        {/* Title & Dimension */}
        {!(isVideo && (!item.alt || item.alt === filename(item.url))) && (
          <span className="viewer-title-text" title={item.alt || filename(item.url)}>
            {item.alt || filename(item.url)}
          </span>
        )}
        <small className="viewer-dim-text">
          {item.width || '—'} × {item.height || '—'}
          {item.size ? ` · ${formatSize(item.size)}` : ''}
        </small>
        {isX && (postText || postHashtags.length > 0) ? (
          <div className="viewer-x-post-meta">
            {postText && (
              <button
                type="button"
                className={`viewer-post-text ${postTextExpanded ? 'expanded' : ''}`}
                aria-expanded={postTextExpanded}
                title={postTextExpanded ? 'Click to collapse post text' : 'Click to expand post text'}
                onClick={() => setPostTextExpanded(value => !value)}
              >
                {postText}
              </button>
            )}
            {postHashtags.length > 0 && <div className="viewer-platform-pill-group viewer-post-hashtags">{postHashtags.slice(0, 5).map(tag => {
              const cleanTag = String(tag).replace(/^#/, '');
              const url = `https://x.com/hashtag/${encodeURIComponent(cleanTag)}`;
              return <button key={cleanTag} type="button" className="viewer-badge-pill x-pill" title={`Explore #${cleanTag} on X in Mosaic`} onClick={() => onNavigateToInstagram ? onNavigateToInstagram(url) : window.open(url, '_blank', 'noopener')}>#{cleanTag} ↗</button>;
            })}</div>}
          </div>
        ) : (postText || (isInstagram && postHashtags.length > 0)) ? (
          <div className="viewer-instagram-post-meta">
            {postText && <button
              type="button"
              className={`viewer-post-text ${postTextExpanded ? 'expanded' : ''}`}
              aria-expanded={postTextExpanded}
              title={postTextExpanded ? 'Click to collapse post text' : 'Click to expand post text'}
              onClick={() => setPostTextExpanded(value => !value)}
            >
              {postText}
            </button>}
            {isInstagram && postHashtags.length > 0 && <div className="viewer-post-hashtags">
              {postHashtags.map(tag => (
                <button
                  key={`ig-caption-${tag}`}
                  type="button"
                  className="viewer-badge-pill instagram-tag-pill"
                  onClick={() => onNavigateToInstagram ? onNavigateToInstagram(getInstagramHashtagUrl(tag)) : window.open(getInstagramHashtagUrl(tag), '_blank', 'noopener')}
                  title={`Explore #${tag} on Instagram in extension view`}
                >#{tag} ↗</button>
              ))}
            </div>}
          </div>
        ) : null}
      </div>

      {/* Right side: Direct visible action buttons */}
      <div className="viewer-info-actions">
        {/* 1. Open Source / Post / Thread */}
        {item.site === 'youtube' ? (
          <button
            className="viewer-ctrl-btn viewer-ctrl-pill primary-site-btn"
            onClick={() => window.open(item.postUrl || item.pageUrl, '_blank', 'noopener')}
            title="Watch on YouTube"
          >
            Watch on YouTube ↗
          </button>
        ) : isPostDifferent && !(isReddit && !directUrl) ? (
          <button
            className="viewer-ctrl-btn viewer-ctrl-pill primary-site-btn"
            onClick={() => (isInstagram || isReddit) && onNavigateToInstagram ? onNavigateToInstagram(postOrPage) : window.open(postOrPage, '_blank', 'noopener')}
            title={isReddit ? 'Open Reddit thread' : isX ? 'Open X post' : isTumblr ? 'Open Tumblr post' : isInstagram ? 'Open Instagram post in extension view' : 'Open source page'}
          >
            <ExternalLinkIcon size={13} />
            <span>{isReddit ? 'Reddit Thread' : isX ? 'Open on 𝕏' : isTumblr ? 'Open on Tumblr' : isInstagram ? 'Instagram Post' : 'Source Page'} ↗</span>
          </button>
        ) : null}

        {/* 2. Direct Media URL */}
        {isDirectValid && !(isReddit && /reddit\.com\/(?:comments|user|r)\//i.test(directUrl)) && (
          <button
            className="viewer-ctrl-btn viewer-ctrl-pill"
            onClick={() => window.open(directUrl, '_blank', 'noopener')}
            title="Open direct original media link in new tab"
          >
            <span>Direct Media ↗</span>
          </button>
        )}

        {/* 3. Copy Link */}
        {(isDirectValid || postOrPage) && (
          <button
            className="viewer-ctrl-btn viewer-ctrl-pill"
            onClick={() => onCopyText(directUrl || postOrPage, 'Link')}
            title="Copy media URL to clipboard"
          >
            <CopyIcon size={13} />
            <span>Copy Link</span>
          </button>
        )}

        {/* 4. Visual Search (Google Lens & Yandex) for images */}
        {!isVideo && isDirectValid && (
          <>
            <button
              className="viewer-ctrl-btn viewer-ctrl-pill"
              onClick={() => onReverseSearch('lens', directUrl)}
              title="Search with Google Lens"
            >
              <SearchIcon size={13} />
              <span>Lens</span>
            </button>
            <button
              className="viewer-ctrl-btn viewer-ctrl-pill"
              onClick={() => onReverseSearch('yandex', directUrl)}
              title="Search with Yandex Images"
            >
              <SearchIcon size={13} />
              <span>Yandex</span>
            </button>
          </>
        )}

        {/* 5. Picture-in-Picture for videos */}
        {isVideo && !isEmbed && hasPip && (
          <button
            className="viewer-ctrl-btn viewer-ctrl-pill"
            onClick={onTogglePip}
            title="Float video in Picture-in-Picture mode"
          >
            <PipIcon size={13} />
            <span>PiP</span>
          </button>
        )}

        {/* 6. Active Video Resolution Badge (if multiple resolutions) */}
        {isVideo && videoVariants.length > 1 && activeVariant && (
          <button
            className="viewer-ctrl-btn viewer-ctrl-pill res-badge-btn"
            onClick={onOpenTools}
            title={`Current quality: ${activeVariant.label}. Click to change resolution.`}
          >
            <span className="res-badge-label">{activeVariant.label}</span>
            <span className="res-badge-arrow">▾</span>
          </button>
        )}

        {/* 7. Favorite Button */}
        <button
          className={`viewer-ctrl-btn viewer-ctrl-pill ${isFavorite ? 'active-fav active' : ''}`}
          aria-pressed={isFavorite}
          onClick={onToggleFavorite}
          title={isFavorite ? 'Remove from favorites (Starred)' : 'Add to favorites'}
        >
          <StarIcon filled={isFavorite} size={14} />
          <span>{isFavorite ? 'Starred' : 'Star'}</span>
        </button>

        {/* 8. Fit/Fill Toggle */}
        {!isEmbed && (
          <button
            className={`viewer-ctrl-btn viewer-fit-toggle ${isFill ? 'active' : ''}`}
            aria-pressed={isFill}
            title={isFill ? `Fit ${item.type} in viewer (fit mode)` : `Fill viewer with ${item.type} (crop edges)`}
            onClick={onToggleFitMode}
          >
            <FitIcon />
          </button>
        )}

        {/* 9. Save to Library / Download */}
        <button
          id="viewerDownload"
          className={`viewer-ctrl-btn viewer-ctrl-pill save-pill ${isDownloaded ? 'is-downloaded active' : ''}`}
          disabled={isDownloaded}
          title={isDownloaded ? 'Already saved in your Mosaic downloads' : 'Save media to local downloads'}
          onClick={() => onDownloadItem(item)}
        >
          {isDownloaded ? '✓ Saved' : '＋ Save file'}
        </button>

        {/* 10. Tools & Inspector Button */}
        <button
          id="viewerToolsBtn"
          className={`viewer-ctrl-btn viewer-tools-btn ${isToolsOpen ? 'active' : ''}`}
          aria-label="Toggle Media Tools & Inspector"
          aria-pressed={isToolsOpen}
          title={isToolsOpen ? 'Close Media Tools & Inspector' : 'Media Tools, Quality Selector & Inspector'}
          onClick={onOpenTools}
        >
          <ToolsIcon size={14} />
          <span>Tools</span>
        </button>
      </div>
    </div>
  );
}
