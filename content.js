chrome.storage.local.get(['isEnabled', 'selectors'], (data) => {
  if (data.isEnabled === false) return;

  const raw = data.selectors || [
    '[data-testid="login-button"]',
    '[data-cy="login-button"]',
    'login'
  ];

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
    const rect = el.getBoundingClientRect();
    const cx = Math.round(rect.left + rect.width / 2);
    const cy = Math.round(rect.top + rect.height / 2);

    // mousedown/mouseup for frameworks that trigger on those events.
    for (const type of ['mousedown', 'mouseup']) {
      el.dispatchEvent(new MouseEvent(type, {
        bubbles: true, cancelable: true, view: window,
        clientX: cx, clientY: cy, screenX: cx, screenY: cy,
      }));
    }
    // Buttons with inline onclick: call the handler directly rather than dispatching
    // a bubbling click. This fires the action without triggering delegated page handlers
    // (e.g. Bootstrap's cleanup code) that can throw DOM errors during navigation.
    // Fall back to el.click() for framework buttons that use event delegation (React etc.).
    if (typeof el.onclick === 'function') {
      el.onclick.call(el, new MouseEvent('click', { bubbles: false, cancelable: true, view: window }));
    } else {
      el.click();
    }
  }

  function findAndClickButton() {
    // 1. Try each entry as a CSS selector.
    for (const rule of targetSelectors) {
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

  const observer = new MutationObserver(() => {
    if (findAndClickButton()) observer.disconnect();
  });

  observer.observe(document.documentElement, { childList: true, subtree: true });
  setTimeout(() => observer.disconnect(), 10000);
});
