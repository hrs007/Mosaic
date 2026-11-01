import { useState, useEffect, useRef, useCallback } from 'react';
import { defaultSiteProfile } from '../constants/defaults.js';
import {
  canonicalMediaId,
  getRedditPostId,
  parseRedditResolution,
  pageIdentity,
  isDisallowedMediaUrl,
  isProfileOrAvatarUrl,
  getInstagramShortcode,
  getInstagramMediaCode,
  isDirectPlayableVideo
} from '../utils/mediaHelpers.js';
import { resolveXVideos } from '../utils/xSyndication.js';
import {
  scanPageInTab,
  scanLiveNowInTab,
  startLiveWatcherInTab,
  advanceTabScroll,
  extractInstagramMainWorldMedia
} from '../services/scanner.js';

const isUsableInstagramPoster = (url) => {
  if (!url || typeof url !== 'string' || isDisallowedMediaUrl(url) || isProfileOrAvatarUrl(url) || isDirectPlayableVideo(url)) return false;
  if (/^data:image\/(?:svg\+xml)/i.test(url) || /^blob:/i.test(url) || /instagram\.com\/(?:p|reel|reels)\//i.test(url)) return false;
  return /^data:image\/(?:jpeg|jpg|png|webp|avif|gif)/i.test(url) || /^https?:\/\//i.test(url);
};

const isExtensionValid = () => {
  try {
    return !!(typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id);
  } catch {
    return false;
  }
};

export function usePageScanner({
  tabId,
  prefsRef,
  activeTypeRef,
  filteredLengthRef,
  perPage,
  setPage,
  showToast
}) {
  const [media, setMedia] = useState([]);
  const [siteProfile, setSiteProfile] = useState(defaultSiteProfile);
  const [scanStatus, setScanStatus] = useState('Ready to explore');
  const [loading, setLoading] = useState(true);
  const [isAdvancing, setIsAdvancing] = useState(false);
  const [hasReachedEnd, setHasReachedEnd] = useState(false);

  // Operational references
  const currentPageIdentityRef = useRef('');
  const liveScanBusyRef = useRef(false);
  const liveScanQueuedRef = useRef(false);
  const sourceAdvanceBusyRef = useRef(false);
  const sourceAdvancePausedRef = useRef(false);
  const consecutiveEmptyAdvancesRef = useRef(0);
  const lastSourceAdvanceRef = useRef(0);
  const hasReachedEndRef = useRef(false);
  hasReachedEndRef.current = hasReachedEnd;
  const lastScrollHeightRef = useRef(0);

  const mediaRef = useRef(media);
  mediaRef.current = media;
  const checkGalleryFillRef = useRef(null);

  // Merge Scanned Media with Deduplication & In-place Updates
  const mergeMedia = useCallback((items) => {
    if (!items || !items.length) return 0;
    let addedCount = 0;

    setMedia(prevMedia => {
      const idToIndex = new Map();
      const aliasToIndex = new Map();
      const redditPostToIndex = new Map();
      const xPostToIndex = new Map();
      const igPostToIndex = new Map();

      const getIgPostKey = (item) => {
        if (!item || item.site !== 'instagram') return '';
        const pId = item.postId || getInstagramMediaCode(item.postUrl || item.playbackPage || item.pageUrl || item.url);
        if (!pId) return '';
        return item.galleryIndex != null ? `${pId}:${item.galleryIndex}` : pId;
      };

      const copyRichMeta = (target, source) => {
        if (source.subreddit && !target.subreddit) target.subreddit = source.subreddit;
        if (source.author && (!target.author || target.author === '[deleted]' || target.author === '')) target.author = source.author;
        if (source.postUrl && (!target.postUrl || /\/(?:search|r\/[^/]+)\/?(?:\?|$)/i.test(target.postUrl))) {
          target.postUrl = source.postUrl;
          target.pageUrl = source.pageUrl || source.postUrl;
        }
        if (source.score && !target.score) target.score = source.score;
        if (source.commentCount && !target.commentCount) target.commentCount = source.commentCount;
        if (source.tweetText && (!target.tweetText || source.tweetText.length > target.tweetText.length)) target.tweetText = source.tweetText;
        if (source.authorName && !target.authorName) target.authorName = source.authorName;
        if (source.authorHandle && !target.authorHandle) target.authorHandle = source.authorHandle;
        if (source.likes && !target.likes) target.likes = source.likes;
        if (source.replies && !target.replies) target.replies = source.replies;
        if (source.isEmbed != null) target.isEmbed = Boolean(source.isEmbed);
        if (source.isGif != null) target.isGif = Boolean(source.isGif);
        if (source.provider && !target.provider) target.provider = source.provider;
        if (source.playbackPage && !target.playbackPage) target.playbackPage = source.playbackPage;
        if (Array.isArray(source.videoVariants) && source.videoVariants.length) {
          if (!target.videoVariants || source.videoVariants.length > target.videoVariants.length) {
            target.videoVariants = source.videoVariants;
          }
        }
        if (source.galleryTotal && !target.galleryTotal) target.galleryTotal = source.galleryTotal;
        if (source.galleryIndex != null && target.galleryIndex == null) target.galleryIndex = source.galleryIndex;
        if (source.blogName && !target.blogName) target.blogName = source.blogName;
        if (source.rebloggedFrom && !target.rebloggedFrom) target.rebloggedFrom = source.rebloggedFrom;
        if (source.site === 'instagram' && Array.isArray(source.tags) && source.tags.length) target.tags = [...new Set([...(target.tags || []), ...source.tags])];
        else if (Array.isArray(source.tags) && source.tags.length && (!target.tags || !target.tags.length)) target.tags = source.tags;
        if (Array.isArray(source.hashtags) && source.hashtags.length) target.hashtags = [...new Set([...(target.hashtags || []), ...source.hashtags])];
        if (Array.isArray(source.mentions) && source.mentions.length && (!target.mentions || !target.mentions.length)) target.mentions = source.mentions;
        if (source.site === 'instagram' && source.caption && (!target.caption || source.caption.length > target.caption.length)) {
          target.caption = source.caption;
          target.alt = source.caption.slice(0, 120);
        }
        if (source.site === 'reddit' && source.caption && (!target.alt || target.alt === '')) target.alt = source.caption.slice(0, 120);
        if (source.postId && !target.postId) target.postId = source.postId;
        if (source.site === 'instagram' && source.postUrl && (!target.postUrl || /instagram\.com\/(?:explore|[^/]+)\/?(?:[?#]|$)/i.test(target.postUrl)) && !/instagram\.com\/(?:p|reel|reels|tv)\//i.test(target.postUrl)) {
          target.postUrl = source.postUrl;
          target.pageUrl = source.pageUrl || source.postUrl;
        }
        if (source.site === 'instagram' && source.postId && (!target.postId || getInstagramMediaCode(target.postUrl || target.url) !== source.postId)) target.postId = source.postId;
        if (source.site === 'instagram' && source.author && !target.author) target.author = source.author;
        if (source.site !== 'instagram' && source.postUrl && !target.postUrl) target.postUrl = source.postUrl;
        if (source.site === 'instagram') {
          if (isUsableInstagramPoster(source.poster) && !isUsableInstagramPoster(target.poster)) target.poster = source.poster;
        } else if (source.poster && !target.poster) target.poster = source.poster;
        if (source.source && /reddit\.com\/(?:comments|search)\//i.test(target.source || '')) target.source = source.source;
        if (source.site === 'instagram') {
          if (isUsableInstagramPoster(source.previewUrl) && !isUsableInstagramPoster(target.previewUrl)) target.previewUrl = source.previewUrl;
        } else if (source.previewUrl && !target.previewUrl) target.previewUrl = source.previewUrl;
      };

      const indexItem = (item, index) => {
        const aliases = new Set([
          item.id,
          canonicalMediaId(item.url, item),
          canonicalMediaId(item.source, item),
          canonicalMediaId(item.previewUrl, item),
          canonicalMediaId(item.poster, item),
          ...(item.fallbackUrls || []).map(url => canonicalMediaId(url, item))
        ].filter(Boolean));
        aliases.forEach(alias => aliasToIndex.set(alias, index));
      };

      for (let i = 0; i < prevMedia.length; i++) {
        const m = prevMedia[i];
        const mid = m.id || canonicalMediaId(m.url, m);
        idToIndex.set(mid, i);
        indexItem(m, i);

        if (m.site === 'reddit') {
          const isGal = m.isGallery || m.postType === 'gallery' || m.galleryIndex != null;
          if (!isGal) {
            const pId = m.postId ? String(m.postId).replace(/^t3_/, '').toLowerCase() : getRedditPostId(m.postUrl || m.url);
            if (pId) {
              redditPostToIndex.set(pId, i);
            }
          }
        } else if (m.site === 'x') {
          const xMediaId = (m.poster || m.source || m.url || '').match(/(?:amplify_video_thumb|ext_tw_video_thumb|tweet_video_thumb|amplify_video|ext_tw_video|tweet_video)\/(\d+)/i)?.[1];
          if (xMediaId) xPostToIndex.set(`mid:${xMediaId}`, i);
          if (m.postUrl) xPostToIndex.set(`purl:${m.postUrl}`, i);
        } else if (m.site === 'instagram') {
          const igKey = getIgPostKey(m);
          if (igKey) igPostToIndex.set(igKey, i);
        }
      }

      const nextMedia = [...prevMedia];
      let changed = false;

      for (const x of items) {
        if (!x?.url || isDisallowedMediaUrl(x.url)) continue;
        const id = canonicalMediaId(String(x.url), x);
        if (!id) continue;

        // Check Reddit post-level deduplication and video upgrading
        if (x.site === 'reddit') {
          const isGal = x.isGallery || x.postType === 'gallery' || x.galleryIndex != null;
          if (!isGal) {
            const pId = x.postId ? String(x.postId).replace(/^t3_/, '').toLowerCase() : getRedditPostId(x.postUrl || x.url);
            if (pId && redditPostToIndex.has(pId)) {
              const existingIdx = redditPostToIndex.get(pId);
              const existing = nextMedia[existingIdx];

              // 1. If an image arrives for a Reddit post where we already have a video, skip duplicate
              if (x.type === 'image' && existing.type === 'video') {
                continue;
              }

              // 2. If a video arrives and existing is an image, upgrade existing in place
              if (x.type === 'video' && existing.type !== 'video') {
                const upgraded = { ...existing };
                upgraded.type = 'video';
                upgraded.url = x.url;
                upgraded.source = x.source || x.url;
                upgraded.fallbackUrls = x.fallbackUrls || [];
                upgraded.poster = x.poster || existing.previewUrl || existing.url;
                upgraded.width = Math.max(existing.width || 0, Number(x.width) || 0);
                upgraded.height = Math.max(existing.height || 0, Number(x.height) || 0);
                upgraded.playbackPage = x.playbackPage || '';
                upgraded.unavailable = false;
                upgraded.id = id;
                copyRichMeta(upgraded, x);
                nextMedia[existingIdx] = upgraded;
                idToIndex.set(id, existingIdx);
                changed = true;
                continue;
              }

              // 3. If both are videos, update resolution if higher
              if (x.type === 'video' && existing.type === 'video') {
                const oldRes = parseRedditResolution(existing.url);
                const newRes = parseRedditResolution(x.url);
                if (newRes > oldRes) {
                  const updated = { ...existing };
                  updated.url = x.url;
                  updated.source = x.source || x.url;
                  if (x.fallbackUrls?.length) {
                    updated.fallbackUrls = [...new Set([...(updated.fallbackUrls || []), ...x.fallbackUrls])].sort((a, b) => parseRedditResolution(b) - parseRedditResolution(a));
                  }
                  copyRichMeta(updated, x);
                  nextMedia[existingIdx] = updated;
                  changed = true;
                } else {
                  copyRichMeta(existing, x);
                }
                continue;
              }

              // 4. If both are images, skip duplicate
              if (x.type === 'image' && existing.type === 'image') {
                copyRichMeta(existing, x);
                continue;
              }
            }
          }
        }

        // Check X post fallback
        if (x.site === 'x' && x.type === 'video' && !x.playbackPage && x.postUrl) {
          const xMediaId = (x.poster || x.source || x.url || '').match(/(?:amplify_video_thumb|ext_tw_video_thumb|tweet_video_thumb|amplify_video|ext_tw_video|tweet_video)\/(\d+)/i)?.[1];
          const fallbackIdx = (xMediaId && xPostToIndex.has(`mid:${xMediaId}`))
            ? xPostToIndex.get(`mid:${xMediaId}`)
            : (x.postUrl && xPostToIndex.has(`purl:${x.postUrl}`))
            ? xPostToIndex.get(`purl:${x.postUrl}`)
            : -1;

          if (fallbackIdx !== -1) {
            const fallback = { ...nextMedia[fallbackIdx] };
            if (fallback.site === 'x' && fallback.type === 'video' && fallback.playbackPage) {
              fallback.url = x.url;
              fallback.source = x.source || x.url;
              fallback.fallbackUrls = x.fallbackUrls || fallback.fallbackUrls || [];
              fallback.playbackPage = '';
              fallback.poster = x.poster || fallback.poster || '';
              fallback.width = Math.max(fallback.width || 0, Number(x.width) || 0);
              fallback.height = Math.max(fallback.height || 0, Number(x.height) || 0);
              fallback.duration = x.duration || fallback.duration || 0;
              copyRichMeta(fallback, x);
              nextMedia[fallbackIdx] = fallback;
              idToIndex.set(id, fallbackIdx);
              changed = true;
              continue;
            }
          }
        }

        // Check Instagram post/carousel deduplication and upgrades
        if (x.site === 'instagram') {
            const igKey = getIgPostKey(x);
          if (igKey && igPostToIndex.has(igKey)) {
            const existingIdx = igPostToIndex.get(igKey);
            const existing = nextMedia[existingIdx];
            const beforeMeta = JSON.stringify([existing.caption, existing.author, existing.postUrl, existing.pageUrl, existing.postId, existing.poster, existing.previewUrl, existing.alt, existing.galleryTotal, existing.galleryIndex, existing.likes, existing.commentCount, existing.mentions, existing.tags, existing.hashtags]);
            copyRichMeta(existing, x);
            if (beforeMeta !== JSON.stringify([existing.caption, existing.author, existing.postUrl, existing.pageUrl, existing.postId, existing.poster, existing.previewUrl, existing.alt, existing.galleryTotal, existing.galleryIndex, existing.likes, existing.commentCount, existing.mentions, existing.tags, existing.hashtags])) changed = true;

            const existingIsDirectVideo = existing.type === 'video' && isDirectPlayableVideo(existing.url);
            const newIsDirectVideo = x.type === 'video' && isDirectPlayableVideo(x.url);

            // 1. Existing was non-working video (e.g. post page or blob) and incoming is direct playable video -> Upgrade in place!
            if (newIsDirectVideo && !existingIsDirectVideo) {
              const upgraded = { ...existing };
              upgraded.type = 'video';
              upgraded.url = x.url;
              upgraded.source = x.source || x.url;
              upgraded.poster = isUsableInstagramPoster(x.poster) ? x.poster : (isUsableInstagramPoster(existing.poster) ? existing.poster : (isUsableInstagramPoster(existing.previewUrl) ? existing.previewUrl : ''));
              upgraded.previewUrl = isUsableInstagramPoster(x.previewUrl) ? x.previewUrl : upgraded.poster;
              upgraded.playbackPage = '';
              upgraded.unavailable = false;
              upgraded.fallbackUrls = [...new Set([...(x.fallbackUrls || []), ...(existing.fallbackUrls || [])])];
              upgraded.width = Math.max(existing.width || 0, Number(x.width) || 0);
              upgraded.height = Math.max(existing.height || 0, Number(x.height) || 0);
              upgraded.duration = x.duration || existing.duration || 0;
              upgraded.id = id;
              copyRichMeta(upgraded, x);
              nextMedia[existingIdx] = upgraded;
              idToIndex.set(id, existingIdx);
              changed = true;
              continue;
            }

            // 2. Incoming is video, existing was image -> Upgrade to video
            if (x.type === 'video' && existing.type !== 'video') {
              const upgraded = { ...existing };
              upgraded.type = 'video';
              upgraded.url = x.url;
              upgraded.source = x.source || x.url;
              upgraded.poster = isUsableInstagramPoster(x.poster) ? x.poster : (isUsableInstagramPoster(existing.url) ? existing.url : (isUsableInstagramPoster(existing.previewUrl) ? existing.previewUrl : ''));
              upgraded.previewUrl = isUsableInstagramPoster(x.previewUrl) ? x.previewUrl : upgraded.poster;
              upgraded.playbackPage = x.playbackPage || '';
              upgraded.unavailable = false;
              upgraded.fallbackUrls = x.fallbackUrls || [];
              upgraded.width = Math.max(existing.width || 0, Number(x.width) || 0);
              upgraded.height = Math.max(existing.height || 0, Number(x.height) || 0);
              upgraded.duration = x.duration || existing.duration || 0;
              upgraded.id = id;
              copyRichMeta(upgraded, x);
              nextMedia[existingIdx] = upgraded;
              idToIndex.set(id, existingIdx);
              changed = true;
              continue;
            }

            // 3. Existing is video, incoming is image (e.g. thumbnail arrives later) -> Copy poster/preview, do not downgrade
            if (existing.type === 'video' && x.type === 'image') {
              let updated = false;
              const incomingPoster = isUsableInstagramPoster(x.poster) ? x.poster : (isUsableInstagramPoster(x.previewUrl) ? x.previewUrl : (x.type === 'image' && isUsableInstagramPoster(x.url) ? x.url : ''));
              if (!isUsableInstagramPoster(existing.poster) && incomingPoster) {
                existing.poster = incomingPoster;
                if (!isUsableInstagramPoster(existing.previewUrl)) existing.previewUrl = existing.poster;
                updated = true;
              }
              if (!existing.width && x.width) { existing.width = Number(x.width); updated = true; }
              if (!existing.height && x.height) { existing.height = Number(x.height); updated = true; }
              copyRichMeta(existing, x);
              if (beforeMeta !== JSON.stringify([existing.caption, existing.author, existing.postUrl, existing.pageUrl, existing.postId, existing.poster, existing.previewUrl, existing.alt, existing.galleryTotal, existing.galleryIndex, existing.likes, existing.commentCount, existing.mentions, existing.tags, existing.hashtags])) updated = true;
              if (updated) changed = true;
              continue;
            }

            // 4. Both are direct videos -> Choose higher resolution if available
            if (newIsDirectVideo && existingIsDirectVideo) {
              if (Number(x.width) * Number(x.height) > (existing.width || 0) * (existing.height || 0)) {
                const upgraded = { ...existing };
                upgraded.url = x.url;
                upgraded.source = x.source || upgraded.source;
                upgraded.width = Number(x.width);
                upgraded.height = Number(x.height);
                upgraded.duration = x.duration || existing.duration || 0;
                if (isUsableInstagramPoster(x.poster) && !isUsableInstagramPoster(upgraded.poster)) upgraded.poster = x.poster;
                if (x.fallbackUrls?.length) {
                  upgraded.fallbackUrls = [...new Set([...(upgraded.fallbackUrls || []), ...x.fallbackUrls])];
                }
                copyRichMeta(upgraded, x);
                nextMedia[existingIdx] = upgraded;
                changed = true;
              } else {
                if (isUsableInstagramPoster(x.poster) && !isUsableInstagramPoster(existing.poster)) {
                  existing.poster = x.poster;
                  if (!isUsableInstagramPoster(existing.previewUrl)) {
                    existing.previewUrl = x.poster;
                  }
                  changed = true;
                }
                copyRichMeta(existing, x);
                if (beforeMeta !== JSON.stringify([existing.caption, existing.author, existing.postUrl, existing.pageUrl, existing.postId, existing.poster, existing.previewUrl, existing.alt, existing.galleryTotal, existing.galleryIndex, existing.likes, existing.commentCount, existing.mentions, existing.tags, existing.hashtags])) changed = true;
              }
              continue;
            }

            // 5. Both are images -> Upgrade if higher resolution
            if (x.type === 'image' && existing.type === 'image') {
              if (Number(x.width) * Number(x.height) > (existing.width || 0) * (existing.height || 0)) {
                const upgraded = { ...existing };
                upgraded.url = x.url;
                upgraded.previewUrl = x.previewUrl || upgraded.previewUrl;
                upgraded.source = x.source || upgraded.source;
                upgraded.width = Number(x.width);
                upgraded.height = Number(x.height);
                copyRichMeta(upgraded, x);
                nextMedia[existingIdx] = upgraded;
                changed = true;
              } else {
                copyRichMeta(existing, x);
                if (beforeMeta !== JSON.stringify([existing.caption, existing.author, existing.postUrl, existing.pageUrl, existing.postId, existing.poster, existing.previewUrl, existing.alt, existing.galleryTotal, existing.galleryIndex, existing.likes, existing.commentCount, existing.mentions, existing.tags, existing.hashtags])) changed = true;
              }
              continue;
            }

            // Any other match with the same igKey -> Merge metadata and skip duplicate
            if (isUsableInstagramPoster(x.poster) && !isUsableInstagramPoster(existing.poster)) {
              existing.poster = x.poster;
              if (!isUsableInstagramPoster(existing.previewUrl)) {
                existing.previewUrl = x.poster;
              }
              changed = true;
            }
            copyRichMeta(existing, x);
            if (beforeMeta !== JSON.stringify([existing.caption, existing.author, existing.postUrl, existing.pageUrl, existing.postId, existing.poster, existing.previewUrl, existing.alt, existing.galleryTotal, existing.galleryIndex, existing.likes, existing.commentCount, existing.mentions, existing.tags, existing.hashtags])) changed = true;
            continue;
          }
        }

        const existingIndex = idToIndex.has(id) ? idToIndex.get(id) : aliasToIndex.get(id);
        if (existingIndex != null) {
          const idx = existingIndex;
          const updated = { ...nextMedia[idx] };
          const previousPoster = updated.poster;
          const previousPreview = updated.previewUrl;
          copyRichMeta(updated, x);
          if (x.site === 'reddit') {
            const redditText = x.caption || x.alt || x.pageTitle || '';
            if (redditText && (!updated.caption || updated.caption.length < redditText.length)) updated.caption = redditText;
            if (redditText && !updated.alt) updated.alt = redditText.slice(0, 120);
            if (redditText && !updated.pageTitle) updated.pageTitle = redditText;
          }
          if (updated.tweetText !== nextMedia[idx].tweetText || updated.caption !== nextMedia[idx].caption || updated.hashtags !== nextMedia[idx].hashtags || updated.poster !== previousPoster || updated.previewUrl !== previousPreview) changed = true;
          const w = Math.max(updated.width || 0, Number(x.width) || 0);
          const h = Math.max(updated.height || 0, Number(x.height) || 0);
          if (w !== updated.width || h !== updated.height) {
            updated.width = w;
            updated.height = h;
            changed = true;
          }
          if (x.duration && !updated.duration) {
            updated.duration = x.duration;
            changed = true;
          }
          if ((!updated.alt || updated.alt === 'YouTube Video') && x.alt && x.alt !== 'YouTube Video') {
            updated.alt = x.alt;
            changed = true;
          }
          if (x.site === 'instagram') {
            if (isUsableInstagramPoster(x.poster) && !isUsableInstagramPoster(updated.poster)) {
              updated.poster = x.poster;
              changed = true;
            }
            if (isUsableInstagramPoster(x.previewUrl) && !isUsableInstagramPoster(updated.previewUrl)) {
              updated.previewUrl = x.previewUrl;
              changed = true;
            }
          } else if ((!updated.poster || updated.poster.includes('hqdefault.jpg')) && x.poster && !x.poster.includes('hqdefault.jpg')) {
            updated.poster = x.poster;
            changed = true;
          }
          if (!updated.previewUrl && x.previewUrl) updated.previewUrl = x.previewUrl;
          if (x.type === 'video' && updated.type !== 'video') {
            updated.type = 'video';
            updated.poster = updated.poster || x.poster || x.previewUrl || '';
            updated.playbackPage = updated.playbackPage || x.playbackPage || '';
            updated.isEmbed = updated.isEmbed || x.isEmbed || false;
            updated.isGif = updated.isGif || x.isGif || false;
            updated.provider = updated.provider || x.provider || '';
            updated.postUrl = updated.postUrl || x.postUrl || '';
            updated.site = updated.site || x.site || '';
            updated.unavailable = false;
            changed = true;
          }
          if (x.type === 'video') {
            if (x.site === 'reddit') {
              const oldRes = parseRedditResolution(updated.url);
              const newRes = parseRedditResolution(x.url);
              if (newRes > oldRes) {
                updated.url = x.url;
                updated.source = x.source || x.url;
                changed = true;
              }
              if (x.fallbackUrls?.length) {
                updated.fallbackUrls = [...new Set([...(updated.fallbackUrls || []), ...x.fallbackUrls])].sort((a, b) => parseRedditResolution(b) - parseRedditResolution(a));
              }
              if (x.poster && !updated.poster) {
                updated.poster = x.poster;
                changed = true;
              }
              updated.unavailable = false;
            } else if (x.site === 'x' && x.url !== updated.url && !x.playbackPage) {
              updated.url = x.url;
              updated.source = x.source || x.url;
              updated.fallbackUrls = x.fallbackUrls || updated.fallbackUrls || [];
              updated.playbackPage = '';
              updated.unavailable = false;
              changed = true;
            } else {
              updated.fallbackUrls = x.fallbackUrls || updated.fallbackUrls || [];
              updated.poster = updated.poster || x.poster || '';
              updated.unavailable = false;
            }
          }
          nextMedia[idx] = updated;
          indexItem(updated, idx);
          continue;
        }

        const item = {
          ...x,
          id,
          index: nextMedia.length,
          size: 0,
          width: Number(x.width) || (x.site === 'youtube' ? 1280 : 0),
          height: Number(x.height) || (x.site === 'youtube' ? 720 : 0)
        };
        const newIdx = nextMedia.length;
        nextMedia.push(item);
        idToIndex.set(id, newIdx);
        indexItem(item, newIdx);
        if (item.site === 'reddit') {
          const isGal = item.isGallery || item.postType === 'gallery' || item.galleryIndex != null;
          if (!isGal) {
            const pId = item.postId ? String(item.postId).replace(/^t3_/, '').toLowerCase() : getRedditPostId(item.postUrl || item.url);
            if (pId) redditPostToIndex.set(pId, newIdx);
          }
        } else if (item.site === 'instagram') {
          const igKey = getIgPostKey(item);
          if (igKey) igPostToIndex.set(igKey, newIdx);
        }
        addedCount++;
        changed = true;
      }

      if (changed) {
        if (addedCount > 0) {
          sourceAdvancePausedRef.current = false;
          consecutiveEmptyAdvancesRef.current = 0;
          setHasReachedEnd(false);
          hasReachedEndRef.current = false;
          setScanStatus(`${nextMedia.filter(x => !x.unavailable).length} items · live`);
        }
        return nextMedia;
      }
      return prevMedia;
    });

    return addedCount;
  }, []);

  // Scan live now in tab
  const scanLiveNow = useCallback(async () => {
    if (!tabId || liveScanBusyRef.current || !isExtensionValid()) {
      liveScanQueuedRef.current = true;
      return;
    }
    liveScanBusyRef.current = true;
    try {
      if (!isExtensionValid()) return;
      const [res] = await chrome.scripting.executeScript({
        target: { tabId },
        func: scanLiveNowInTab
      });
      const items = res?.result?.items || [];
      if (res?.result?.url && pageIdentity(res.result.url) !== currentPageIdentityRef.current) {
        currentPageIdentityRef.current = pageIdentity(res.result.url);
      }
      const xItems = items.filter(item => item.site === 'x' && item.type === 'video');
      if (xItems.length) await resolveXVideos(xItems);
      mergeMedia(items);

      if (items.length) {
        const hasYt = items.some(x => x.site === 'youtube');
        const hasX = items.some(x => x.site === 'x');
        const hasReddit = items.some(x => x.site === 'reddit');
        const hasTumblr = items.some(x => x.site === 'tumblr');
        const hasIg = items.some(x => x.site === 'instagram');
        if (hasYt) {
          setSiteProfile({ key: 'youtube', name: 'YouTube', glyph: '▶', hint: 'Watch videos · shorts · embedded players' });
        } else if (hasX) {
          setSiteProfile({ key: 'x', name: 'X', glyph: '𝕏', hint: 'Loaded posts · playable clips · originals' });
        } else if (hasReddit) {
          setSiteProfile({ key: 'reddit', name: 'Reddit', glyph: 'r', hint: 'Post images · hosted videos · discussions' });
        } else if (hasTumblr) {
          setSiteProfile({ key: 'tumblr', name: 'Tumblr', glyph: 't', hint: 'Photosets · GIFs · original sizes · posts' });
        } else if (hasIg) {
          setSiteProfile({ key: 'instagram', name: 'Instagram', glyph: '◎', hint: 'Loaded posts · high-res photos · reels' });
        }
      }

      if (items.some(x => x.site === 'instagram') && isExtensionValid()) {
        try {
          const [mainRes] = await chrome.scripting.executeScript({
            target: { tabId },
            world: 'MAIN',
            func: extractInstagramMainWorldMedia
          });
          const mainItems = mainRes?.result || [];
          if (mainItems.length) {
            mergeMedia(mainItems);
          }
        } catch {}
      }
    } catch {} finally {
      liveScanBusyRef.current = false;
      if (liveScanQueuedRef.current) {
        liveScanQueuedRef.current = false;
        setTimeout(scanLiveNow, 100);
      }
    }
  }, [tabId, mergeMedia]);

  // Advance Source Page (Infinite Scroll in Background)
  const advanceSourcePage = useCallback(async (force = false) => {
    if (
      !tabId ||
      !isExtensionValid() ||
      sourceAdvanceBusyRef.current ||
      Date.now() - lastSourceAdvanceRef.current < 350
    ) return;

    if (!force && (sourceAdvancePausedRef.current || hasReachedEndRef.current)) return;

    if (force) {
      sourceAdvancePausedRef.current = false;
      hasReachedEndRef.current = false;
      setHasReachedEnd(false);
    }

    sourceAdvanceBusyRef.current = true;
    setIsAdvancing(true);
    let steps = 0;
    try {
      while (
        steps < 2 &&
        !document.body.classList.contains('modal-open') &&
        activeTypeRef.current !== 'favorites' &&
        activeTypeRef.current !== 'files'
      ) {
        const beforeCount = mediaRef.current.length;
        lastSourceAdvanceRef.current = Date.now();
        const [res] = await chrome.scripting.executeScript({
          target: { tabId },
          func: advanceTabScroll
        });
        const scrollInfo = res?.result;
        steps++;

        // Give the tab time to trigger infinite scroll network request and DOM mutation
        await new Promise(resolve => setTimeout(resolve, 650));
        await scanLiveNow();

        const gotNewMedia = mediaRef.current.length > beforeCount;
        const scrollHeight = scrollInfo?.scrollHeight || 0;
        const heightGrew = scrollHeight > (lastScrollHeightRef.current + 50);
        if (scrollHeight > 0) lastScrollHeightRef.current = scrollHeight;

        if (gotNewMedia || heightGrew) {
          consecutiveEmptyAdvancesRef.current = 0;
          sourceAdvancePausedRef.current = false;
          setHasReachedEnd(false);
          hasReachedEndRef.current = false;
        } else {
          consecutiveEmptyAdvancesRef.current++;
          // Declare reached end when the page cannot scroll further / is at bottom
          // and no new media was added after consecutive verification steps
          const cannotScrollFurther = !scrollInfo?.scrolled || scrollInfo?.atBottom;
          if (cannotScrollFurther && consecutiveEmptyAdvancesRef.current >= 2) {
            sourceAdvancePausedRef.current = true;
            setHasReachedEnd(true);
            hasReachedEndRef.current = true;
            break;
          }
        }
      }
    } catch {} finally {
      sourceAdvanceBusyRef.current = false;
      setIsAdvancing(false);
    }
  }, [tabId, scanLiveNow, activeTypeRef]);

  // Check Gallery Fill and Auto-Load Beforehand
  const checkGalleryFill = useCallback(() => {
    const scroller = document.querySelector('.app-shell');
    if (!scroller || document.body.classList.contains('modal-open')) return;

    const isScrollable = scroller.scrollHeight > scroller.clientHeight + 80;
    const remainingScroll = isScrollable
      ? scroller.scrollHeight - (scroller.scrollTop + scroller.clientHeight)
      : 0;

    // 1. Auto-advance the gallery visible page beforehand when not scrollable or when approaching the bottom
    if (!isScrollable || (remainingScroll < 800 && scroller.scrollTop > 50)) {
      setPage(prevPage => {
        if (prevPage * perPage < filteredLengthRef.current) {
          return prevPage + 1;
        }
        return prevPage;
      });
    }

    // 2. Auto-advance the source page in tab beforehand (only for live page media)
    if (activeTypeRef.current === 'favorites' || activeTypeRef.current === 'files') return;

    if (sourceAdvanceBusyRef.current || hasReachedEndRef.current || sourceAdvancePausedRef.current) return;

    // If gallery is not scrollable, or within 2000px of bottom, or has fewer than 100 items: advance tab beforehand
    if (!isScrollable || remainingScroll < 2000 || filteredLengthRef.current < 100) {
      const wait = 350 - (Date.now() - lastSourceAdvanceRef.current);
      if (wait <= 0) {
        advanceSourcePage();
      }
    }
  }, [advanceSourcePage, perPage, setPage, activeTypeRef, filteredLengthRef]);

  checkGalleryFillRef.current = checkGalleryFill;

  // Preload initial batches beforehand so media is ready in advance
  const preloadInitialMedia = useCallback(async () => {
    if (!tabId || activeTypeRef.current === 'favorites' || activeTypeRef.current === 'files') return;
    sourceAdvancePausedRef.current = false;
    consecutiveEmptyAdvancesRef.current = 0;
    setHasReachedEnd(false);
    hasReachedEndRef.current = false;

    let cycles = 0;
    const maxCycles = 5;
    const targetBuffer = 120;

    while (
      cycles < maxCycles &&
      mediaRef.current.length < targetBuffer &&
      !sourceAdvancePausedRef.current &&
      !hasReachedEndRef.current &&
      !document.body.classList.contains('modal-open')
    ) {
      cycles++;
      await advanceSourcePage();
      await new Promise(resolve => setTimeout(resolve, 350));
    }
    checkGalleryFill();
  }, [tabId, advanceSourcePage, checkGalleryFill, activeTypeRef]);

  // Full Initial Page Scan
  const scanPage = useCallback(async () => {
    if (!tabId || !isExtensionValid()) return;
    sourceAdvancePausedRef.current = false;
    consecutiveEmptyAdvancesRef.current = 0;
    setHasReachedEnd(false);
    hasReachedEndRef.current = false;
    setPage(1);
    setLoading(true);
    setScanStatus('Looking for media…');

    try {
      if (!isExtensionValid()) return;
      const [res] = await chrome.scripting.executeScript({
        target: { tabId },
        func: scanPageInTab,
        args: [prefsRef.current.backgrounds]
      });
      const result = res?.result;
      const identity = pageIdentity(result?.pageUrl || '');
      if (currentPageIdentityRef.current && identity && identity !== currentPageIdentityRef.current) {
        setMedia([]);
      }
      currentPageIdentityRef.current = identity;

      const scannedItems = result?.items || [];
      if (result?.site?.key === 'x') {
        await resolveXVideos(scannedItems);
      }
      mergeMedia(scannedItems);
      if (result?.site) setSiteProfile(result.site);

      if ((result?.site?.key === 'instagram' || scannedItems.some(x => x.site === 'instagram')) && isExtensionValid()) {
        try {
          const [mainRes] = await chrome.scripting.executeScript({
            target: { tabId },
            world: 'MAIN',
            func: extractInstagramMainWorldMedia
          });
          const mainItems = mainRes?.result || [];
          if (mainItems.length) {
            mergeMedia(mainItems);
          }
        } catch {}
      }

      setScanStatus(`${scannedItems.length} items · live`);
      setLoading(false);

      // Start live watcher
      if (isExtensionValid()) {
        chrome.scripting.executeScript({
          target: { tabId },
          func: startLiveWatcherInTab,
          args: [prefsRef.current.backgrounds, tabId]
        }).catch(() => {});
      }

      // Auto-load media beforehand in the background
      preloadInitialMedia();
    } catch (e) {
      setLoading(false);
      setScanStatus('Page could not be scanned');
      showToast(`Could not scan page: ${e?.message || 'access denied'}`);
    }
  }, [tabId, mergeMedia, showToast, preloadInitialMedia, prefsRef, setPage]);

  // Start Live Scan Loop and Connect Port
  useEffect(() => {
    if (!tabId || !isExtensionValid()) return;

    let port = null;
    let reconnectTimer = null;
    let isDisposed = false;
    let liveBatch = [];
    let liveBatchTimer = null;

    const flushLiveBatch = async () => {
      if (liveBatchTimer) {
        clearTimeout(liveBatchTimer);
        liveBatchTimer = null;
      }
      if (!liveBatch.length || isDisposed) return;
      const items = liveBatch;
      liveBatch = [];

      const xItems = items.filter(item => item.site === 'x' && item.type === 'video');
      if (xItems.length) {
        try { await resolveXVideos(xItems); } catch {}
      }
      mergeMedia(items);
    };

    const connectLivePort = () => {
      if (isDisposed || !isExtensionValid()) return;
      try {
        port = chrome.runtime.connect({ name: `mosaic-gallery:${tabId}` });
        port.onMessage.addListener((message) => {
          if (isDisposed) return;
          if (message?.source === 'mosaic-live' && message.tabId === tabId && message.media) {
            const item = message.media;
            if (!item.pageUrl || !item.url || isDisallowedMediaUrl(item.url)) return;
            const identity = pageIdentity(item.pageUrl);
            if (!currentPageIdentityRef.current) currentPageIdentityRef.current = identity;
            if (currentPageIdentityRef.current && identity !== currentPageIdentityRef.current) return;
            liveBatch.push(item);
            if (!liveBatchTimer) {
              liveBatchTimer = setTimeout(flushLiveBatch, 80);
            }
          }
        });
        port.onDisconnect.addListener(() => {
          if (isDisposed || !isExtensionValid()) return;
          reconnectTimer = setTimeout(connectLivePort, 500);
        });
      } catch {
        if (!isDisposed && isExtensionValid()) {
          reconnectTimer = setTimeout(connectLivePort, 1000);
        }
      }
    };
    connectLivePort();

    const pollInterval = setInterval(() => {
      if (isDisposed || !isExtensionValid()) {
        clearInterval(pollInterval);
        return;
      }
      scanLiveNow();
      checkGalleryFill();
    }, 1800);

    scanPage();

    return () => {
      isDisposed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (liveBatchTimer) clearTimeout(liveBatchTimer);
      clearInterval(pollInterval);
      if (port) {
        try { port.disconnect(); } catch {}
      }
    };
  }, [tabId, scanLiveNow, scanPage, mergeMedia, checkGalleryFill]);

  const handleGalleryScroll = useCallback(() => {
    checkGalleryFill();
  }, [checkGalleryFill]);

  return {
    media,
    setMedia,
    mediaRef,
    siteProfile,
    scanStatus,
    loading,
    isAdvancing,
    hasReachedEnd,
    setHasReachedEnd,
    hasReachedEndRef,
    sourceAdvancePausedRef,
    consecutiveEmptyAdvancesRef,
    checkGalleryFillRef,
    mergeMedia,
    scanPage,
    scanLiveNow,
    advanceSourcePage,
    preloadInitialMedia,
    checkGalleryFill,
    onGalleryScroll: handleGalleryScroll
  };
}
