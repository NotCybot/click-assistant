document.addEventListener('DOMContentLoaded', () => {
  const toggle = document.getElementById('enableToggle');
  const addBtn = document.getElementById('addBtn');
  const findBtn = document.getElementById('findBtn');
  const input = document.getElementById('newSelector');
  const list = document.getElementById('selectorList');
  const settingsBtn = document.getElementById('settingsBtn');
  const settingsMenu = document.getElementById('settingsMenu');
  const autoReloadToggle = document.getElementById('autoReloadToggle');

  const defaultSelectors = [
    { selector: '[data-testid="login-button"]' },
    { selector: '[data-cy="login-button"]' },
    { selector: 'login' }
  ];

  function normalizeSelectors(raw) {
    if (!raw) return defaultSelectors;
    return raw.map(s => typeof s === 'string' ? { selector: s } : s);
  }

  function getHostname(url) {
    try { return new URL(url).hostname; } catch (e) { return url; }
  }

  chrome.storage.local.get(['pickedSelector', 'isEnabled', 'selectors', 'autoReload'], (data) => {
    if (data.pickedSelector) {
      input.value = data.pickedSelector;
      chrome.storage.local.remove('pickedSelector');
    }
    toggle.checked = data.isEnabled !== false;
    renderList(normalizeSelectors(data.selectors));
    autoReloadToggle.checked = !!data.autoReload;
  });

  toggle.addEventListener('change', () => {
    chrome.storage.local.set({ isEnabled: toggle.checked }, () => {
      if (toggle.checked) {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          const tab = tabs[0];
          if (tab && tab.id) chrome.tabs.reload(tab.id);
        });
      }
    });
  });

  autoReloadToggle.addEventListener('change', () => {
    chrome.storage.local.set({ autoReload: autoReloadToggle.checked });
  });

  settingsMenu.style.display = 'none';

  function resizePopupToFit() {
    if (window.resizeTo) {
      setTimeout(() => {
        window.resizeTo(document.body.offsetWidth + 20, document.body.offsetHeight + 20);
      }, 10);
    }
  }

  settingsBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    settingsMenu.style.display = settingsMenu.style.display === 'flex' ? 'none' : 'flex';
    resizePopupToFit();
  });

  document.addEventListener('click', (e) => {
    if (!settingsMenu.contains(e.target) && e.target !== settingsBtn && settingsMenu.style.display === 'flex') {
      settingsMenu.style.display = 'none';
      resizePopupToFit();
    }
  });

  const addSelector = () => {
    const value = input.value.trim();
    if (!value) return;

    chrome.storage.local.get(['selectors'], (data) => {
      const current = normalizeSelectors(data.selectors);
      if (!current.some(s => s.selector === value && !s.url)) {
        const updated = [...current, { selector: value }];
        chrome.storage.local.set({ selectors: updated }, () => {
          renderList(updated);
          input.value = '';
        });
      }
    });
  };

  addBtn.addEventListener('click', addSelector);
  input.addEventListener('keypress', (e) => { if (e.key === 'Enter') addSelector(); });

  findBtn.addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (tab) {
        chrome.tabs.executeScript(tab.id, { file: 'element-picker.js' });
        window.close();
      }
    });
  });

  function renderList(entries) {
    list.innerHTML = '';
    entries.forEach(entry => {
      const li = document.createElement('li');

      const text = document.createElement('span');
      text.className = 'selector-text';

      const hasLabel = entry.label && entry.label !== entry.selector;
      text.textContent = hasLabel ? entry.label : entry.selector;

      if (hasLabel) {
        const rawSpan = document.createElement('span');
        rawSpan.className = 'selector-raw';
        rawSpan.textContent = entry.selector;
        text.appendChild(rawSpan);
      }

      li.appendChild(text);

      if (entry.url) {
        const badge = document.createElement('span');
        badge.className = 'url-badge';
        badge.textContent = getHostname(entry.url);
        li.appendChild(badge);
      }

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'delete-btn';
      deleteBtn.innerHTML = '&times;';
      deleteBtn.onclick = () => removeSelector(entry);
      li.appendChild(deleteBtn);

      list.appendChild(li);
    });
    addHoverEffect();
  }

  function removeSelector(entry) {
    chrome.storage.local.get(['selectors'], (data) => {
      const current = normalizeSelectors(data.selectors);
      const updated = current.filter(s => !(s.selector === entry.selector && s.url === entry.url));
      chrome.storage.local.set({ selectors: updated }, () => renderList(updated));
    });
  }

  function addHoverEffect() {
    document.querySelectorAll('#selectorList li').forEach(item => {
      item.addEventListener('mousemove', e => {
        const rect = item.getBoundingClientRect();
        item.style.setProperty('--x', `${e.clientX - rect.left}px`);
        item.style.setProperty('--y', `${e.clientY - rect.top}px`);
      });
    });
  }
});
