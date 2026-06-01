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
        chrome.tabs.reload(sender.tab.id);
      }
    });
  }
  return true;
});

function normalizeSelectors(raw) {
  if (!raw) return null;
  return raw.map(s => typeof s === 'string' ? { selector: s } : s);
}
