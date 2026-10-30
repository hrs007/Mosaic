const xVideoSourceCache = new Map();
const xVideoFailureCache = new Map();

export async function resolveXVideos(items) {
  const videos = items.filter(item => item?.site === 'x' && item.type === 'video' && item.postUrl);
  await Promise.all(videos.map(async item => {
    const id = item.postUrl.match(/status\/(\d+)/)?.[1];
    if (!id) return;
    if ((xVideoFailureCache.get(id) || 0) > Date.now()) return;
    xVideoFailureCache.delete(id);

    let request = xVideoSourceCache.get(id);
    if (!request) {
      const token = (Number(id) / 1e15 * Math.PI).toString(36).replace(/(0+|\.)/g, '');
      request = fetch(`https://cdn.syndication.twimg.com/tweet-result?id=${encodeURIComponent(id)}&lang=en&token=${encodeURIComponent(token)}`, { credentials: 'omit' })
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          const byUrl = new Map();
          const seen = new WeakSet();
          let checked = 0;
          const walk = value => {
            if (!value || typeof value !== 'object' || seen.has(value) || checked++ > 20000) return;
            seen.add(value);
            if (Array.isArray(value)) {
              for (const child of value) walk(child);
              return;
            }
            if (Array.isArray(value.variants)) {
              for (const variant of value.variants) {
                const url = variant?.url;
                const type = variant?.content_type || variant?.type;
                if (type === 'video/mp4' && typeof url === 'string' && /^https:\/\/video\.twimg\.com\//i.test(url) && /\.mp4(?:[?#]|$)/i.test(url)) {
                  const previous = byUrl.get(url);
                  if (!previous || (variant.bitrate || 0) > (previous.bitrate || 0)) {
                    byUrl.set(url, variant);
                  }
                }
              }
            }
            for (const [key, child] of Object.entries(value)) {
              if (key !== 'url' && key !== 'user') walk(child);
            }
          };
          walk(data);
          return [...byUrl.values()].sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0)).map(v => v.url);
        })
        .catch(() => []);
      xVideoSourceCache.set(id, request);
    }

    const urls = await request;
    if (urls.length) {
      xVideoFailureCache.delete(id);
      item.url = urls[0];
      item.source = urls[0];
      item.playbackPage = '';
      item.fallbackUrls = urls;
    } else if (request === xVideoSourceCache.get(id)) {
      xVideoSourceCache.delete(id);
      xVideoFailureCache.set(id, Date.now() + 60000);
    }
  }));
}
