// Only strings with real CSS syntax are tried via querySelector.
// Plain text labels like "a" or "button" are valid CSS tag selectors and would silently
// match unrelated elements, so they skip directly to text matching.
const CSS_SELECTOR_RE = /^[#.\[:]|[>\+~]/;

chrome.storage.local.get(['isEnabled', 'selectors'], (data) => {
  if (data.isEnabled === false) return;

  const raw = data.selectors || [];

  const allEntries = raw.map(s => typeof s === 'string' ? { selector: s } : s);
  const currentOrigin = window.location.origin;

  const targetSelectors = allEntries
    .filter(entry => !entry.url || entry.url === currentOrigin)
    .map(entry => entry.selector);

  if (targetSelectors.length === 0) return;

  // One click per page path per tab session — prevents SSO redirect loops where the login
  // page reloads after a redirect and would trigger the click again infinitely.
  const sessionKey = `click-assistant:${currentOrigin}${window.location.pathname}`;
  if (sessionStorage.getItem(sessionKey)) return;

  const lowerSelectors = targetSelectors.map(s => s.toLowerCase());

  function isVisible(el) {
    // offsetParent is null for position:fixed elements (e.g. Coder/Technitium modal overlays)
    // even when they are fully visible, so use computed style instead.
    const style = getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function performClick(el) {
    // Mark before click so even if the page unloads immediately we don't re-fire.
    sessionStorage.setItem(sessionKey, '1');

    el.scrollIntoView({ block: 'nearest', behavior: 'instant' });
    // Focus required by some form libraries before a click is meaningful.
    el.focus({ preventScroll: true });

    const rect = el.getBoundingClientRect();
    const cx = Math.round(rect.left + rect.width / 2);
    const cy = Math.round(rect.top + rect.height / 2);
    const init = { bubbles: true, cancelable: true, view: window, clientX: cx, clientY: cy, screenX: cx, screenY: cy };
    const ptrInit = { ...init, isPrimary: true, pointerId: 1, pointerType: 'mouse' };

    // Full pointer + mouse event sequence so frameworks that listen on pointer events
    // (React 17+, many UI libraries) respond correctly alongside mouse-event listeners.
    el.dispatchEvent(new PointerEvent('pointerdown', ptrInit));
    el.dispatchEvent(new MouseEvent('mousedown', init));
    el.dispatchEvent(new PointerEvent('pointerup', ptrInit));
    el.dispatchEvent(new MouseEvent('mouseup', init));

    // el.click() is the only reliable way to trigger all handlers (addEventListener,
    // event delegation, form submission, link navigation) with a single call.
    el.click();
  }

  function findAndClickButton() {
    // 1. Try each entry as a CSS selector — only if it looks like one.
    for (const rule of targetSelectors) {
      if (!CSS_SELECTOR_RE.test(rule)) continue;
      try {
        const el = document.querySelector(rule);
        if (el && isVisible(el)) {
          performClick(el);
          return true;
        }
      } catch (e) {}
    }

    const candidates = document.querySelectorAll(
      'button, a, input[type="button"], input[type="submit"], input[type="image"], input[type="reset"], [role="button"], [role="link"], [tabindex="0"]'
    );

    // 2. Exact text match (innerText, value, aria-label, title).
    for (const el of candidates) {
      if (!isVisible(el)) continue;
      const text = (el.innerText || el.value || el.textContent || '').trim().toLowerCase();
      const label = (el.getAttribute('aria-label') || el.getAttribute('title') || '').trim().toLowerCase();
      if ((text && lowerSelectors.includes(text)) || (label && lowerSelectors.includes(label))) {
        performClick(el);
        return true;
      }
    }

    // 3. Partial text match — handles buttons where innerText includes an <img> or icon glyph
    //    alongside the label (e.g. " OpenID Connect" matching "OpenID Connect").
    //    Only applies to selectors long enough to be specific (≥4 chars).
    for (const el of candidates) {
      if (!isVisible(el)) continue;
      const text = (el.innerText || el.value || el.textContent || '').trim().toLowerCase();
      const label = (el.getAttribute('aria-label') || el.getAttribute('title') || '').trim().toLowerCase();
      if (
        (text && lowerSelectors.some(s => s.length >= 4 && text.includes(s))) ||
        (label && lowerSelectors.some(s => s.length >= 4 && label.includes(s)))
      ) {
        performClick(el);
        return true;
      }
    }

    return false;
  }

  if (findAndClickButton()) return;

  // Debounce MutationObserver callbacks — SPAs can fire thousands of mutations per
  // second during a render cycle, and triggering a full querySelectorAll scan on each
  // one causes measurable page slowdown. 100 ms is short enough to react quickly to
  // content appearing, long enough to batch an entire render burst into one check.
  let mutationTimer = null;
  const observer = new MutationObserver(() => {
    clearTimeout(mutationTimer);
    mutationTimer = setTimeout(() => {
      if (findAndClickButton()) observer.disconnect();
    }, 100);
  });

  observer.observe(document.documentElement, { childList: true, subtree: true });
  setTimeout(() => observer.disconnect(), 10000);
});
