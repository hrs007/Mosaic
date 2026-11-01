async function injectContentScriptIntoOpenTabs() {
  try {
    const tabs = await chrome.tabs.query({ url: ['http://*/*', 'https://*/*'] });
    for (const tab of tabs) {
      if (!tab.id || !tab.url) continue;
      if (/^(chrome|edge|about|chrome-extension):/i.test(tab.url)) continue;
      if (tab.url.includes('chromewebstore.google.com') || tab.url.includes('chrome.google.com/webstore')) continue;

      chrome.scripting.executeScript({
        target: { tabId: tab.id, allFrames: true },
        files: ['content.js']
      }).catch(() => {});
    }
  } catch (err) {
    console.debug('Failed to inject content script into open tabs:', err);
  }
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({ id: "mosaic-open", title: "Open page media in Mosaic", contexts: ["page", "image", "video"] });
  injectContentScriptIntoOpenTabs();
});

const togglingTabs = new Set();

async function toggleGallery(tab) {
  if (!tab?.id) return;
  if (tab.url && /^(chrome|edge|about|chrome-extension):/i.test(tab.url)) return;

  // Prevent double-invocation race conditions
  if (togglingTabs.has(tab.id)) return;
  togglingTabs.add(tab.id);
  setTimeout(() => togglingTabs.delete(tab.id), 400);

  try {
    // Check if gallery overlay is currently open on this tab
    let isCurrentlyOpen = false;
    try {
      const [res] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => !!document.getElementById('mosaic-gallery-overlay')
      });
      isCurrentlyOpen = !!res?.result;
    } catch (err) {
      console.warn('Could not inspect tab DOM:', err);
    }

    if (isCurrentlyOpen) {
      // Gallery is open -> close it
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          document.getElementById('mosaic-gallery-overlay')?.remove();
          if (window.__mosaicInitialScroll) {
            window.scrollTo(window.__mosaicInitialScroll.x, window.__mosaicInitialScroll.y);
          }
          if (window.__mosaicWasPlaying) {
            try {
              const vid = document.querySelector('video.html5-main-video') || document.querySelector('video');
              vid?.play?.().catch(() => {});
            } catch {}
            window.__mosaicWasPlaying = false;
          }
        }
      }).catch(() => {});
    } else {
      // Gallery is closed -> inject overlay
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        args: [chrome.runtime.getURL(`gallery.html?tabId=${tab.id}`)],
        func: (url) => {
          try {
            window.__mosaicInitialScroll = { x: window.scrollX || window.pageXOffset || 0, y: window.scrollY || window.pageYOffset || 0 };
          } catch {}

          // If host page has a playing video (e.g. YouTube watch page), pause it to prevent audio clash
          try {
            const vid = document.querySelector('video.html5-main-video') || document.querySelector('video');
            if (vid && !vid.paused) {
              window.__mosaicWasPlaying = true;
              vid.pause();
            }
          } catch {}

          // If tab is in fullscreen, exit fullscreen so overlay is visible in top layer
          try {
            if (document.fullscreenElement) {
              document.exitFullscreen?.().catch(() => {});
            }
          } catch {}

          // Remove any existing overlay
          document.getElementById('mosaic-gallery-overlay')?.remove();

          const host = document.createElement('div');
          host.id = 'mosaic-gallery-overlay';
          Object.assign(host.style, {
            all: 'initial',
            position: 'fixed',
            top: '0',
            left: '0',
            right: '0',
            bottom: '0',
            inset: '0',
            zIndex: '2147483647',
            width: '100vw',
            height: '100vh',
            display: 'block',
            background: '#f7f7f5',
            margin: '0',
            padding: '0',
            border: 'none'
          });
          const root = host.attachShadow({ mode: 'open' });
          const frame = document.createElement('iframe');
          frame.src = url;
          frame.title = 'Mosaic media gallery';
          frame.allow = 'autoplay *; picture-in-picture *; encrypted-media *';
          frame.setAttribute('allow', 'autoplay *; picture-in-picture *; encrypted-media *');
          Object.assign(frame.style, {
            all: 'initial',
            display: 'block',
            width: '100%',
            height: '100%',
            border: '0'
          });
          root.appendChild(frame);
          (document.body || document.documentElement).appendChild(host);

          const cleanup = (shouldRestore = true) => {
            window.removeEventListener('keydown', onHostKeyDown, true);
            window.removeEventListener('message', onFrameMessage);
            host.remove();
            if (shouldRestore && window.__mosaicInitialScroll) {
              window.scrollTo(window.__mosaicInitialScroll.x, window.__mosaicInitialScroll.y);
            }
            if (window.__mosaicWasPlaying) {
              try {
                const vid = document.querySelector('video.html5-main-video') || document.querySelector('video');
                vid?.play?.().catch(() => {});
              } catch {}
              window.__mosaicWasPlaying = false;
            }
          };

          // Listen for CSP block on host page (e.g. strict host CSP on unrefreshed tabs)
          const onCspViolation = (e) => {
            const blocked = String(e?.blockedURI || '');
            if (blocked.includes('gallery.html') || blocked.startsWith('chrome-extension://')) {
              cleanup(false);
              try {
                chrome.runtime?.sendMessage?.({ type: 'mosaic-open-tab-fallback', tabId });
              } catch {
                window.open(url, '_blank', 'noopener');
              }
            }
          };
          document.addEventListener('securitypolicyviolation', onCspViolation, true);

          // Auto-focus the frame so keyboard events are received immediately
          try {
            frame.focus();
            frame.onload = () => {
              try { frame.focus(); frame.contentWindow?.focus(); } catch {}
            };
          } catch {}

          // Listen for Escape key on host page (handles Escape on first open before user clicks inside iframe)
          const onHostKeyDown = (e) => {
            if (e.key === 'Escape' || e.code === 'Escape') {
              cleanup();
            }
          };
          window.addEventListener('keydown', onHostKeyDown, true);

          // Listen for close message from iframe
          const onFrameMessage = (e) => {
            if (e.data?.type === 'mosaic-close-frame') {
              cleanup(e.data?.restoreScroll);
            }
          };
          window.addEventListener('message', onFrameMessage);
        }
      });
    }
  } catch (error) {
    console.warn('Mosaic could not open on this tab', error);
  }
}

