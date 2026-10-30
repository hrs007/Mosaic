const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const params = new URLSearchParams(location.search);
const tabId = Number(params.get('tabId'));
const defaults = { dimensions: true, sizes: true, newTab: true, backgrounds: true, autoplay: true, density: 'comfortable', columns: 'auto', theme: 'light' };
let prefs = { ...defaults }, media = [], filtered = [], favorites = new Set(), savedMedia = new Map(), savedFiles=[], savedObjectUrls=new Map(), activeType = 'all', siteFilter='', sortBy = 'largest', minKb = 0, orientation = 'any', viewMode = 'grid', search = '', page = 1, perPage = 60, viewerIndex = -1, duplicateHidden = false, livePollTimer = null, currentPageIdentity='', liveScanBusy=false, liveScanQueued=false, sourceAdvanceBusy=false, sourceAdvancePaused=false, lastSourceAdvance=0;
let siteProfile = { key: 'generic', name: 'Page media', hint: 'Media discovered on this page', glyph: '◉' };
const xVideoSourceCache=new Map();
const xVideoFailureCache=new Map();

async function init() {
  const stored = await chrome.storage.local.get(['mosaicPrefs', 'mosaicFavorites', 'mosaicSavedMedia', 'mosaicSavedFiles', 'mosaicHideSmall', 'mosaicGalleryState', 'mosaicHideDuplicates']);
  savedFiles=stored.mosaicSavedFiles||[];
  try{await navigator.storage?.persist?.();}catch{}
  prefs = { ...defaults, ...(stored.mosaicPrefs || {}) }; favorites = new Set(stored.mosaicFavorites || []); savedMedia = new Map((stored.mosaicSavedMedia || []).filter(item=>item?.url).map(item=>{const id=item.id||canonicalMediaId(item.url);return [id,{...item,id}];}));
  await refreshSavedFiles();
  for (const id of savedMedia.keys()) favorites.add(id);
  if (savedMedia.size) await chrome.storage.local.set({mosaicFavorites:[...favorites]});
  const state = stored.mosaicGalleryState || {};
  activeType = state.activeType || 'all'; siteFilter=state.siteFilter||''; sortBy = state.sortBy || 'newest'; minKb = state.minKb || 0; orientation = state.orientation || 'any'; viewMode = state.viewMode || 'grid'; search = state.search || '';
  applyPrefs(); $('#hideSmall').checked = stored.mosaicHideSmall !== false; $('#hideDuplicates').checked = stored.mosaicHideDuplicates === true; $('#searchInput').value = search;
  $$('.tab').forEach(x=>x.classList.toggle('active',x.dataset.type===activeType)); $$('.view-button').forEach(x=>x.classList.toggle('active',x.dataset.view===viewMode));
  $$('.size-chip').forEach(x=>x.classList.toggle('active',Number(x.dataset.size)===minKb)); $$('.orientation-chip').forEach(x=>x.classList.toggle('active',x.dataset.orientation===orientation));
  const sortOption = $(`#sortMenu button[data-sort="${sortBy}"]`); if(sortOption){$('#sortLabel').textContent=sortOption.textContent;}
  if(state.filtersOpen)$('#filterPanel').classList.remove('hidden');
  bindEvents(); scanPage();
}
function applyPrefs() {
  document.documentElement.dataset.theme = prefs.theme === 'system' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : prefs.theme;
  document.documentElement.dataset.density = prefs.density;
  document.documentElement.dataset.columns = prefs.columns;
  $('#settingDimensions').checked = prefs.dimensions; $('#settingSizes').checked = prefs.sizes; $('#settingNewTab').checked = prefs.newTab;
  $('#settingBackgrounds').checked = prefs.backgrounds;$('#settingAutoplay').checked=prefs.autoplay; $('#settingDensity').value = prefs.density; $('#settingColumns').value = prefs.columns; $('#settingTheme').value = prefs.theme;
}
async function scanPage() {
  sourceAdvancePaused=false;page=1;
  $('#loadingState').classList.remove('hidden'); $('#emptyState').classList.add('hidden');
  $('#scanStatus').textContent = 'Looking for media…'; $('#siteLabel').textContent = 'Scanning current page';
  try {
    const [result] = await chrome.scripting.executeScript({ target: { tabId }, func: (includeBackgrounds) => {
      const bestSrcset = (value='') => value.split(',').map(part=>{const bits=part.trim().split(/\s+/);const metric=parseFloat(bits[1])||0;return {url:bits[0],metric};}).filter(x=>x.url).sort((a,b)=>b.metric-a.metric)[0]?.url||'';
      const xVariantCache=new WeakMap();
      const readXVariant = (tweet) => {
        if(xVariantCache.has(tweet))return xVariantCache.get(tweet);
        const seen=new WeakSet();let checked=0,best=null;
        const walk=(value,depth)=>{if(!value||typeof value!=='object'||depth>14||checked++>5000||seen.has(value))return;seen.add(value);const variants=value.video_info?.variants;if(Array.isArray(variants))for(const v of variants)if(v?.content_type==='video/mp4'&&typeof v.url==='string'&&(!best||(v.bitrate||0)>(best.bitrate||0)))best=v;for(const key of Object.keys(value)){if(/^(return|child|sibling|stateNode|_owner|_store|owner|elementType|type)$/i.test(key))continue;try{walk(value[key],depth+1);}catch{}}};
        const nodes=[tweet,...(tweet?.querySelectorAll?.('*')||[])];for(const node of nodes){for(const key of Object.keys(node)){if(key.startsWith('__reactProps$'))walk(node[key],0);else if(key.startsWith('__reactFiber$'))walk(node[key]?.memoizedProps,0);}}
        const url=best?.url||'';if(url)xVariantCache.set(tweet,url);return url;
      };
      const xDirectVideo = (tweet, video) => {
        const direct=[video?.currentSrc,video?.getAttribute('src'),...[...(video?.querySelectorAll?.('source')||[])].map(s=>s.src)];
        const valid=src=>{try{const u=new URL(src,location.href);return u.protocol==='https:'&&u.hostname==='video.twimg.com'&&/\.mp4(?:[?#]|$)/i.test(u.href);}catch{return false;}};
        const fromElement=direct.find(valid);if(fromElement)return fromElement;
        const fromReact=readXVariant(tweet);if(valid(fromReact))return fromReact;
        const postId=tweet?.querySelector('a[href*="/status/"]')?.href.match(/status\/(\d+)/)?.[1];
        const thumbId=tweet?.querySelector('img[src*="ext_tw_video_thumb"],img[src*="tweet_video_thumb"],img[src*="amplify_video_thumb"]')?.src.match(/(?:thumb|video)\/(\d+)/)?.[1];
        const mediaIds=[postId,thumbId].filter(Boolean);if(!mediaIds.length)return '';
        return performance.getEntriesByType('resource').map(e=>e.name).find(src=>valid(src)&&mediaIds.some(id=>new URL(src).pathname.includes(id)))||'';
      };
      const redditVideoData = (player) => {
        let packaged={};try{packaged=JSON.parse(player?.getAttribute('packaged-media-json')||'{}');}catch{}
        const variants=packaged?.playbackMp4s?.permutations||[];
        const sources=variants.map(v=>({source:v?.source,url:typeof v?.source==='string'?v.source:(v?.source?.url||v?.source?.fallbackUrl||''),width:v?.source?.dimensions?.width||v?.dimensions?.width||0})).filter(v=>/^https?:\/\//i.test(v.url)&&/\.mp4(?:[?#]|$)/i.test(v.url)).sort((a,b)=>b.width-a.width);
        const shadowVideo=player?.shadowRoot?.querySelector('video');
        const url=sources[0]?.url||[shadowVideo?.currentSrc,shadowVideo?.getAttribute('src'),player?.getAttribute('src')].find(src=>/^https?:\/\//i.test(src||'')&&/\.mp4(?:[?#]|$)/i.test(src))||'';
        return {url,urls:[...new Set([url,...sources.map(x=>x.url)].filter(Boolean))],width:sources[0]?.width||shadowVideo?.videoWidth||0,height:sources[0]?.source?.dimensions?.height||shadowVideo?.videoHeight||0};
      };
      const host=location.hostname.toLowerCase();
      const site=host.includes('reddit.com')?{key:'reddit',name:'Reddit',hint:'Post images, galleries, and video previews',glyph:'r'}:host==='x.com'||host.endsWith('.x.com')||host.includes('twitter.com')?{key:'x',name:'X',hint:'Post media and original image versions',glyph:'𝕏'}:host.includes('google.')&&(/\/search/.test(location.pathname)||location.pathname==='/')?{key:'google-images',name:'Google Images',hint:'Result previews and source pages',glyph:'G'}:host.includes('imgur.com')?{key:'imgur',name:'Imgur',hint:'Direct images, albums, and video previews',glyph:'i'}:host.includes('instagram.com')?{key:'instagram',name:'Instagram',hint:'Visible post images and reel previews',glyph:'◎'}:host.includes('youtube.com')||host.includes('youtu.be')?{key:'youtube',name:'YouTube',hint:'Video thumbnails and visible page media',glyph:'▶'}:host.includes('pinterest.')?{key:'pinterest',name:'Pinterest',hint:'Pin images and original image versions',glyph:'p'}:host.includes('flickr.com')?{key:'flickr',name:'Flickr',hint:'Photo previews and larger available sizes',glyph:'f'}:host.includes('tumblr.com')?{key:'tumblr',name:'Tumblr',hint:'Post images and video previews',glyph:'t'}:{key:'generic',name:host.replace(/^www\./,''),hint:'Images, videos, and backgrounds on this page',glyph:'◉'};
      const found = new Map(); const add = (url, type, node, poster = '', meta = {}) => {
        if (!url || /^data:image\/svg\+xml/i.test(url)) return;
        try { const absolute = new URL(url, location.href).href; if (!/^https?:|^blob:|^data:image\/(?!svg)/i.test(absolute)) return;
          const postUrl=meta.postUrl||node?.closest?.('article,[data-testid="tweet"]')?.querySelector?.('a[href*="/status/"]')?.href||'';
          const directXVideo=site.key==='x'&&type==='video'&&new URL(absolute).hostname==='video.twimg.com'&&/\.mp4(?:[?#]|$)/i.test(absolute);
          const pagePlayback = type === 'video' && ((site.key==='x'&&!directXVideo) || /^blob:/i.test(absolute) || /\.m3u8(?:[?#]|$)|\.mpd(?:[?#]|$)/i.test(absolute) || /application\/(?:x-mpegurl|vnd\.apple\.mpegurl|dash\+xml)/i.test(node?.type || ''));
          const playableUrl = pagePlayback ? (site.key==='x' && postUrl ? postUrl : `${location.href}#mosaic-video-${[...document.querySelectorAll('video')].indexOf(node)}`) : absolute;
          let cleaned=absolute;
          if(site.key==='reddit') cleaned=cleaned.replace(/([?&])width=\d+|([?&])height=\d+|([?&])format=\w+/gi,'').replace(/[?&]$/,'');
          if(site.key==='x') cleaned=cleaned.replace(/([?&])name=(small|medium|900x900|large)/i,'$1name=orig');
          if(site.key==='google-images') { const src=node?.getAttribute?.('data-iurl')||node?.closest?.('[data-iurl]')?.getAttribute?.('data-iurl')||''; if(src) { try{cleaned=new URL(src,location.href).href;}catch{} } }
          if(site.key==='imgur') cleaned=cleaned.replace(/\?.*$/,'');
          const key = pagePlayback ? playableUrl : cleaned.replace(/([?&])(width|height|w|h|quality|q)=\d+/gi, '$1');
          const width=node?.naturalWidth||node?.videoWidth||node?.width||0, height=node?.naturalHeight||node?.videoHeight||node?.height||0;
          if(type==='image'&&width>0&&height>0&&(width<32||height<32))return;
          const old = found.get(key); const sourcePage=node?.getAttribute?.('data-lpage')||node?.getAttribute?.('data-url')||node?.closest?.('[data-lpage]')?.getAttribute?.('data-lpage')||location.href; const item = { url: pagePlayback ? playableUrl : cleaned, type, previewUrl:type==='image'?(node?.currentSrc||node?.getAttribute?.('src')||absolute):poster, alt: node?.alt || node?.getAttribute?.('aria-label') || '', pageUrl: sourcePage, pageTitle: document.title, width, height, source: node?.currentSrc || node?.getAttribute?.('src') || cleaned, mime: node?.type || '', poster, site:site.key, playbackPage: pagePlayback ? playableUrl : '', postUrl: postUrl || node?.closest?.('[data-testid="tweet"]')?.querySelector?.('a[href*="/status/"]')?.href || '', ...meta };
          if (!old || item.width * item.height > old.width * old.height) found.set(key, item);
        } catch {}
      };
      const xVideoThumbSelector='[data-testid="tweet"] img[src*="ext_tw_video_thumb"],[data-testid="tweet"] img[src*="tweet_video_thumb"],[data-testid="tweet"] img[src*="amplify_video_thumb"]';
      const xVideoThumbs=new Set(site.key==='x'?[...document.querySelectorAll(xVideoThumbSelector)]:[]);
      if(site.key==='reddit')document.querySelectorAll('shreddit-post').forEach(post=>{
        const permalink=post.getAttribute('permalink')||'',pageUrl=permalink?new URL(permalink,location.href).href:location.href,title=post.getAttribute('post-title')||document.title;
        const player=post.querySelector('shreddit-player');
        if(player){const media=redditVideoData(player),poster=player.getAttribute('poster')||player.getAttribute('preview')||post.querySelector('img[alt="media poster"]')?.currentSrc||'';add(media.url||pageUrl,'video',player,poster,{alt:title,pageUrl,pageTitle:title,width:media.width,height:media.height,source:media.url||pageUrl,fallbackUrls:media.urls,site:'reddit',playbackPage:media.url?'':pageUrl,postUrl:pageUrl});return;}
        const content=post.getAttribute('content-href')||'';if(/^https?:\/\/(?:i|preview)\.redd\.it\//i.test(content))add(content,'image',post,'',{alt:title,pageUrl,pageTitle:title,source:content,site:'reddit',postUrl:pageUrl});
        else {const imgs=[...post.querySelectorAll('img')].map(img=>({img,src:img.currentSrc||img.getAttribute('src')||img.getAttribute('data-src')||''})).filter(x=>/^(?:https?:)?\/\/(?:i|preview|external-preview)\.redd\.it\//i.test(x.src));const originals=imgs.filter(x=>/^(?:https?:)?\/\/i\.redd\.it\//i.test(x.src));for(const {img,src} of (originals.length?originals:imgs))add(src,'image',img,'',{alt:img.alt||title,pageUrl,pageTitle:title,source:src,site:'reddit',postUrl:pageUrl});}
      });
      const googleImageResults=site.key==='google-images'?[...document.querySelectorAll('img')].filter(n=>n.closest('[data-iurl],a[href*="/imgres"]')||n.hasAttribute('data-iurl')):[];
      const googleImagesSet=new Set(googleImageResults);
      document.querySelectorAll('img').forEach(n => {
        if(site.key==='reddit')return;
        if(site.key==='google-images'&&!googleImagesSet.has(n))return;
        if(xVideoThumbs.has(n))return;
        const googleResult=n.closest('[data-iurl]');
        const src=(site.key==='google-images'&&(googleResult?.getAttribute('data-iurl')||n.getAttribute('data-iurl')))||n.currentSrc||n.getAttribute('src')||n.getAttribute('data-src')||n.getAttribute('data-lazy-src')||bestSrcset(n.getAttribute('srcset')||n.getAttribute('data-srcset')||'');
        add(src,'image',n);
      });
      if(site.key!=='reddit'&&site.key!=='x')document.querySelectorAll('video').forEach(n => { const sources=[...n.querySelectorAll('source')];const supported=sources.find(s=>!s.type||n.canPlayType(s.type))||sources[0];const mediaSrc=n.currentSrc||n.getAttribute('src')||supported?.getAttribute('src');add(mediaSrc,'video',n,n.getAttribute('poster')||''); });
      if(site.key==='x')document.querySelectorAll('[data-testid="tweet"]').forEach(tweet=>{const video=tweet.querySelector('video'),thumb=tweet.querySelector(xVideoThumbSelector);if(!video&&!thumb)return;const postUrl=tweet.querySelector('a[href*="/status/"]')?.href||'';const direct=xDirectVideo(tweet,video);const preview=video?.getAttribute('poster')||thumb?.currentSrc||thumb?.src||'';add(direct||video?.currentSrc||video?.getAttribute('src')||postUrl,'video',video||thumb,preview,{postUrl,playbackPage:direct?'':postUrl,site:'x'});});
      if(site.key!=='reddit')document.querySelectorAll('a[href]').forEach(n => { if (/\.(mp4|webm|mov|m4v|ogv)(\?|#|$)/i.test(n.href)) add(n.href, 'video', n); });
      if (includeBackgrounds&&site.key!=='google-images'&&site.key!=='reddit') document.querySelectorAll('*').forEach(n => { const bg = getComputedStyle(n).backgroundImage; for (const m of bg.matchAll(/url\(["']?(.*?)["']?\)/g)) add(m[1], 'image', n); });
      return { items: [...found.values()], title: document.title, hostname: location.hostname, pageUrl:location.href, site };
    }, args: [prefs.backgrounds] });
    const identity=pageIdentity(result?.result?.pageUrl||'');
    if(currentPageIdentity&&identity&&identity!==currentPageIdentity){media=[];filtered=[];$('#gallery').innerHTML='';page=1;}
    currentPageIdentity=identity;
    const scannedItems=result?.result?.items||[];
    if(result?.result?.site?.key==='x')await resolveXVideos(scannedItems);
    mergeMedia(scannedItems);
    const hasSelectedType=activeType==='all'||activeType==='favorites'||activeType==='files'||media.some(x=>!x.unavailable&&x.type===activeType);
    if(!hasSelectedType){activeType='all';$$('.tab').forEach(x=>x.classList.toggle('active',x.dataset.type==='all'));saveGalleryState();}
    $('#siteLabel').textContent = result?.result?.hostname || 'Current page'; siteProfile=result?.result?.site||siteProfile; renderSiteTools();
    $('#scanStatus').textContent = `${media.filter(x=>!x.unavailable).length} items · live`; $('#countSaved').textContent = media.filter(x => favorites.has(x.id)&&!x.unavailable).length;
    if (!media.length) { $('#loadingState').classList.add('hidden'); $('#emptyState').classList.remove('hidden'); }
    updateCounts(); filterAndRender();
    $('#loadingState').classList.add('hidden');
    if(!filtered.length&&media.some(x=>!x.unavailable)){
      // A previous page's search/type/size filters can otherwise make a new page
      // look empty. Recover to the full set while retaining appearance settings.
      $('#clearFilters').click();
      toast('No results matched the saved filters. Showing all page media.');
    }
    startLiveDiscovery();
    setTimeout(checkGalleryFill,0);
  } catch (e) {
    $('#loadingState').classList.add('hidden'); $('#emptyState').classList.remove('hidden'); $('#scanStatus').textContent = 'Page could not be scanned';
    $('#emptyState h3').textContent='Could not read this page';$('#emptyState p').textContent='Try a regular website tab, then reopen Mosaic.';
    toast(`Could not scan page: ${e?.message||'access denied'}`);
  }
}
async function scanLiveNow(){if(liveScanBusy){liveScanQueued=true;return;}liveScanBusy=true;try{const [result]=await chrome.scripting.executeScript({target:{tabId},func:()=>({url:location.href,items:[...document.querySelectorAll('img,video,shreddit-player,[data-testid="tweet"] img')].map(node=>{const host=location.hostname.toLowerCase(),reddit=host.includes('reddit.com'),x=host==='x.com'||host.endsWith('.x.com')||host.includes('twitter.com'),post=node.closest('shreddit-post,[data-testid="tweet"]'),tweet=node.closest('[data-testid="tweet"]'),img=node.matches('img')?node:node.querySelector?.('img'),video=node.matches('video')?node:node.querySelector?.('video'),player=node.matches('shreddit-player')?node:post?.querySelector?.('shreddit-player'),poster=player?.getAttribute('poster')||player?.getAttribute('preview')||img?.currentSrc||img?.src||video?.poster||'',postUrl=post?.getAttribute('permalink')?new URL(post.getAttribute('permalink'),location.href).href:tweet?.querySelector('a[href*="/status/"]')?.href||'',thumb=img?.currentSrc||img?.src||'',videoThumb=/ext_tw_video_thumb|tweet_video_thumb|amplify_video_thumb/i.test(thumb),type=video||player||videoThumb?'video':'image';let url=video?.currentSrc||video?.src||player?.getAttribute('src')||'';let fallbacks=[];if(reddit&&player){try{const p=JSON.parse(player.getAttribute('packaged-media-json')||'{}');fallbacks=(p.playbackMp4s?.permutations||[]).map(v=>typeof v.source==='string'?v.source:v.source?.url).filter(u=>u&&/\.mp4(?:[?#]|$)/i.test(u));url=fallbacks[0]||url;}catch{}}if(x&&videoThumb&&!url)url=postUrl;if(!url&&!videoThumb)url=thumb;if(!url)return null;if(type==='image'&&img&&((img.naturalWidth&&img.naturalWidth<120)||(img.naturalHeight&&img.naturalHeight<120)))return null;return {url,type,postUrl,pageUrl:location.href,pageTitle:document.title,alt:img?.alt||post?.getAttribute('post-title')||'',width:img?.naturalWidth||video?.videoWidth||0,height:img?.naturalHeight||video?.videoHeight||0,poster,fallbackUrls:fallbacks,site:reddit?'reddit':x?'x':'',playbackPage:type==='video'&&!fallbacks.length&&!url.includes('.mp4')?postUrl:''};}).filter(Boolean)})});const items=result?.result?.items||[];if(result?.result?.url&&pageIdentity(result.result.url)!==currentPageIdentity){media=[];filtered=[];$('#gallery').innerHTML='';currentPageIdentity=pageIdentity(result.result.url);}const xItems=items.filter(item=>item.site==='x'&&item.type==='video');if(xItems.length)await resolveXVideos(xItems);mergeMedia(items);if(items.length){siteProfile.key=items.some(x=>x.site==='x')?'x':items.some(x=>x.site==='reddit')?'reddit':siteProfile.key;updateCounts();$('#scanStatus').textContent=`${media.length} items · live`;}}catch{}finally{liveScanBusy=false;if(liveScanQueued){liveScanQueued=false;setTimeout(scanLiveNow,100);}}}
function mergeMedia(items) {
  const known = new Map(media.map(item => [canonicalMediaId(item.url), item])); let added = 0, changed = false;
  for (const x of items) {
    if (!x?.url) continue;
    const id = canonicalMediaId(String(x.url)), old = known.get(id);
    if(!old&&x.site==='x'&&x.type==='video'&&!x.playbackPage&&x.postUrl){const fallback=media.find(item=>item.site==='x'&&item.type==='video'&&item.playbackPage&&item.postUrl===x.postUrl);if(fallback){known.delete(canonicalMediaId(fallback.url));fallback.url=x.url;fallback.source=x.source||x.url;fallback.fallbackUrls=x.fallbackUrls||fallback.fallbackUrls||[];fallback.playbackPage='';fallback.poster||=x.poster||'';fallback.width=Math.max(fallback.width||0,Number(x.width)||0);fallback.height=Math.max(fallback.height||0,Number(x.height)||0);known.set(canonicalMediaId(fallback.url),fallback);if(favorites.has(fallback.id))savedMedia.set(fallback.id,{...fallback});changed=true;continue;}}
    if (old) { const w=Math.max(old.width||0,Number(x.width)||0),h=Math.max(old.height||0,Number(x.height)||0);if(w!==old.width||h!==old.height){old.width=w;old.height=h;changed=true;}old.alt ||= x.alt || '';old.previewUrl||=x.previewUrl||''; if(x.type==='video'&&old.type!=='video'){old.type='video';old.poster||=x.poster||x.previewUrl||'';old.playbackPage||=x.playbackPage||'';old.postUrl||=x.postUrl||'';old.site||=x.site||'';old.unavailable=false;changed=true;}if(x.type==='video'){if(x.site==='x'&&x.url!==old.url&&!x.playbackPage){const previousId=old.id;old.url=x.url;old.id=id;old.source=x.source||x.url;old.fallbackUrls=x.fallbackUrls||old.fallbackUrls||[];old.playbackPage='';old.unavailable=false;known.delete(previousId);known.set(id,old);if(favorites.delete(previousId))favorites.add(id);if(savedMedia.has(previousId)){savedMedia.delete(previousId);savedMedia.set(id,{...old});}changed=true;}else{if(x.site==='reddit'||x.site==='x'){old.fallbackUrls=x.fallbackUrls||old.fallbackUrls||[];old.source=x.source||old.source;old.playbackPage=x.playbackPage||old.playbackPage;old.unavailable=false;}old.poster||=x.poster||'';}}if(favorites.has(old.id))savedMedia.set(old.id,{...old});continue; }
    const item = { ...x, id, index: media.length, size: 0, width: Number(x.width) || 0, height: Number(x.height) || 0 };
    media.push(item); known.set(id, item); if(favorites.has(id))savedMedia.set(id,{...item}); added++; changed=true;
  }
  if (changed) { if(added>0)sourceAdvancePaused=false; updateCounts(); filterAndRender(); $('#scanStatus').textContent = `${media.filter(x=>!x.unavailable).length} items · live`; persistSavedMedia(); setTimeout(checkGalleryFill,120); }
  return added;
}
function canonicalMediaId(url){try{const u=new URL(url);for(const [k,v] of [...u.searchParams]){if(/^(width|height|w|h|quality)$/i.test(k)&&/^\d+$/.test(v))u.searchParams.delete(k);else if(k.toLowerCase()==='q'&&/^\d+$/.test(v))u.searchParams.delete(k);else if(k.toLowerCase()==='name'&&/^(small|medium|large|orig|900x900)$/i.test(v))u.searchParams.delete(k);}return u.href;}catch{return String(url).replace(/([?&])(width|height|w|h|quality)=\d+(&|$)/gi,'$1').replace(/[?&]$/,'');}}
function pageIdentity(url){try{const u=new URL(url);return `${u.origin}${u.pathname}${u.search}`;}catch{return '';}}
function persistSavedMedia(){return chrome.storage.local.set({mosaicFavorites:[...favorites],mosaicSavedMedia:[...savedMedia.values()]});}
async function resolveXVideos(items){
  const videos=items.filter(item=>item?.site==='x'&&item.type==='video'&&item.postUrl);
  await Promise.all(videos.map(async item=>{
    const id=item.postUrl.match(/status\/(\d+)/)?.[1];if(!id)return;
    if((xVideoFailureCache.get(id)||0)>Date.now())return;xVideoFailureCache.delete(id);
    let request=xVideoSourceCache.get(id);
    if(!request){const token=(Number(id)/1e15*Math.PI).toString(36).replace(/(0+|\.)/g,'');request=fetch(`https://cdn.syndication.twimg.com/tweet-result?id=${encodeURIComponent(id)}&lang=en&token=${encodeURIComponent(token)}`,{credentials:'omit'}).then(r=>r.ok?r.json():null).then(data=>{
      const byUrl=new Map(),seen=new WeakSet();let checked=0;
      const walk=value=>{if(!value||typeof value!=='object'||seen.has(value)||checked++>20000)return;seen.add(value);if(Array.isArray(value)){for(const child of value)walk(child);return;}if(Array.isArray(value.variants)){for(const variant of value.variants){const url=variant?.url,type=variant?.content_type||variant?.type;if(type==='video/mp4'&&typeof url==='string'&&/^https:\/\/video\.twimg\.com\//i.test(url)&&/\.mp4(?:[?#]|$)/i.test(url)){const previous=byUrl.get(url);if(!previous||(variant.bitrate||0)>(previous.bitrate||0))byUrl.set(url,variant);}}}for(const [key,child]of Object.entries(value))if(key!=='url'&&key!=='user')walk(child);};walk(data);
      return [...byUrl.values()].sort((a,b)=>(b.bitrate||0)-(a.bitrate||0)).map(v=>v.url);
    }).catch(()=>[]);xVideoSourceCache.set(id,request);}
    const urls=await request;if(urls.length){xVideoFailureCache.delete(id);item.url=urls[0];item.source=urls[0];item.playbackPage='';item.fallbackUrls=urls;}else if(request===xVideoSourceCache.get(id)){xVideoSourceCache.delete(id);xVideoFailureCache.set(id,Date.now()+60000);}
  }));
}
function startLiveDiscovery() {
  if (livePollTimer) clearInterval(livePollTimer);
  const connectLivePort=()=>{try{const port=chrome.runtime.connect({name:`mosaic-gallery:${tabId}`});window.__mosaicLivePort=port;port.onMessage.addListener(message=>{if(message?.source==='mosaic-live'&&message.tabId===tabId)receiveLiveMedia({data:message});});port.onDisconnect.addListener(()=>{if(window.__mosaicLivePort===port){window.__mosaicLivePort=null;setTimeout(connectLivePort,500);}});}catch{setTimeout(connectLivePort,1000);}};
  if(!window.__mosaicLivePort)connectLivePort();
  livePollTimer=setInterval(scanLiveNow,1800);scanLiveNow();
  // A lightweight content script stays in the source tab and reports additions from
  // MutationObserver, lazy-load attributes, video sources, and CSS background changes.
  chrome.scripting.executeScript({ target: { tabId }, func: (includeBackgrounds, targetTabId) => {
    if (window.__mosaicWatcher?.version===4) { window.__mosaicWatcher.includeBackgrounds = includeBackgrounds; window.__mosaicWatcher.scan(); return; }
    if(window.__mosaicWatcher?.observer)window.__mosaicWatcher.observer.disconnect();
    if(window.__mosaicWatcher)delete window.__mosaicWatcher;
    const bestSrcset = (value='') => value.split(',').map(part=>{const bits=part.trim().split(/\s+/);return {url:bits[0],metric:parseFloat(bits[1])||0};}).filter(x=>x.url).sort((a,b)=>b.metric-a.metric)[0]?.url||'';
    const xVariantCache=new WeakMap();const readXVariant=(tweet)=>{if(xVariantCache.has(tweet))return xVariantCache.get(tweet);const seen=new WeakSet();let checked=0,best=null;const walk=(value,depth)=>{if(!value||typeof value!=='object'||depth>14||checked++>5000||seen.has(value))return;seen.add(value);const variants=value.video_info?.variants;if(Array.isArray(variants))for(const v of variants)if(v?.content_type==='video/mp4'&&typeof v.url==='string'&&(!best||(v.bitrate||0)>(best.bitrate||0)))best=v;for(const key of Object.keys(value)){if(/^(return|child|sibling|stateNode|_owner|_store|owner|elementType|type)$/i.test(key))continue;try{walk(value[key],depth+1);}catch{}}};for(const node of [tweet,...(tweet?.querySelectorAll?.('*')||[])])for(const key of Object.keys(node)){if(key.startsWith('__reactProps$'))walk(node[key],0);else if(key.startsWith('__reactFiber$'))walk(node[key]?.memoizedProps,0);}const url=best?.url||'';if(url)xVariantCache.set(tweet,url);return url;};
    const xDirectVideo=(tweet,video)=>{const valid=src=>{try{const u=new URL(src,location.href);return u.protocol==='https:'&&u.hostname==='video.twimg.com'&&/\.mp4(?:[?#]|$)/i.test(u.href);}catch{return false;}};const direct=[video?.currentSrc,video?.getAttribute('src'),...[...(video?.querySelectorAll?.('source')||[])].map(s=>s.src)].find(valid);if(direct)return direct;const fromReact=readXVariant(tweet);if(valid(fromReact))return fromReact;const ids=[tweet?.querySelector('a[href*="/status/"]')?.href.match(/status\/(\d+)/)?.[1],tweet?.querySelector('img[src*="ext_tw_video_thumb"],img[src*="tweet_video_thumb"],img[src*="amplify_video_thumb"]')?.src.match(/(?:thumb|video)\/(\d+)/)?.[1]].filter(Boolean);return ids.length?performance.getEntriesByType('resource').map(e=>e.name).find(src=>valid(src)&&ids.some(id=>new URL(src).pathname.includes(id)))||'':'';};
    const redditVideoData=(player)=>{let packaged={};try{packaged=JSON.parse(player?.getAttribute('packaged-media-json')||'{}');}catch{}const variants=packaged?.playbackMp4s?.permutations||[];const sources=variants.map(v=>({source:v?.source,url:typeof v?.source==='string'?v.source:(v?.source?.url||v?.source?.fallbackUrl||''),width:v?.source?.dimensions?.width||v?.dimensions?.width||0})).filter(v=>/^https?:\/\//i.test(v.url)&&/\.mp4(?:[?#]|$)/i.test(v.url)).sort((a,b)=>b.width-a.width);const video=player?.shadowRoot?.querySelector('video'),url=sources[0]?.url||[video?.currentSrc,video?.getAttribute('src'),player?.getAttribute('src')].find(src=>/^https?:\/\//i.test(src||'')&&/\.mp4(?:[?#]|$)/i.test(src))||'';return{url,urls:[...new Set([url,...sources.map(x=>x.url)].filter(Boolean))],width:sources[0]?.width||video?.videoWidth||0,height:sources[0]?.source?.dimensions?.height||video?.videoHeight||0};};
    const watcher = { version:4, includeBackgrounds, seen: new Set(), timer: 0, scan() {
      const add = (url, type, node, poster = '', meta = {}) => {
        if (!url || /^data:image\/svg\+xml/i.test(url)) return;
        try { const absolute = new URL(url, location.href).href; if (!/^https?:|^blob:|^data:image\/(?!svg)/i.test(absolute)) return;
          const host=location.hostname.toLowerCase(), isX=host==='x.com'||host.endsWith('.x.com')||host.includes('twitter.com');
          const postUrl=meta.postUrl||node?.closest?.('article,[data-testid="tweet"]')?.querySelector?.('a[href*="/status/"]')?.href||'';
          const directXVideo=isX&&type==='video'&&new URL(absolute).hostname==='video.twimg.com'&&/\.mp4(?:[?#]|$)/i.test(absolute);
          const pagePlayback=type==='video'&&((isX&&!directXVideo)||/^blob:/i.test(absolute)||/\.m3u8(?:[?#]|$)|\.mpd(?:[?#]|$)/i.test(absolute));
          const playableUrl=meta.playbackPage|| (pagePlayback?(isX&&postUrl?postUrl:`${location.href}#mosaic-video-${[...document.querySelectorAll('video')].indexOf(node)}`):absolute);
          const width=node?.naturalWidth||node?.videoWidth||node?.width||0,height=node?.naturalHeight||node?.videoHeight||node?.height||0;
          if(type==='image'&&((width>0&&width<32)||(height>0&&height<32)))return;
          const seenKey=`${type}:${absolute}`;if (this.seen.has(seenKey)) return; this.seen.add(seenKey);
          chrome.runtime.sendMessage({type:'mosaic-live-media',tabId:targetTabId,media:{url:playableUrl,type,previewUrl:type==='image'?(node?.currentSrc||node?.getAttribute?.('src')||absolute):'',alt:node?.alt||node?.getAttribute?.('aria-label')||'',pageUrl:location.href,pageTitle:document.title,width,height,source:node?.currentSrc||node?.getAttribute?.('src')||absolute,mime:node?.type||'',poster:poster||node?.getAttribute?.('poster')||'',playbackPage:meta.playbackPage|| (pagePlayback?playableUrl:''),postUrl,site:meta.site||(isX?'x':''),fallbackUrls:meta.fallbackUrls||[]}}).catch(()=>{});
        } catch {}
      };
      const scanNode = (n) => {
        if (!n || n.nodeType !== 1) return;
        const host=location.hostname.toLowerCase(),isX=host==='x.com'||host.endsWith('.x.com')||host.includes('twitter.com');
        const nodes = [n, ...(n.querySelectorAll ? n.querySelectorAll('img,video,source,shreddit-player,a[href], [style]') : [])];
        for (const el of nodes) {
          if (el.matches?.('img')) { const src=el.currentSrc||el.getAttribute('src')||el.getAttribute('data-src')||el.getAttribute('data-original')||bestSrcset(el.getAttribute('srcset')||el.getAttribute('data-srcset')||'');const host=location.hostname.toLowerCase(),isGoogleImages=host.includes('google.')&&(/\/search/.test(location.pathname)||location.pathname==='/'),isReddit=host.includes('reddit.com');if(isGoogleImages&&!el.closest('[data-iurl],a[href*="/imgres"]')&&!el.hasAttribute('data-iurl'))continue;if(isReddit){const post=el.closest('shreddit-post');if(!post||post.querySelector('shreddit-player'))continue;const content=post.getAttribute('content-href')||'';if(/^https?:\/\/(?:i|preview)\.redd\.it\//i.test(content)){add(content,'image',post);continue;}if(!/^(?:https?:)?\/\/i\.redd\.it\//i.test(src)&&post.querySelector('img[src*="i.redd.it"]'))continue;}const isXThumb=(host==='x.com'||host.endsWith('.x.com')||host.includes('twitter.com'))&&/ext_tw_video_thumb|tweet_video_thumb|amplify_video_thumb/i.test(src);if(isXThumb){const tweet=el.closest('[data-testid="tweet"]'),video=tweet?.querySelector('video'),direct=tweet?xDirectVideo(tweet,video):'',postUrl=tweet?.querySelector('a[href*="/status/"]')?.href||'';add(direct||video?.currentSrc||video?.getAttribute('src')||postUrl,'video',video||el,video?.getAttribute('poster')||src,{postUrl,playbackPage:direct?'':postUrl,site:'x'});continue;}add(src,'image',el); }
          if (el.matches?.('shreddit-player')) {const post=el.closest('shreddit-post'),media=redditVideoData(el),poster=el.getAttribute('poster')||el.getAttribute('preview')||'',permalink=post?.getAttribute('permalink')||'',postUrl=permalink?new URL(permalink,location.href).href:location.href;chrome.runtime.sendMessage({type:'mosaic-live-media',tabId:targetTabId,media:{url:media.url||postUrl,type:'video',previewUrl:poster,poster,alt:post?.getAttribute('post-title')||'',pageUrl:location.href,pageTitle:document.title,width:media.width,height:media.height,source:media.url||postUrl,fallbackUrls:media.urls,playbackPage:media.url?'':postUrl,site:'reddit',postUrl}}).catch(()=>{});}
          if (el.matches?.('source')) { const parent=el.closest('video,picture'); if(parent?.matches('video')){const sources=[...parent.querySelectorAll('source')];const supported=sources.find(s=>!s.type||parent.canPlayType(s.type))||sources[0];add(parent.currentSrc||parent.getAttribute('src')||supported?.getAttribute('src'),'video',parent,parent.getAttribute('poster')||'');} }
          if (el.matches?.('video')) { const sources=[...el.querySelectorAll('source')];const supported=sources.find(s=>!s.type||el.canPlayType(s.type))||sources[0];const tweet=el.closest('[data-testid="tweet"]');const direct=isX&&tweet?xDirectVideo(tweet,el):'';const postUrl=tweet?.querySelector('a[href*="/status/"]')?.href||'';add(direct||el.currentSrc||el.getAttribute('src')||supported?.getAttribute('src')||(isX?postUrl:''),'video',el,el.getAttribute('poster')||tweet?.querySelector('img[src*="ext_tw_video_thumb"],img[src*="tweet_video_thumb"],img[src*="amplify_video_thumb"]')?.src||'',{postUrl,playbackPage:isX&&!direct?postUrl:'',site:isX?'x':''}); }
          if (el.matches?.('a[href]') && /\.(mp4|webm|mov|m4v|ogv)(\?|#|$)/i.test(el.href)) add(el.href,'video',el);
          if (this.includeBackgrounds && el.matches?.('[style]')) { const bg=getComputedStyle(el).backgroundImage; for(const m of bg.matchAll(/url\(["']?(.*?)["']?\)/g))add(m[1],'image',el); }
        }
      };
      scanNode(document.documentElement);
      if (this.includeBackgrounds&&!location.hostname.toLowerCase().includes('google.')&&!location.hostname.toLowerCase().includes('reddit.')) document.querySelectorAll('*').forEach(el=>{const bg=getComputedStyle(el).backgroundImage;for(const m of bg.matchAll(/url\(["']?(.*?)["']?\)/g))add(m[1],'image',el);});
    }};
    window.__mosaicWatcher=watcher;
    watcher.observer=new MutationObserver(records=>{for(const r of records){if(r.type==='attributes'&&r.target)watcher.scan(r.target);for(const n of r.addedNodes)watcher.scan(n);}clearTimeout(watcher.timer);watcher.timer=setTimeout(()=>watcher.scan(),500);});
    watcher.observer.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['src','srcset','data-src','data-srcset','data-original','poster','preview','packaged-media-json','content-href','style']});
    document.addEventListener('scroll',()=>{clearTimeout(watcher.timer);watcher.timer=setTimeout(()=>watcher.scan(),250);},{capture:true,passive:true});
    watcher.scan();
  }, args: [prefs.backgrounds,tabId] }).catch(()=>{});
}
function galleryFillThreshold(scroller){return Math.max(1600,scroller.clientHeight*2.25);}
function checkGalleryFill(){const scroller=$('.app-shell');if(!scroller||document.body.classList.contains('modal-open')||activeType==='favorites'||activeType==='files'||sourceAdvancePaused)return;const remaining=scroller.scrollHeight-(scroller.scrollTop+scroller.clientHeight);if(remaining>galleryFillThreshold(scroller))return;if(sourceAdvanceBusy){setTimeout(checkGalleryFill,300);return;}const wait=900-(Date.now()-lastSourceAdvance);if(wait>0){setTimeout(checkGalleryFill,wait+25);return;}advanceSourcePage();}
async function advanceSourcePage(){if(sourceAdvanceBusy||sourceAdvancePaused||Date.now()-lastSourceAdvance<850)return;sourceAdvanceBusy=true;let noMediaSteps=0,steps=0;try{while(steps<80&&!document.body.classList.contains('modal-open')&&activeType!=='favorites'&&activeType!=='files'){
  const scroller=$('.app-shell');if(!scroller||scroller.scrollHeight-(scroller.scrollTop+scroller.clientHeight)>galleryFillThreshold(scroller))break;
  const beforeCount=media.length;lastSourceAdvance=Date.now();const [result]=await chrome.scripting.executeScript({target:{tabId},func:()=>{const root=document.scrollingElement||document.documentElement;let target=null,best=0;for(const el of document.querySelectorAll('body *')){const style=getComputedStyle(el);if(!/(auto|scroll|overlay)/.test(style.overflowY))continue;const remaining=el.scrollHeight-el.clientHeight;if(remaining<=180)continue;const rect=el.getBoundingClientRect(),visibleWidth=Math.max(0,Math.min(rect.right,innerWidth)-Math.max(rect.left,0)),visibleHeight=Math.max(0,Math.min(rect.bottom,innerHeight)-Math.max(rect.top,0));if(visibleWidth<innerWidth*.35||visibleHeight<innerHeight*.25)continue;const score=remaining*Math.min(1,(visibleWidth*visibleHeight)/(innerWidth*innerHeight*.55));if(score>best){best=score;target=el;}}const rootRemaining=Math.max(0,root.scrollHeight-root.clientHeight);if(!target||rootRemaining>best)target=null;const before=target?target.scrollTop:window.scrollY,step=Math.max(420,Math.floor(window.innerHeight*.68));if(target)target.scrollBy({top:step,left:0,behavior:'instant'});else window.scrollBy({top:step,left:0,behavior:'instant'});const after=target?target.scrollTop:window.scrollY;return{before,after};}});const moved=(result?.result?.after||0)>(result?.result?.before||0);if(!moved){sourceAdvancePaused=true;break;}steps++;await new Promise(resolve=>setTimeout(resolve,350));await scanLiveNow();await new Promise(resolve=>setTimeout(resolve,400));await scanLiveNow();if(media.length===beforeCount)noMediaSteps++;else noMediaSteps=0;if(noMediaSteps>=4){sourceAdvancePaused=true;break;}}
 if(steps>=80)sourceAdvancePaused=true;
 }catch{}finally{sourceAdvanceBusy=false;if(!sourceAdvancePaused)setTimeout(checkGalleryFill,250);}}
async function receiveLiveMedia(event) {
  if (event.data?.source !== 'mosaic-live' || !event.data.media) return;
  const item = event.data.media;
  // Source-page scripts forward through postMessage only; verify the source page URL
  // belongs to the tab being viewed before accepting its media entry.
  if (!item.pageUrl) return;
  const identity=pageIdentity(item.pageUrl);
  if(currentPageIdentity&&identity&&identity!==currentPageIdentity){media=[];filtered=[];$('#gallery').innerHTML='';page=1;currentPageIdentity=identity;scanPage();return;}
  if(!currentPageIdentity)currentPageIdentity=identity;
  if(item.site==='x'&&item.type==='video')await resolveXVideos([item]);
  if(currentPageIdentity&&identity!==currentPageIdentity)return;
  mergeMedia([item]);
}
function probeItem(item) {
  if (item.type === 'video') { item.size = 0; return; }
  const img = new Image(); img.onload = () => { const changed=!item.width||!item.height;item.width ||= img.naturalWidth; item.height ||= img.naturalHeight;item.unavailable=false;if(changed){updateCounts();filterAndRender();} }; img.onerror = () => {item.unavailable=true;updateCounts();filterAndRender();}; img.src = item.url;
  try { fetch(item.url, { method: 'HEAD', mode: 'cors' }).then(r => { const len = Number(r.headers.get('content-length')); if (len) { item.size = len; updateCounts();filterAndRender(); } }).catch(() => {}); } catch {}
}
function updateCounts() {
  const available=media.filter(x=>!x.unavailable);$('#countAll').textContent = available.length; $('#countImage').textContent = available.filter(x => x.type === 'image').length; $('#countVideo').textContent = available.filter(x => x.type === 'video').length; $('#countSaved').textContent = savedFiles.length;const favoritesCount=$('#countFavorites');if(favoritesCount)favoritesCount.textContent=savedMedia.size;
  $('#mediaCountTop').textContent = `${available.length} ${available.length === 1 ? 'item' : 'items'}`;
}
function renderSiteTools(){
  const bar=$('#siteTools'), actions=$('#siteActions'); if(!bar||!actions)return;
  bar.classList.remove('hidden'); $('#siteGlyph').textContent=siteProfile.glyph; $('#siteName').textContent=siteProfile.key==='x'?'X media':siteProfile.key==='reddit'?'Reddit media':'Page media'; $('#siteHint').textContent=siteProfile.key==='x'?'Loaded posts · playable clips · originals':siteProfile.key==='reddit'?'Post images · hosted videos · discussions':'Actions for media on this page'; actions.innerHTML='';
  const action=(label,fn)=>{const b=document.createElement('button');b.className='site-action';b.textContent=label;b.onclick=fn;actions.append(b);};
  action('Scan loaded posts',()=>scanPage());
  if(siteProfile.key==='x'){action('All X media',()=>setSiteFilter('all','x'));action('Playable clips',()=>setSiteFilter('video','x-playable'));action('X images',()=>setSiteFilter('image','x'));}
  else if(siteProfile.key==='reddit'){action('Reddit images',()=>setSiteFilter('image','reddit'));action('Reddit videos',()=>setSiteFilter('video','reddit'));action('Reddit hosted',()=>setSiteFilter('all','reddit-hosted'));}
  else if(siteProfile.key==='google-images') action('Image results',()=>setSiteFilter('image'));
}
function setSiteFilter(type,filter=''){activeType=type;siteFilter=filter;$$('.tab').forEach(x=>x.classList.toggle('active',x.dataset.type===type));saveGalleryState();filterAndRender();setTimeout(checkGalleryFill,0);}
function filterAndRender() {
  const term = search.trim().toLowerCase(); let list = activeType==='favorites'?[...savedMedia.values()]:activeType==='files'?savedFiles.map(x=>({...x,id:x.id,savedFile:true,url:x.sourceUrl||'',sourceUrl:x.sourceUrl})):media.filter(x => !x.unavailable && (activeType === 'all' || x.type === activeType));
  if(siteFilter==='x')list=list.filter(x=>x.site==='x');else if(siteFilter==='x-playable')list=list.filter(x=>x.site==='x'&&x.type==='video'&&/^https:\/\/video\.twimg\.com\//i.test(x.url));else if(siteFilter==='reddit'||siteFilter==='reddit-hosted')list=list.filter(x=>x.site==='reddit'&&(siteFilter!=='reddit-hosted'||/redd\.it|reddit\.com/i.test(x.url)));
  if (term) list = list.filter(x => `${x.alt} ${x.url} ${x.pageTitle}`.toLowerCase().includes(term));
  if (minKb) list = list.filter(x => {const bytes=x.size||(x.width&&x.height?x.width*x.height*.3:0);return !bytes||bytes>=minKb*1024;});
  if (orientation !== 'any') list = list.filter(x => { if(!x.width||!x.height)return true;const ratio = x.width / x.height; return orientation === 'landscape' ? ratio > 1.12 : orientation === 'portrait' ? ratio < .88 : ratio >= .88 && ratio <= 1.12; });
  if ($('#hideSmall').checked) list = list.filter(x => x.type==='video'||!x.width||!x.height||(x.width >= 120 && x.height >= 120));
  if (duplicateHidden || $('#hideDuplicates').checked) { const seen = new Set(); list = list.filter(x => { const key = `${x.width}x${x.height}:${x.url.split('?')[0].replace(/[-_](\d+x\d+|\d+)(?=\.[a-z]+$)/i, '')}`; if (seen.has(key)) return false; seen.add(key); return true; }); }
  list.sort((a,b) => sortBy === 'smallest' ? (a.size || Infinity) - (b.size || Infinity) : sortBy === 'newest' ? (a.index||0) - (b.index||0) : sortBy === 'name' ? a.url.localeCompare(b.url) : (b.size || b.width*b.height) - (a.size || a.width*a.height));
  const viewerId = viewerIndex >= 0 ? filtered[viewerIndex]?.id : null; filtered = list;
  page=Math.max(page,Math.ceil(filtered.length/perPage)||1);
  if (viewerId) viewerIndex = filtered.findIndex(x=>x.id===viewerId);
  $('#galleryTitle').innerHTML = `${activeType === 'all' ? 'All media' : activeType === 'image' ? 'Images' : activeType === 'video' ? 'Videos' : activeType==='files'?'Mosaic library':'Favorites'} <span id="visibleCount">${filtered.length}</span>`;
  $('#gallerySubtitle').textContent = filtered.length ? (activeType === 'favorites' ? 'Your saved favorites.' : activeType==='files'?'Stored in your Mosaic library on this device.':'A little visual inspiration from this page.') : 'Nothing matches your current filters.';
  // Keep existing cards mounted when only media was appended. Rebuild only when
  // membership/order changed because a user adjusted a filter or sort.
  const currentIds=[...$('#gallery').children].map(x=>x.dataset.id);
  const targetIds=filtered.slice(0,Math.max(page*perPage,perPage)).map(x=>x.id);
  if (!currentIds.length || currentIds.some((id,i)=>id!==targetIds[i]) || currentIds.length>targetIds.length) renderCards();
  else if(targetIds.length>currentIds.length) renderCards(true);
}
function renderCards(append = false) {
  const gallery=$('#gallery'),existing=new Map([...gallery.children].map(card=>[card.dataset.id,card]));
  const desired=filtered.slice(0,page*perPage),desiredIds=new Set(desired.map(item=>item.id));
  for(const [id,node] of existing)if(!desiredIds.has(id)){node.remove();existing.delete(id);}
  $('#gallery').classList.toggle('masonry', viewMode === 'masonry');
  const items = filtered.slice(append ? gallery.children.length : 0, page*perPage);
  for (const item of items) {
    const cached=existing.get(item.id);if(cached){gallery.append(cached);continue;}
    const card = document.createElement('article'); card.className = 'media-card'; card.dataset.id = item.id;
    if(item.savedFile)card.classList.add('saved-library-card');
    const mediaWrap = document.createElement('div'); mediaWrap.className = `media-thumb ${item.width && item.height ? (item.width/item.height > 1.12 ? 'landscape' : item.width/item.height < .88 ? 'portrait' : 'square') : ''}`;
    if (item.width && item.height) mediaWrap.style.setProperty('--ratio', `${item.width}/${item.height}`);
    if (item.type === 'video'&&item.savedFile) {mediaWrap.classList.add('saved-video-thumb');if(item.downloadId){if(item.poster){const poster=document.createElement('img');poster.className='saved-video-poster';poster.src=item.poster;poster.alt=item.alt||'Saved video';poster.loading='lazy';mediaWrap.append(poster);}else{const placeholder=document.createElement('div');placeholder.className='video-placeholder';placeholder.innerHTML='<span>▶</span><small>SAVED VIDEO</small>';mediaWrap.append(placeholder);}}else{const video=document.createElement('video');video.className='saved-card-video';video.poster=item.poster||'';video.controls=false;video.preload='metadata';video.playsInline=true;video.muted=true;mediaWrap.append(video);getSavedObjectUrl(item).then(url=>{if(url&&video.isConnected)video.src=url;});}const badge=document.createElement('span');badge.className='play-badge';badge.textContent='▶';mediaWrap.append(badge); }
    else if (item.type === 'video') { const poster = item.poster || item.thumbnail || item.previewImage; if(poster){const img=document.createElement('img');img.src=poster;img.alt=item.alt;img.loading='lazy';img.decoding='async';mediaWrap.append(img);}else{const placeholder=document.createElement('div');placeholder.className='video-placeholder';placeholder.innerHTML='<span>▶</span><small>VIDEO</small>';mediaWrap.append(placeholder);} const play = document.createElement('span'); play.className='play-badge'; play.textContent='▶'; mediaWrap.append(play); }
    else { const img = document.createElement('img'); img.alt = item.alt; img.loading='lazy'; img.decoding='async';if(item.savedFile)getSavedObjectUrl(item).then(url=>{if(url&&img.isConnected)img.src=url;});else img.src=item.previewUrl||item.url;img.addEventListener('load',()=>{const changed=item.width!==img.naturalWidth||item.height!==img.naturalHeight;item.width=img.naturalWidth;item.height=img.naturalHeight;item.unavailable=false;if(changed){mediaWrap.style.setProperty('--ratio',`${item.width}/${item.height}`);if($('#hideSmall').checked&&(item.width<120||item.height<120))filterAndRender();}}); img.addEventListener('error', () => {if(!item.savedFile&&item.previewUrl&&img.src!==item.url){img.src=item.url;item.previewUrl=item.url;return;}item.unavailable=true;img.classList.add('broken');img.alt='Preview unavailable';updateCounts();filterAndRender(); }); mediaWrap.append(img); }
    const hover = document.createElement('div'); hover.className='card-hover'; hover.innerHTML='<span class="open-hint">↗ &nbsp; Preview</span>'; mediaWrap.append(hover);
    if(!item.savedFile){const fav = document.createElement('button'); fav.className=`favorite-button ${favorites.has(item.id)?'favorited':''}`; fav.title='Save favorite'; fav.textContent=favorites.has(item.id)?'♥':'♡'; fav.addEventListener('click', e => { e.stopPropagation(); toggleFavorite(item.id); fav.classList.toggle('favorited'); fav.textContent=fav.classList.contains('favorited')?'♥':'♡'; }); mediaWrap.append(fav);}
    mediaWrap.addEventListener('click', () => openViewer(filtered.indexOf(item)));
    const info = document.createElement('div'); info.className='card-info'; const name = document.createElement('span'); name.className='card-name'; name.title=item.fileName||item.alt||filename(item.url); name.textContent=item.fileName||item.alt||filename(item.url); const meta=document.createElement('span'); meta.className='card-meta'; if(item.savedFile){const details=[item.type==='video'?'VIDEO':'IMAGE',item.site?.toUpperCase(),item.savedAt?new Date(item.savedAt).toLocaleDateString():'',prefs.sizes&&item.size?formatSize(item.size):''].filter(Boolean);meta.textContent=details.join(' · ');}else{meta.textContent=`${item.type==='video'?'VIDEO':'IMAGE'}${prefs.dimensions&&item.width&&item.height?` · ${item.width} × ${item.height}`:''}${prefs.sizes&&item.size?` · ${formatSize(item.size)}`:''}`;} info.append(name,meta);
    if(item.downloadId&&item.type==='video'){const playSaved=document.createElement('button');playSaved.className='card-more saved-play';playSaved.textContent='▶';playSaved.title='Open saved video';playSaved.setAttribute('aria-label','Open saved video');playSaved.addEventListener('click',e=>{e.stopPropagation();chrome.downloads.open(item.downloadId);});info.append(playSaved);}
    if(item.downloadId){const reveal=document.createElement('button');reveal.className='card-more saved-reveal';reveal.textContent='▣';reveal.title='Show in Finder';reveal.setAttribute('aria-label','Show downloaded file in Finder');reveal.addEventListener('click',e=>{e.stopPropagation();chrome.downloads.show(item.downloadId);});info.append(reveal);}
    const more=document.createElement('button'); more.className='card-more'; more.textContent='···'; more.title='More actions'; more.addEventListener('click', e=>{e.stopPropagation();showCardActions(item,more);}); info.append(more); card.append(mediaWrap,info); $('#gallery').append(card);
  }
  const remain = filtered.length - page*perPage; $('#loadMoreWrap').classList.toggle('hidden', remain <= 0); $('#loadMoreLabel').textContent = remain > 0 ? `${remain} more` : '';
  $('#loadingState').classList.add('hidden'); $('#emptyState').classList.toggle('hidden', filtered.length !== 0);
  if(!filtered.length&&media.some(x=>!x.unavailable)){$('#emptyState h3').textContent='No media matches these filters';$('#emptyState p').textContent='Clear the search or filters to see everything found on this page.';$('#rescanEmpty').textContent='Clear filters';$('#rescanEmpty').onclick=()=>{$('#clearFilters').click();};}
  else{$('#emptyState h3').textContent='No media found here';$('#emptyState p').textContent='Try another filter or scan this page again.';$('#rescanEmpty').textContent='↻  Scan page';$('#rescanEmpty').onclick=scanPage;}
}
function filename(url) { try { return decodeURIComponent(new URL(url).pathname.split('/').pop()) || new URL(url).hostname; } catch { return 'Media item'; } }
function formatSize(n) { return n > 1024*1024 ? `${(n/1024/1024).toFixed(1)} MB` : `${Math.max(1,Math.round(n/1024))} KB`; }
function openLibrary(){return new Promise((resolve,reject)=>{const request=indexedDB.open('mosaic-media-library',2);request.onupgradeneeded=()=>{const db=request.result;if(!db.objectStoreNames.contains('files'))db.createObjectStore('files',{keyPath:'id'});if(!db.objectStoreNames.contains('settings'))db.createObjectStore('settings',{keyPath:'id'});};request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});}
async function libraryRequest(mode,action,storeName='files'){const db=await openLibrary();return new Promise((resolve,reject)=>{const tx=db.transaction(storeName,mode),store=tx.objectStore(storeName);let req;try{req=action(store);}catch(error){db.close();reject(error);return;}tx.oncomplete=()=>{db.close();resolve(req?.result);};tx.onerror=()=>{db.close();reject(tx.error||req?.error);};tx.onabort=()=>{db.close();reject(tx.error||new Error('Library storage failed'));};});}
async function getSavedObjectUrl(item){const id=item.libraryId||item.id;if(savedObjectUrls.has(id))return savedObjectUrls.get(id);const record=await libraryRequest('readonly',store=>store.get(id));if(item.downloadId)return item.sourceUrl||item.url||'';const blob=record?.fileHandle?await record.fileHandle.getFile():record?.blob;if(!blob)return'';const url=URL.createObjectURL(blob);savedObjectUrls.set(id,url);return url;}
async function getLibraryFolder(){const setting=await libraryRequest('readonly',store=>store.get('export-directory'),'settings');let directory=setting?.handle;if(!directory){if(!window.showDirectoryPicker)throw new Error('Folder access is unavailable');directory=await window.showDirectoryPicker({id:'mosaic-library',mode:'readwrite'});await libraryRequest('readwrite',store=>store.put({id:'export-directory',handle:directory}),'settings');}let permission=await directory.queryPermission({mode:'readwrite'});if(permission!=='granted')permission=await directory.requestPermission({mode:'readwrite'});if(permission!=='granted')throw new Error('Folder access was not granted');return directory;}
async function writeLibraryFile(directory,item,blob,overwrite=false){const sourceName=filename(item.sourceUrl||item.url),fallbackExt=item.type==='video'?'.mp4':'.jpg',base=(item.alt||sourceName||`mosaic-${Date.now()}`).replace(/[<>:"/\\|?*\x00-\x1f]/g,'_').replace(/\.[^.]+$/,'').trim()||`mosaic-${Date.now()}`,extension=(sourceName.match(/\.(mp4|webm|mov|m4v|ogv|jpe?g|png|gif|webp|avif)$/i)||[])[0]||fallbackExt;let name=`${base}${extension}`;if(!overwrite){let suffix=2;while(await directory.getFileHandle(name).then(()=>true).catch(()=>false))name=`${base} (${suffix++})${extension}`;}const fileHandle=await directory.getFileHandle(name,{create:true}),writable=await fileHandle.createWritable();await writable.write(blob);await writable.close();return{fileHandle,name};}
async function moveLegacyCopyToFolder(item){try{const id=item.libraryId||item.id,record=await libraryRequest('readonly',store=>store.get(id));if(!record?.blob)return;const directory=await getLibraryFolder(),{fileHandle,name}=await writeLibraryFile(directory,item,record.blob,true),{blob,...metadata}=record,updated={...metadata,fileHandle,storageMode:'file',fileName:name};await libraryRequest('readwrite',store=>store.put(updated));item.storageMode='file';item.fileName=name;savedFiles=savedFiles.map(file=>file.id===id?{...file,storageMode:'file',fileName:name}:file);await chrome.storage.local.set({mosaicSavedFiles:savedFiles});const url=savedObjectUrls.get(id);if(url)URL.revokeObjectURL(url);savedObjectUrls.delete(id);filterAndRender();toast('Moved to your chosen folder; the Mosaic copy was removed.');}catch(error){toast(error?.name==='AbortError'?'Move cancelled.':'Could not move this video to your chosen folder.');}}
async function refreshSavedFiles(){try{const data=await chrome.storage.local.get('mosaicSavedFiles'),records=data.mosaicSavedFiles||[],valid=[];for(const record of records){if(!record?.id)continue;if(record.downloadId){try{const [download]=await chrome.downloads.search({id:record.downloadId});if(download){record.fileName=download.filename?.split(/[\\/]/).pop()||record.fileName;record.downloadState=download.state;record.downloadError=download.error||'';valid.push(record);}else valid.push({...record,downloadState:'missing'});}catch{valid.push(record);}continue;}const stored=await libraryRequest('readonly',store=>store.get(record.id));if(stored?.blob||stored?.fileHandle)valid.push({...record,storageMode:stored.fileHandle?'file':'library',fileName:stored.fileName||record.fileName||''});}savedFiles=valid;await chrome.storage.local.set({mosaicSavedFiles:savedFiles});const count=$('#countSaved');if(count)count.textContent=valid.length;if(activeType==='files')filterAndRender();}catch{savedFiles=[];}}
async function toggleFavorite(id) {const item=media.find(x=>x.id===id)||savedMedia.get(id);if(favorites.has(id)){favorites.delete(id);savedMedia.delete(id);}else{favorites.add(id);if(item)savedMedia.set(id,{...item});}await persistSavedMedia();updateCounts();if(activeType==='favorites')filterAndRender();}
async function downloadItem(item) {
  try {
    const sourceUrl=item.sourceUrl||item.source||item.url;
    if(!sourceUrl||/^(blob|data):/i.test(sourceUrl)){toast('This media has no downloadable file URL.');return;}
    if(item.type==='video'&&item.playbackPage&&sourceUrl===item.playbackPage){toast('This post does not expose a video file to save.');return;}
    const existing=savedFiles.find(file=>file.sourceUrl===sourceUrl);
    if(existing){item.libraryId=existing.id;item.saved=true;const button=$('#viewerDownload');if(button){button.textContent='✓ Saved';button.disabled=true;}toast('Already saved in your Mosaic library.');return;}
    const sourceName=filename(sourceUrl),fallback=item.type==='video'?'video.mp4':'image.jpg';let name=(sourceName||fallback).replace(/[<>:"/\\|?*\x00-\x1f]/g,'_').trim()||fallback;if(!/\.(mp4|webm|mov|m4v|ogv|jpe?g|png|gif|webp|avif)$/i.test(name))name+=item.type==='video'?'.mp4':'.jpg';
    const downloadId=await chrome.downloads.download({url:sourceUrl,filename:`Mosaic/${name}`,conflictAction:'uniquify',saveAs:false});
    const id=crypto.randomUUID(),entry={id,downloadId,sourceUrl,type:item.type==='video'?'video':'image',alt:item.alt||name,fileName:name,pageTitle:item.pageTitle||'',site:item.site||'',pageUrl:item.pageUrl||'',postUrl:item.postUrl||'',poster:item.poster||'',width:item.width||0,height:item.height||0,size:item.size||0,savedAt:Date.now(),mime:item.mime||'',storageMode:'download',downloadState:'in_progress'};
    savedFiles=[entry,...savedFiles];item.libraryId=id;item.saved=true;item.downloadId=downloadId;item.fileName=name;await chrome.storage.local.set({mosaicSavedFiles:savedFiles});updateCounts();if(activeType==='files')filterAndRender();const button=$('#viewerDownload');if(button){button.textContent='✓ Saved';button.disabled=true;}toast(`Saving ${name} to Downloads / Mosaic…`);
  }catch(error){toast(error?.message||'Could not save this media to Downloads / Mosaic.');}
}
async function removeSavedFile(item){try{const id=item.libraryId||item.id;if(filtered[viewerIndex]?.id===item.id&&(item.savedFile||item.saved))closeViewer();await libraryRequest('readwrite',store=>store.delete(id));const url=savedObjectUrls.get(id);if(url)URL.revokeObjectURL(url);savedObjectUrls.delete(id);savedFiles=savedFiles.filter(file=>file.id!==id);item.saved=false;delete item.libraryId;await chrome.storage.local.set({mosaicSavedFiles:savedFiles});updateCounts();filterAndRender();}catch{toast('Could not remove this saved item.');}}
async function clearLibrary(){try{if(filtered[viewerIndex]?.savedFile)closeViewer();await libraryRequest('readwrite',store=>store.clear());for(const url of savedObjectUrls.values())URL.revokeObjectURL(url);savedObjectUrls.clear();savedFiles=[];await chrome.storage.local.set({mosaicSavedFiles:[]});updateCounts();if(activeType==='files')filterAndRender();toast('Mosaic library cleared.');}catch{toast('Could not clear the Mosaic library.');}}
function showCardActions(item, anchor){
  document.querySelector('.card-action-menu')?.remove();const menu=document.createElement('div');menu.className='card-action-menu';
  const add=(label,fn)=>{const b=document.createElement('button');b.textContent=label;b.onclick=()=>{menu.remove();fn();};menu.append(b);};
  add('Open media',()=>openViewer(filtered.indexOf(item)));if(item.savedFile||item.saved){if(item.downloadId){add('Show in Finder',()=>chrome.downloads.show(item.downloadId));add('Open downloaded file',()=>chrome.downloads.open(item.downloadId));}if(item.storageMode==='library')add('Move to Finder folder and free Mosaic space',()=>moveLegacyCopyToFolder(item));add('Remove from Mosaic library',()=>removeSavedFile(item));}else add('Save to Mosaic library',()=>downloadItem(item));
  if(item.type==='image'){const url=item.sourceUrl||item.source||item.url;add('Reverse image search',()=>openReverseSearch('lens',url));}
  if(item.postUrl)add(item.site==='x'?'Open X post':'Open Reddit discussion',()=>window.open(item.postUrl,'_blank','noopener'));
  else if(item.pageUrl&&item.pageUrl!==item.url)add('Open source page',()=>window.open(item.pageUrl,'_blank','noopener'));
  const rect=anchor.getBoundingClientRect();menu.style.position='fixed';menu.style.left=`${Math.min(rect.right-150,window.innerWidth-160)}px`;menu.style.top=`${Math.min(rect.bottom+4,window.innerHeight-140)}px`;document.body.append(menu);
  setTimeout(()=>document.addEventListener('click',function close(e){if(!menu.contains(e.target)){menu.remove();document.removeEventListener('click',close);}}),0);
}
async function openViewer(index) { if (index < 0) return; viewerIndex=index;const item=filtered[index];if(item?.savedFile){const url=await getSavedObjectUrl(item);if(!url){toast('This item is missing from your Mosaic library.');return;}item.url=url;}showViewer(); $('#viewerBackdrop').classList.remove('hidden'); document.body.classList.add('modal-open'); }
function openSourceInViewer(url){$('#viewerMedia').innerHTML='';const frame=document.createElement('iframe');frame.src=url;frame.allow=(prefs.autoplay?'autoplay; ':'')+'fullscreen; picture-in-picture; encrypted-media';frame.allowFullscreen=true;frame.referrerPolicy='no-referrer-when-downgrade';frame.title='Media source page';$('#viewerMedia').append(frame);$('#viewerBackdrop').classList.remove('hidden');document.body.classList.add('modal-open');$('#viewerInfo').innerHTML=`<span>Source page</span><small>Opened inside Mosaic viewer</small><button id="viewerSourceBack">← &nbsp; Back to media</button>`;$('#viewerSourceBack').onclick=()=>{if(viewerIndex>=0)showViewer();};}
function openReverseSearch(engine,url){if(!url)return;const encoded=encodeURIComponent(url);const targets={lens:`https://lens.google.com/uploadbyurl?url=${encoded}`,bing:`https://www.bing.com/images/searchbyimage?cbir=sbi&imgurl=${encoded}`,tineye:`https://tineye.com/search?url=${encoded}`};window.open(targets[engine]||targets.lens,'_blank','noopener');}
function copyText(value){if(!value)return; navigator.clipboard?.writeText(value).then(()=>toast('Copied to clipboard.')).catch(()=>toast('Clipboard access is unavailable.'));}
function showViewerActions(item,anchor){document.querySelector('.viewer-action-menu')?.remove();const menu=document.createElement('div');menu.className='card-action-menu viewer-action-menu';const add=(label,fn)=>{const button=document.createElement('button');button.textContent=label;button.onclick=()=>{menu.remove();fn();};menu.append(button);};const url=item.sourceUrl||item.source||item.url;if(item.type==='image'){add('Search with Google Lens',()=>openReverseSearch('lens',url));add('Search with Bing Visual Search',()=>openReverseSearch('bing',url));add('Search with TinEye',()=>openReverseSearch('tineye',url));}add('Copy media address',()=>copyText(item.sourceUrl||item.source||item.url));if(item.postUrl){add(item.site==='x'?'Open X post':'Open Reddit discussion',()=>window.open(item.postUrl,'_blank','noopener'));add('Copy post link',()=>copyText(item.postUrl));}else if(item.pageUrl)add('Open source page',()=>window.open(item.pageUrl,'_blank','noopener'));if(item.savedFile||item.saved){if(item.downloadId){add('Show in Finder',()=>chrome.downloads.show(item.downloadId));add('Open downloaded file',()=>chrome.downloads.open(item.downloadId));}if(item.storageMode==='library')add('Move to Finder folder and free Mosaic space',()=>moveLegacyCopyToFolder(item));add('Remove from Mosaic library',()=>removeSavedFile(item));}const rect=anchor.getBoundingClientRect();menu.style.position='fixed';menu.style.left=`${Math.min(rect.right-230,window.innerWidth-238)}px`;document.body.append(menu);menu.style.top=`${Math.max(8,rect.top-menu.offsetHeight-8)}px`;setTimeout(()=>document.addEventListener('click',function close(e){if(!menu.contains(e.target)&&e.target!==anchor){menu.remove();document.removeEventListener('click',close);}}),0);}
function showViewer() {
  const item=filtered[viewerIndex];if(!item)return;document.querySelector('.viewer-action-menu')?.remove();$('#viewerMedia').classList.remove('zoom-fill','video-view');$('#viewerMedia').innerHTML='';
  if(item.type==='video'&&item.playbackPage&&item.site!=='x'){
    const frame=document.createElement('iframe');frame.src=item.playbackPage;frame.allow=(prefs.autoplay?'autoplay; ':'')+'fullscreen; picture-in-picture; encrypted-media';frame.allowFullscreen=true;frame.referrerPolicy='no-referrer-when-downgrade';frame.title='Video player from source page';$('#viewerMedia').append(frame);
  }else if(item.type==='video'&&item.site==='x'&&item.playbackPage){
    const fallback=document.createElement('div');fallback.className='x-video-fallback';
    if(item.poster){const poster=document.createElement('img');poster.src=item.poster;poster.alt=item.alt||'X video preview';fallback.append(poster);}
    const note=document.createElement('p');note.textContent='Could not retrieve a playable MP4 for this post.';const open=document.createElement('button');open.className='site-action';open.textContent='Play on X';open.onclick=()=>window.open(item.postUrl||item.pageUrl,'_blank','noopener');fallback.append(note,open);$('#viewerMedia').append(fallback);
  }else{
    const el=document.createElement(item.type==='video'?'video':'img');
    let controls=null,videoStage=null,applyVideoSizing=null,videoFitMode='fit';
    if(item.type==='video'){videoStage=document.createElement('div');videoStage.className='viewer-video-stage';applyVideoSizing=()=>{const box=videoStage.getBoundingClientRect(),vw=el.videoWidth,vh=el.videoHeight;if(!box.width||!box.height)return;if(videoFitMode==='fit'&&vw&&vh){const scale=Math.min(box.width/vw,box.height/vh);el.style.width=`${vw*scale}px`;el.style.height=`${vh*scale}px`;el.style.objectFit='contain';}else{el.style.width=`${box.width}px`;el.style.height=`${box.height}px`;el.style.objectFit=videoFitMode==='fill'?'cover':'contain';}};const sources=[...new Set([item.url,...(item.fallbackUrls||[])].filter(Boolean))];let sourceIndex=0;el.controls=false;el.autoplay=!!prefs.autoplay;el.playsInline=true;el.preload='auto';el.disableRemotePlayback=true;el.referrerPolicy='no-referrer';el.addEventListener('error',()=>{if(sourceIndex+1<sources.length){sourceIndex++;el.src=sources[sourceIndex];el.load();el.play().catch(()=>{});}else if(item.site==='reddit'&&item.playbackPage){$('#viewerMedia').innerHTML='';openSourceInViewer(item.playbackPage);}else if(item.site==='x'){toast('This X video could not be loaded. Use Play on X to open its post.');}else toast('This video source is unavailable or blocked.');});el.addEventListener('loadedmetadata',()=>{applyVideoSizing();if(!item.width||!item.height){item.width=el.videoWidth||item.width;item.height=el.videoHeight||item.height;$('#viewerInfo small').textContent=`${item.width||'—'} × ${item.height||'—'}${item.size?` · ${formatSize(item.size)}`:''}`;}const seek=controls?.querySelector('input[type=range]');if(seek)seek.max=String(Math.floor(el.duration*10)||0);});el.src=sources[0]||item.url;}
    else{el.style.width='auto';el.style.height='auto';el.src=item.url;}
    if(item.type!=='video'){el.alt=item.alt;el.addEventListener('error',()=>{if(item.previewUrl&&el.src!==item.previewUrl)el.src=item.previewUrl;});}
    if(item.type==='video'){videoStage.append(el);$('#viewerMedia').classList.add('video-view');$('#viewerMedia').append(videoStage);new ResizeObserver(()=>applyVideoSizing()).observe(videoStage);requestAnimationFrame(applyVideoSizing);}else $('#viewerMedia').append(el);
    if(item.type==='video'){controls=document.createElement('div');controls.className='viewer-controls';const toggle=document.createElement('button');toggle.className='viewer-play';toggle.type='button';toggle.setAttribute('aria-label','Pause video');toggle.textContent='Ⅱ';const zoom=document.createElement('button');zoom.className='viewer-zoom';zoom.type='button';zoom.textContent='Fill';zoom.title='Fill the viewer with video';zoom.onclick=()=>{videoFitMode=videoFitMode==='fit'?'fill':'fit';applyVideoSizing();zoom.textContent=videoFitMode==='fill'?'Fit':'Fill';zoom.title=videoFitMode==='fill'?'Fit the full video in the viewer':'Fill the viewer with video';};const seek=document.createElement('input');seek.type='range';seek.min='0';seek.max='0';seek.value='0';seek.setAttribute('aria-label','Video position');const clock=document.createElement('span');clock.className='viewer-clock';clock.textContent='0:00 / 0:00';const update=()=>{toggle.textContent=el.paused?'▶':'Ⅱ';toggle.setAttribute('aria-label',el.paused?'Play video':'Pause video');if(Number(seek.max)>0)seek.value=String(Math.floor((el.currentTime||0)*10));clock.textContent=`${formatVideoTime(el.currentTime)} / ${formatVideoTime(el.duration)}`;};toggle.onclick=()=>{if(el.paused)el.play().catch(()=>{});else el.pause();};seek.addEventListener('input',()=>{if(Number(seek.max)>0)el.currentTime=Number(seek.value)/10;});el.addEventListener('timeupdate',update);el.addEventListener('play',update);el.addEventListener('pause',update);el.addEventListener('loadedmetadata',()=>{if(Number.isFinite(el.duration))seek.max=String(Math.floor(el.duration*10));update();});controls.append(toggle,zoom,seek,clock);$('#viewerMedia').append(controls);requestAnimationFrame(applyVideoSizing);if(Number.isFinite(el.duration))seek.max=String(Math.floor(el.duration*10));update();}
  }
  $('#viewerInfo').innerHTML=`<span>${escapeHtml(item.alt||filename(item.url))}</span><small>${item.width||'—'} × ${item.height||'—'}${item.size?` · ${formatSize(item.size)}`:''}</small><button id="viewerDownload" ${item.savedFile||item.saved?'disabled title="Stored in your Mosaic library"':''}>${item.savedFile||item.saved?'✓ Saved':'＋ Save file'}</button><button id="viewerMore" aria-label="More media actions" title="More media actions">···</button>`;
  $('#viewerDownload').onclick=()=>downloadItem(item);$('#viewerMore').onclick=e=>{e.stopPropagation();showViewerActions(item,e.currentTarget);};
}
function formatVideoTime(value){if(!Number.isFinite(value))return'0:00';const seconds=Math.floor(value);return`${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;}
function escapeHtml(v){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function closeViewer() { $('#viewerBackdrop').classList.add('hidden'); document.body.classList.remove('modal-open'); $('#viewerMedia').innerHTML=''; viewerIndex=-1; }
async function navigateViewer(dir){if(!filtered.length)return;viewerIndex=(viewerIndex+dir+filtered.length)%filtered.length;const item=filtered[viewerIndex];if(item?.savedFile){const url=await getSavedObjectUrl(item);if(!url){toast('This item is missing from your Mosaic library.');return;}item.url=url;}showViewer();}
function toast(msg){const t=$('#toast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2600);}
async function savePrefs(){await chrome.storage.local.set({mosaicPrefs:prefs});applyPrefs();}
function saveGalleryState(){chrome.storage.local.set({mosaicGalleryState:{activeType,siteFilter,sortBy,minKb,orientation,viewMode,search,filtersOpen:!$('#filterPanel').classList.contains('hidden')}});}
function bindEvents(){
  setInterval(checkGalleryFill,900);
  chrome.downloads.onChanged.addListener(delta=>{const item=savedFiles.find(file=>file.downloadId===delta.id);if(!item)return;if(delta.state)item.downloadState=delta.state.current;if(delta.error)item.downloadError=delta.error.current;if(delta.filename)item.fileName=delta.filename.current.split(/[\\/]/).pop();chrome.storage.local.set({mosaicSavedFiles:savedFiles});if(activeType==='files')filterAndRender();});
  const galleryScroller=$('.app-shell');galleryScroller?.addEventListener('scroll',()=>{sourceAdvancePaused=false;checkGalleryFill();},{passive:true});
  $$('.tab').forEach(b=>b.onclick=()=>{$$('.tab').forEach(x=>x.classList.remove('active'));b.classList.add('active');activeType=b.dataset.type;siteFilter='';saveGalleryState();filterAndRender();setTimeout(checkGalleryFill,0);});
  $('#searchInput').addEventListener('input',e=>{search=e.target.value;saveGalleryState();filterAndRender();});
  $('#filterToggle').onclick=()=>{$('#filterPanel').classList.toggle('hidden');saveGalleryState();};
  $$('.size-chip').forEach(b=>b.onclick=()=>{$$('.size-chip').forEach(x=>x.classList.remove('active'));b.classList.add('active');minKb=Number(b.dataset.size);saveGalleryState();filterAndRender();});
  $$('.orientation-chip').forEach(b=>b.onclick=()=>{$$('.orientation-chip').forEach(x=>x.classList.remove('active'));b.classList.add('active');orientation=b.dataset.orientation;saveGalleryState();filterAndRender();});
  $('#hideSmall').onchange=()=>{chrome.storage.local.set({mosaicHideSmall:$('#hideSmall').checked});filterAndRender();};$('#hideDuplicates').onchange=()=>{chrome.storage.local.set({mosaicHideDuplicates:$('#hideDuplicates').checked});filterAndRender();};
  $('#clearFilters').onclick=()=>{activeType='all';siteFilter='';$$('.tab').forEach(x=>x.classList.toggle('active',x.dataset.type==='all'));minKb=0;orientation='any';search='';$('#searchInput').value='';$('#hideSmall').checked=false;$('#hideDuplicates').checked=false;chrome.storage.local.set({mosaicHideSmall:false,mosaicHideDuplicates:false});$$('.size-chip,.orientation-chip').forEach(x=>x.classList.remove('active'));$('.size-chip').classList.add('active');$('.orientation-chip').classList.add('active');saveGalleryState();filterAndRender();};
  $('#sortButton').onclick=()=>$('#sortMenu').classList.toggle('hidden');$$('#sortMenu button').forEach(b=>b.onclick=()=>{sortBy=b.dataset.sort;$('#sortLabel').textContent=b.textContent;$('#sortMenu').classList.add('hidden');saveGalleryState();filterAndRender();});
  document.addEventListener('click',e=>{if(!e.target.closest('.sort-wrap'))$('#sortMenu').classList.add('hidden');});
  $$('.view-button').forEach(b=>b.onclick=()=>{$$('.view-button').forEach(x=>x.classList.remove('active'));b.classList.add('active');viewMode=b.dataset.view;saveGalleryState();renderCards();});
  $('#loadMore').onclick=()=>{page++;renderCards(true);};
  $('#rescanButton').onclick=()=>{closeDrawer();scanPage();};$('#rescanEmpty').onclick=scanPage;
  $('#settingsOpen').onclick=openDrawer;$('#settingsClose').onclick=closeDrawer;$('#drawerBackdrop').onclick=closeDrawer;$('#privacyLink').onclick=openDrawer;
  $('#overlayClose').onclick=()=>chrome.runtime.sendMessage({type:'mosaic-close-overlay',tabId});
  $('#settingDimensions').onchange=e=>{prefs.dimensions=e.target.checked;savePrefs();renderCards();};$('#settingSizes').onchange=e=>{prefs.sizes=e.target.checked;savePrefs();renderCards();};$('#settingNewTab').onchange=e=>{prefs.newTab=e.target.checked;savePrefs();};
  $('#settingBackgrounds').onchange=e=>{prefs.backgrounds=e.target.checked;savePrefs();scanPage();};$('#settingAutoplay').onchange=e=>{prefs.autoplay=e.target.checked;savePrefs();};$('#settingDensity').onchange=e=>{prefs.density=e.target.value;savePrefs();};$('#settingColumns').onchange=e=>{prefs.columns=e.target.value;savePrefs();};$('#settingTheme').onchange=e=>{prefs.theme=e.target.value;savePrefs();};
  $('#clearFavorites').onclick=async()=>{favorites.clear();savedMedia.clear();await persistSavedMedia();updateCounts();if(activeType==='favorites')filterAndRender();else renderCards();toast('Favorites cleared');};$('#clearLibrary').onclick=clearLibrary;
  $('#viewerClose').onclick=closeViewer;$('#viewerBackdrop').onclick=e=>{if(e.target===$('#viewerBackdrop')||e.target===$('.viewer-modal')||e.target===$('#viewerMedia')||e.target===$('#viewerInfo')||e.target.classList?.contains('viewer-video-stage'))closeViewer();};$('#viewerMedia').addEventListener('click',e=>{const video=e.target.closest?.('video');if(!video)return;const w=video.videoWidth,h=video.videoHeight;if(!w||!h)return;const r=video.getBoundingClientRect(),scale=Math.min(r.width/w,r.height/h),shownW=w*scale,shownH=h*scale,left=r.left+(r.width-shownW)/2,top=r.top+(r.height-shownH)/2;if(e.clientX<left||e.clientX>left+shownW||e.clientY<top||e.clientY>top+shownH)closeViewer();});$('#viewerPrev').onclick=()=>navigateViewer(-1);$('#viewerNext').onclick=()=>navigateViewer(1);
  $('#themeToggle').onclick=()=>{prefs.theme=document.documentElement.dataset.theme==='amoled'?'light':document.documentElement.dataset.theme==='dark'?'amoled':'dark';$('#settingTheme').value=prefs.theme;savePrefs();};
  document.addEventListener('keydown',e=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();$('#searchInput').focus();}if(e.key==='Escape'){closeViewer();closeDrawer();}if(!$('#viewerBackdrop').classList.contains('hidden')){if(e.key==='ArrowRight')navigateViewer(1);if(e.key==='ArrowLeft')navigateViewer(-1);}});
}
function openDrawer(){$('#settingsDrawer').classList.add('open');$('#drawerBackdrop').classList.remove('hidden');$('#settingsDrawer').setAttribute('aria-hidden','false');}
function closeDrawer(){$('#settingsDrawer').classList.remove('open');$('#drawerBackdrop').classList.add('hidden');$('#settingsDrawer').setAttribute('aria-hidden','true');}
init();
