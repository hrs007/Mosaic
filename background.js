chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({ id: "mosaic-open", title: "Open page media in Mosaic", contexts: ["page", "image", "video"] });
});

async function toggleGallery(tab) {
  if (!tab?.id || !tab.url || /^(chrome|edge|about|chrome-extension):/i.test(tab.url)) return;
  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, args: [chrome.runtime.getURL(`gallery.html?tabId=${tab.id}`)], func: (url) => {
      const current=document.getElementById('mosaic-gallery-overlay');
      if(current){
        const frame=current.shadowRoot?.querySelector('iframe');
        if(frame){try{const target=new URL(url);frame.contentWindow.location.replace(target.href);return;}catch{}}
        current.remove();
      }
      const host=document.createElement('div');host.id='mosaic-gallery-overlay';
      Object.assign(host.style,{all:'initial',position:'fixed',inset:'0',zIndex:'2147483647',width:'100vw',height:'100vh',display:'block',background:'#f7f7f5'});
      const root=host.attachShadow({mode:'open'});
      const frame=document.createElement('iframe');frame.src=url;frame.title='Mosaic media gallery';
      Object.assign(frame.style,{all:'initial',display:'block',width:'100%',height:'100%',border:'0'});
      root.appendChild(frame);document.documentElement.appendChild(host);
    }});
  } catch (error) { console.warn('Mosaic could not open on this tab',error); }
}

chrome.action.onClicked.addListener(toggleGallery);

chrome.contextMenus.onClicked.addListener(async (_info, tab) => {
  toggleGallery(tab);
});

chrome.runtime.onMessage.addListener((message) => {
  if(message?.type==='mosaic-close-overlay'&&message.tabId){
    chrome.scripting.executeScript({target:{tabId:message.tabId},func:()=>document.getElementById('mosaic-gallery-overlay')?.remove()}).catch(()=>{});
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
