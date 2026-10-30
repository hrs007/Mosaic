import { filename, canonicalMediaId } from '../utils/mediaHelpers.js';

const savedObjectUrls = new Map();

export function openLibrary() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('mosaic-media-library', 2);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('files')) db.createObjectStore('files', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings', { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function libraryRequest(mode, action, storeName = 'files') {
  const db = await openLibrary();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    let req;
    try {
      req = action(store);
    } catch (error) {
      db.close();
      reject(error);
      return;
    }
    tx.oncomplete = () => {
      db.close();
      resolve(req?.result);
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error || req?.error);
    };
    tx.onabort = () => {
      db.close();
      reject(tx.error || new Error('Library storage failed'));
    };
  });
}

export async function getSavedObjectUrl(item) {
  if (!item) return '';
  if (item.downloadId) return item.sourceUrl || item.url || '';
  const id = item.libraryId || item.id;
  if (savedObjectUrls.has(id)) return savedObjectUrls.get(id);
  try {
    const record = await libraryRequest('readonly', store => store.get(id));
    const blob = record?.fileHandle ? await record.fileHandle.getFile() : record?.blob;
    if (blob) {
      const url = URL.createObjectURL(blob);
      savedObjectUrls.set(id, url);
      return url;
    }
  } catch {}
  return item.sourceUrl || item.url || '';
}

export async function refreshSavedFiles() {
  try {
    const data = await chrome.storage.local.get('mosaicSavedFiles');
    const records = data.mosaicSavedFiles || [];
    const valid = [];
    const existingDownloadIds = new Set();

    for (const record of records) {
      if (!record?.id) continue;
      if (record.downloadId) {
        existingDownloadIds.add(record.downloadId);
        try {
          const [download] = await chrome.downloads.search({ id: record.downloadId });
          if (download && download.state !== 'interrupted') {
            record.fileName = download.filename?.split(/[\\/]/).pop() || record.fileName;
            record.downloadState = download.state;
            record.downloadError = download.error || '';
            if (!record.size && download.fileSize) record.size = download.fileSize;
            valid.push(record);
          } else if (download) {
            valid.push(record);
          }
        } catch {
          valid.push(record);
        }
        continue;
      }
      const stored = await libraryRequest('readonly', store => store.get(record.id));
      if (stored?.blob || stored?.fileHandle) {
        valid.push({
          ...record,
          storageMode: stored.fileHandle ? 'file' : 'library',
          fileName: stored.fileName || record.fileName || ''
        });
      }
    }

    // Recover files in Downloads/Mosaic from browser downloads history across extension re-installs
    try {
      const mosaicDownloads = await chrome.downloads.search({ query: ['Mosaic'], orderBy: ['-startTime'], limit: 100 });
      for (const d of (mosaicDownloads || [])) {
        if (!d || !d.filename || !d.filename.includes('Mosaic') || d.state === 'interrupted' || existingDownloadIds.has(d.id)) continue;
        const fname = d.filename.split(/[\\/]/).pop() || '';
        const isVid = /\.(mp4|webm|mov|m4v|ogv)$/i.test(fname);
        const isImg = /\.(jpe?g|png|gif|webp|avif)$/i.test(fname);
        if (!isVid && !isImg) continue;
        const recoveredItem = {
          id: `dl-${d.id}`,
          downloadId: d.id,
          sourceUrl: d.url || '',
          type: isVid ? 'video' : 'image',
          alt: fname,
          fileName: fname,
          pageTitle: fname,
          site: '',
          pageUrl: d.url || '',
          postUrl: '',
          poster: '',
          width: 0,
          height: 0,
          size: d.fileSize || 0,
          savedAt: new Date(d.startTime).getTime() || Date.now(),
          mime: d.mime || (isVid ? 'video/mp4' : 'image/jpeg'),
          storageMode: 'download',
          downloadState: d.state
        };
        valid.push(recoveredItem);
        existingDownloadIds.add(d.id);
      }
    } catch {}

    await chrome.storage.local.set({ mosaicSavedFiles: valid });
    return valid;
  } catch {
    return [];
  }
}

export async function clearLibraryStorage() {
  await libraryRequest('readwrite', store => store.clear());
  for (const url of savedObjectUrls.values()) URL.revokeObjectURL(url);
  savedObjectUrls.clear();
  await chrome.storage.local.set({ mosaicSavedFiles: [] });
}

export async function deleteSavedFile(item) {
  const id = item.libraryId || item.id;
  await libraryRequest('readwrite', store => store.delete(id));
  const url = savedObjectUrls.get(id);
  if (url) URL.revokeObjectURL(url);
  savedObjectUrls.delete(id);
}
