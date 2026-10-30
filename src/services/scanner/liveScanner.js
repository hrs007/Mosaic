export function scanLiveNowInTab() {
  const host = location.hostname.toLowerCase();
  const isReddit = host.includes('reddit.com');
  const isX = host === 'x.com' || host.endsWith('.x.com') || host.includes('twitter.com');
  const isYouTube = host.includes('youtube.com') || host.includes('youtu.be');

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

  const ytItems = [];
  if (isYouTube) {
    document.querySelectorAll('ytd-thumbnail a#thumbnail, a[href*="/watch?v="], a[href*="/shorts/"]').forEach(a => {
      const vId = getVId(a.href);
      if (!vId) return;
      const container = a.closest('ytd-rich-item-renderer, ytd-video-renderer, ytd-compact-video-renderer, ytd-grid-video-renderer') || a;
      const title = container.querySelector('#video-title')?.textContent?.trim() || a.getAttribute('title') || a.getAttribute('aria-label') || 'YouTube Video';
      const embedUrl = `https://www.youtube-nocookie.com/embed/${vId}?autoplay=1&enablejsapi=1&origin=https://www.youtube.com`;
      const liveImg = container.querySelector('img#img') || a.querySelector('img');
      const thumb = (liveImg?.currentSrc && !liveImg.currentSrc.startsWith('data:')) ? liveImg.currentSrc : `https://i.ytimg.com/vi/${vId}/hqdefault.jpg`;
      const postUrl = new URL(a.getAttribute('href'), location.href).href;
      ytItems.push({
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
      });
    });
  }

  const standardItems = isYouTube ? [] : [...document.querySelectorAll('img,video,shreddit-player,[data-testid="tweet"] img')].map(node => {
    const post = node.closest('shreddit-post,[data-testid="tweet"]');
    const tweet = node.closest('[data-testid="tweet"]');
    const img = node.matches('img') ? node : node.querySelector?.('img');
    const video = node.matches('video') ? node : node.querySelector?.('video');
    const player = node.matches('shreddit-player') ? node : post?.querySelector?.('shreddit-player');
    const poster = player?.getAttribute('poster') || player?.getAttribute('preview') || img?.currentSrc || img?.src || video?.poster || '';
    const postUrl = post?.getAttribute('permalink') ? new URL(post.getAttribute('permalink'), location.href).href : tweet?.querySelector('a[href*="/status/"]')?.href || '';
    const thumb = img?.currentSrc || img?.src || '';
    const videoThumb = /ext_tw_video_thumb|tweet_video_thumb|amplify_video_thumb/i.test(thumb);
    const type = video || player || videoThumb ? 'video' : 'image';
    let url = video?.currentSrc || video?.src || player?.getAttribute('src') || '';
    let fallbacks = [];
    if (isReddit) {
      if (player && node.matches('img')) return null;
      if (node.matches('img') && post && post.querySelector('shreddit-player')) return null;
      if (node.matches('img') && !/(?:i|preview|external-preview)\.redd\.it/i.test(thumb)) return null;
      if (player) {
        try {
          const p = JSON.parse(player.getAttribute('packaged-media-json') || '{}');
          const perms = (p.playbackMp4s?.permutations || []).map(v => {
            const u = typeof v.source === 'string' ? v.source : (v.source?.url || v.source?.fallbackUrl || '');
            const m = String(u).match(/DASH_(\d+)/i);
            const res = m ? parseInt(m[1], 10) : (v.source?.dimensions?.height || v.dimensions?.height || 0);
            return { url: u, res };
          }).filter(x => x.url && /\.mp4(?:[?#]|$)/i.test(x.url)).sort((a, b) => b.res - a.res);
          fallbacks = perms.map(x => x.url);
          url = fallbacks[0] || url;
        } catch {}
      }
    }
    if (isX && videoThumb && !url) url = postUrl;
    if (!url && !videoThumb) url = thumb;
    if (!url) return null;
    if (isReddit && type === 'image') {
      try {
        const u = new URL(url);
        if (u.hostname === 'preview.redd.it' || u.hostname === 'external-preview.redd.it') {
          const parts = u.pathname.split('/').filter(Boolean);
          const fname = parts.pop() || '';
          if (fname) url = `https://i.redd.it/${fname.includes('.') ? fname : fname + '.jpg'}`;
        }
      } catch {}
    }
    if (type === 'image' && img && ((img.naturalWidth > 0 && img.naturalWidth < 32) || (img.naturalHeight > 0 && img.naturalHeight < 32))) return null;
    return {
      url,
      type,
      postUrl,
      pageUrl: location.href,
      pageTitle: document.title,
      alt: img?.alt || post?.getAttribute('post-title') || '',
      width: img?.naturalWidth || video?.videoWidth || 0,
      height: img?.naturalHeight || video?.videoHeight || 0,
      poster,
      fallbackUrls: fallbacks,
      site: isReddit ? 'reddit' : isX ? 'x' : '',
      playbackPage: type === 'video' && !fallbacks.length && !url.includes('.mp4') ? postUrl : ''
    };
  }).filter(Boolean);

  return { url: location.href, items: [...ytItems, ...standardItems] };
}
