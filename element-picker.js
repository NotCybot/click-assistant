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
    document.removeEventListener('click', selectElement, true);
    document.removeEventListener('keydown', handleKeydown);
    overlay.remove();
    window.elementPickerActive = false;
  };

  const highlightElement = (e) => {
    const target = e.target;
    if (target === overlay || target.tagName === 'BODY') return;
    
    const rect = target.getBoundingClientRect();
    overlay.style.width = `${rect.width}px`;
    overlay.style.height = `${rect.height}px`;
    overlay.style.top = `${rect.top}px`;
    overlay.style.left = `${rect.left}px`;
  };

  const getSimpleSelector = (el) => {
    // 1. ALWAYS prioritize descriptive text content.
    const text = (el.innerText || el.textContent || '').trim();
    // Use text if it's a reasonable length and doesn't contain newlines.
    if (text && text.length > 2 && text.length < 50 && !text.includes('\n')) {
      return text;
    }

    // 2. Fallback to a unique ID if no good text is found.
    if (el.id) {
      const idSelector = `#${CSS.escape(el.id)}`;
      if (document.querySelectorAll(idSelector).length === 1) {
        return idSelector;
      }
    }

    // 3. Fallback to a unique, simple data-attribute.
    const uniqueAttrs = ['data-testid', 'data-cy', 'name'];
    for (const attr of uniqueAttrs) {
      if (el.hasAttribute(attr)) {
        const attrSelector = `[${attr}="${CSS.escape(el.getAttribute(attr))}"]`;
        if (document.querySelectorAll(attrSelector).length === 1) {
          return attrSelector;
        }
      }
    }
    
    // If no simple, descriptive selector can be found, return null.
    return null;
  };

  const selectElement = (e) => {
    e.preventDefault();
    e.stopPropagation();

    const selector = getSimpleSelector(e.target);

    // Only send a message if we found a good selector.
    if (selector) {
      chrome.runtime.sendMessage({ type: 'element-selected', selector: selector });
    }
    
    cleanup();
  };
  
  const handleKeydown = (e) => {
    if (e.key === 'Escape') {
      cleanup();
    }
  };

  document.addEventListener('mouseover', highlightElement);
  document.addEventListener('click', selectElement, { capture: true });
  document.addEventListener('keydown', handleKeydown);
})();
