// background.js
chrome.runtime.onMessage.addListener((message, sender) => {
  if (message.type === 'element-selected') {
    chrome.storage.local.get(['selectors', 'autoReload'], (data) => {
      const defaultSelectors = [
        '[data-testid="login-button"]',
        '[data-cy="login-button"]',
        'login'
      ];
      const selectors = data.selectors || defaultSelectors;
      const selector = message.selector;

      if (!selectors.includes(selector)) {
        selectors.push(selector);
        chrome.storage.local.set({ selectors });
      }

      if (data.autoReload && sender.tab && sender.tab.id) {
        chrome.tabs.reload(sender.tab.id);
      }
    });
  }
  return true; // Keep the message channel open for async response
});