chrome.action.onClicked.addListener(toggleGallery);

chrome.commands?.onCommand?.addListener(async (command) => {
  if (command === '_execute_action') {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) toggleGallery(tab);
  }
});

chrome.contextMenus.onClicked.addListener(async (_info, tab) => {
  toggleGallery(tab);
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'mosaic-toggle-overlay') {
    const tab = sender.tab;
    if (tab) {
      toggleGallery(tab);
    } else {
      chrome.tabs.query({ active: true, currentWindow: true }).then(([activeTab]) => {
        if (activeTab) toggleGallery(activeTab);
      }).catch(() => {});
    }
    sendResponse?.({ ok: true });
    return false;
  }

  if (message?.type === 'mosaic-open-tab-fallback' && message.tabId) {
    chrome.tabs.create({ url: chrome.runtime.getURL(`gallery.html?tabId=${message.tabId}`) });
  }

  const attachGalleryAfterLoad = (targetTab) => {
    if (!targetTab?.id || !message.keepGalleryOpen) return;
    const listener = (tabId, changeInfo, tab) => {
      if (tabId !== targetTab.id || changeInfo.status !== 'complete') return;
      chrome.tabs.onUpdated.removeListener(listener);
      setTimeout(() => toggleGallery(tab), 700);
    };
    chrome.tabs.onUpdated.addListener(listener);
    setTimeout(() => {
      try { chrome.tabs.onUpdated.removeListener(listener); } catch {}
    }, 30000);
  };

  // Navigate to a social destination and re-open Mosaic in extension view.
  if ((message?.type === 'mosaic-navigate-social' || message?.type === 'mosaic-navigate-to-instagram') && message.url) {
    const senderTabId = sender?.tab?.id;
    const targetTabId = Number(message.tabId) > 0 ? Number(message.tabId) : senderTabId;
    if (targetTabId) {
      const onUpdatedTab = (updatedTab) => {
        if (chrome.runtime.lastError || !updatedTab) {
          if (message.keepGalleryOpen) chrome.tabs.create({ url: message.url, active: true }, attachGalleryAfterLoad);
          return;
        }
        if (message.keepGalleryOpen) {
          const onTabUpdated = (tabId, changeInfo, tab) => {
            if (tabId === targetTabId && changeInfo.status === 'complete') {
              chrome.tabs.onUpdated.removeListener(onTabUpdated);
              setTimeout(() => {
                chrome.tabs.get(targetTabId, currentTab => {
                  if (!chrome.runtime.lastError && currentTab) toggleGallery(currentTab);
                });
              }, 700);
            }
          };
          chrome.tabs.onUpdated.addListener(onTabUpdated);
          setTimeout(() => {
            try { chrome.tabs.onUpdated.removeListener(onTabUpdated); } catch {}
          }, 30000);
        }
      };
      chrome.tabs.update(targetTabId, { url: message.url, active: true }, onUpdatedTab);
    } else {
      chrome.tabs.create({ url: message.url, active: true }, attachGalleryAfterLoad);
    }
  }

  if (message?.type === 'mosaic-close-overlay' && message.tabId) {
    const restoreScroll = message.restoreScroll !== false;
    chrome.scripting.executeScript({
      target: { tabId: message.tabId },
      args: [restoreScroll],
      func: (shouldRestore) => {
        document.getElementById('mosaic-gallery-overlay')?.remove();
        if (shouldRestore && window.__mosaicInitialScroll) {
          window.scrollTo(window.__mosaicInitialScroll.x, window.__mosaicInitialScroll.y);
        }
      }
    }).catch(() => {});
  }
});

