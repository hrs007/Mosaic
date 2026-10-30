export function scanPageInTab(includeBackgrounds) {
  const bestSrcset = (value = '') =>
    value.split(',')
      .map(part => {
        const bits = part.trim().split(/\s+/);
        const metric = parseFloat(bits[1]) || 0;
        return { url: bits[0], metric };
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
          if (v?.content_type === 'video/mp4' && typeof v.url === 'string' && (!best || (v.bitrate || 0) > (best.bitrate || 0))) {
            best = v;
          }
        }
      }
      for (const key of Object.keys(value)) {
        if (/^(return|child|sibling|stateNode|_owner|_store|owner|elementType|type)$/i.test(key)) continue;
        try { walk(value[key], depth + 1); } catch {}
      }
    };
    const nodes = [tweet, ...(tweet?.querySelectorAll?.('*') || [])];
    for (const node of nodes) {
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
    const direct = [video?.currentSrc, video?.getAttribute('src'), ...[...(video?.querySelectorAll?.('source') || [])].map(s => s.src)];
    const valid = src => {
      try {
        const u = new URL(src, location.href);
        return u.protocol === 'https:' && u.hostname === 'video.twimg.com' && /\.mp4(?:[?#]|$)/i.test(u.href);
      } catch {
        return false;
      }
    };
    const fromElement = direct.find(valid);
    if (fromElement) return fromElement;
    const fromReact = readXVariant(tweet);
    if (valid(fromReact)) return fromReact;
    const postId = tweet?.querySelector('a[href*="/status/"]')?.href.match(/status\/(\d+)/)?.[1];
    const thumbId = tweet?.querySelector('img[src*="ext_tw_video_thumb"],img[src*="tweet_video_thumb"],img[src*="amplify_video_thumb"]')?.src.match(/(?:thumb|video)\/(\d+)/)?.[1];
    const mediaIds = [postId, thumbId].filter(Boolean);
    if (!mediaIds.length) return '';
    return performance.getEntriesByType('resource').map(e => e.name).find(src => valid(src) && mediaIds.some(id => new URL(src).pathname.includes(id))) || '';
  };

  const redditVideoData = (player) => {
    let packaged = {};
    try { packaged = JSON.parse(player?.getAttribute('packaged-media-json') || '{}'); } catch {}
    const variants = packaged?.playbackMp4s?.permutations || [];
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
    }).filter(v => /^https?:\/\//i.test(v.url) && /\.mp4(?:[?#]|$)/i.test(v.url)).sort((a, b) => b.res - a.res || b.width - a.width);

    const shadowVideo = player?.shadowRoot?.querySelector('video');
    const url = sources[0]?.url || [shadowVideo?.currentSrc, shadowVideo?.getAttribute('src'), player?.getAttribute('src')].find(src => /^https?:\/\//i.test(src || '') && /\.mp4(?:[?#]|$)/i.test(src)) || '';
    return {
      url,
      urls: [...new Set([url, ...sources.map(x => x.url)].filter(Boolean))],
      width: sources[0]?.width || shadowVideo?.videoWidth || 0,
      height: sources[0]?.height || shadowVideo?.videoHeight || 0
    };
  };

  const host = location.hostname.toLowerCase();
  const site = host.includes('reddit.com')
    ? { key: 'reddit', name: 'Reddit', hint: 'Post images, galleries, and video previews', glyph: 'r' }
    : host === 'x.com' || host.endsWith('.x.com') || host.includes('twitter.com')
    ? { key: 'x', name: 'X', hint: 'Post media and original image versions', glyph: '𝕏' }
    : host.includes('google.') && (/\/search/.test(location.pathname) || location.pathname === '/')
    ? { key: 'google-images', name: 'Google Images', hint: 'Result previews and source pages', glyph: 'G' }
    : host.includes('imgur.com')
    ? { key: 'imgur', name: 'Imgur', hint: 'Direct images, albums, and video previews', glyph: 'i' }
    : host.includes('instagram.com')
    ? { key: 'instagram', name: 'Instagram', hint: 'Visible post images and reel previews', glyph: '◎' }
    : host.includes('youtube.com') || host.includes('youtu.be')
    ? { key: 'youtube', name: 'YouTube', hint: 'Video thumbnails and visible page media', glyph: '▶' }
    : host.includes('pinterest.')
    ? { key: 'pinterest', name: 'Pinterest', hint: 'Pin images and original image versions', glyph: 'p' }
    : host.includes('flickr.com')
    ? { key: 'flickr', name: 'Flickr', hint: 'Photo previews and larger available sizes', glyph: 'f' }
    : host.includes('tumblr.com')
    ? { key: 'tumblr', name: 'Tumblr', hint: 'Post images and video previews', glyph: 't' }
    : { key: 'generic', name: host.replace(/^www\./, ''), hint: 'Images, videos, and backgrounds on this page', glyph: '◉' };

  const found = new Map();
  const add = (url, type, node, poster = '', meta = {}) => {
    if (!url || /^data:image\/svg\+xml/i.test(url)) return;
    try {
      const absolute = new URL(url, location.href).href;
      if (!/^https?:|^blob:|^data:image\/(?!svg)/i.test(absolute)) return;
      const postUrl = meta.postUrl || node?.closest?.('article,[data-testid="tweet"]')?.querySelector?.('a[href*="/status/"]')?.href || '';
      const directXVideo = site.key === 'x' && type === 'video' && new URL(absolute).hostname === 'video.twimg.com' && /\.mp4(?:[?#]|$)/i.test(absolute);
      const pagePlayback = type === 'video' && ((site.key === 'x' && !directXVideo) || /^blob:/i.test(absolute) || /\.m3u8(?:[?#]|$)|\.mpd(?:[?#]|$)/i.test(absolute) || /application\/(?:x-mpegurl|vnd\.apple\.mpegurl|dash\+xml)/i.test(node?.type || ''));
      const playableUrl = pagePlayback ? (site.key === 'x' && postUrl ? postUrl : `${location.href}#mosaic-video-${[...document.querySelectorAll('video')].indexOf(node)}`) : absolute;
      let cleaned = absolute;
      if (site.key === 'reddit') {
        try {
          const u = new URL(absolute);
          if (u.hostname === 'preview.redd.it' || u.hostname === 'external-preview.redd.it') {
            const m = u.pathname.match(/\/([a-zA-Z0-9_-]+\.(jpe?g|png|gif|webp|avif))/i);
            if (m) cleaned = `https://i.redd.it/${m[1]}`;
          }
        } catch {}
      }
      if (site.key === 'x') {
        try {
          const u = new URL(absolute);
          if (u.hostname === 'pbs.twimg.com' && u.pathname.startsWith('/media/')) {
            u.searchParams.set('name', 'large');
            cleaned = u.href;
          }
        } catch {}
      }
      if (site.key === 'google-images') {
        const src = node?.getAttribute?.('data-iurl') || node?.closest?.('[data-iurl]')?.getAttribute?.('data-iurl') || '';
        if (src) {
          try { cleaned = new URL(src, location.href).href; } catch {}
        }
      }
      if (site.key === 'imgur') cleaned = cleaned.replace(/\?.*$/, '');
      const key = pagePlayback ? playableUrl : cleaned.replace(/([?&])(width|height|w|h|quality|q)=\d+/gi, '$1');
      const width = node?.naturalWidth || node?.videoWidth || node?.width || 0;
      const height = node?.naturalHeight || node?.videoHeight || node?.height || 0;
      if (type === 'image' && width > 0 && height > 0 && (width < 32 || height < 32)) return;
      const old = found.get(key);
      const sourcePage = node?.getAttribute?.('data-lpage') || node?.getAttribute?.('data-url') || node?.closest?.('[data-lpage]')?.getAttribute?.('data-lpage') || location.href;
      const item = {
        url: pagePlayback ? playableUrl : cleaned,
        type,
        previewUrl: type === 'image' ? (node?.currentSrc || node?.getAttribute?.('src') || absolute) : poster,
        alt: node?.alt || node?.getAttribute?.('aria-label') || '',
        pageUrl: sourcePage,
        pageTitle: document.title,
        width,
        height,
        source: node?.currentSrc || node?.getAttribute?.('src') || cleaned,
        mime: node?.type || '',
        poster,
        site: site.key,
        playbackPage: pagePlayback ? playableUrl : '',
        postUrl: postUrl || node?.closest?.('[data-testid="tweet"]')?.querySelector?.('a[href*="/status/"]')?.href || '',
        ...meta
      };
      if (!old || item.width * item.height > old.width * old.height) found.set(key, item);
    } catch {}
  };

  const xVideoThumbSelector = '[data-testid="tweet"] img[src*="ext_tw_video_thumb"],[data-testid="tweet"] img[src*="tweet_video_thumb"],[data-testid="tweet"] img[src*="amplify_video_thumb"]';
  const xVideoThumbs = new Set(site.key === 'x' ? [...document.querySelectorAll(xVideoThumbSelector)] : []);

  if (site.key === 'reddit') {
    document.querySelectorAll('shreddit-post').forEach(post => {
      const permalink = post.getAttribute('permalink') || '';
      const pageUrl = permalink ? new URL(permalink, location.href).href : location.href;
      const title = post.getAttribute('post-title') || document.title;
      const player = post.querySelector('shreddit-player');
      if (player) {
        const media = redditVideoData(player);
        const poster = player.getAttribute('poster') || player.getAttribute('preview') || post.querySelector('img[alt="media poster"]')?.currentSrc || '';
        add(media.url || pageUrl, 'video', player, poster, {
          alt: title,
          pageUrl,
          pageTitle: title,
          width: media.width,
          height: media.height,
          source: media.url || pageUrl,
          fallbackUrls: media.urls,
          site: 'reddit',
          playbackPage: media.url ? '' : pageUrl,
          postUrl: pageUrl
        });
        return;
      }
      const content = post.getAttribute('content-href') || '';
      if (/^https?:\/\/(?:i|preview|external-preview)\.redd\.it\//i.test(content)) {
        add(content, 'image', post, '', { alt: title, pageUrl, pageTitle: title, source: content, site: 'reddit', postUrl: pageUrl });
        return;
      }
      const imgs = [...post.querySelectorAll('img')].map(img => ({ img, src: img.currentSrc || img.getAttribute('src') || img.getAttribute('data-src') || '' })).filter(x => /^(?:https?:)?\/\/(?:i|preview|external-preview)\.redd\.it\//i.test(x.src));
      const originals = imgs.filter(x => /^(?:https?:)?\/\/i\.redd\.it\//i.test(x.src));
      const toAdd = originals.length ? originals : (imgs.length ? [imgs[0]] : []);
      for (const { img, src } of toAdd) {
        add(src, 'image', img, '', { alt: img.alt || title, pageUrl, pageTitle: title, source: src, site: 'reddit', postUrl: pageUrl });
      }
    });
  }

  const googleImageResults = site.key === 'google-images' ? [...document.querySelectorAll('img')].filter(n => n.closest('[data-iurl],a[href*="/imgres"]') || n.hasAttribute('data-iurl')) : [];
  const googleImagesSet = new Set(googleImageResults);
  const imgs = [...document.querySelectorAll('img')];
  const vids = [...document.querySelectorAll('video')];
  const iframes = [...document.querySelectorAll('iframe')];

  imgs.forEach(n => {
    if (site.key === 'youtube') return;
    if (site.key === 'reddit') {
      if (n.closest('shreddit-post')) return;
      const s = n.currentSrc || n.src || '';
      if (!/(?:i|preview|external-preview)\.redd\.it/i.test(s)) return;
    }
    if (site.key === 'google-images' && !googleImagesSet.has(n)) return;
    if (xVideoThumbs.has(n)) return;
    const googleResult = n.closest('[data-iurl]');
    const picSource = bestSrcset(n.closest('picture')?.querySelector('source')?.getAttribute('srcset') || '');
    const src = (site.key === 'google-images' && (googleResult?.getAttribute('data-iurl') || n.getAttribute('data-iurl'))) || picSource || n.currentSrc || n.getAttribute('src') || n.getAttribute('data-src') || n.getAttribute('data-original') || n.getAttribute('data-lazy-src') || n.getAttribute('data-lazy') || n.getAttribute('data-high-res') || n.getAttribute('data-full-src') || bestSrcset(n.getAttribute('srcset') || n.getAttribute('data-srcset') || '');
    add(src, 'image', n);
  });

  vids.forEach(n => {
    if (site.key === 'youtube') return;
    if (site.key === 'reddit' && n.closest('shreddit-post')) return;
    const sources = [...n.querySelectorAll('source')];
    const rawUrls = [
      n.currentSrc,
      n.src,
      n.getAttribute('src'),
      n.getAttribute('data-src'),
      n.getAttribute('data-video-src'),
      n.getAttribute('data-lazy-src'),
      n.getAttribute('data-url'),
      n.getAttribute('data-orig'),
      ...sources.flatMap(s => [
        s.currentSrc,
        s.src,
        s.getAttribute('src'),
        s.getAttribute('data-src'),
        s.getAttribute('data-lazy-src'),
        s.getAttribute('data-url'),
        s.getAttribute('data-orig')
      ])
    ].filter(Boolean);

    const sourceUrls = rawUrls.filter(u => typeof u === 'string' && !/\.(jpe?g|png|webp|avif|gif|svg)(?:[?#]|$)/i.test(u)).sort((a, b) => {
      const parseRes = u => {
        const m = String(u).match(/(\d{3,4})p|res=(\d{3,4})|_(\d{3,4})\.mp4/i);
        return m ? parseInt(m[1] || m[2] || m[3], 10) : 0;
      };
      return parseRes(b) - parseRes(a);
    });

    const poster = n.poster || n.getAttribute('poster') || n.getAttribute('data-poster') || n.getAttribute('data-preview') || '';
    if (sourceUrls.length > 0) {
      add(sourceUrls[0], 'video', n, poster, { fallbackUrls: sourceUrls });
    } else if (poster) {
      add(poster, 'image', n, poster);
    }
  });

  iframes.forEach(f => {
    const src = f.src || f.getAttribute('src') || f.getAttribute('data-src') || '';
    if (src && /youtube\.com|youtu\.be|vimeo\.com|dailymotion\.com|twitch\.tv|player\./i.test(src)) {
      add(src, 'video', f, '', { playbackPage: src, isEmbed: true, alt: f.title || 'Embedded video' });
    }
  });

  document.querySelectorAll('a[href]').forEach(a => {
    const href = a.href || '';
    if (/\.(gif|gifv)(\?|#|$)/i.test(href)) {
      add(href, 'image', a, '', { site: site.key, alt: a.textContent?.trim() || 'GIF image' });
    } else if (/\.(mp4|webm|mov|m4v|ogv)(\?|#|$)/i.test(href)) {
      add(href, 'video', a, '', { site: site.key, alt: a.textContent?.trim() || 'Video' });
    }
  });

  if (site.key !== 'youtube') {
    try {
      performance.getEntriesByType('resource').forEach(entry => {
        const name = entry.name;
        if (!name || !/^https?:/i.test(name)) return;
        const isDirectVideo = /\.(mp4|webm|mov|m4v|ogv)(?:[?#]|$)/i.test(name) && !/\.(m3u8|mpd|m4s|vtt|srt|ts)(?:[?#]|$)/i.test(name) && !/audio/i.test(name);
        if (isDirectVideo) {
          add(name, 'video', null, '', { site: site.key, source: name, alt: name.split('/').pop()?.split('?')[0] || 'Video' });
          return;
        }
        const isDirectImg = (/\.(jpe?g|png|webp|avif|gif)(?:[?#]|$)/i.test(name) || /pbs\.twimg\.com\/media\/|i\.redd\.it\/|cdninstagram\.com\//i.test(name)) && !/\.(svg|ico|css|js|json|woff2?|map)(?:[?#]|$)/i.test(name) && !/analytics|telemetry|beacon|pixel|collect|track/i.test(name);
        if (isDirectImg) {
          add(name, 'image', null, '', { site: site.key, source: name, alt: name.split('/').pop()?.split('?')[0] || 'Image' });
        }
      });
    } catch {}
  }

  if (site.key === 'youtube') {
    const getVId = (url) => {
      try {
        const u = new URL(url, location.href);
        if (u.hostname.includes('youtu.be')) return u.pathname.slice(1).split(/[?#]/)[0];
        if (u.pathname.includes('/shorts/')) return u.pathname.split('/shorts/')[1].split(/[?#]/)[0];
        if (u.pathname.includes('/watch')) return u.searchParams.get('v') || '';
        if (u.pathname.includes('/embed/')) return u.pathname.split('/embed/')[1].split(/[?#]/)[0];
      } catch {}
      return '';
    };

    const currentVId = getVId(location.href);
    if (currentVId) {
      const embedUrl = `https://www.youtube-nocookie.com/embed/${currentVId}?autoplay=1&enablejsapi=1&origin=https://www.youtube.com`;
      const thumb = `https://i.ytimg.com/vi/${currentVId}/hqdefault.jpg`;
      add(embedUrl, 'video', null, thumb, {
        alt: document.title.replace(/ - YouTube$/i, '') || 'YouTube Video',
        pageUrl: location.href,
        postUrl: location.href,
        playbackPage: embedUrl,
        site: 'youtube',
        isEmbed: true,
        fallbackUrls: [
          `https://i.ytimg.com/vi/${currentVId}/maxresdefault.jpg`,
          `https://i.ytimg.com/vi/${currentVId}/mqdefault.jpg`
        ]
      });
    }

    document.querySelectorAll('ytd-thumbnail a#thumbnail, a[href*="/watch?v="], a[href*="/shorts/"]').forEach(a => {
      const vId = getVId(a.href);
      if (!vId) return;
      const container = a.closest('ytd-rich-item-renderer, ytd-video-renderer, ytd-compact-video-renderer, ytd-grid-video-renderer') || a;
      const title = container.querySelector('#video-title')?.textContent?.trim() || a.getAttribute('title') || a.getAttribute('aria-label') || 'YouTube Video';
      const embedUrl = `https://www.youtube-nocookie.com/embed/${vId}?autoplay=1&enablejsapi=1&origin=https://www.youtube.com`;
      const liveImg = container.querySelector('img#img') || a.querySelector('img');
      const liveThumb = (liveImg?.currentSrc && !liveImg.currentSrc.startsWith('data:')) ? liveImg.currentSrc : `https://i.ytimg.com/vi/${vId}/hqdefault.jpg`;
      const postUrl = new URL(a.getAttribute('href'), location.href).href;
      add(embedUrl, 'video', container, liveThumb, {
        alt: title,
        pageUrl: postUrl,
        postUrl,
        playbackPage: embedUrl,
        site: 'youtube',
        isEmbed: true,
        fallbackUrls: [
          `https://i.ytimg.com/vi/${vId}/maxresdefault.jpg`,
          `https://i.ytimg.com/vi/${vId}/mqdefault.jpg`
        ]
      });
    });
  }

  if (site.key === 'x') {
    document.querySelectorAll('[data-testid="tweet"]').forEach(tweet => {
      const video = tweet.querySelector('video');
      const thumb = tweet.querySelector(xVideoThumbSelector);
      if (!video && !thumb) return;
      const postUrl = tweet.querySelector('a[href*="/status/"]')?.href || '';
      const direct = xDirectVideo(tweet, video);
      const preview = video?.getAttribute('poster') || thumb?.currentSrc || thumb?.src || '';
      add(direct || video?.currentSrc || video?.getAttribute('src') || postUrl, 'video', video || thumb, preview, { postUrl, playbackPage: direct ? '' : postUrl, site: 'x' });
    });
  }

  if (site.key !== 'reddit') {
    document.querySelectorAll('a[href]').forEach(n => {
      if (/\.(mp4|webm|mov|m4v|ogv)(\?|#|$)/i.test(n.href)) add(n.href, 'video', n);
    });
  }

  try {
    const deepNodes = document.querySelectorAll('[data-src],[data-srcset],[data-original],[data-lazy-src],[data-high-res],[data-full-src],[data-media-url]');
    deepNodes.forEach(el => {
      const src = el.getAttribute('data-src') || el.getAttribute('data-original') || el.getAttribute('data-lazy-src') || el.getAttribute('data-high-res') || el.getAttribute('data-full-src') || el.getAttribute('data-media-url') || bestSrcset(el.getAttribute('data-srcset') || '');
      if (src) {
        const isVid = /\.(mp4|webm|mov|m4v|ogv)(?:[?#]|$)/i.test(src) || el.matches('video');
        add(src, isVid ? 'video' : 'image', el);
      }
    });
  } catch {}

  if (includeBackgrounds && site.key !== 'google-images') {
    document.querySelectorAll('[style*="background"], [style*="url("]').forEach(n => {
      const bg = getComputedStyle(n).backgroundImage;
      for (const m of bg.matchAll(/url\(["']?(.*?)["']?\)/g)) add(m[1], 'image', n);
    });
  }

  return { items: [...found.values()], title: document.title, hostname: location.hostname, pageUrl: location.href, site };
}
