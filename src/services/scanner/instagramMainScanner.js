// instagramMainScanner.js — Injected in world: 'MAIN' to access React Fiber and page context
// Runs inside the tab's MAIN world so __reactFiber$, __reactProps$, and same-origin canvas frame capture work.

export function extractInstagramMainWorldMedia() {
  if (!location.hostname.includes('instagram.com')) return [];

  const cleanInstagramVideoUrl = (url) => {
    if (!url || typeof url !== 'string') return '';
    try {
      const u = new URL(url);
      u.searchParams.delete('bytestart');
      u.searchParams.delete('byteend');
      return u.href;
    } catch {
      return url.replace(/([?&])byte(?:start|end)=\d+(&|$)/gi, '$1').replace(/[?&]$/, '');
    }
  };

  const getInstagramShortcode = (url) => {
    if (!url) return '';
    const m = String(url).match(/(?:instagram\.com\/(?:p|reel|reels)\/|\/p\/|\/reel\/|\/reels\/)([a-zA-Z0-9_-]+)/i);
    return m ? m[1] : '';
  };

  const extractHashtags = (text) => {
    if (!text || typeof text !== 'string') return [];
    const matches = text.match(/#([a-zA-Z0-9_\u0080-\uffff]+)/g);
    if (!matches) return [];
    return [...new Set(matches.map(h => h.replace(/^#/, '')))];
  };

  const extractMentions = (text) => {
    if (!text || typeof text !== 'string') return [];
    const matches = text.match(/@([a-zA-Z0-9_\.]+)/g);
    if (!matches) return [];
    return [...new Set(matches.map(m => m.replace(/^@/, '')))];
  };

  const captureVideoFrame = (vid) => {
    if (!vid) return '';
    try {
      if (vid.videoWidth > 0 && vid.videoHeight > 0) {
        const canvas = document.createElement('canvas');
        const maxDim = 720;
        let w = vid.videoWidth;
        let h = vid.videoHeight;
        if (w > maxDim || h > maxDim) {
          if (w >= h) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          } else {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(vid, 0, 0, w, h);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
          if (dataUrl && dataUrl.length > 500) return dataUrl;
        }
      }
    } catch {}
    return '';
  };

  const getProfileFromPath = () => {
    try {
      const parts = location.pathname.replace(/^\/+|\/+$/g, '').split('/');
      const first = parts[0] || '';
      const reserved = new Set(['', 'p', 'reel', 'reels', 'stories', 'explore', 'direct', 'accounts', 'developer', 'about', 'legal', 'terms', 'privacy', 'directory', 'tag', 'tags', 'archive']);
      if (first && !reserved.has(first.toLowerCase()) && /^[a-zA-Z0-9_\.]+$/.test(first)) {
        return first;
      }
    } catch {}
    return '';
  };

  const getTagFromPath = () => {
    try {
      const m = location.pathname.match(/\/explore\/tags\/([^\/?#]+)/i) || location.pathname.match(/\/tags\/([^\/?#]+)/i);
      return m ? decodeURIComponent(m[1]) : '';
    } catch {}
    return '';
  };

  const profileAuthor = getProfileFromPath();
  const tagFromPath = getTagFromPath();

  const foundItems = [];
  const seenPostKeys = new Set();
  const checkedObjects = new WeakSet();
  let inspectCount = 0;

  const parseMediaObj = (obj, meta = {}) => {
    if (!obj || typeof obj !== 'object') return null;

    const code = obj.code || obj.shortcode || meta.postId || '';
    const user = obj.user || obj.owner || {};
    const username = typeof user.username === 'string' ? user.username : (meta.author || profileAuthor || '');
    const caption = typeof obj.caption === 'string'
      ? obj.caption
      : (obj.caption?.text || obj.edge_media_to_caption?.edges?.[0]?.node?.text || meta.caption || '');
    const rawLikes = obj.like_count != null ? obj.like_count : (obj.edge_liked_by?.count != null ? obj.edge_liked_by.count : (obj.edge_media_preview_like?.count != null ? obj.edge_media_preview_like.count : meta.likes));
    const likes = (rawLikes != null && Number(rawLikes) > 0) ? Number(rawLikes) : (meta.likes || undefined);
    const rawComments = obj.comment_count != null ? obj.comment_count : (obj.edge_media_to_comment?.count != null ? obj.edge_media_to_comment.count : meta.commentCount);
    const comments = (rawComments != null && Number(rawComments) > 0) ? Number(rawComments) : (meta.commentCount || undefined);
    const postUrl = code ? `https://www.instagram.com/p/${code}/` : (meta.postUrl || location.href);
    const hashtags = extractHashtags(caption);
    if (tagFromPath && !hashtags.includes(tagFromPath)) hashtags.push(tagFromPath);
    const mentions = extractMentions(caption);

    // Check carousel_media
    const carousel = obj.carousel_media || obj.edge_sidecar_to_children?.edges?.map(e => e.node) || [];
    if (Array.isArray(carousel) && carousel.length > 0) {
      carousel.forEach((cItem, cIdx) => {
        const parsed = parseMediaObj(cItem, {
          ...meta,
          postId: code,
          author: username,
          caption,
          hashtags,
          mentions,
          tags: hashtags,
          likes,
          commentCount: comments,
          postUrl,
          galleryIndex: cIdx,
          galleryTotal: carousel.length,
          isGallery: true
        });
        if (parsed) {
          const itemKey = `${code}:${cIdx}`;
          if (!seenPostKeys.has(itemKey)) {
            seenPostKeys.add(itemKey);
            foundItems.push(parsed);
          }
        }
      });
      return null;
    }

    // 1. Video
    const videoVersions = obj.video_versions || obj.videoVersions;
    const isVid = obj.is_video || obj.media_type === 2 || (Array.isArray(videoVersions) && videoVersions.length > 0) || Boolean(obj.video_url || obj.videoUrl || obj.progressive_download_url || obj.dash_manifest);

    if (isVid) {
      let bestVid = typeof obj.video_url === 'string' ? obj.video_url : (typeof obj.videoUrl === 'string' ? obj.videoUrl : '');
      if (!bestVid && typeof obj.progressive_download_url === 'string') {
        bestVid = obj.progressive_download_url;
      }
      if (!bestVid && typeof obj.dash_manifest === 'string') {
        const m = obj.dash_manifest.match(/<BaseURL>([^<]+?\.mp4[^<]*?)<\/BaseURL>/i);
        if (m && m[1]) bestVid = m[1].replace(/&amp;/g, '&');
      }

      const fallbacks = [];
      let maxPix = 0;
      let vW = 0, vH = 0;

      if (Array.isArray(videoVersions)) {
        for (const v of videoVersions) {
          if (!v?.url) continue;
          const cleaned = cleanInstagramVideoUrl(v.url);
          fallbacks.push(cleaned);
          const pix = (v.width || 0) * (v.height || 0);
          if (pix >= maxPix) {
            maxPix = pix;
            bestVid = cleaned;
            vW = v.width || 0;
            vH = v.height || 0;
          }
        }
      }
      if (bestVid) bestVid = cleanInstagramVideoUrl(bestVid);

      let poster = '';
      if (Array.isArray(obj.image_versions2?.candidates) && obj.image_versions2.candidates.length) {
        const sorted = [...obj.image_versions2.candidates].sort((a, b) => ((b.width || 0) * (b.height || 0)) - ((a.width || 0) * (a.height || 0)));
        poster = sorted[0]?.url || '';
      }
      if (!poster && typeof obj.display_url === 'string') poster = obj.display_url;
      if (!poster && typeof obj.display_src === 'string') poster = obj.display_src;
      if (!poster && typeof obj.thumbnail_src === 'string') poster = obj.thumbnail_src;

      const dur = Math.round(obj.video_duration || meta.duration || 0);
      const mainUrl = bestVid || poster || postUrl;

      return {
        type: 'video',
        url: mainUrl,
        source: bestVid || poster,
        poster: poster || '',
        previewUrl: poster || bestVid || '',
        fallbackUrls: fallbacks,
        width: vW || (obj.dimensions?.width) || 0,
        height: vH || (obj.dimensions?.height) || 0,
        duration: dur,
        postId: code,
        author: username,
        caption,
        hashtags,
        mentions,
        tags: hashtags,
        likes,
        commentCount: comments,
        postUrl,
        pageUrl: postUrl,
        playbackPage: bestVid ? '' : postUrl,
        site: 'instagram',
        alt: caption.slice(0, 120) || (username ? `Video by ${username}` : 'Instagram video'),
        ...meta
      };
    }

    // 2. Image
    const candidates = obj.image_versions2?.candidates;
    let bestImg = '';
    let maxPix = 0;
    let iW = 0, iH = 0;
    const fallbacks = [];

    if (Array.isArray(candidates)) {
      for (const c of candidates) {
        if (!c?.url) continue;
        fallbacks.push(c.url);
        const pix = (c.width || 0) * (c.height || 0);
        if (pix >= maxPix) {
          maxPix = pix;
          bestImg = c.url;
          iW = c.width || 0;
          iH = c.height || 0;
        }
      }
    } else if (typeof obj.display_url === 'string') {
      bestImg = obj.display_url;
    } else if (typeof obj.display_src === 'string') {
      bestImg = obj.display_src;
    }

    if (bestImg) {
      return {
        type: 'image',
        url: bestImg,
        source: bestImg,
        previewUrl: bestImg,
        fallbackUrls: fallbacks,
        width: iW || (obj.dimensions?.width) || 0,
        height: iH || (obj.dimensions?.height) || 0,
        postId: code,
        author: username,
        caption,
        hashtags,
        mentions,
        tags: hashtags,
        likes,
        commentCount: comments,
        postUrl,
        pageUrl: postUrl,
        site: 'instagram',
        alt: caption.slice(0, 120) || (username ? `Photo by ${username}` : 'Instagram photo'),
        ...meta
      };
    }

    return null;
  };

  const inspectObj = (value, depth = 0) => {
    if (!value || typeof value !== 'object' || depth > 10 || inspectCount++ > 4000 || checkedObjects.has(value)) return;
    checkedObjects.add(value);

    if (value.video_versions || value.videoVersions || value.video_url || value.videoUrl || value.dash_manifest || value.progressive_download_url || value.image_versions2 || value.carousel_media || value.edge_sidecar_to_children || (value.media_type && (value.video_url || value.display_url))) {
      const item = parseMediaObj(value);
      if (item) {
        const itemKey = item.postId ? (item.galleryIndex != null ? `${item.postId}:${item.galleryIndex}` : item.postId) : item.url;
        if (!seenPostKeys.has(itemKey)) {
          seenPostKeys.add(itemKey);
          foundItems.push(item);
        }
      }
    } else if (Array.isArray(value.items)) {
      value.items.forEach(it => {
        const item = parseMediaObj(it);
        if (item) {
          const itemKey = item.postId ? (item.galleryIndex != null ? `${item.postId}:${item.galleryIndex}` : item.postId) : item.url;
          if (!seenPostKeys.has(itemKey)) {
            seenPostKeys.add(itemKey);
            foundItems.push(item);
          }
        }
      });
    } else if (value.post || value.media || value.item) {
      const item = parseMediaObj(value.post || value.media || value.item);
      if (item) {
        const itemKey = item.postId ? (item.galleryIndex != null ? `${item.postId}:${item.galleryIndex}` : item.postId) : item.url;
        if (!seenPostKeys.has(itemKey)) {
          seenPostKeys.add(itemKey);
          foundItems.push(item);
        }
      }
    }

    for (const key of Object.keys(value)) {
      if (/^(return|child|sibling|stateNode|_owner|_store|owner|elementType|type)$/i.test(key)) continue;
      try { inspectObj(value[key], depth + 1); } catch {}
    }
  };

  // 1. Inspect React Fiber from DOM elements
  const candidateNodes = [
    document.getElementById('react-root'),
    document.querySelector('main'),
    ...document.querySelectorAll('article, a[href*="/p/"], a[href*="/reel/"], div[role="dialog"], video')
  ].filter(Boolean);

  for (const node of candidateNodes) {
    if (foundItems.length >= 60) break;
    for (const key of Object.keys(node)) {
      if (key.startsWith('__reactFiber$') || key.startsWith('__reactInternalInstance$')) {
        let fiber = node[key];
        let fDepth = 0;
        while (fiber && fDepth++ < 35) {
          if (fiber.memoizedProps) inspectObj(fiber.memoizedProps, 0);
          if (fiber.memoizedState) inspectObj(fiber.memoizedState, 0);
          fiber = fiber.return;
        }
      } else if (key.startsWith('__reactProps$')) {
        inspectObj(node[key], 0);
      }
    }
  }

  // 2. Also inspect playing / buffered video elements in DOM
  const videos = [...document.querySelectorAll('video')];
  for (const vid of videos) {
    const postLink = vid.closest('article, div[role="dialog"]')?.querySelector('a[href*="/p/"], a[href*="/reel/"]') || vid.closest('a[href*="/p/"], a[href*="/reel/"]');
    const postId = getInstagramShortcode(postLink?.href || location.href);
    const existing = foundItems.find(it => it.postId === postId && it.type === 'video');
    if (!existing || !existing.poster) {
      const snap = captureVideoFrame(vid);
      if (snap) {
        if (existing) {
          existing.poster = snap;
          if (!existing.previewUrl) existing.previewUrl = snap;
        } else if (postId) {
          const postUrl = `https://www.instagram.com/p/${postId}/`;
          const item = {
            type: 'video',
            url: postUrl,
            source: snap,
            poster: snap,
            previewUrl: snap,
            width: vid.videoWidth || 0,
            height: vid.videoHeight || 0,
            duration: Math.round(vid.duration || 0),
            postId,
            author: profileAuthor,
            postUrl,
            pageUrl: postUrl,
            playbackPage: postUrl,
            site: 'instagram',
            alt: 'Instagram video'
          };
          foundItems.push(item);
        }
      }
    }
  }

  return foundItems;
}
