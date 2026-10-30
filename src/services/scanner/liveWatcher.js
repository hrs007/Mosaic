export function startLiveWatcherInTab(includeBackgrounds, targetTabId) {
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
    const video = player?.shadowRoot?.querySelector('video');
    const url = sources[0]?.url || [video?.currentSrc, video?.getAttribute('src'), player?.getAttribute('src')].find(src => /^https?:\/\//i.test(src || '') && /\.mp4(?:[?#]|$)/i.test(src)) || '';
    return {
      url,
      urls: [...new Set([url, ...sources.map(x => x.url)].filter(Boolean))],
      width: sources[0]?.width || video?.videoWidth || 0,
      height: sources[0]?.height || video?.videoHeight || 0
    };
  };

  const watcher = {
    version: 4,
    includeBackgrounds,
    seen: new Set(),
    timer: 0,
    scan() {
      const add = (url, type, node, poster = '', meta = {}) => {
        if (!url || /^data:image\/svg\+xml/i.test(url)) return;
        try {
          const absolute = new URL(url, location.href).href;
          if (!/^https?:|^blob:|^data:image\/(?!svg)/i.test(absolute)) return;
          const host = location.hostname.toLowerCase();
          const isX = host === 'x.com' || host.endsWith('.x.com') || host.includes('twitter.com');
          const postUrl = meta.postUrl || node?.closest?.('article,[data-testid="tweet"]')?.querySelector?.('a[href*="/status/"]')?.href || '';
          const directXVideo = isX && type === 'video' && new URL(absolute).hostname === 'video.twimg.com' && /\.mp4(?:[?#]|$)/i.test(absolute);
          const pagePlayback = type === 'video' && ((isX && !directXVideo) || /^blob:/i.test(absolute) || /\.m3u8(?:[?#]|$)|\.mpd(?:[?#]|$)/i.test(absolute));
          const playableUrl = meta.playbackPage || (pagePlayback ? (isX && postUrl ? postUrl : `${location.href}#mosaic-video-${[...document.querySelectorAll('video')].indexOf(node)}`) : absolute);
          const width = node?.naturalWidth || node?.videoWidth || node?.width || 0;
          const height = node?.naturalHeight || node?.videoHeight || node?.height || 0;
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
              previewUrl: type === 'image' ? (node?.currentSrc || node?.getAttribute?.('src') || absolute) : '',
              alt: node?.alt || node?.getAttribute?.('aria-label') || '',
              pageUrl: location.href,
              pageTitle: document.title,
              width,
              height,
              source: node?.currentSrc || node?.getAttribute?.('src') || absolute,
              mime: node?.type || '',
              poster: poster || node?.getAttribute?.('poster') || '',
              playbackPage: meta.playbackPage || (pagePlayback ? playableUrl : ''),
              postUrl,
              site: meta.site || (isX ? 'x' : ''),
              fallbackUrls: meta.fallbackUrls || []
            }
          }).catch(() => {});
        } catch {}
      };

      const scanNode = (n) => {
        if (!n || n.nodeType !== 1) return;
        const host = location.hostname.toLowerCase();
        const isX = host === 'x.com' || host.endsWith('.x.com') || host.includes('twitter.com');
        const isYouTube = host.includes('youtube.com') || host.includes('youtu.be');
        const nodes = [n, ...(n.querySelectorAll ? n.querySelectorAll('img,video,source,shreddit-player,a[href],ytd-thumbnail a#thumbnail, [style]') : [])];
        for (const el of nodes) {
          if (isYouTube && el.matches?.('ytd-thumbnail a#thumbnail, a[href*="/watch?v="], a[href*="/shorts/"]')) {
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
            const vId = getVId(el.href);
            if (vId) {
              const container = el.closest('ytd-rich-item-renderer, ytd-video-renderer, ytd-compact-video-renderer, ytd-grid-video-renderer') || el;
              const title = container.querySelector('#video-title')?.textContent?.trim() || el.getAttribute('title') || el.getAttribute('aria-label') || 'YouTube Video';
              const embedUrl = `https://www.youtube-nocookie.com/embed/${vId}?autoplay=1&enablejsapi=1&origin=https://www.youtube.com`;
              const liveImg = container.querySelector('img#img') || el.querySelector('img');
              const thumb = (liveImg?.currentSrc && !liveImg.currentSrc.startsWith('data:')) ? liveImg.currentSrc : `https://i.ytimg.com/vi/${vId}/hqdefault.jpg`;
              const postUrl = new URL(el.getAttribute('href'), location.href).href;
              chrome.runtime.sendMessage({
                type: 'mosaic-live-media',
                tabId: targetTabId,
                media: {
                  url: embedUrl,
                  type: 'video',
                  postUrl,
                  pageUrl: postUrl,
                  pageTitle: title,
                  alt: title,
                  width: 1280,
                  height: 720,
                  poster: thumb,
                  fallbackUrls: [
                    `https://i.ytimg.com/vi/${vId}/maxresdefault.jpg`,
                    `https://i.ytimg.com/vi/${vId}/mqdefault.jpg`
                  ],
                  site: 'youtube',
                  playbackPage: embedUrl,
                  isEmbed: true
                }
              }).catch(() => {});
            }
          }
          if (el.matches?.('img')) {
            if (isYouTube) continue;
            const src = el.currentSrc || el.getAttribute('src') || el.getAttribute('data-src') || el.getAttribute('data-original') || bestSrcset(el.getAttribute('srcset') || el.getAttribute('data-srcset') || '');
            const host = location.hostname.toLowerCase();
            const isGoogleImages = host.includes('google.') && (/\/search/.test(location.pathname) || location.pathname === '/');
            const isReddit = host.includes('reddit.com');
            if (isGoogleImages && !el.closest('[data-iurl],a[href*="/imgres"]') && !el.hasAttribute('data-iurl')) continue;
            if (isReddit) {
              const post = el.closest('shreddit-post');
              if (!post || post.querySelector('shreddit-player')) continue;
              if (!/(?:i|preview|external-preview)\.redd\.it/i.test(src)) continue;
              const content = post.getAttribute('content-href') || '';
              if (/^https?:\/\/(?:i|preview)\.redd\.it\//i.test(content)) {
                add(content, 'image', post);
                continue;
              }
              if (!/^(?:https?:)?\/\/i\.redd\.it\//i.test(src) && post.querySelector('img[src*="i.redd.it"]')) continue;
            }
            const isXThumb = (host === 'x.com' || host.endsWith('.x.com') || host.includes('twitter.com')) && /ext_tw_video_thumb|tweet_video_thumb|amplify_video_thumb/i.test(src);
            if (isXThumb) {
              const tweet = el.closest('[data-testid="tweet"]');
              const video = tweet?.querySelector('video');
              const direct = tweet ? xDirectVideo(tweet, video) : '';
              const postUrl = tweet?.querySelector('a[href*="/status/"]')?.href || '';
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
                postUrl
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
            const postUrl = tweet?.querySelector('a[href*="/status/"]')?.href || '';
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

      scanNode(document.documentElement);
      if (this.includeBackgrounds && !location.hostname.toLowerCase().includes('google.') && !location.hostname.toLowerCase().includes('reddit.') && !location.hostname.toLowerCase().includes('youtube.')) {
        document.querySelectorAll('*').forEach(el => {
          const bg = getComputedStyle(el).backgroundImage;
          for (const m of bg.matchAll(/url\(["']?(.*?)["']?\)/g)) add(m[1], 'image', el);
        });
      }
    }
  };

  window.__mosaicWatcher = watcher;
  watcher.observer = new MutationObserver(records => {
    for (const r of records) {
      if (r.type === 'attributes' && r.target) watcher.scan(r.target);
      for (const n of r.addedNodes) watcher.scan(n);
    }
    clearTimeout(watcher.timer);
    watcher.timer = setTimeout(() => watcher.scan(), 100);
  });
  watcher.observer.observe(document.documentElement, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['src', 'srcset', 'data-src', 'data-srcset', 'data-original', 'poster', 'preview', 'packaged-media-json', 'content-href', 'style']
  });
  document.addEventListener('scroll', () => {
    clearTimeout(watcher.timer);
    watcher.timer = setTimeout(() => watcher.scan(), 80);
  }, { capture: true, passive: true });
  watcher.scan();
}
