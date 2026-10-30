export function startLiveWatcherInTab(includeBackgrounds, targetTabId) {
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

  if (window.__mosaicWatcher?.version === 4) {
    window.__mosaicWatcher.includeBackgrounds = includeBackgrounds;
    window.__mosaicWatcher.scan();
    return;
  }
  if (window.__mosaicWatcher?.observer) window.__mosaicWatcher.observer.disconnect();
  if (window.__mosaicWatcher) delete window.__mosaicWatcher;

  const bestSrcset = (value = '') =>
    value.split(',')
      .map(part => {
        const bits = part.trim().split(/\s+/);
        return { url: bits[0], metric: parseFloat(bits[1]) || 0 };
      })
      .filter(x => x.url)
      .sort((a, b) => b.metric - a.metric)[0]?.url || '';

  const xVariantCache = new WeakMap();
  const readXVariant = (tweet) => {
    if (xVariantCache.has(tweet)) return xVariantCache.get(tweet);
    const seen = new WeakSet();
    let checked = 0, best = null;
    const walk = (value, depth) => {
      if (!value || typeof value !== 'object' || depth > 14 || checked++ > 5000 || seen.has(value)) return;
      seen.add(value);
      const variants = value.video_info?.variants;
      if (Array.isArray(variants)) {
        for (const v of variants) {
          if (v?.content_type === 'video/mp4' && typeof v.url === 'string' && (!best || (v.bitrate || 0) > (best.bitrate || 0))) best = v;
        }
      }
      for (const key of Object.keys(value)) {
        if (/^(return|child|sibling|stateNode|_owner|_store|owner|elementType|type)$/i.test(key)) continue;
        try { walk(value[key], depth + 1); } catch {}
      }
    };
    for (const node of [tweet, ...(tweet?.querySelectorAll?.('*') || [])]) {
      for (const key of Object.keys(node)) {
        if (key.startsWith('__reactProps$')) walk(node[key], 0);
        else if (key.startsWith('__reactFiber$')) walk(node[key]?.memoizedProps, 0);
      }
    }
    const url = best?.url || '';
    if (url) xVariantCache.set(tweet, url);
    return url;
  };

  const xDirectVideo = (tweet, video) => {
    const valid = src => {
      try {
        const u = new URL(src, location.href);
        return u.protocol === 'https:' && u.hostname === 'video.twimg.com' && /\.mp4(?:[?#]|$)/i.test(u.href);
      } catch {
        return false;
      }
    };
    const direct = [video?.currentSrc, video?.getAttribute('src'), ...[...(video?.querySelectorAll?.('source') || [])].map(s => s.src)].find(valid);
    if (direct) return direct;
    const fromReact = readXVariant(tweet);
    if (valid(fromReact)) return fromReact;
    const ids = [
      tweet?.querySelector('a[href*="/status/"]')?.href.match(/status\/(\d+)/)?.[1],
      tweet?.querySelector('img[src*="ext_tw_video_thumb"],img[src*="tweet_video_thumb"],img[src*="amplify_video_thumb"]')?.src.match(/(?:thumb|video)\/(\d+)/)?.[1]
    ].filter(Boolean);
    return ids.length ? performance.getEntriesByType('resource').map(e => e.name).find(src => valid(src) && ids.some(id => new URL(src).pathname.includes(id))) || '' : '';
  };

  const redditVideoData = (player) => {
    let packaged = {};
    try {
      const jsonStr = player?.getAttribute('playback-media-json') || player?.getAttribute('packaged-media-json');
      if (jsonStr) packaged = JSON.parse(jsonStr);
    } catch {}
    const variants = packaged?.playbackMp4s?.permutations || packaged?.permutations || [];
    const parseRes = (u) => {
      const m = String(u).match(/DASH_(\d+)/i);
      return m ? parseInt(m[1], 10) : 0;
    };
    const sources = variants.map(v => {
      const url = typeof v?.source === 'string' ? v.source : (v?.source?.url || v?.source?.fallbackUrl || '');
      const width = v?.source?.dimensions?.width || v?.dimensions?.width || 0;
      const height = v?.source?.dimensions?.height || v?.dimensions?.height || 0;
      const res = Math.max(width, height, parseRes(url));
      return { source: v?.source, url, width, height, res };
    }).filter(v => /^https?:\/\//i.test(v.url) && (/\.mp4(?:[?#]|$)/i.test(v.url) || /[?&]format=mp4/i.test(v.url))).sort((a, b) => b.res - a.res || b.width - a.width);
    const video = player?.shadowRoot?.querySelector('video');
    const directSrc = [
      player?.getAttribute('src'),
      player?.getAttribute('mp4-url'),
      player?.getAttribute('stream-url'),
      video?.currentSrc,
      video?.getAttribute('src')
    ].find(src => /^https?:\/\//i.test(src || '') && (/\.mp4(?:[?#]|$)/i.test(src) || /[?&]format=mp4/i.test(src)));
    const url = sources[0]?.url || directSrc || '';
    return {
      url,
      urls: [...new Set([url, ...sources.map(x => x.url)].filter(Boolean))],
      width: sources[0]?.width || video?.videoWidth || 0,
      height: sources[0]?.height || video?.videoHeight || 0
    };
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

  const watcher = {
    version: 4,
    includeBackgrounds,
    seen: new Set(),
    timer: null,
    pendingNodes: new Set(),
    scan(targetNode = null) {
      const add = (url, type, node, poster = '', meta = {}) => {
        if (!url || isDisallowedMediaUrl(url)) return;
        if (isProfileOrAvatarUrl(url) || isProfileOrAvatarUrl(poster)) return;
        if (node && node.matches?.('script, style, link, meta, noscript, template')) return;
        const host = location.hostname.toLowerCase();
        const isX = host === 'x.com' || host.endsWith('.x.com') || host.includes('twitter.com');
        const isReddit = host.includes('reddit.com');
        if (isX) {
          if (node?.closest?.('[data-testid*="UserAvatar"], [data-testid*="user-avatar"], [data-testid="Tweet-User-Avatar"], [data-testid="userAvatarContainer"]')) return;
          if (/profile photo|avatar|profile picture/i.test(node?.getAttribute?.('alt') || '')) return;
        }
        try {
          const absolute = new URL(url, location.href).href;
          if (!/^https?:|^blob:|^data:image\/(?!svg)/i.test(absolute) || isDisallowedMediaUrl(absolute) || isProfileOrAvatarUrl(absolute)) return;
          const postUrl = meta.postUrl ||
            node?.closest?.('article,[data-testid="tweet"]')?.querySelector?.('a[href*="/status/"]')?.href ||
            node?.closest?.('article,[data-testid="tweet"]')?.querySelector?.('time')?.closest?.('a')?.href ||
            (isX && location.pathname.includes('/status/') ? location.href.split('?')[0] : '');
          const directXVideo = isX && type === 'video' && new URL(absolute).hostname === 'video.twimg.com' && /\.mp4(?:[?#]|$)/i.test(absolute);
          const pagePlayback = type === 'video' && ((isX && !directXVideo) || /^blob:/i.test(absolute) || /\.m3u8(?:[?#]|$)|\.mpd(?:[?#]|$)/i.test(absolute));
          const playableUrl = meta.playbackPage || (pagePlayback ? (isX && postUrl ? postUrl : `${location.href}#mosaic-video-${[...document.querySelectorAll('video')].indexOf(node)}`) : absolute);
          const width = node?.naturalWidth || node?.videoWidth || node?.width || 0;
          const height = node?.naturalHeight || node?.videoHeight || node?.height || 0;
          const duration = (type === 'video' && node && typeof node.duration === 'number' && Number.isFinite(node.duration) && node.duration > 0)
            ? Math.round(node.duration)
            : (meta.duration || 0);
          if (type === 'image' && ((width > 0 && width < 32) || (height > 0 && height < 32))) return;
          const seenKey = `${type}:${absolute}`;
          if (this.seen.has(seenKey)) return;
          this.seen.add(seenKey);
          chrome.runtime.sendMessage({
            type: 'mosaic-live-media',
            tabId: targetTabId,
            media: {
              url: playableUrl,
              type,
              duration: duration || meta.duration || 0,
              previewUrl: type === 'image' ? (node?.currentSrc || node?.getAttribute?.('src') || absolute) : '',
              alt: node?.alt || node?.getAttribute?.('aria-label') || meta.alt || '',
              pageUrl: location.href,
              pageTitle: document.title,
              width,
              height,
              source: node?.currentSrc || node?.getAttribute?.('src') || absolute,
              mime: node?.type || '',
              poster: poster || node?.getAttribute?.('poster') || '',
              playbackPage: meta.playbackPage || (pagePlayback ? playableUrl : ''),
              postUrl: meta.postUrl || postUrl,
              postId: meta.postId || '',
              postType: meta.postType || '',
              site: meta.site || (isX ? 'x' : isReddit ? 'reddit' : ''),
              fallbackUrls: meta.fallbackUrls || []
            }
          }).catch(() => {});
        } catch {}
      };

      const scanNode = (n) => {
        if (!n || n.nodeType !== 1) return;
        if (n.matches?.('script, style, link, meta, noscript, template')) return;
        const host = location.hostname.toLowerCase();
        const isX = host === 'x.com' || host.endsWith('.x.com') || host.includes('twitter.com');
        const isYouTube = host.includes('youtube.com') || host.includes('youtu.be');
        const isReddit = host.includes('reddit.com');
        const isTumblr = host.includes('tumblr.com');
        const nodes = [n, ...(n.querySelectorAll ? n.querySelectorAll('img,video,source,shreddit-player,a[href],ytd-thumbnail a#thumbnail, [style]') : [])];
        for (const el of nodes) {
          const ytVideoSelector = 'ytd-thumbnail a#thumbnail, a#thumbnail, a[href*="/watch?v="], a[href*="/watch?"], a[href*="/shorts/"], a[href*="/live/"], a.yt-lockup-metadata-view-model__title, a.yt-lockup-view-model__core-link, a#video-title, a#video-title-link, ytd-reel-item-renderer a[href]';
          if (isYouTube && el.matches?.(ytVideoSelector)) {
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
            const rawHref = el.getAttribute('href') || el.href || '';
            const vId = getVId(rawHref);
            if (vId) {
              const container = el.closest([
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
              ].join(',')) || el.parentElement || el;

              let title = (
                container.querySelector('#video-title')?.textContent?.trim() ||
                container.querySelector('.yt-lockup-metadata-view-model__title')?.textContent?.trim() ||
                container.querySelector('a.yt-lockup-metadata-view-model__title')?.textContent?.trim() ||
                container.querySelector('h3 a, h3 span, h3')?.textContent?.trim() ||
                container.querySelector('[id*="title"]')?.textContent?.trim() ||
                el.getAttribute('title')?.trim() ||
                el.getAttribute('aria-label')?.trim() ||
                el.textContent?.trim() ||
                ''
              );
              title = title.replace(/\s+/g, ' ').replace(/ - YouTube$/i, '').trim();
              if (!title || title.length < 2) title = 'YouTube Video';

              const timeElem = container.querySelector(
                '.badge-shape-wiz__text, badge-shape-wiz, ytd-thumbnail-overlay-time-status-renderer, span.ytd-thumbnail-overlay-time-status-renderer, #time-status'
              );
              let ytDuration = timeElem?.textContent?.trim() || '';
              if (!/^\d+:\d+/.test(ytDuration)) {
                const aria = el.getAttribute('aria-label') || container.querySelector('#video-title, a[aria-label]')?.getAttribute('aria-label') || '';
                const m = aria.match(/(?:(\d+)\s+hours?,\s*)?(\d+)\s+minutes?,\s*(\d+)\s+seconds?/i);
                if (m) {
                  const h = m[1] ? parseInt(m[1], 10) : 0;
                  const min = parseInt(m[2], 10);
                  const sec = parseInt(m[3], 10);
                  ytDuration = h > 0 ? `${h}:${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${min}:${String(sec).padStart(2, '0')}`;
                }
              }
              const embedUrl = `https://www.youtube-nocookie.com/embed/${vId}?autoplay=1&enablejsapi=1`;
              const imgEl = (
                container.querySelector('img.yt-core-image') ||
                container.querySelector('img#img') ||
                container.querySelector('yt-img-shadow img') ||
                container.querySelector('img[src*="ytimg.com"], img[src*="ggpht.com"]') ||
                container.querySelector('img') ||
                el.querySelector('img')
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

              chrome.runtime.sendMessage({
                type: 'mosaic-live-media',
                tabId: targetTabId,
                media: {
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
                }
              }).catch(() => {});
            }
          }
          if (isTumblr && el.matches?.('img, figure.tmblr-full img, .photoset-image img, article img, video')) {
            if (
              el.closest('figure[aria-label="Avatar"], [data-testid="post-header-avatar"], .post-avatar') ||
              el.alt === 'Avatar' ||
              el.closest('header')
            ) {
              continue;
            }

            const isVid = el.matches('video');
            let best = '';
            let fallbacks = [];

            if (isVid) {
              const sources = [...el.querySelectorAll('source')];
              best = (
                sources.find(s => s.src && !isDisallowedMediaUrl(s.src))?.src ||
                sources.find(s => s.getAttribute('src') && !isDisallowedMediaUrl(s.getAttribute('src')))?.getAttribute('src') ||
                el.currentSrc ||
                el.src ||
                el.getAttribute('src') ||
                ''
              );
              fallbacks = [best].filter(Boolean);
            } else {
              const picSource = el.closest('picture')?.querySelector('source')?.getAttribute('srcset') ||
                                el.closest('picture')?.querySelector('source')?.getAttribute('srcSet') || '';
              const rawSrcset = picSource || el.srcset || el.getAttribute('srcset') || el.getAttribute('srcSet') || el.getAttribute('data-srcset') || '';
              let candWidth = 0;
              if (rawSrcset) {
                const candidates = rawSrcset.split(',')
                  .map(part => {
                    const [u, w] = part.trim().split(/\s+/);
                    return { url: u, width: parseInt(w, 10) || 0 };
                  })
                  .filter(c => c.url && !isDisallowedMediaUrl(c.url) && !isProfileOrAvatarUrl(c.url))
                  .sort((a, b) => b.width - a.width);
                if (candidates.length > 0) {
                  best = candidates[0].url;
                  fallbacks = candidates.map(c => c.url);
                  candWidth = candidates[0].width;
                }
              }
              if (!best) {
                const direct = (
                  el.currentSrc ||
                  el.src ||
                  el.getAttribute('src') ||
                  el.getAttribute('data-src') ||
                  el.getAttribute('data-highres') ||
                  el.getAttribute('data-full-src') ||
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
            }

            if (best && !isDisallowedMediaUrl(best) && !isProfileOrAvatarUrl(best)) {
              const post = el.closest('article, [data-timeline-post], [data-testid="post"], [data-id], .post, .post_container, .entry, [data-login-wall-post-id]');
              const postId = (
                post?.getAttribute('data-id') ||
                post?.getAttribute('data-post-id') ||
                post?.getAttribute('data-login-wall-post-id') ||
                post?.getAttribute('id')?.replace(/^post_/, '') ||
                post?.closest?.('[data-id]')?.getAttribute('data-id') ||
                post?.querySelector?.('[data-login-wall-post-id]')?.getAttribute('data-login-wall-post-id') ||
                post?.querySelector('a[href*="/post/"]')?.getAttribute('href')?.match(/\/post\/(\d+)/)?.[1] ||
                location.pathname.match(/\/(\d{10,25})(?:\/|$)/)?.[1] ||
                ''
              );
              const blogAnchor = (
                post?.querySelector('[data-testid="post-header-blog-name"]') ||
                post?.querySelector('.post-header__blog-name') ||
                post?.querySelector('a.reblog_author, a.post_info_author, a.author') ||
                post?.querySelector('[data-login-wall-blog-name]') ||
                post?.querySelector('header a[href*="tumblr.com"], header a[href^="/blog/"]')
              );
              const blogName = (
                post?.getAttribute('data-login-wall-blog-name') ||
                post?.querySelector?.('[data-login-wall-blog-name]')?.getAttribute('data-login-wall-blog-name') ||
                blogAnchor?.textContent?.trim() ||
                (location.hostname.includes('.tumblr.com') && !location.hostname.startsWith('www.') ? location.hostname.split('.')[0] : '') ||
                (location.pathname.startsWith('/') && !['explore', 'tagged', 'dashboard', 'search', 'settings'].includes(location.pathname.split('/')[1]) ? location.pathname.split('/')[1] : '') ||
                ''
              ).replace(/^@/, '');
              const permalinkAnchor = post?.querySelector('a[href*="/post/"], a.post_permalink, a.post_info_link, a[rel="bookmark"]');
              const postUrl = permalinkAnchor?.href || (postId && blogName ? `https://${blogName}.tumblr.com/post/${postId}` : location.href);
              const isGif = !isVid && isItemGif({ url: best, sourceUrl: best });

              let w = isVid ? (el.videoWidth || 0) : (el.naturalWidth || 0);
              let h = isVid ? (el.videoHeight || 0) : (el.naturalHeight || 0);
              if (!w || !h) {
                const dimMatch = (best || '').match(/\/s(\d+)x(\d+)\//i);
                if (dimMatch) {
                  if (!w) w = parseInt(dimMatch[1], 10);
                  if (!h) h = parseInt(dimMatch[2], 10);
                } else if (!w) {
                  const wMatch = (best || '').match(/_(\d{2,4})\.(?:jpe?g|png|webp|gif)/i);
                  if (wMatch) w = parseInt(wMatch[1], 10);
                }
              }

              chrome.runtime.sendMessage({
                type: 'mosaic-live-media',
                tabId: targetTabId,
                media: {
                  url: best,
                  type: isVid ? 'video' : 'image',
                  site: 'tumblr',
                  postId,
                  blogName,
                  postUrl,
                  pageUrl: postUrl,
                  pageTitle: document.title,
                  alt: el.alt || el.getAttribute('aria-label') || 'Tumblr media',
                  width: w,
                  height: h,
                  poster: isVid ? (el.getAttribute('poster') || '') : '',
                  isGif,
                  fallbackUrls: [...new Set(fallbacks)]
                }
              }).catch(() => {});
            }
          }
          if (el.matches?.('img')) {
            if (isYouTube) continue;
            if (isTumblr && (el.closest?.('figure[aria-label="Avatar"], [data-testid="post-header-avatar"], .post-avatar, header') || el.alt === 'Avatar')) continue;
            const src = el.currentSrc || el.getAttribute('src') || el.getAttribute('data-src') || el.getAttribute('data-original') || bestSrcset(el.getAttribute('srcset') || el.getAttribute('data-srcset') || '');
            const host = location.hostname.toLowerCase();
            const isGoogleImages = host.includes('google.') && (/\/search/.test(location.pathname) || location.pathname === '/');
            const isReddit = host.includes('reddit.com');
            const isXHost = host === 'x.com' || host.endsWith('.x.com') || host.includes('twitter.com');
            if (isXHost) {
              if (isProfileOrAvatarUrl(src) ||
                  el.closest?.('[data-testid*="UserAvatar"], [data-testid*="user-avatar"], [data-testid="Tweet-User-Avatar"], [data-testid="userAvatarContainer"]') ||
                  /profile photo|avatar|profile picture/i.test(el.getAttribute?.('alt') || '')) {
                continue;
              }
            }
            if (isGoogleImages && !el.closest('[data-iurl],a[href*="/imgres"]') && !el.hasAttribute('data-iurl')) continue;
            if (isReddit) {
              const post = el.closest('shreddit-post, shreddit-search-post, [data-testid="search-post-unit"], article[data-testid="post-container"]');
              if (!post) continue;
              const permalink = post.getAttribute?.('permalink') || post.querySelector?.('a[href*="/comments/"]')?.getAttribute('href') || '';
              const postUrl = permalink ? new URL(permalink, location.href).href : location.href;
              const postId = post.id || post.getAttribute?.('id') || '';
              const content = post.getAttribute?.('content-href') || post.querySelector?.('a[slot="content"], a[slot="thumbnail"]')?.getAttribute('href') || '';
              const domain = post.getAttribute?.('domain') || '';

              const ext = detectExternalVideo(content, domain, post);
              if (ext) {
                const poster = extractRedditThumbnail(post) || ext.poster || src;
                const mainUrl = ext.directUrl || ext.fallbackUrls[0] || ext.embedUrl || poster || postUrl;
                add(mainUrl, 'video', el, poster, {
                  postId,
                  postUrl,
                  site: 'reddit',
                  playbackPage: ext.embedUrl,
                  isEmbed: ext.isEmbed,
                  isGif: ext.isGif,
                  fallbackUrls: ext.fallbackUrls || []
                });
                continue;
              }

              const isVidPost = post.getAttribute?.('post-type') === 'video' ||
                                post.getAttribute?.('post-type') === 'gif' ||
                                post.querySelector?.('shreddit-player, video') ||
                                content.includes('v.redd.it');
              if (isVidPost) continue;
              if (!/(?:i|preview|external-preview)\.redd\.it/i.test(src)) continue;
              if (/^https?:\/\/(?:i|preview)\.redd\.it\//i.test(content)) {
                add(content, 'image', post, '', { postId, postUrl, site: 'reddit' });
                continue;
              }
              if (!/^(?:https?:)?\/\/i\.redd\.it\//i.test(src) && post.querySelector('img[src*="i.redd.it"]')) continue;
              add(src, 'image', el, '', { postId, postUrl, site: 'reddit' });
              continue;
            }
            const isXThumb = (host === 'x.com' || host.endsWith('.x.com') || host.includes('twitter.com')) && /ext_tw_video_thumb|tweet_video_thumb|amplify_video_thumb/i.test(src);
            if (isXThumb) {
              const tweet = el.closest('[data-testid="tweet"]');
              const video = tweet?.querySelector('video');
              const direct = tweet ? xDirectVideo(tweet, video) : '';
              const postUrl = tweet?.querySelector('a[href*="/status/"]')?.href || tweet?.querySelector('time')?.closest('a')?.href || (location.pathname.includes('/status/') ? location.href.split('?')[0] : '');
              add(direct || video?.currentSrc || video?.getAttribute('src') || postUrl, 'video', video || el, video?.getAttribute('poster') || src, { postUrl, playbackPage: direct ? '' : postUrl, site: 'x' });
              continue;
            }
            add(src, 'image', el);
          }
          if (el.matches?.('shreddit-player')) {
            const post = el.closest('shreddit-post');
            const media = redditVideoData(el);
            const poster = el.getAttribute('poster') || el.getAttribute('preview') || '';
            const permalink = post?.getAttribute('permalink') || '';
            const postUrl = permalink ? new URL(permalink, location.href).href : location.href;
            const postId = post ? (post.id || post.getAttribute('id') || '') : '';
            chrome.runtime.sendMessage({
              type: 'mosaic-live-media',
              tabId: targetTabId,
              media: {
                url: media.url || postUrl,
                type: 'video',
                previewUrl: poster,
                poster,
                alt: post?.getAttribute('post-title') || '',
                pageUrl: location.href,
                pageTitle: document.title,
                width: media.width,
                height: media.height,
                source: media.url || postUrl,
                fallbackUrls: media.urls,
                playbackPage: media.url ? '' : postUrl,
                site: 'reddit',
                postUrl,
                postId,
                postType: 'video'
              }
            }).catch(() => {});
          }
          if (el.matches?.('source')) {
            const parent = el.closest('video,picture');
            if (parent?.matches('video')) {
              if (isYouTube) continue;
              if (host.includes('reddit.com') && parent.closest('shreddit-post')) continue;
              const sources = [...parent.querySelectorAll('source')];
              const supported = sources.find(s => !s.type || parent.canPlayType(s.type)) || sources[0];
              add(parent.currentSrc || parent.getAttribute('src') || supported?.getAttribute('src'), 'video', parent, parent.getAttribute('poster') || '');
            }
          }
          if (el.matches?.('video')) {
            if (isYouTube) continue;
            if (host.includes('reddit.com') && el.closest('shreddit-post')) continue;
            const sources = [...el.querySelectorAll('source')];
            const supported = sources.find(s => !s.type || el.canPlayType(s.type)) || sources[0];
            const tweet = el.closest('[data-testid="tweet"]');
            const direct = isX && tweet ? xDirectVideo(tweet, el) : '';
            const postUrl = tweet?.querySelector('a[href*="/status/"]')?.href || tweet?.querySelector('time')?.closest('a')?.href || (isX && location.pathname.includes('/status/') ? location.href.split('?')[0] : '');
            add(direct || el.currentSrc || el.getAttribute('src') || supported?.getAttribute('src') || (isX ? postUrl : ''), 'video', el, el.getAttribute('poster') || tweet?.querySelector('img[src*="ext_tw_video_thumb"],img[src*="tweet_video_thumb"],img[src*="amplify_video_thumb"]')?.src || '', { postUrl, playbackPage: isX && !direct ? postUrl : '', site: isX ? 'x' : '' });
          }
          if (el.matches?.('a[href]')) {
            if (/\.(mp4|webm|mov|m4v|ogv)(\?|#|$)/i.test(el.href)) add(el.href, 'video', el);
            if (/\.(gif|gifv)(\?|#|$)/i.test(el.href)) add(el.href, 'image', el);
          }
          if (this.includeBackgrounds && el.matches?.('[style]')) {
            const bg = getComputedStyle(el).backgroundImage;
            for (const m of bg.matchAll(/url\(["']?(.*?)["']?\)/g)) add(m[1], 'image', el);
          }
        }
      };

      if (targetNode && targetNode.nodeType === 1) {
        scanNode(targetNode);
      } else {
        scanNode(document.documentElement);
        if (this.includeBackgrounds && !location.hostname.toLowerCase().includes('google.') && !location.hostname.toLowerCase().includes('reddit.') && !location.hostname.toLowerCase().includes('youtube.')) {
          document.querySelectorAll('*').forEach(el => {
            const bg = getComputedStyle(el).backgroundImage;
            for (const m of bg.matchAll(/url\(["']?(.*?)["']?\)/g)) add(m[1], 'image', el);
          });
        }
      }
    }
  };

  window.__mosaicWatcher = watcher;
  watcher.observer = new MutationObserver(records => {
    for (const r of records) {
      if (r.type === 'attributes' && r.target && r.target.nodeType === 1) {
        watcher.pendingNodes.add(r.target);
      }
      for (const n of r.addedNodes) {
        if (n.nodeType === 1) watcher.pendingNodes.add(n);
      }
    }
    if (!watcher.timer) {
      watcher.timer = setTimeout(() => {
        watcher.timer = null;
        const nodes = [...watcher.pendingNodes];
        watcher.pendingNodes.clear();
        for (const node of nodes) {
          if (node.isConnected) {
            watcher.scan(node);
          }
        }
      }, 60);
    }
  });
  watcher.observer.observe(document.documentElement, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['src', 'srcset', 'data-src', 'data-srcset', 'data-original', 'poster', 'preview', 'packaged-media-json', 'content-href', 'style']
  });

  let scrollTimer = null;
  document.addEventListener('scroll', () => {
    if (scrollTimer) return;
    scrollTimer = setTimeout(() => {
      scrollTimer = null;
      const unhandled = document.querySelectorAll('shreddit-player:not([data-mosaic-seen]), video:not([data-mosaic-seen])');
      unhandled.forEach(el => {
        el.setAttribute('data-mosaic-seen', 'true');
        watcher.scan(el);
      });
    }, 300);
  }, { capture: true, passive: true });

  watcher.scan();
}
