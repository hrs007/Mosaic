const xVideoSourceCache = new Map();
const xVideoFailureCache = new Map();

export async function resolveXVideos(items) {
  if (!Array.isArray(items) || !items.length) return;

  const videos = items.filter(item => item?.site === 'x' && item.type === 'video');
  if (!videos.length) return;

  // Group videos by tweet status ID
  const byPostId = new Map();
  for (const item of videos) {
    const id = (item.postUrl || item.pageUrl || item.url || '').match(/status\/(\d+)/)?.[1];
    if (!id) continue;
    if (!byPostId.has(id)) byPostId.set(id, []);
    byPostId.get(id).push(item);
  }

  await Promise.all([...byPostId.entries()].map(async ([id, tweetVideos]) => {
    if ((xVideoFailureCache.get(id) || 0) > Date.now()) return;
    xVideoFailureCache.delete(id);

    let request = xVideoSourceCache.get(id);
    if (!request) {
      const token = (Number(id) / 1e15 * Math.PI).toString(36).replace(/(0+|\.)/g, '');
      request = fetch(`https://cdn.syndication.twimg.com/tweet-result?id=${encodeURIComponent(id)}&lang=en&token=${encodeURIComponent(token)}`, { credentials: 'omit' })
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (!data) return { mediaList: [], tweetMeta: null };
          const mediaList = [];
          const tweetMeta = {
            text: data.text || '',
            authorName: data.user?.name || '',
            authorHandle: data.user?.screen_name || '',
            likes: data.favorite_count || 0,
            replies: data.conversation_count || 0
          };

          const formatXLabel = (v, idx, total) => {
            const u = v.url || v.src || '';
            const m = u.match(/\/vid\/(?:avc1\/)?(\d+)x(\d+)\//i);
            if (m) {
              const minDim = Math.min(parseInt(m[1], 10), parseInt(m[2], 10));
              return `${minDim}p`;
            }
            const br = v.bitrate || 0;
            if (br >= 2000000) return '1080p';
            if (br >= 1000000) return '720p';
            if (br >= 500000) return '480p';
            if (br > 0) return '360p';
            return total > 1 ? `Quality ${total - idx}` : 'MP4';
          };

          // 1. Check data.mediaDetails (handles multi-video & single-video with complete metadata)
          if (Array.isArray(data.mediaDetails) && data.mediaDetails.length) {
            for (const m of data.mediaDetails) {
              const variants = (m.video_info?.variants || []).filter(v =>
                (v.content_type === 'video/mp4' || v.type === 'video/mp4') &&
                typeof (v.url || v.src) === 'string'
              ).sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));

              const urls = variants.map(v => v.url || v.src);
              const videoVariants = variants.map((v, i) => ({
                url: v.url || v.src,
                label: formatXLabel(v, i, variants.length),
                bitrate: v.bitrate || 0
              }));
              const mId = m.id_str || (m.media_url_https || '').match(/(?:thumb|video)\/(\d+)/)?.[1] || '';
              if (urls.length) {
                mediaList.push({
                  mediaId: mId,
                  poster: m.media_url_https || '',
                  duration: Math.round((m.video_info?.duration_millis || 0) / 1000),
                  width: m.original_info?.width || 0,
                  height: m.original_info?.height || 0,
                  urls,
                  videoVariants
                });
              }
            }
          }

          // 2. Check data.video fallback
          if (!mediaList.length && data.video) {
            const v = data.video;
            const variants = (v.variants || []).filter(x =>
              (x.type === 'video/mp4' || x.content_type === 'video/mp4') &&
              typeof (x.src || x.url) === 'string'
            ).sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));

            const urls = variants.map(x => x.src || x.url);
            const videoVariants = variants.map((x, i) => ({
              url: x.src || x.url,
              label: formatXLabel(x, i, variants.length),
              bitrate: x.bitrate || 0
            }));
            if (urls.length) {
              mediaList.push({
                mediaId: v.videoId?.id || '',
                poster: v.poster || '',
                duration: Math.round((v.durationMs || 0) / 1000),
                width: 0,
                height: 0,
                urls,
                videoVariants
              });
            }
          }

          // 3. Fallback recursive walk if variants were stored elsewhere
          if (!mediaList.length) {
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
                  const url = variant?.url || variant?.src;
                  const type = variant?.content_type || variant?.type;
                  if (type === 'video/mp4' && typeof url === 'string' && /^https:\/\/video\.twimg\.com\//i.test(url) && /\.mp4(?:[?#]|$)/i.test(url)) {
                    const previous = byUrl.get(url);
                    if (!previous || (variant.bitrate || 0) > (previous.bitrate || 0)) {
                      byUrl.set(url, { ...variant, url });
                    }
                  }
                }
              }
              for (const [key, child] of Object.entries(value)) {
                if (key !== 'url' && key !== 'user') walk(child);
              }
            };
            walk(data);
            const sortedVariants = [...byUrl.values()].sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
            const urls = sortedVariants.map(v => v.url);
            const videoVariants = sortedVariants.map((v, i) => ({
              url: v.url,
              label: formatXLabel(v, i, sortedVariants.length),
              bitrate: v.bitrate || 0
            }));
            if (urls.length) {
              mediaList.push({
                mediaId: '',
                poster: '',
                duration: 0,
                width: 0,
                height: 0,
                urls,
                videoVariants
              });
            }
          }

          return { mediaList, tweetMeta };
        })
        .catch(() => ({ mediaList: [], tweetMeta: null }));
      xVideoSourceCache.set(id, request);
    }

    const result = await request;
    const mediaList = result?.mediaList || [];
    const tweetMeta = result?.tweetMeta || null;

    if (mediaList.length) {
      xVideoFailureCache.delete(id);
      const usedMedia = new Set();

      for (const item of tweetVideos) {
        if (tweetMeta) {
          if (tweetMeta.text && !item.tweetText) item.tweetText = tweetMeta.text;
          if (tweetMeta.authorName && !item.authorName) item.authorName = tweetMeta.authorName;
          if (tweetMeta.authorHandle && !item.authorHandle) item.authorHandle = tweetMeta.authorHandle;
          if (tweetMeta.likes && !item.likes) item.likes = tweetMeta.likes;
          if (tweetMeta.replies && !item.replies) item.replies = tweetMeta.replies;
        }

        const itemMediaId = (item.poster || item.previewUrl || item.source || item.url || '').match(/(?:amplify_video_thumb|ext_tw_video_thumb|tweet_video_thumb|amplify_video|ext_tw_video|tweet_video)\/(\d+)/i)?.[1];
        let matched = itemMediaId ? mediaList.find(m => !usedMedia.has(m) && m.mediaId === itemMediaId) : null;
        if (!matched) {
          matched = mediaList.find(m => !usedMedia.has(m));
        }

        if (matched) {
          usedMedia.add(matched);
          item.url = matched.urls[0];
          item.source = matched.urls[0];
          item.playbackPage = '';
          item.fallbackUrls = matched.urls;
          item.videoVariants = matched.videoVariants || [];
          if (matched.poster && (!item.poster || item.poster.includes('#mosaic'))) {
            item.poster = matched.poster;
            item.previewUrl = matched.poster;
          }
          if (matched.duration && !item.duration) item.duration = matched.duration;
          if (matched.width && !item.width) item.width = matched.width;
          if (matched.height && !item.height) item.height = matched.height;
        }
      }

      // If syndication returned additional videos from the same tweet not yet in items:
      for (const m of mediaList) {
        if (!usedMedia.has(m)) {
          usedMedia.add(m);
          const refItem = tweetVideos[0] || {};
          const newId = m.mediaId ? `x:video:${m.mediaId}` : `x:video:${id}:${m.urls[0]}`;
          items.push({
            ...refItem,
            id: newId,
            url: m.urls[0],
            source: m.urls[0],
            type: 'video',
            poster: m.poster || refItem.poster || '',
            previewUrl: m.poster || refItem.previewUrl || '',
            width: m.width || refItem.width || 0,
            height: m.height || refItem.height || 0,
            duration: m.duration || refItem.duration || 0,
            playbackPage: '',
            fallbackUrls: m.urls,
            videoVariants: m.videoVariants || [],
            tweetText: tweetMeta?.text || refItem.tweetText || '',
            authorName: tweetMeta?.authorName || refItem.authorName || '',
            authorHandle: tweetMeta?.authorHandle || refItem.authorHandle || '',
            likes: tweetMeta?.likes || refItem.likes || 0,
            replies: tweetMeta?.replies || refItem.replies || 0
          });
        }
      }
    } else if (request === xVideoSourceCache.get(id)) {
      xVideoSourceCache.delete(id);
      xVideoFailureCache.set(id, Date.now() + 60000);
    }
  }));
}