const galleryPorts = new Map();
chrome.runtime.onConnect.addListener(port => {
  const match=port.name?.match(/^mosaic-gallery:(\d+)$/);if(!match)return;
  const tabId=Number(match[1]);galleryPorts.set(tabId,port);
  port.onDisconnect.addListener(()=>{if(galleryPorts.get(tabId)===port)galleryPorts.delete(tabId);});
});
chrome.runtime.onMessage.addListener((message,sender)=>{
  if(message?.type!=='mosaic-live-media'||!message.tabId||sender.tab?.id!==message.tabId)return;
  galleryPorts.get(Number(message.tabId))?.postMessage({source:'mosaic-live',tabId:Number(message.tabId),media:message.media});
});

async function setupDnrRules() {
  if (!chrome.declarativeNetRequest?.updateDynamicRules) return;
  const rules = [
    {
      id: 101,
      priority: 1,
      action: {
        type: 'modifyHeaders',
        requestHeaders: [
          { header: 'Referer', operation: 'set', value: 'https://www.youtube.com/' },
          { header: 'Origin', operation: 'set', value: 'https://www.youtube.com' }
        ]
      },
      condition: {
        urlFilter: '||youtube.com/',
        resourceTypes: ['sub_frame', 'xmlhttprequest', 'media', 'other']
      }
    },
    {
      id: 102,
      priority: 1,
      action: {
        type: 'modifyHeaders',
        requestHeaders: [
          { header: 'Referer', operation: 'set', value: 'https://www.youtube.com/' },
          { header: 'Origin', operation: 'set', value: 'https://www.youtube.com' }
        ]
      },
      condition: {
        urlFilter: '||youtube-nocookie.com/',
        resourceTypes: ['sub_frame', 'xmlhttprequest', 'media', 'other']
      }
    },
    {
      id: 103,
      priority: 2,
      action: {
        type: 'modifyHeaders',
        responseHeaders: [
          { header: 'content-security-policy', operation: 'remove' },
          { header: 'content-security-policy-report-only', operation: 'remove' },
          { header: 'x-frame-options', operation: 'remove' }
        ]
      },
      condition: {
        urlFilter: '||instagram.com/',
        resourceTypes: ['main_frame', 'sub_frame']
      }
    },
    {
      id: 104,
      priority: 1,
      action: {
        type: 'modifyHeaders',
        requestHeaders: [
          { header: 'Referer', operation: 'set', value: 'https://www.instagram.com/' }
        ],
        responseHeaders: [
          { header: 'access-control-allow-origin', operation: 'set', value: '*' },
          { header: 'cross-origin-resource-policy', operation: 'set', value: 'cross-origin' }
        ]
      },
      condition: {
        urlFilter: '||cdninstagram.com/',
        resourceTypes: ['image', 'media', 'xmlhttprequest', 'sub_frame', 'other']
      }
    },
    {
      id: 105,
      priority: 1,
      action: {
        type: 'modifyHeaders',
        requestHeaders: [
          { header: 'Referer', operation: 'set', value: 'https://www.instagram.com/' }
        ],
        responseHeaders: [
          { header: 'access-control-allow-origin', operation: 'set', value: '*' },
          { header: 'cross-origin-resource-policy', operation: 'set', value: 'cross-origin' }
        ]
      },
      condition: {
        urlFilter: '||fbcdn.net/',
        resourceTypes: ['image', 'media', 'xmlhttprequest', 'sub_frame', 'other']
      }
    }
  ];
  try {
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: [101, 102, 103, 104, 105],
      addRules: rules
    });
  } catch (err) {
    console.warn('Failed to register DNR rules:', err);
  }
}
chrome.runtime.onInstalled?.addListener(() => setupDnrRules());
chrome.runtime.onStartup?.addListener(() => setupDnrRules());
setupDnrRules();

