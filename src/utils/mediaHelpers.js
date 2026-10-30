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
  const u = item.sourceUrl || item.source || item.url || '';
  return item.mime === 'image/gif' ||
         /\.(gif|gifv)(?:[?#]|$)/i.test(u) ||
         /\.(gif|gifv)(?:[?#]|$)/i.test(item.previewUrl || '') ||
         /\.(gif|gifv)(?:[?#]|$)/i.test(item.poster || '');
}

export function canonicalMediaId(url, item = null) {
  try {
    const raw = String(url || '');
    const ytMatch = raw.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|shorts\/|watch\?v=))([a-zA-Z0-9_-]{11})/i);
    if (ytMatch) return `youtube:${ytMatch[1]}`;

    const redditVid = getRedditVideoId(raw) || (item && item.site === 'reddit' && item.type === 'video' ? getRedditVideoId(item.source || '') : '');
    if (redditVid) return `reddit:video:${redditVid}`;

    const redditImg = getRedditImageId(raw) || (item && item.site === 'reddit' ? getRedditImageId(item.source || item.previewUrl || '') : '');
    if (redditImg) return `reddit:image:${redditImg}`;

    if (item && item.site === 'reddit' && item.type === 'video' && item.postUrl) {
      const pId = getRedditPostId(item.postUrl);
      if (pId) return `reddit:post-video:${pId}`;
    }

    const u = new URL(raw);
    if (u.hostname === 'preview.redd.it' || u.hostname === 'external-preview.redd.it') {
      const rId = getRedditImageId(raw);
      if (rId) return `reddit:image:${rId}`;
    }
    for (const [k, v] of [...u.searchParams]) {
      if (/^(width|height|w|h|quality|crop|auto|format)$/i.test(k)) u.searchParams.delete(k);
      else if (k.toLowerCase() === 'q' && /^\d+$/.test(v)) u.searchParams.delete(k);
      else if (k.toLowerCase() === 'name' && /^(small|medium|large|orig|900x900)$/i.test(v)) u.searchParams.delete(k);
    }
    return u.href;
  } catch {
    return String(url).replace(/([?&])(width|height|w|h|quality)=\d+(&|$)/gi, '$1').replace(/[?&]$/, '');
  }
}

export function getPlayableVideoUrl(item) {
  if (!item || item.type !== 'video') return '';
  if (item.savedFile) return item.sourceUrl || item.url || '';
  const candidates = [
    item.sourceUrl,
    item.source,
    item.url,
    ...(item.fallbackUrls || [])
  ].filter(u => u && typeof u === 'string' && !/^blob:/i.test(u) && !u.includes('#mosaic-video-') && !/\.(jpe?g|png|webp|avif|gif|svg)(?:[?#]|$)/i.test(u));
  const direct = candidates.find(u => /\.(mp4|webm|mov|m4v|ogv)(?:[?#]|$)/i.test(u) || /video\.twimg\.com|v\.redd\.it/i.test(u));
  if (direct) return direct;
  if (item.playbackPage && candidates[0] === item.playbackPage) return '';
  return candidates[0] || '';
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
  if (!Number.isFinite(value)) return '0:00';
  const seconds = Math.floor(value);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
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
