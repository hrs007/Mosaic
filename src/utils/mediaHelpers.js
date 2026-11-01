export function isDisallowedMediaUrl(url) {
  if (!url || typeof url !== 'string') return true;
  const s = url.trim();
  if (!s || /^javascript:/i.test(s) || /^data:(?:text|application)\//i.test(s) || /^data:image\/svg\+xml/i.test(s)) return true;
  if (/static\.cdninstagram\.com\/rsrc\.php\//i.test(s)) return true;

  try {
    const parsed = new URL(s, 'https://mosaic.internal');
    const path = parsed.pathname.toLowerCase();

    // Check non-media extensions on URL pathname
    if (/\.(js|mjs|cjs|jsx|ts|tsx|css|scss|sass|less|map|json|jsonld|wasm|woff2?|ttf|otf|eot|zip|rar|tar|gz|7z|dmg|exe|pkg|deb|rpm|pdf|docx?|xlsx?|pptx?|txt|md|csv|xml)$/i.test(path)) {
      return true;
    }

    // Check if query or full string directly targets a script/stylesheet/map
    if (/\.(js|mjs|cjs|jsx|ts|tsx|css|json|map)(?:[?#]|$)/i.test(s)) {
      return true;
    }
  } catch {
    if (/\.(js|mjs|cjs|jsx|ts|tsx|css|scss|sass|less|map|json|jsonld|wasm|woff2?|ttf|otf|eot|zip|rar|tar|gz|7z|dmg|exe|pkg|deb|rpm|pdf|docx?|xlsx?|pptx?|txt|md|csv|xml)(?:[?#]|$)/i.test(s)) {
      return true;
    }
  }

  return false;
}

export function isProfileOrAvatarUrl(url) {
  if (!url || typeof url !== 'string') return false;
  return /twimg\.com\/(?:profile_images|profile_banners|sticky\/default_profile_images)\//i.test(url) ||
         /(?:styles\.redditmedia\.com\/.*avatar|reddit\.com\/avatar)/i.test(url) ||
         /(?:avatars\.githubusercontent\.com|yt3\.ggpht\.com)/i.test(url) ||
         /(?:media\.tumblr\.com\/avatar_|assets\.tumblr\.com\/images\/default_avatar|api\.tumblr\.com\/v2\/blog\/.*\/avatar|s\d+x\d+u_c1\/)/i.test(url) ||
         /static\.cdninstagram\.com\/rsrc\.php\//i.test(url);
}

export function getInstagramShortcode(url) {
  if (!url) return '';
  const m = String(url).match(/(?:instagram\.com\/(?:p|reel|reels)\/|\/p\/|\/reel\/|\/reels\/)([a-zA-Z0-9_-]+)/i);
  return m ? m[1] : '';
}

export function extractHashtags(text) {
  if (!text || typeof text !== 'string') return [];
  const matches = text.match(/#([a-zA-Z0-9_\u0080-\uffff]+)/g);
  if (!matches) return [];
  return [...new Set(matches.map(m => m.slice(1).toLowerCase()))];
}

export function extractMentions(text) {
  if (!text || typeof text !== 'string') return [];
  const matches = text.match(/@([a-zA-Z0-9_\.]+)/g);
  if (!matches) return [];
  return [...new Set(matches.map(m => m.slice(1)))];
}

export function getInstagramProfileUrl(username) {
  if (!username) return 'https://www.instagram.com/';
  const clean = String(username).replace(/^[@\/]+|[\/]+$/g, '');
  return `https://www.instagram.com/${encodeURIComponent(clean)}/`;
}

export function getInstagramProfileFromPath(pathname = '') {
  try {
    const path = (pathname || (typeof location !== 'undefined' ? location.pathname : '')).replace(/^\/+|\/+$/g, '');
    const parts = path.split('/');
    const first = parts[0] || '';
    const reserved = new Set(['', 'p', 'reel', 'reels', 'stories', 'explore', 'direct', 'accounts', 'developer', 'about', 'legal', 'terms', 'privacy', 'directory', 'tag', 'tags', 'archive']);
    if (first && !reserved.has(first.toLowerCase()) && /^[a-zA-Z0-9_\.]+$/.test(first)) {
      return first;
    }
  } catch {}
  return '';
}

export function getInstagramTagFromPath(pathname = '') {
  try {
    const path = pathname || (typeof location !== 'undefined' ? location.pathname : '');
    const m = path.match(/\/explore\/tags\/([^\/?#]+)/i) || path.match(/\/tags\/([^\/?#]+)/i);
    return m ? decodeURIComponent(m[1]) : '';
  } catch {}
  return '';
}

export function getInstagramHashtagUrl(tag) {
  if (!tag) return 'https://www.instagram.com/';
  const clean = String(tag).replace(/^[#\/]+|[\/]+$/g, '');
  return `https://www.instagram.com/explore/tags/${encodeURIComponent(clean)}/`;
}

export function getRedditPostId(url) {
  if (!url) return '';
  const m = String(url).match(/(?:comments\/|comments\/t3_|t3_)([a-zA-Z0-9]+)/i);
  return m ? m[1].toLowerCase() : '';
}

export function getRedditVideoId(url) {
  if (!url) return '';
  const m = String(url).match(/v\.redd\.it\/([a-zA-Z0-9_-]+)/i);
  return m ? m[1].toLowerCase() : '';
}

export function getRedditImageId(url) {
  if (!url) return '';
  try {
    const u = new URL(url);
    if (/^(?:i|preview|external-preview)\.redd\.it$/i.test(u.hostname)) {
      const parts = u.pathname.split('/').filter(Boolean);
      const filename = parts.pop() || '';
      const base = filename.split('.')[0];
      if (base && base.length >= 6) return base.toLowerCase();
    }
  } catch {}
  const m = String(url).match(/(?:i|preview|external-preview)\.redd\.it\/(?:[a-zA-Z0-9_-]+\/)?([a-zA-Z0-9_-]{6,})/i);
  return m ? m[1].toLowerCase() : '';
}

export function parseRedditResolution(url) {
  if (!url) return 0;
  const m = String(url).match(/DASH_(\d+)/i);
  if (m) return parseInt(m[1], 10);
  const m2 = String(url).match(/(\d{3,4})p/i);
  if (m2) return parseInt(m2[1], 10);
  return 0;
}

export function isItemGif(item) {
  if (!item) return false;
  if (item.isGif || item.type === 'gif' || item.postType === 'gif') return true;
  const u = item.sourceUrl || item.source || item.url || '';
  return item.mime === 'image/gif' ||
         /\.(gif|gifv)(?:[?#]|$)/i.test(u) ||
         /[?&]format=mp4(?:&|$)/i.test(u) ||
         /(?:giphy\.com|tenor\.com|gfycat\.com)/i.test(u) ||
         /\.(gif|gifv)(?:[?#]|$)/i.test(item.previewUrl || '') ||
         /\.(gif|gifv)(?:[?#]|$)/i.test(item.poster || '');
}

export function extractRedditThumbnail(post) {
  if (!post) return '';

  // 1. Direct attributes
  const directAttr = post.getAttribute?.('thumbnail') ||
                     post.getAttribute?.('preview-img') ||
                     post.getAttribute?.('content-src') ||
                     post.getAttribute?.('preview');
  if (directAttr && typeof directAttr === 'string' && !isDisallowedMediaUrl(directAttr) && !isProfileOrAvatarUrl(directAttr)) {
    return directAttr.replace(/&amp;/g, '&');
  }

  // 2. JSON attributes (packaged-media-json, preview-media-json, post-data)
  for (const attr of ['packaged-media-json', 'preview-media-json', 'post-data']) {
    const rawJson = post.getAttribute?.(attr);
    if (rawJson) {
      try {
        const data = JSON.parse(rawJson);
        const imgObj = data.preview?.images?.[0] || data.images?.[0] || data.thumbnail;
        if (imgObj) {
          const srcUrl = imgObj.source?.url || imgObj.url;
          if (srcUrl && !isDisallowedMediaUrl(srcUrl)) {
            return srcUrl.replace(/&amp;/g, '&');
          }
        }
      } catch {}
    }
  }

  // 3. Child elements: faceplate-img, shreddit-aspect-ratio, slotted thumbnail, etc.
  const faceplateImg = post.querySelector?.('faceplate-img');
  const fpSrc = faceplateImg?.getAttribute('src') || faceplateImg?.src;
  if (fpSrc && !isDisallowedMediaUrl(fpSrc) && !isProfileOrAvatarUrl(fpSrc)) {
    return fpSrc.replace(/&amp;/g, '&');
  }

  const candidateImgs = [
    post.querySelector?.('shreddit-aspect-ratio img'),
    post.querySelector?.('img[slot="thumbnail"]'),
    post.querySelector?.('img[alt="media poster"]'),
    post.querySelector?.('img[loading]'),
    post.querySelector?.('img')
  ].filter(Boolean);

  for (const img of candidateImgs) {
    const src = img.currentSrc || img.getAttribute?.('src') || img.getAttribute?.('data-src') || '';
    if (src && !isDisallowedMediaUrl(src) && !isProfileOrAvatarUrl(src) && !src.startsWith('data:image/svg')) {
      return src.replace(/&amp;/g, '&');
    }
  }

  return '';
}

export function detectExternalVideo(contentHref = '', domain = '', post = null) {
  let targetUrl = contentHref || '';
  const dom = (domain || '').toLowerCase();

  // If contentHref is empty or generic, check anchor tags inside the post
  if ((!targetUrl || targetUrl === '#' || /reddit\.com/i.test(targetUrl)) && post) {
    const externalLink = post.querySelector?.('a[href*="redgifs.com"], a[href*="streamable.com"], a[href*="imgur.com"], a[href*="giphy.com"], a[href*="youtube.com"], a[href*="youtu.be"]');
    if (externalLink?.href) targetUrl = externalLink.href;
  }

  // 1. RedGifs
  const isRedGifs = /redgifs\.com/i.test(targetUrl) || dom.includes('redgifs');
  if (isRedGifs) {
    const match = targetUrl.match(/redgifs\.com\/(?:watch|ifr)\/([a-zA-Z0-9_-]+)/i);
    const id = match ? match[1].replace(/\?.*$/, '') : '';
    const embedUrl = id ? `https://www.redgifs.com/ifr/${id}?autoplay=0` : targetUrl;
    return {
      provider: 'redgifs',
      id,
      embedUrl,
      isEmbed: true,
      isVideo: true,
      isGif: true,
      directUrl: '',
      fallbackUrls: id ? [
        `https://thumbs2.redgifs.com/${id}.mp4`,
        `https://thumbs2.redgifs.com/${id}-mobile.mp4`,
        `https://media.redgifs.com/${id}.mp4`
      ] : [],
      poster: id ? `https://thumbs2.redgifs.com/${id}.jpg` : ''
    };
  }

  // 2. Streamable
  const isStreamable = /streamable\.com/i.test(targetUrl) || dom.includes('streamable');
  if (isStreamable) {
    const match = targetUrl.match(/streamable\.com\/(?:e\/|o\/)?([a-zA-Z0-9]+)/i);
    const id = match ? match[1].replace(/\?.*$/, '') : '';
    const embedUrl = id ? `https://streamable.com/e/${id}?autoplay=0` : targetUrl;
    return {
      provider: 'streamable',
      id,
      embedUrl,
      isEmbed: true,
      isVideo: true,
      isGif: false,
      directUrl: '',
      fallbackUrls: [],
      poster: ''
    };
  }

  // 3. Imgur
  const isImgur = /imgur\.com/i.test(targetUrl) || dom.includes('imgur');
  if (isImgur) {
    if (/\.(mp4|gifv)(?:[?#]|$)/i.test(targetUrl)) {
      const mp4Url = targetUrl.replace(/\.gifv(?:[?#]|$)/i, '.mp4');
      return {
        provider: 'imgur',
        id: '',
        embedUrl: '',
        isEmbed: false,
        isVideo: true,
        isGif: true,
        directUrl: mp4Url,
        fallbackUrls: [mp4Url],
        poster: mp4Url.replace(/\.mp4(?:[?#]|$)/i, '.jpg')
      };
    }
  }

  // 4. Giphy
  const isGiphy = /giphy\.com/i.test(targetUrl) || dom.includes('giphy');
  if (isGiphy) {
    const match = targetUrl.match(/giphy\.com\/(?:gifs|media)\/(?:.*-)?([a-zA-Z0-9]+)/i);
    const id = match ? match[1].replace(/\?.*$/, '') : '';
    const embedUrl = id ? `https://giphy.com/embed/${id}` : targetUrl;
    const mp4Url = id ? `https://media.giphy.com/media/${id}/giphy.mp4` : '';
    return {
      provider: 'giphy',
      id,
      embedUrl,
      isEmbed: !mp4Url,
      isVideo: true,
      isGif: true,
      directUrl: mp4Url,
      fallbackUrls: mp4Url ? [mp4Url] : [],
      poster: id ? `https://media.giphy.com/media/${id}/giphy.gif` : ''
    };
  }

  // 5. YouTube
  const isYouTube = /(?:youtube\.com|youtu\.be)/i.test(targetUrl) || dom.includes('youtube') || dom.includes('youtu.be');
  if (isYouTube) {
    const match = targetUrl.match(/(?:v=|youtu\.be\/|embed\/)([a-zA-Z0-9_-]{11})/i);
    const id = match ? match[1] : '';
    const embedUrl = id ? `https://www.youtube-nocookie.com/embed/${id}?autoplay=0` : targetUrl;
    return {
      provider: 'youtube',
      id,
      embedUrl,
      isEmbed: true,
      isVideo: true,
      isGif: false,
      directUrl: '',
      fallbackUrls: id ? [
        `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`,
        `https://i.ytimg.com/vi/${id}/hqdefault.jpg`
      ] : [],
      poster: id ? `https://i.ytimg.com/vi/${id}/maxresdefault.jpg` : ''
    };
  }

  return null;
}

export function canonicalMediaId(url, item = null) {
  if (isDisallowedMediaUrl(url)) return '';
  try {
    const raw = String(url || '');
    const ytMatch = raw.match(/(?:youtu\.be\/|(?:youtube\.com|youtube-nocookie\.com)\/(?:embed\/|shorts\/|live\/|watch\?(?:.*&)?v=))([a-zA-Z0-9_-]{11})/i);
    if (ytMatch) return `youtube:${ytMatch[1]}`;

    if (item && item.site === 'tumblr') {
      const postId = item.postId;
      const assetHash = raw.match(/tumblr_([a-zA-Z0-9]+)/i)?.[1] || raw.match(/media\.tumblr\.com\/([a-f0-9]{32})/i)?.[1];
      if (postId && item.galleryIndex != null) {
        return `tumblr:post:${postId}:${item.galleryIndex}`;
      }
      if (postId && assetHash) {
        return `tumblr:post:${postId}:${assetHash}`;
      }
      if (postId && item.type === 'video') {
        return `tumblr:video:${postId}`;
      }
      if (postId) {
        return `tumblr:post:${postId}`;
      }
      if (assetHash) return `tumblr:media:${assetHash}`;
    } else if (raw.includes('media.tumblr.com')) {
      const assetHash = raw.match(/tumblr_([a-zA-Z0-9]+)/i)?.[1] || raw.match(/media\.tumblr\.com\/([a-f0-9]{32})/i)?.[1];
      if (assetHash) return `tumblr:media:${assetHash}`;
    }

    if (item && item.site === 'x') {
      const mediaId = (item.poster || item.previewUrl || item.source || raw).match(/(?:amplify_video_thumb|ext_tw_video_thumb|tweet_video_thumb|amplify_video|ext_tw_video|tweet_video)\/(\d+)/i)?.[1];
      if (mediaId) return `x:video:${mediaId}`;
      const tweetId = raw.match(/status\/(\d+)/)?.[1] || (item.postUrl || '').match(/status\/(\d+)/)?.[1];
      if (tweetId) return `x:tweet:${tweetId}`;
    } else if (raw.includes('twimg.com')) {
      const mediaId = raw.match(/(?:amplify_video_thumb|ext_tw_video_thumb|tweet_video_thumb|amplify_video|ext_tw_video|tweet_video)\/(\d+)/i)?.[1];
      if (mediaId) return `x:video:${mediaId}`;
    }

    if (item && item.site === 'reddit') {
      const isGal = item.isGallery || item.postType === 'gallery' || item.galleryIndex != null;
      const pId = item.postId ? String(item.postId).replace(/^t3_/, '').toLowerCase() : getRedditPostId(item.postUrl || raw);
      if (pId && (item.type === 'video' || item.isGif || item.postType === 'video' || item.postType === 'gif' || item.isEmbed)) {
        return `reddit:post-video:${pId}`;
      }
      if (pId && !isGal) {
        return `reddit:post:${pId}`;
      }
      if (pId && isGal && item.galleryIndex != null) {
        return `reddit:gallery:${pId}:${item.galleryIndex}`;
      }
    }

    const redditVid = getRedditVideoId(raw) || (item && item.site === 'reddit' && item.type === 'video' ? getRedditVideoId(item.source || '') : '');
    if (redditVid) return `reddit:video:${redditVid}`;

    const redditImg = getRedditImageId(raw) || (item && item.site === 'reddit' ? getRedditImageId(item.source || item.previewUrl || '') : '');
    if (redditImg) return `reddit:image:${redditImg}`;

    if (item && item.site === 'reddit' && item.type === 'video' && item.postUrl) {
      const pId = getRedditPostId(item.postUrl);
      if (pId) return `reddit:post-video:${pId}`;
    }

    if (item && item.site === 'instagram') {
      const pId = item.postId || getInstagramShortcode(item.postUrl || item.playbackPage || item.pageUrl || raw);
      if (pId && item.galleryIndex != null) {
        return `instagram:post:${pId}:${item.galleryIndex}`;
      }
      if (pId) {
        return `instagram:post:${pId}`;
      }
    }

    const igCode = getInstagramShortcode(raw);
    if (igCode) {
      return `instagram:post:${igCode}`;
    }

    if (raw.includes('cdninstagram.com')) {
      const match = raw.match(/\/([a-zA-Z0-9_-]+_[an])\.(?:jpe?g|png|webp|mp4)/i) ||
                    raw.match(/\/([0-9]+_[0-9]+_[0-9]+_[an])\./i);
      if (match) return `instagram:media:${match[1]}`;
    }

    const u = new URL(raw);
    if (u.hostname === 'preview.redd.it' || u.hostname === 'external-preview.redd.it') {
      const rId = getRedditImageId(raw);
      if (rId) return `reddit:image:${rId}`;
    }
    for (const [k, v] of [...u.searchParams]) {
      if (/^(width|height|w|h|quality|crop|auto)$/i.test(k)) u.searchParams.delete(k);
      else if (k.toLowerCase() === 'format' && v.toLowerCase() !== 'mp4') u.searchParams.delete(k);
      else if (k.toLowerCase() === 'q' && /^\d+$/.test(v)) u.searchParams.delete(k);
      else if (k.toLowerCase() === 'name' && /^(small|medium|large|orig|900x900)$/i.test(v)) u.searchParams.delete(k);
    }
    return u.href;
  } catch {
    return String(url).replace(/([?&])(width|height|w|h|quality)=\d+(&|$)/gi, '$1').replace(/[?&]$/, '');
  }
}

export function isDirectPlayableVideo(url) {
  if (!url || typeof url !== 'string' || isDisallowedMediaUrl(url)) return false;
  // Cross-origin blobs (e.g. blob:https://www.instagram.com/...) cannot be played across origins in extension
  if (/^blob:https?:/i.test(url)) return false;
  if (/^blob:/i.test(url) || /^data:video\//i.test(url)) return true;
  if (url.includes('youtube.com') || url.includes('youtube-nocookie.com') || url.includes('youtu.be') || url.includes('#mosaic-video-')) return false;
  if (/redgifs\.com\/(?:ifr|watch)/i.test(url) || /streamable\.com\/(?:e\/|[a-zA-Z0-9]+$)/i.test(url)) return false;
  return /\.(mp4|webm|mov|m4v|ogv)(?:[?#]|$)/i.test(url) ||
         /[?&]format=mp4(?:&|$)/i.test(url) ||
         /(?:cdninstagram\.com|fbcdn\.net)\/.*(?:\.mp4|\/o1\/v\/|\/v\/t(?:50|66)\.)/i.test(url) ||
         /video\.twimg\.com|v\.redd\.it|thumbs2\.redgifs\.com|media\.redgifs\.com|media\.giphy\.com/i.test(url);
}

export function getPlayableVideoUrl(item) {
  if (!item) return '';
  if (item.type !== 'video' && !isItemGif(item)) return '';
  if (item.savedFile) return item.sourceUrl || item.url || '';
  if (item.isEmbed || item.site === 'youtube') return '';

  const candidates = [
    item.sourceUrl,
    item.source,
    item.url,
    ...(item.fallbackUrls || [])
  ].filter(u => {
    if (!u || typeof u !== 'string' || u.includes('#mosaic-video-')) return false;
    if (/^blob:https?:/i.test(u)) return false;
    if (/[?&]format=mp4(?:&|$)/i.test(u)) return true;
    return !/\.(jpe?g|png|webp|avif|gif|svg)(?:[?#]|$)/i.test(u);
  });

  const direct = candidates.find(u => isDirectPlayableVideo(u));
  if (direct && !/^blob:https?:/i.test(direct)) return direct;
  return '';
}

export function getGifAnimatedUrl(item) {
  if (!item) return '';
  if (!isItemGif(item)) return '';

  // 1. Playable video URL (e.g. format=mp4 or .mp4 loop)
  const playable = getPlayableVideoUrl(item);
  if (playable) return playable;

  // 2. Native Reddit preview URL -> convert to full animated i.redd.it gif
  const rawUrl = item.url || item.sourceUrl || item.source || '';
  try {
    const u = new URL(rawUrl);
    if (u.hostname === 'preview.redd.it' && /\.gif(?:[?#]|$)/i.test(rawUrl)) {
      const parts = u.pathname.split('/').filter(Boolean);
      const filename = parts.pop() || '';
      const base = filename.split('.')[0];
      if (base) return `https://i.redd.it/${base}.gif`;
    }
  } catch {}

  // 3. Check fallbacks
  if (Array.isArray(item.fallbackUrls)) {
    const anim = item.fallbackUrls.find(u => typeof u === 'string' && (/\.gif(?:[?#]|$)/i.test(u) || /[?&]format=mp4/i.test(u)));
    if (anim) return anim;
  }

  // 4. Return raw url or .gif converted
  if (/\.gifv(?:[?#]|$)/i.test(rawUrl)) return rawUrl.replace(/\.gifv/i, '.gif');
  if (/\.gif(?:[?#]|$)/i.test(rawUrl)) return rawUrl;
  return item.url || '';
}

export function isItemDownloaded(item, savedFiles = []) {
  if (!item) return false;
  if (item.downloadId || item.savedFile || item.saved) return true;
  const directUrl = item.sourceUrl || item.source || item.url;
  const canonicalId = item.id || canonicalMediaId(directUrl, item);
  return savedFiles.some(file => {
    if (!file) return false;
    if (file.id === item.id || file.id === item.libraryId || file.id === canonicalId) return true;
    if (file.sourceUrl && directUrl && file.sourceUrl === directUrl) return true;
    if (file.sourceUrl && item.url && file.sourceUrl === item.url) return true;
    return false;
  });
}

export function filename(url) {
  try {
    return decodeURIComponent(new URL(url).pathname.split('/').pop()) || new URL(url).hostname;
  } catch {
    return 'Media item';
  }
}

export function formatSize(n) {
  return n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;
}

export function formatVideoTime(value) {
  if (!Number.isFinite(value) || value < 0) return '0:00';
  const totalSeconds = Math.floor(value);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function formatDuration(val) {
  if (!val && val !== 0) return '';
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (/^\d+:\d+(?::\d+)?$/.test(trimmed)) return trimmed;
    const isoMatch = trimmed.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/i);
    if (isoMatch && (isoMatch[1] || isoMatch[2] || isoMatch[3])) {
      const h = parseInt(isoMatch[1] || '0', 10);
      const m = parseInt(isoMatch[2] || '0', 10);
      const s = parseInt(isoMatch[3] || '0', 10);
      return formatDuration(h * 3600 + m * 60 + s);
    }
    const num = parseFloat(trimmed);
    if (!isNaN(num) && num > 0) return formatDuration(num);
    return '';
  }
  if (typeof val === 'number' && Number.isFinite(val) && val > 0) {
    const totalSec = Math.round(val);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    if (h > 0) {
      return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
    return `${m}:${String(s).padStart(2, '0')}`;
  }
  return '';
}

export function pageIdentity(url) {
  try {
    const u = new URL(url);
    return u.origin;
  } catch {
    return '';
  }
}

export function escapeHtml(v) {
  return String(v).replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[c]));
}
