export function scanLiveNowInTab() {
  const isDisallowedMediaUrl = (url) => {
    if (!url || typeof url !== 'string') return true;
    const s = url.trim();
    if (!s || /^javascript:/i.test(s) || /^data:(?:text|application)\//i.test(s) || /^data:image\/svg\+xml/i.test(s)) return true;
    try {
      const parsed = new URL(s, location.href);
      const path = parsed.pathname.toLowerCase();
      if (/\.(js|mjs|cjs|jsx|ts|tsx|css|scss|sass|less|map|json|jsonld|wasm|woff2?|ttf|otf|eot|zip|rar|tar|gz|7z|dmg|exe|pkg|deb|rpm|pdf|docx?|xlsx?|pptx?|txt|md|csv|xml)$/i.test(path)) {
        return true;
      }
      if (/\.(js|mjs|cjs|jsx|ts|tsx|css|json|map)(?:[?#]|$)/i.test(s)) {
        return true;
      }
    } catch {
      if (/\.(js|mjs|cjs|jsx|ts|tsx|css|scss|sass|less|map|json|jsonld|wasm|woff2?|ttf|otf|eot|zip|rar|tar|gz|7z|dmg|exe|pkg|deb|rpm|pdf|docx?|xlsx?|pptx?|txt|md|csv|xml)(?:[?#]|$)/i.test(s)) {
        return true;
      }
    }
    return false;
  };

  const isProfileOrAvatarUrl = (url) => {
    if (!url || typeof url !== 'string') return false;
    return /twimg\.com\/(?:profile_images|profile_banners|sticky\/default_profile_images)\//i.test(url) ||
           /(?:styles\.redditmedia\.com\/.*avatar|reddit\.com\/avatar)/i.test(url) ||
           /(?:avatars\.githubusercontent\.com|yt3\.ggpht\.com)/i.test(url) ||
           /(?:media\.tumblr\.com\/avatar_|assets\.tumblr\.com\/images\/default_avatar|api\.tumblr\.com\/v2\/blog\/.*\/avatar|s\d+x\d+u_c1\/)/i.test(url);
  };

  const isItemGif = (item) => {
    if (!item) return false;
    if (item.isGif || item.type === 'gif' || item.postType === 'gif') return true;
    const u = item.sourceUrl || item.source || item.url || '';
    return item.mime === 'image/gif' ||
           /\.(gif|gifv)(?:[?#]|$)/i.test(u) ||
           /[?&]format=mp4(?:&|$)/i.test(u) ||
           /(?:giphy\.com|tenor\.com|gfycat\.com)/i.test(u) ||
           /\.(gif|gifv)(?:[?#]|$)/i.test(item.previewUrl || '') ||
           /\.(gif|gifv)(?:[?#]|$)/i.test(item.poster || '');
  };

  const extractRedditThumbnail = (post) => {
    if (!post) return '';
    const directAttr = post.getAttribute?.('thumbnail') ||
                       post.getAttribute?.('preview-img') ||
                       post.getAttribute?.('content-src') ||
                       post.getAttribute?.('preview');
    if (directAttr && typeof directAttr === 'string' && !isDisallowedMediaUrl(directAttr) && !isProfileOrAvatarUrl(directAttr)) {
      return directAttr.replace(/&amp;/g, '&');
    }

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

    const faceplateImg = post.querySelector?.('faceplate-img');
    const fpSrc = faceplateImg?.getAttribute?.('src') || faceplateImg?.src;
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
  };

  const detectExternalVideo = (contentHref = '', domain = '', post = null) => {
    let targetUrl = contentHref || '';
    const dom = (domain || '').toLowerCase();

    if ((!targetUrl || targetUrl === '#' || /reddit\.com/i.test(targetUrl)) && post) {
      const externalLink = post.querySelector?.('a[href*="redgifs.com"], a[href*="streamable.com"], a[href*="imgur.com"], a[href*="giphy.com"], a[href*="youtube.com"], a[href*="youtu.be"]');
      if (externalLink?.href) targetUrl = externalLink.href;
    }

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
  };

  const host = location.hostname.toLowerCase();
  const isReddit = host.includes('reddit.com');
  const isX = host === 'x.com' || host.endsWith('.x.com') || host.includes('twitter.com');
  const isYouTube = host.includes('youtube.com') || host.includes('youtu.be');
  const isTumblr = host.includes('tumblr.com');
  const isInstagram = host.includes('instagram.com');

  const bestSrcset = (value = '') => {
    if (!value || typeof value !== 'string') return '';
    const parts = value.split(/,\s*(?=https?:)/);
    const candidates = [];
    for (const part of parts) {
      const bits = part.trim().split(/\s+/);
      const url = bits[0];
      const metric = parseFloat(bits[1]) || 0;
      if (url && !isDisallowedMediaUrl(url)) {
        candidates.push({ url, metric });
      }
    }
    candidates.sort((a, b) => b.metric - a.metric);
    return candidates[0]?.url || '';
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
    return [...new Set(matches.map(m => m.slice(1).toLowerCase()))];
  };

  const extractMentions = (text) => {
    if (!text || typeof text !== 'string') return [];
    const matches = text.match(/@([a-zA-Z0-9_\.]+)/g);
    if (!matches) return [];
    return [...new Set(matches.map(m => m.slice(1)))];
  };

  const getInstagramProfileFromPath = (pathname = '') => {
    try {
      const path = (pathname || location.pathname || '').replace(/^\/+|\/+$/g, '');
      const parts = path.split('/');
      const first = parts[0] || '';
      const reserved = new Set(['', 'p', 'reel', 'reels', 'stories', 'explore', 'direct', 'accounts', 'developer', 'about', 'legal', 'terms', 'privacy', 'directory', 'tag', 'tags', 'archive']);
      if (first && !reserved.has(first.toLowerCase()) && /^[a-zA-Z0-9_\.]+$/.test(first)) {
        return first;
      }
    } catch {}
    return '';
  };

  const getInstagramTagFromPath = (pathname = '') => {
    try {
      const path = pathname || location.pathname || '';
      const m = path.match(/\/explore\/tags\/([^\/?#]+)/i) || path.match(/\/tags\/([^\/?#]+)/i);
      return m ? decodeURIComponent(m[1]) : '';
    } catch {}
    return '';
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

  const extractInstagramPoster = (container) => {
    if (!container) return '';
    let root = container;
    if (root.matches?.('video')) {
      root = root.closest('a[href*="/p/"], a[href*="/reel/"], article, div[role="dialog"]') || root.parentElement?.parentElement || root.parentElement || root;
    }
    if (!root.querySelector?.('img, picture source, canvas, [style*="background-image"], [style*="background:"]')) {
      const up = root.closest?.('a[href*="/p/"], a[href*="/reel/"], article, div[role="dialog"]');
      if (up) root = up;
    }

    // 0. Container itself is an img
    if (root.matches?.('img')) {
      const s = bestSrcset(root.getAttribute('srcset') || root.getAttribute('data-srcset') || '') ||
                root.currentSrc ||
                root.src ||
                root.getAttribute('data-src') ||
                root.getAttribute('data-lazy-src') ||
                root.getAttribute('data-original') || '';
      if (s && !isDisallowedMediaUrl(s) && !isProfileOrAvatarUrl(s) && !s.startsWith('data:image/svg') && !s.includes('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7')) {
        return s;
      }
    }

    // 1. Picture source srcset
    const picSources = [...root.querySelectorAll('picture source')];
    for (const s of picSources) {
      const srcset = s.getAttribute('srcset') || s.getAttribute('data-srcset') || '';
      const best = bestSrcset(srcset);
      if (best && !isDisallowedMediaUrl(best) && !isProfileOrAvatarUrl(best)) return best;
    }

    // 2. Video element poster attribute or frame capture
    const vids = root.matches?.('video') ? [root] : [...root.querySelectorAll('video')];
    for (const vid of vids) {
      const vPoster = vid.getAttribute('poster') || vid.poster || '';
      if (vPoster && !vPoster.startsWith('blob:') && !isDisallowedMediaUrl(vPoster) && !isProfileOrAvatarUrl(vPoster)) {
        return vPoster;
      }
      const frame = captureVideoFrame(vid);
      if (frame) return frame;
    }

    // 3. Img tags (excluding headers/avatars and 1x1 GIF placeholders)
    const imgs = [...root.querySelectorAll('img')].filter(img => {
      if (img.closest('header, nav, [role="navigation"]') || /avatar|profile picture/i.test(img.alt || '') || img.alt === 'Avatar') return false;
      return true;
    });
    for (const img of imgs) {
      const src = bestSrcset(img.getAttribute('srcset') || img.getAttribute('data-srcset') || '') ||
                  img.currentSrc ||
                  img.src ||
                  img.getAttribute('data-src') ||
                  img.getAttribute('data-lazy-src') ||
                  img.getAttribute('data-original') || '';
      if (src && !isDisallowedMediaUrl(src) && !isProfileOrAvatarUrl(src) && !src.startsWith('data:image/svg') && !src.includes('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7')) {
        return src;
      }
    }

    // 4. Canvas tags (Instagram blurhash/preview frames)
    const canvases = root.matches?.('canvas') ? [root] : [...root.querySelectorAll('canvas')];
    for (const c of canvases) {
      try {
        if (c.width > 20 && c.height > 20) {
          const dUrl = c.toDataURL('image/jpeg', 0.82);
          if (dUrl && dUrl.length > 500) return dUrl;
        }
      } catch {}
    }

    // 5. Background-image (both inline and computed)
    const bgEls = [...root.querySelectorAll('[style*="background-image"], [style*="background:"]')];
    for (const el of bgEls) {
      const bg = el.style.backgroundImage || el.style.background || '';
      const m = bg.match(/url\(['"]?([^'")]+)['"]?\)/i);
      if (m && m[1] && !isDisallowedMediaUrl(m[1]) && !isProfileOrAvatarUrl(m[1])) {
        return m[1];
      }
    }

    try {
      const cStyle = window.getComputedStyle(root);
      const cBg = cStyle?.backgroundImage || '';
      const m = cBg.match(/url\(['"]?([^'")]+)['"]?\)/i);
      if (m && m[1] && !isDisallowedMediaUrl(m[1]) && !isProfileOrAvatarUrl(m[1])) {
        return m[1];
      }
    } catch {}

    // 6. Recent Instagram photo entries from resource performance
    try {
      const entries = performance.getEntriesByType('resource');
      for (let i = entries.length - 1; i >= 0 && i >= entries.length - 30; i--) {
        const name = entries[i].name;
        if (name && /(?:cdninstagram\.com|fbcdn\.net)\/.*(?:[?&]stp=dst-jpg|\/v\/t51\.|\.jpg|\.webp)/i.test(name) &&
            !isDisallowedMediaUrl(name) && !isProfileOrAvatarUrl(name)) {
          return name;
        }
      }
    } catch {}

    return '';
  };

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

  const igVariantCache = new WeakMap();
  const readInstagramMedia = (container) => {
    if (!container) return [];
    if (igVariantCache.has(container)) return igVariantCache.get(container);

    const seen = new WeakSet();
    let checked = 0;
    const found = [];

    const parseMediaObj = (obj, meta = {}) => {
      if (!obj || typeof obj !== 'object') return null;

      const code = obj.code || obj.shortcode || meta.postId || '';
      const user = obj.user || obj.owner || {};
      const username = typeof user.username === 'string' ? user.username : (meta.author || getInstagramProfileFromPath() || '');
      const caption = typeof obj.caption === 'string'
        ? obj.caption
        : (obj.caption?.text || obj.edge_media_to_caption?.edges?.[0]?.node?.text || meta.caption || '');
      const rawLikes = obj.like_count != null ? obj.like_count : (obj.edge_liked_by?.count != null ? obj.edge_liked_by.count : (obj.edge_media_preview_like?.count != null ? obj.edge_media_preview_like.count : meta.likes));
      const likes = (rawLikes != null && Number(rawLikes) > 0) ? Number(rawLikes) : (meta.likes || undefined);
      const rawComments = obj.comment_count != null ? obj.comment_count : (obj.edge_media_to_comment?.count != null ? obj.edge_media_to_comment.count : meta.commentCount);
      const comments = (rawComments != null && Number(rawComments) > 0) ? Number(rawComments) : (meta.commentCount || undefined);
      const postUrl = code ? `https://www.instagram.com/p/${code}/` : (meta.postUrl || '');
      const tagFromPath = getInstagramTagFromPath();
      const hashtags = extractHashtags(caption);
      if (tagFromPath && !hashtags.includes(tagFromPath)) hashtags.push(tagFromPath);
      const mentions = extractMentions(caption);

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
          if (parsed) found.push(parsed);
        });
        return null;
      }

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
        if (!poster && container) poster = extractInstagramPoster(container);

        if (bestVid || poster) {
          return {
            type: bestVid ? 'video' : 'image',
            url: bestVid || poster,
            source: bestVid || poster,
            poster,
            previewUrl: poster || bestVid,
            fallbackUrls: fallbacks,
            width: vW || (obj.dimensions?.width) || 0,
            height: vH || (obj.dimensions?.height) || 0,
            duration: Math.round(obj.video_duration || 0),
            postId: code,
            author: username,
            caption,
            hashtags,
            mentions,
            tags: hashtags,
            likes,
            commentCount: comments,
            postUrl: postUrl || location.href,
            pageUrl: postUrl || location.href,
            pageTitle: document.title,
            site: 'instagram',
            alt: caption.slice(0, 120) || (username ? `Video by ${username}` : 'Instagram video'),
            ...meta
          };
        }
      }

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
          postUrl: postUrl || location.href,
          pageUrl: postUrl || location.href,
          pageTitle: document.title,
          site: 'instagram',
          alt: caption.slice(0, 120) || (username ? `Photo by ${username}` : 'Instagram photo'),
          ...meta
        };
      }

      return null;
    };

    const inspectObj = (value, depth) => {
      if (!value || typeof value !== 'object' || depth > 10 || checked++ > 3500 || seen.has(value)) return;
      seen.add(value);

      if (value.video_versions || value.videoVersions || value.video_url || value.videoUrl || value.dash_manifest || value.progressive_download_url || value.image_versions2 || value.carousel_media || value.edge_sidecar_to_children || (value.media_type && (value.video_url || value.display_url))) {
        const item = parseMediaObj(value);
        if (item) found.push(item);
      } else if (Array.isArray(value.items)) {
        value.items.forEach(it => {
          const item = parseMediaObj(it);
          if (item) found.push(item);
        });
      } else if (value.post || value.media || value.item) {
        const item = parseMediaObj(value.post || value.media || value.item);
        if (item) found.push(item);
      }

      for (const key of Object.keys(value)) {
        if (/^(return|child|sibling|stateNode|_owner|_store|owner|elementType|type)$/i.test(key)) continue;
        try { inspectObj(value[key], depth + 1); } catch {}
      }
    };

    const nodes = [container, ...(container?.querySelectorAll?.('video, img, article, a[href*="/p/"], a[href*="/reel/"]') || [])];
    for (const node of nodes) {
      if (found.length >= 25) break;
      for (const key of Object.keys(node)) {
        if (key.startsWith('__reactFiber$') || key.startsWith('__reactInternalInstance$')) {
          let fiber = node[key];
          let fDepth = 0;
          while (fiber && fDepth++ < 30) {
            if (fiber.memoizedProps) inspectObj(fiber.memoizedProps, 0);
            if (fiber.memoizedState) inspectObj(fiber.memoizedState, 0);
            fiber = fiber.return;
          }
        } else if (key.startsWith('__reactProps$')) {
          inspectObj(node[key], 0);
        }
      }
    }

    igVariantCache.set(container, found);
    return found;
  };

  const getVId = (url) => {
    if (!url || typeof url !== 'string') return '';
    try {
      const u = new URL(url, location.href);
      if (u.hostname.includes('youtu.be')) {
        const id = u.pathname.slice(1).split(/[?#&/]/)[0];
        if (/^[a-zA-Z0-9_-]{11}$/.test(id)) return id;
      }
      if (u.pathname.includes('/shorts/')) {
        const id = u.pathname.split('/shorts/')[1].split(/[?#&/]/)[0];
        if (/^[a-zA-Z0-9_-]{11}$/.test(id)) return id;
      }
      if (u.pathname.includes('/live/')) {
        const id = u.pathname.split('/live/')[1].split(/[?#&/]/)[0];
        if (/^[a-zA-Z0-9_-]{11}$/.test(id)) return id;
      }
      if (u.pathname.includes('/embed/')) {
        const id = u.pathname.split('/embed/')[1].split(/[?#&/]/)[0];
        if (/^[a-zA-Z0-9_-]{11}$/.test(id)) return id;
      }
      const vParam = u.searchParams.get('v');
      if (vParam && /^[a-zA-Z0-9_-]{11}$/.test(vParam)) return vParam;
    } catch {}
    const match = String(url).match(/(?:v=|youtu\.be\/|\/shorts\/|\/embed\/|\/live\/)([a-zA-Z0-9_-]{11})/i);
    return match ? match[1] : '';
  };

  const ytItems = [];
  if (isYouTube) {
    // Current playing video on watch or shorts page
    const currentVId = getVId(location.href);
    if (currentVId) {
      const isShort = location.pathname.includes('/shorts/');
      const mainVid = document.querySelector('video.html5-main-video') || document.querySelector('ytd-player video') || document.querySelector('video');
      const curDur = (mainVid && typeof mainVid.duration === 'number' && Number.isFinite(mainVid.duration) && mainVid.duration > 0)
        ? Math.round(mainVid.duration)
        : 0;
      const embedUrl = `https://www.youtube-nocookie.com/embed/${currentVId}?autoplay=1&enablejsapi=1`;
      const thumb = `https://i.ytimg.com/vi/${currentVId}/hqdefault.jpg`;
      const pageTitle = (
        document.querySelector('h1.ytd-watch-metadata, #title h1, h1.title, ytd-reel-player-header-renderer h2')?.textContent?.trim() ||
        document.title.replace(/^\(\d+\)\s*/, '').replace(/ - YouTube$/i, '').trim() ||
        'YouTube Video'
      );
      const vidWidth = (mainVid?.videoWidth && mainVid.videoWidth > 0) ? mainVid.videoWidth : (isShort ? 720 : 1280);
      const vidHeight = (mainVid?.videoHeight && mainVid.videoHeight > 0) ? mainVid.videoHeight : (isShort ? 1280 : 720);
      ytItems.push({
        url: embedUrl,
        type: 'video',
        duration: curDur,
        postUrl: location.href,
        pageUrl: location.href,
        pageTitle,
        alt: pageTitle,
        width: vidWidth,
        height: vidHeight,
        poster: thumb,
        fallbackUrls: [
          `https://i.ytimg.com/vi/${currentVId}/maxresdefault.jpg`,
          `https://i.ytimg.com/vi/${currentVId}/mqdefault.jpg`
        ],
        site: 'youtube',
        playbackPage: embedUrl,
        isEmbed: true
      });
    }

    const ytVideoSelector = [
      'ytd-thumbnail a#thumbnail',
      'a#thumbnail',
      'a[href*="/watch?v="]',
      'a[href*="/watch?"]',
      'a[href*="/shorts/"]',
      'a[href*="/live/"]',
      'a.yt-lockup-metadata-view-model__title',
      'a.yt-lockup-view-model__core-link',
      'a#video-title',
      'a#video-title-link',
      'ytd-reel-item-renderer a[href]'
    ].join(', ');

    document.querySelectorAll(ytVideoSelector).forEach(a => {
      const rawHref = a.getAttribute('href') || a.href || '';
      const vId = getVId(rawHref);
      if (!vId) return;

      const container = a.closest([
        'ytd-rich-item-renderer',
        'ytd-rich-grid-media',
        'yt-lockup-view-model',
        'yt-compact-lockup-view-model',
        'ytd-video-renderer',
        'ytd-compact-video-renderer',
        'ytd-grid-video-renderer',
        'ytd-reel-item-renderer',
        'ytd-reel-video-renderer',
        'ytd-playlist-video-renderer',
        'ytd-playlist-panel-video-renderer',
        'ytd-compact-radio-renderer',
        'ytd-radio-renderer',
        'ytd-item-section-renderer'
      ].join(',')) || a.parentElement || a;

      let title = (
        container.querySelector('#video-title')?.textContent?.trim() ||
        container.querySelector('.yt-lockup-metadata-view-model__title')?.textContent?.trim() ||
        container.querySelector('a.yt-lockup-metadata-view-model__title')?.textContent?.trim() ||
        container.querySelector('h3 a, h3 span, h3')?.textContent?.trim() ||
        container.querySelector('[id*="title"]')?.textContent?.trim() ||
        a.getAttribute('title')?.trim() ||
        a.getAttribute('aria-label')?.trim() ||
        a.textContent?.trim() ||
        ''
      );
      title = title.replace(/\s+/g, ' ').replace(/ - YouTube$/i, '').trim();
      if (!title || title.length < 2) title = 'YouTube Video';

      const timeElem = container.querySelector(
        '.badge-shape-wiz__text, badge-shape-wiz, ytd-thumbnail-overlay-time-status-renderer, span.ytd-thumbnail-overlay-time-status-renderer, #time-status'
      );
      let ytDuration = timeElem?.textContent?.trim() || '';
      if (!/^\d+:\d+/.test(ytDuration)) {
        const aria = a.getAttribute('aria-label') || container.querySelector('#video-title, a[aria-label]')?.getAttribute('aria-label') || '';
        const m = aria.match(/(?:(\d+)\s+hours?,\s*)?(\d+)\s+minutes?,\s*(\d+)\s+seconds?/i);
        if (m) {
          const h = m[1] ? parseInt(m[1], 10) : 0;
          const min = parseInt(m[2], 10);
          const sec = parseInt(m[3], 10);
          ytDuration = h > 0
            ? `${h}:${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
            : `${min}:${String(sec).padStart(2, '0')}`;
        }
      }

      const embedUrl = `https://www.youtube-nocookie.com/embed/${vId}?autoplay=1&enablejsapi=1`;

      const imgEl = (
        container.querySelector('img.yt-core-image') ||
        container.querySelector('img#img') ||
        container.querySelector('yt-img-shadow img') ||
        container.querySelector('img[src*="ytimg.com"], img[src*="ggpht.com"]') ||
        container.querySelector('img') ||
        a.querySelector('img')
      );
      const thumb = (imgEl?.currentSrc && !imgEl.currentSrc.startsWith('data:'))
        ? imgEl.currentSrc
        : (imgEl?.src && !imgEl.src.startsWith('data:'))
        ? imgEl.src
        : (imgEl?.getAttribute('src') && !imgEl.getAttribute('src').startsWith('data:'))
        ? imgEl.getAttribute('src')
        : `https://i.ytimg.com/vi/${vId}/hqdefault.jpg`;

      let postUrl = '';
      try {
        postUrl = rawHref ? new URL(rawHref, location.href).href : `https://www.youtube.com/watch?v=${vId}`;
      } catch {
        postUrl = `https://www.youtube.com/watch?v=${vId}`;
      }

      const isShort = Boolean(
        rawHref.includes('/shorts/') ||
        container.matches?.('ytd-reel-item-renderer, ytd-reel-video-renderer')
      );
      const vidWidth = isShort ? 720 : 1280;
      const vidHeight = isShort ? 1280 : 720;

      ytItems.push({
        url: embedUrl,
        type: 'video',
        duration: ytDuration,
        postUrl,
        pageUrl: postUrl,
        pageTitle: title,
        alt: title,
        width: vidWidth,
        height: vidHeight,
        poster: thumb,
        fallbackUrls: [
          `https://i.ytimg.com/vi/${vId}/maxresdefault.jpg`,
          `https://i.ytimg.com/vi/${vId}/hqdefault.jpg`,
          `https://i.ytimg.com/vi/${vId}/mqdefault.jpg`
        ],
        site: 'youtube',
        playbackPage: embedUrl,
        isEmbed: true
      });
    });
  }

  const tumblrItems = [];
  const processedTumblrMedia = new Set();
  if (isTumblr) {
    const extractTumblrImgData = (img) => {
      const picSource = img.closest('picture')?.querySelector('source')?.getAttribute('srcset') ||
                        img.closest('picture')?.querySelector('source')?.getAttribute('srcSet') || '';
      const rawSrcset = picSource ||
                        img.srcset ||
                        img.getAttribute('srcset') ||
                        img.getAttribute('srcSet') ||
                        img.getAttribute('data-srcset') ||
                        '';
      let best = '';
      let fallbacks = [];
      let width = 0;
      let height = 0;

      if (rawSrcset) {
        const candidates = rawSrcset.split(',')
          .map(part => {
            const [u, w] = part.trim().split(/\s+/);
            const num = parseInt(w, 10) || 0;
            return { url: u, width: num };
          })
          .filter(c => c.url && !isDisallowedMediaUrl(c.url) && !isProfileOrAvatarUrl(c.url))
          .sort((a, b) => b.width - a.width);

        if (candidates.length > 0) {
          best = candidates[0].url;
          fallbacks = candidates.map(c => c.url);
          if (candidates[0].width) width = candidates[0].width;
        }
      }

      if (!best) {
        const direct = (
          img.currentSrc ||
          img.src ||
          img.getAttribute('src') ||
          img.getAttribute('data-src') ||
          img.getAttribute('data-highres') ||
          img.getAttribute('data-full-src') ||
          ''
        );
        if (direct && !isDisallowedMediaUrl(direct) && !isProfileOrAvatarUrl(direct)) {
          best = direct;
          fallbacks = [direct];
        }
      }

      if (best && /\.gifv(?:[?#]|$)/i.test(best)) {
        const gifUrl = best.replace(/\.gifv/i, '.gif');
        best = gifUrl;
        fallbacks.unshift(gifUrl);
      }

      if (img.naturalWidth && img.naturalHeight) {
        width = img.naturalWidth;
        height = img.naturalHeight;
      } else if (img.width && img.height && img.width > 32 && img.height > 32) {
        width = img.width;
        height = img.height;
      } else if (best) {
        const dimMatch = best.match(/\/s(\d+)x(\d+)\//i);
        if (dimMatch) {
          width = parseInt(dimMatch[1], 10);
          height = parseInt(dimMatch[2], 10);
        } else if (!width) {
          const wMatch = best.match(/_(\d{2,4})\.(?:jpe?g|png|webp|gif)/i);
          if (wMatch) width = parseInt(wMatch[1], 10);
        }
      }

      return { best, fallbacks: [...new Set(fallbacks)], width, height };
    };

    const tumblrPosts = [
      ...document.querySelectorAll('article, [data-timeline-post], [data-testid="post"], [data-id], .post, .post_container, .entry, [data-login-wall-post-id]')
    ];
    const uniqueTumblrPosts = [...new Set(tumblrPosts)];

    uniqueTumblrPosts.forEach(post => {
      const postId = (
        post.getAttribute('data-id') ||
        post.getAttribute('data-post-id') ||
        post.getAttribute('data-login-wall-post-id') ||
        post.getAttribute('id')?.replace(/^post_/, '') ||
        post.closest('[data-id]')?.getAttribute('data-id') ||
        post.querySelector('[data-login-wall-post-id]')?.getAttribute('data-login-wall-post-id') ||
        post.querySelector('a[href*="/post/"]')?.getAttribute('href')?.match(/\/post\/(\d+)/)?.[1] ||
        location.pathname.match(/\/(\d{10,25})(?:\/|$)/)?.[1] ||
        ''
      );

      const blogAnchor = (
        post.querySelector('[data-testid="post-header-blog-name"]') ||
        post.querySelector('.post-header__blog-name') ||
        post.querySelector('a.reblog_author, a.post_info_author, a.author') ||
        post.querySelector('[data-login-wall-blog-name]') ||
        post.querySelector('header a[href*="tumblr.com"], header a[href^="/blog/"]')
      );
      let blogName = (
        post.getAttribute('data-login-wall-blog-name') ||
        post.querySelector('[data-login-wall-blog-name]')?.getAttribute('data-login-wall-blog-name') ||
        blogAnchor?.textContent?.trim() ||
        (location.hostname.includes('.tumblr.com') && !location.hostname.startsWith('www.') ? location.hostname.split('.')[0] : '') ||
        (location.pathname.startsWith('/') && !['explore', 'tagged', 'dashboard', 'search', 'settings'].includes(location.pathname.split('/')[1]) ? location.pathname.split('/')[1] : '') ||
        ''
      ).replace(/^@/, '');

      const reblogAnchor = post.querySelector('.reblog_source, a.reblog-source, .reblog-header a, a.reblogged-from');
      const rebloggedFrom = reblogAnchor?.textContent?.trim().replace(/^@/, '') || '';

      const tagEls = post.querySelectorAll('a[href*="/tagged/"], a.tag, [data-testid="post-tags"] a');
      const tags = [...tagEls].map(t => t.textContent.trim().replace(/^#/, '')).filter(Boolean);

      const permalinkAnchor = post.querySelector('a[href*="/post/"], a.post_permalink, a.post_info_link, a[rel="bookmark"]');
      let postUrl = '';
      try {
        if (permalinkAnchor?.href) {
          postUrl = new URL(permalinkAnchor.getAttribute('href'), location.href).href;
        } else if (postId && blogName) {
          postUrl = `https://${blogName}.tumblr.com/post/${postId}`;
        } else if (location.pathname.includes('/post/') || location.pathname.match(/\/\d{10,25}/)) {
          postUrl = location.href;
        }
      } catch {}

      const captionText = (
        post.querySelector('[data-testid="post-text"], .post_body, .caption, .body-text, .post-content-text')?.textContent?.trim() ||
        ''
      );

      const videoEls = [...post.querySelectorAll('video')];
      videoEls.forEach(v => {
        processedTumblrMedia.add(v);
        const sources = [...v.querySelectorAll('source')];
        const rawVidUrl = (
          sources.find(s => s.src && !isDisallowedMediaUrl(s.src))?.src ||
          sources.find(s => s.getAttribute('src') && !isDisallowedMediaUrl(s.getAttribute('src')))?.getAttribute('src') ||
          v.currentSrc ||
          v.src ||
          v.getAttribute('src') ||
          ''
        );
        if (!rawVidUrl || isDisallowedMediaUrl(rawVidUrl)) return;
        const poster = v.getAttribute('poster') || '';
        const dur = (typeof v.duration === 'number' && Number.isFinite(v.duration) && v.duration > 0) ? Math.round(v.duration) : 0;
        const isGifClip = Boolean(
          v.hasAttribute('loop') &&
          v.hasAttribute('muted') &&
          (rawVidUrl.includes('.mp4') || rawVidUrl.includes('.gifv') || /gif/i.test(captionText))
        );

        const variants = [];
        if (rawVidUrl.includes('.mp4')) {
          ['1080', '720', '480'].forEach(res => {
            const variantUrl = rawVidUrl.replace(/_(\d{3,4})\.mp4/i, `_${res}.mp4`);
            if (variantUrl !== rawVidUrl) variants.push(variantUrl);
          });
        }

        tumblrItems.push({
          url: rawVidUrl,
          type: 'video',
          site: 'tumblr',
          postId,
          blogName,
          rebloggedFrom,
          tags,
          postUrl: postUrl || location.href,
          pageUrl: postUrl || location.href,
          pageTitle: document.title,
          caption: captionText,
          alt: captionText.slice(0, 120) || 'Tumblr video',
          duration: dur,
          width: v.videoWidth || 1280,
          height: v.videoHeight || 720,
          poster,
          isGif: isGifClip,
          fallbackUrls: variants
        });
      });

      const allImgs = [...post.querySelectorAll('img')];
      const validMedia = [];

      allImgs.forEach(img => {
        if (
          img.closest('figure[aria-label="Avatar"], [data-testid="post-header-avatar"], .post-avatar') ||
          img.alt === 'Avatar' ||
          img.closest('header') ||
          /avatar/i.test(img.className || '')
        ) {
          return;
        }

        const data = extractTumblrImgData(img);
        if (data.best) {
          validMedia.push({ img, data });
        }
      });

      const totalPhotos = validMedia.length;
      validMedia.forEach(({ img, data }, idx) => {
        processedTumblrMedia.add(img);
        const { best, fallbacks } = data;
        const isGif = isItemGif({ url: best, sourceUrl: best, mime: img.getAttribute('data-mime') || '' });

        tumblrItems.push({
          url: best,
          type: 'image',
          site: 'tumblr',
          postId,
          blogName,
          rebloggedFrom,
          tags,
          postUrl: postUrl || location.href,
          pageUrl: postUrl || location.href,
          pageTitle: document.title,
          caption: captionText,
          alt: img.alt || captionText.slice(0, 120) || 'Tumblr image',
          width: img.naturalWidth || data.width || 0,
          height: img.naturalHeight || data.height || 0,
          galleryIndex: totalPhotos > 1 ? idx : null,
          galleryTotal: totalPhotos > 1 ? totalPhotos : null,
          isGallery: totalPhotos > 1,
          isGif,
          fallbackUrls: fallbacks
        });
      });
    });

    // Standalone Tumblr media nodes on legacy themes or unnested markup
    document.querySelectorAll('img[src*="media.tumblr.com"], img[srcset*="media.tumblr.com"], video[src*="media.tumblr.com"], figure.tmblr-full img, .photoset-image img').forEach(el => {
      if (processedTumblrMedia.has(el)) return;
      if (
        el.closest('figure[aria-label="Avatar"], [data-testid="post-header-avatar"], .post-avatar') ||
        el.alt === 'Avatar' ||
        el.closest('header')
      ) {
        return;
      }
      processedTumblrMedia.add(el);
      const isVid = el.matches('video');
      if (isVid) {
        const src = el.currentSrc || el.src || el.getAttribute('src') || '';
        if (!src || isDisallowedMediaUrl(src) || isProfileOrAvatarUrl(src)) return;
        tumblrItems.push({
          url: src,
          type: 'video',
          site: 'tumblr',
          pageUrl: location.href,
          pageTitle: document.title,
          alt: el.getAttribute('aria-label') || 'Tumblr video',
          width: el.videoWidth || 0,
          height: el.videoHeight || 0,
          poster: el.getAttribute('poster') || '',
          fallbackUrls: []
        });
      } else {
        const data = extractTumblrImgData(el);
        if (!data.best) return;
        const isGif = isItemGif({ url: data.best, sourceUrl: data.best });
        tumblrItems.push({
          url: data.best,
          type: 'image',
          site: 'tumblr',
          pageUrl: location.href,
          pageTitle: document.title,
          alt: el.alt || 'Tumblr image',
          width: el.naturalWidth || data.width || 0,
          height: el.naturalHeight || data.height || 0,
          isGif,
          fallbackUrls: data.fallbacks
        });
      }
    });
  }

  const instagramItems = [];
  const processedIgMedia = new Set();
  if (isInstagram) {
    const profileAuthor = getInstagramProfileFromPath();
    const tagFromPath = getInstagramTagFromPath();

    const articles = [...document.querySelectorAll('article')];
    articles.forEach(article => {
      const postLink = article.querySelector('a[href*="/p/"], a[href*="/reel/"]');
      const postHref = postLink?.href || '';
      const postId = getInstagramShortcode(postHref || location.href);
      const postUrl = postId ? `https://www.instagram.com/p/${postId}/` : (postHref || location.href);

      const authorEl = article.querySelector('header a[role="link"], header a[href^="/"], a[href^="/"][tabindex="0"]');
      const author = authorEl?.textContent?.trim() || authorEl?.getAttribute('href')?.replace(/^\/|\/$/g, '') || profileAuthor || '';

      const captionEl = article.querySelector('h1, span[dir="auto"], [data-testid="post-comment-root"]');
      const caption = captionEl?.textContent?.trim() || '';

      // Parse DOM likes and comments
      let domLikes = undefined;
      let domComments = undefined;
      const likeTextEl = article.querySelector('section a[href*="/liked_by/"], section span');
      const likeText = likeTextEl?.textContent || '';
      const likeMatch = likeText.match(/([\d,.]+[KMBkmb]?)\s*likes?/i) || likeText.match(/(?:and|,)\s*([\d,.]+[KMBkmb]?)\s*others?/i);
      if (likeMatch) domLikes = likeMatch[1];
      const commentBtn = article.querySelector('a[href*="/p/"][role="button"], button[type="button"]');
      const commentText = commentBtn?.textContent || '';
      const commentMatch = commentText.match(/(?:view all|view)\s*([\d,.]+[KMBkmb]?)\s*comments?/i);
      if (commentMatch) domComments = commentMatch[1];

      const fiberItems = readInstagramMedia(article);
      if (fiberItems && fiberItems.length > 0) {
        article.querySelectorAll('img, video').forEach(el => processedIgMedia.add(el));
        fiberItems.forEach(item => {
          instagramItems.push({
            ...item,
            postId: item.postId || postId,
            author: item.author || author,
            caption: item.caption || caption,
            likes: item.likes || domLikes,
            commentCount: item.commentCount || domComments,
            postUrl: item.postUrl || postUrl,
            pageUrl: postUrl,
            site: 'instagram'
          });
        });
        return;
      }

      // DOM fallback for video
      const articleVids = [...article.querySelectorAll('video')];
      const poster = extractInstagramPoster(article);
      articleVids.forEach(v => {
        processedIgMedia.add(v);
        let vidSrc = (v.currentSrc && !v.currentSrc.startsWith('blob:') ? v.currentSrc : '') || (v.src && !v.src.startsWith('blob:') ? v.src : '');
        if (!vidSrc) {
          try {
            const perfMp4 = performance.getEntriesByType('resource')
              .map(e => e.name)
              .find(name => /(?:cdninstagram\.com|fbcdn\.net)\/.*\.mp4/i.test(name));
            if (perfMp4) vidSrc = cleanInstagramVideoUrl(perfMp4);
          } catch {}
        }
        const dur = (typeof v.duration === 'number' && Number.isFinite(v.duration) && v.duration > 0) ? Math.round(v.duration) : 0;
        const mainUrl = vidSrc || poster || postUrl;
        const hashtags = extractHashtags(caption);
        if (tagFromPath && !hashtags.includes(tagFromPath)) hashtags.push(tagFromPath);
        const mentions = extractMentions(caption);
        instagramItems.push({
          url: mainUrl,
          type: 'video',
          site: 'instagram',
          postId,
          author,
          caption,
          hashtags,
          mentions,
          tags: hashtags,
          likes: domLikes,
          commentCount: domComments,
          postUrl,
          pageUrl: postUrl,
          pageTitle: document.title,
          poster,
          duration: dur,
          width: v.videoWidth || 0,
          height: v.videoHeight || 0,
          alt: caption.slice(0, 120) || (author ? `Video by ${author}` : 'Instagram video'),
          source: vidSrc || poster,
          playbackPage: vidSrc ? '' : postUrl
        });
      });

      if (articleVids.length > 0) {
        article.querySelectorAll('img').forEach(el => processedIgMedia.add(el));
        return;
      }

      // DOM fallback for images
      const articleImgs = [...article.querySelectorAll('img')];
      const validImgs = articleImgs.filter(img => {
        if (processedIgMedia.has(img)) return false;
        if (img.closest('header') || /avatar|profile picture/i.test(img.alt || '') || img.alt === 'Avatar') return false;
        const s = img.currentSrc || img.src || '';
        if (isProfileOrAvatarUrl(s) || isDisallowedMediaUrl(s)) return false;
        return true;
      });

      const totalSlides = validImgs.length;
      validImgs.forEach((img, idx) => {
        processedIgMedia.add(img);
        const src = bestSrcset(img.getAttribute('srcset') || '') || img.currentSrc || img.src || '';
        if (!src || isDisallowedMediaUrl(src) || isProfileOrAvatarUrl(src)) return;
        const hashtags = extractHashtags(caption);
        if (tagFromPath && !hashtags.includes(tagFromPath)) hashtags.push(tagFromPath);
        const mentions = extractMentions(caption);

        instagramItems.push({
          url: src,
          type: 'image',
          site: 'instagram',
          postId,
          author,
          caption,
          hashtags,
          mentions,
          tags: hashtags,
          likes: domLikes,
          commentCount: domComments,
          postUrl,
          pageUrl: postUrl,
          pageTitle: document.title,
          galleryIndex: totalSlides > 1 ? idx : null,
          galleryTotal: totalSlides > 1 ? totalSlides : null,
          isGallery: totalSlides > 1,
          width: img.naturalWidth || 0,
          height: img.naturalHeight || 0,
          alt: img.alt || caption.slice(0, 120) || (author ? `Photo by ${author}` : 'Instagram photo'),
          source: src
        });
      });
    });

    // Grid items (Profile, Explore, Reels)
    const gridLinks = [...document.querySelectorAll('a[href*="/p/"], a[href*="/reel/"]')];
    gridLinks.forEach(link => {
      const href = link.href || '';
      const postId = getInstagramShortcode(href);
      if (!postId) return;
      const postUrl = `https://www.instagram.com/p/${postId}/`;

      const fiberItems = readInstagramMedia(link);
      if (fiberItems && fiberItems.length > 0) {
        link.querySelectorAll('img, video').forEach(el => processedIgMedia.add(el));
        fiberItems.forEach(item => {
          instagramItems.push({
            ...item,
            postId: item.postId || postId,
            author: item.author || profileAuthor,
            postUrl,
            pageUrl: postUrl,
            site: 'instagram'
          });
        });
        return;
      }

      const vid = link.querySelector('video');
      const poster = extractInstagramPoster(link);
      const isReelOrVideoLink = /\/reel\//i.test(href) ||
        Boolean(link.querySelector('svg[aria-label="Reel"], svg[aria-label="Clip"], span[aria-label="Reel"], [aria-label*="reel" i], [aria-label*="clip" i], [aria-label*="video" i]'));

      if ((vid || isReelOrVideoLink) && (!vid || !processedIgMedia.has(vid))) {
        // Mark both video and image as processed so no duplicate image is added
        link.querySelectorAll('img, video').forEach(el => processedIgMedia.add(el));

        let vidSrc = (vid && !vid.currentSrc?.startsWith('blob:') && vid.currentSrc) || (vid && !vid.src?.startsWith('blob:') && vid.src) || '';
        const dur = (vid && typeof vid.duration === 'number' && Number.isFinite(vid.duration) && vid.duration > 0) ? Math.round(vid.duration) : 0;
        const hashtags = tagFromPath ? [tagFromPath] : [];
        instagramItems.push({
          url: vidSrc || poster || postUrl,
          type: 'video',
          site: 'instagram',
          postId,
          author: profileAuthor,
          hashtags,
          tags: hashtags,
          postUrl,
          pageUrl: postUrl,
          pageTitle: document.title,
          poster,
          duration: dur,
          width: vid?.videoWidth || 0,
          height: vid?.videoHeight || 0,
          alt: link.querySelector('img')?.alt || 'Instagram reel',
          source: vidSrc || poster,
          playbackPage: vidSrc ? '' : postUrl
        });
        return; // Skip image processing for this post
      }

      const img = link.querySelector('img');
      if (img && !processedIgMedia.has(img)) {
        if (/avatar|profile picture/i.test(img.alt || '') || img.closest('header')) return;
        const src = bestSrcset(img.getAttribute('srcset') || '') || img.currentSrc || img.src || '';
        if (src && !isDisallowedMediaUrl(src) && !isProfileOrAvatarUrl(src)) {
          processedIgMedia.add(img);
          const hashtags = tagFromPath ? [tagFromPath] : [];
          instagramItems.push({
            url: src,
            type: 'image',
            site: 'instagram',
            postId,
            author: profileAuthor,
            hashtags,
            tags: hashtags,
            postUrl,
            pageUrl: postUrl,
            pageTitle: document.title,
            width: img.naturalWidth || 0,
            height: img.naturalHeight || 0,
            alt: img.alt || 'Instagram photo',
            source: src
          });
        }
      }
    });
  }

  const standardItems = (isYouTube || isInstagram) ? [] : [...document.querySelectorAll('img,video,shreddit-player,[data-testid="tweet"] img')].map(node => {
    if (isTumblr && (processedTumblrMedia.has(node) || node.closest?.('figure[aria-label="Avatar"], [data-testid="post-header-avatar"], .post-avatar, header') || node.alt === 'Avatar')) {
      return null;
    }
    if (isX) {
      if (node.closest?.('[data-testid*="UserAvatar"], [data-testid*="user-avatar"], [data-testid="Tweet-User-Avatar"], [data-testid="userAvatarContainer"]')) return null;
      if (/profile photo|avatar|profile picture/i.test(node.getAttribute?.('alt') || '')) return null;
    }
    const post = node.closest('shreddit-post,[data-testid="tweet"]');
    const tweet = node.closest('[data-testid="tweet"]');
    const redditPost = isReddit ? node.closest('shreddit-post, shreddit-search-post, [data-testid="search-post-unit"], article[data-testid="post-container"]') : null;
    const redditContent = redditPost?.getAttribute?.('content-href') || redditPost?.querySelector?.('a[slot="content"], a[slot="thumbnail"]')?.getAttribute('href') || '';
    const redditDomain = redditPost?.getAttribute?.('domain') || '';
    const redditExt = isReddit && redditPost ? detectExternalVideo(redditContent, redditDomain, redditPost) : null;

    const isVideoPost = redditPost && (
      !!redditExt ||
      redditPost.getAttribute('post-type') === 'video' ||
      redditPost.getAttribute('post-type') === 'gif' ||
      redditPost.querySelector('shreddit-player, video') ||
      redditPost.getAttribute('content-href')?.includes('v.redd.it')
    );
    if (isReddit && node.matches('img') && isVideoPost && !redditExt) return null;

    const img = node.matches('img') ? node : node.querySelector?.('img');
    const video = node.matches('video') ? node : node.querySelector?.('video');
    const player = node.matches('shreddit-player') ? node : redditPost?.querySelector?.('shreddit-player');
    let poster = player?.getAttribute('poster') || player?.getAttribute('preview') || img?.currentSrc || img?.src || video?.poster || '';
    if (isReddit && redditPost && !poster) {
      poster = extractRedditThumbnail(redditPost);
    }
    const postUrl = redditPost?.getAttribute('permalink')
      ? new URL(redditPost.getAttribute('permalink'), location.href).href
      : (tweet?.querySelector('a[href*="/status/"]')?.href || tweet?.querySelector('time')?.closest('a')?.href || (isX && location.pathname.includes('/status/') ? location.href.split('?')[0] : ''));
    const postId = redditPost ? (redditPost.id || redditPost.getAttribute('id') || '') : '';
    const thumb = img?.currentSrc || img?.src || '';
    const videoThumb = /ext_tw_video_thumb|tweet_video_thumb|amplify_video_thumb/i.test(thumb);
    const type = video || player || videoThumb || redditExt ? 'video' : 'image';
    let url = video?.currentSrc || video?.src || player?.getAttribute('src') || '';
    let fallbacks = [];
    let videoVariants = [];
    let itemType = type;
    let isGif = false;
    let isEmbed = false;
    let playbackPage = '';
    let provider = '';
    let subreddit = '';
    let author = '';
    let score = '';
    let commentCount = '';
    let tweetText = '';
    let authorName = '';
    let authorHandle = '';

    if (redditExt) {
      itemType = 'video';
      isEmbed = redditExt.isEmbed;
      isGif = redditExt.isGif;
      playbackPage = redditExt.embedUrl;
      poster = poster || redditExt.poster || '';
      url = redditExt.directUrl || redditExt.fallbackUrls[0] || redditExt.embedUrl || poster || postUrl;
      fallbacks = redditExt.fallbackUrls || [];
      provider = redditExt.provider;
    }

    if (isReddit && redditPost) {
      subreddit = redditPost.getAttribute('subreddit-prefixed-name') || redditPost.getAttribute('subreddit-name') || '';
      author = redditPost.getAttribute('author') || '';
      score = redditPost.getAttribute('score') || '';
      commentCount = redditPost.getAttribute('comment-count') || '';
    }

    if (isX && tweet) {
      tweetText = tweet.querySelector('[data-testid="tweetText"]')?.innerText?.trim() ||
                  tweet.querySelector('[data-testid="tweetText"]')?.textContent?.trim() || '';
      authorName = tweet.querySelector('[data-testid="User-Name"] span')?.textContent?.trim() || '';
      const authorHandleMatch = tweet.querySelector('[data-testid="User-Name"]')?.textContent?.match(/@([a-zA-Z0-9_]+)/);
      authorHandle = authorHandleMatch ? authorHandleMatch[1] : '';
    }

    if (isReddit && !redditExt) {
      if (player && node.matches('img')) return null;
      if (node.matches('img') && (redditPost?.querySelector('shreddit-player') || isVideoPost)) return null;
      if (player) {
        try {
          const jsonStr = player.getAttribute('playback-media-json') || player.getAttribute('packaged-media-json');
          const p = jsonStr ? JSON.parse(jsonStr) : {};
          const variants = p.playbackMp4s?.permutations || p.permutations || [];
          const perms = variants.map(v => {
            const u = typeof v.source === 'string' ? v.source : (v.source?.url || v.source?.fallbackUrl || '');
            const m = String(u).match(/DASH_(\d+)/i);
            const res = m ? parseInt(m[1], 10) : (v.source?.dimensions?.height || v.dimensions?.height || 0);
            return { url: u, res };
          }).filter(x => x.url && (/\.mp4(?:[?#]|$)/i.test(x.url) || /[?&]format=mp4/i.test(x.url))).sort((a, b) => b.res - a.res);
          fallbacks = perms.map(x => x.url);
          videoVariants = perms.map(x => ({
            url: x.url,
            label: x.res ? `${x.res}p` : 'MP4',
            res: x.res
          }));
          url = fallbacks[0] || player.getAttribute('src') || player.getAttribute('mp4-url') || player.getAttribute('stream-url') || url;
        } catch {}
      }
      if (player?.hasAttribute('gif') || redditPost?.getAttribute('post-type') === 'gif' || /\.gif(?:[?#]|$)/i.test(url) || /[?&]format=mp4/i.test(url)) {
        isGif = true;
      }
    }
    if (isX && videoThumb && !url) url = postUrl;
    if (!url && !videoThumb) url = thumb;
    if (!url || isDisallowedMediaUrl(url) || isProfileOrAvatarUrl(url) || isProfileOrAvatarUrl(poster)) return null;
    if (isReddit) {
      try {
        const u = new URL(url);
        if (u.searchParams.get('format') === 'mp4') {
          itemType = 'video';
          isGif = true;
        }
      } catch {}
    }
    if (isDisallowedMediaUrl(url)) return null;
    if (itemType === 'image' && img && ((img.naturalWidth > 0 && img.naturalWidth < 32) || (img.naturalHeight > 0 && img.naturalHeight < 32))) return null;
    const duration = (video && typeof video.duration === 'number' && Number.isFinite(video.duration) && video.duration > 0)
      ? Math.round(video.duration)
      : (player ? (Number(player.getAttribute('duration')) || 0) : 0);
    return {
      url,
      type: itemType,
      isGif,
      duration: duration || 0,
      postUrl,
      postId,
      postType: redditPost?.getAttribute('post-type') || '',
      pageUrl: location.href,
      pageTitle: document.title,
      alt: img?.alt || redditPost?.getAttribute('post-title') || '',
      width: img?.naturalWidth || video?.videoWidth || 0,
      height: img?.naturalHeight || video?.videoHeight || 0,
      poster,
      fallbackUrls: fallbacks,
      videoVariants,
      subreddit,
      author,
      score,
      commentCount,
      tweetText,
      authorName,
      authorHandle,
      site: isReddit ? 'reddit' : isX ? 'x' : '',
      isEmbed: isEmbed || false,
      provider: provider || '',
      playbackPage: playbackPage || (type === 'video' && !fallbacks.length && !url.includes('.mp4') ? postUrl : '')
    };
  }).filter(Boolean);

  return { url: location.href, items: [...ytItems, ...tumblrItems, ...instagramItems, ...standardItems] };
}
