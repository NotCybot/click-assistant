(() => {
  // Prevents the script from running multiple times if injected again.
  if (window.elementPickerActive) return;
  window.elementPickerActive = true;

  const overlay = document.createElement('div');
  overlay.style.position = 'fixed';
  overlay.style.backgroundColor = 'rgba(68, 138, 255, 0.25)';
  overlay.style.border = '2px solid #448aff';
  overlay.style.borderRadius = '4px';
  overlay.style.zIndex = '999999998';
  overlay.style.pointerEvents = 'none';
  overlay.style.transition = 'all 150ms ease-out';
  document.body.appendChild(overlay);

  const cleanup = () => {
    document.removeEventListener('mouseover', highlightElement);
    document.removeEventListener('mousedown', suppressEvent, true);
    document.removeEventListener('click', selectElement, true);
    document.removeEventListener('keydown', handleKeydown);
    overlay.remove();
    window.elementPickerActive = false;
  };

  const INTERACTIVE = new Set(['BUTTON', 'A', 'INPUT', 'SELECT', 'TEXTAREA']);

  const findInteractive = (el) => {
    let cur = el;
    while (cur && cur.tagName !== 'BODY') {
      if (INTERACTIVE.has(cur.tagName) || cur.getAttribute('role') === 'button') return cur;
      cur = cur.parentElement;
    }
    return el;
  };

  const highlightElement = (e) => {
    const raw = e.target;
    if (raw === overlay || raw.tagName === 'BODY') return;
    const target = findInteractive(raw);
    const rect = target.getBoundingClientRect();
    overlay.style.width = `${rect.width}px`;
    overlay.style.height = `${rect.height}px`;
    overlay.style.top = `${rect.top}px`;
    overlay.style.left = `${rect.left}px`;
  };

  const buildCssPath = (el) => {
    const parts = [];
    let cur = el;
    // Stop at <html>, not <body> — including "body" in the path avoids returning a bare
    // tag name like "button" that would match the first button anywhere on the page.
    while (cur && cur.tagName !== 'HTML') {
      let part = cur.tagName.toLowerCase();
      if (cur.id) {
        parts.unshift(`#${CSS.escape(cur.id)}`);
        break;
      }
      const parent = cur.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children).filter(c => c.tagName === cur.tagName);
        if (siblings.length > 1) part += `:nth-of-type(${siblings.indexOf(cur) + 1})`;
      }
      parts.unshift(part);
      cur = cur.parentElement;
      if (parts.length >= 5) break;
    }
    return parts.join(' > ') || el.tagName.toLowerCase();
  };

  const getSimpleSelector = (el) => {
    // 1. ALWAYS prioritize descriptive text content.
    // Use only innerText (rendered text), never textContent — textContent includes hidden
    // nodes like SVG <title> elements and aria-hidden spans, which content.js can't match.
    const text = (el.innerText || '').trim();
    if (text && text.length > 2 && text.length < 50 && !text.includes('\n')) {
      return text;
    }

    // 2. Unique ID.
    if (el.id) {
      const idSelector = `#${CSS.escape(el.id)}`;
      if (document.querySelectorAll(idSelector).length === 1) {
        return idSelector;
      }
    }

    // 3. Unique data-attribute or aria-label/title (covers icon-only buttons).
    const uniqueAttrs = ['data-testid', 'data-cy', 'name', 'aria-label', 'title', 'data-id', 'data-action'];
    for (const attr of uniqueAttrs) {
      if (el.hasAttribute(attr)) {
        const attrSelector = `[${attr}="${CSS.escape(el.getAttribute(attr))}"]`;
        if (document.querySelectorAll(attrSelector).length === 1) {
          return attrSelector;
        }
      }
    }

    // 4. Input button value text.
    if (el.tagName === 'INPUT' && el.value) {
      return el.value.trim();
    }

    // 5. Fallback: structural CSS path — always produces a usable selector.
    return buildCssPath(el);
  };

  const suppressEvent = (e) => {
    e.preventDefault();
    e.stopImmediatePropagation();
  };

  // Returns a human-readable description for a picked element so the popup can show
  // something meaningful even when getSimpleSelector falls back to a CSS path.
  const getLabel = (el) => {
    const text = (el.innerText || '').replace(/\s+/g, ' ').trim();
    if (text) return text.slice(0, 80);
    const attr = el.getAttribute('aria-label') || el.getAttribute('title') || el.getAttribute('placeholder');
    if (attr?.trim()) return attr.trim().slice(0, 80);
    if (el.tagName === 'INPUT' && el.value) return el.value.trim().slice(0, 80);
    return (document.title || document.location.hostname).slice(0, 80);
  };

  const selectElement = (e) => {
    e.preventDefault();
    e.stopImmediatePropagation();

    const target = findInteractive(e.target);
    const selector = getSimpleSelector(target);
    const label = getLabel(target);
    chrome.runtime.sendMessage({ type: 'element-selected', selector, label });
    cleanup();
  };

  const handleKeydown = (e) => {
    if (e.key === 'Escape') {
      cleanup();
    }
  };

  document.addEventListener('mouseover', highlightElement);
  document.addEventListener('mousedown', suppressEvent, { capture: true });
  document.addEventListener('click', selectElement, { capture: true });
  document.addEventListener('keydown', handleKeydown);
})();
