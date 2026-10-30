export function advanceTabScroll() {
  const step = Math.max(700, Math.floor(window.innerHeight * 1.2));
  const prevY = window.scrollY || window.pageYOffset || 0;
  window.scrollBy({ top: step, left: 0, behavior: 'instant' });
  const afterY = window.scrollY || window.pageYOffset || 0;

  let scrolledContainer = false;
  let containerAtBottom = false;

  if (afterY === prevY && document.scrollingElement && document.scrollingElement.scrollHeight > document.scrollingElement.clientHeight) {
    const prevElemY = document.scrollingElement.scrollTop;
    document.scrollingElement.scrollTop += step;
    if (document.scrollingElement.scrollTop !== prevElemY) {
      scrolledContainer = true;
    }
  }

  const feedContainers = document.querySelectorAll('main, [role="feed"], [role="main"], #content, [data-testid="primaryColumn"]');
  for (const el of feedContainers) {
    if (el && el.scrollHeight > el.clientHeight + 100) {
      const prevElY = el.scrollTop;
      el.scrollTop += step;
      if (el.scrollTop !== prevElY) {
        scrolledContainer = true;
      }
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 50) {
        containerAtBottom = true;
      }
    }
  }

  const docEl = document.documentElement;
  const body = document.body;
  const scrollHeight = Math.max(
    docEl ? docEl.scrollHeight : 0,
    body ? body.scrollHeight : 0,
    document.scrollingElement ? document.scrollingElement.scrollHeight : 0
  );
  const clientHeight = window.innerHeight || (docEl ? docEl.clientHeight : 0);
  const currentScroll = window.scrollY || window.pageYOffset || (document.scrollingElement ? document.scrollingElement.scrollTop : 0);

  const windowDidNotScroll = (afterY === prevY && !scrolledContainer);
  const reachedWindowBottom = (currentScroll + clientHeight >= scrollHeight - 60);

  const atBottom = reachedWindowBottom || (windowDidNotScroll && currentScroll > 0) || containerAtBottom;

  return {
    scrolled: (afterY !== prevY) || scrolledContainer,
    atBottom,
    currentScroll,
    scrollHeight
  };
}
