chrome.runtime.onMessage.addListener((message, sender) => {
  if (message.type === 'element-selected') {
    chrome.storage.local.get(['selectors', 'autoReload'], (data) => {
      const defaultSelectors = [
        { selector: '[data-testid="login-button"]' },
        { selector: '[data-cy="login-button"]' },
        { selector: 'login' }
      ];
      const selectors = normalizeSelectors(data.selectors) || defaultSelectors;
      const selector = message.selector;
      const url = sender.tab && sender.tab.url ? new URL(sender.tab.url).origin : undefined;
      const entry = url ? { selector, url } : { selector };

      if (!selectors.some(s => s.selector === selector && s.url === url)) {
        selectors.push(entry);
        chrome.storage.local.set({ selectors });
      }

      if (data.autoReload && sender.tab && sender.tab.id) {
        // Clear the per-page session key before reloading so content.js doesn't
        // early-return on the "already clicked" guard. Without this, reloading a page
        // where a button was already clicked in this session would prevent the newly
        // added selector from being tested immediately.
        chrome.tabs.executeScript(sender.tab.id, {
          code: `for (const k of Object.keys(sessionStorage)) { if (k.startsWith('click-assistant:')) sessionStorage.removeItem(k); }`
        }, () => chrome.tabs.reload(sender.tab.id));
      }
    });
  }
  return true;
});

function normalizeSelectors(raw) {
  if (!raw) return null;
  return raw.map(s => typeof s === 'string' ? { selector: s } : s);
}
