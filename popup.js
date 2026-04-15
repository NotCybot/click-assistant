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
    '[data-testid="login-button"]',
    '[data-cy="login-button"]',
    'login'
  ];

  // On popup open, check if a selector was just picked and load settings
  chrome.storage.local.get(['pickedSelector', 'isEnabled', 'selectors', 'autoReload'], (data) => {
    if (data.pickedSelector) {
      input.value = data.pickedSelector;
      chrome.storage.local.remove('pickedSelector');
    }
    toggle.checked = data.isEnabled !== false;
    const selectors = data.selectors || defaultSelectors;
    renderList(selectors);
    autoReloadToggle.checked = !!data.autoReload;
  });

  // Save enable toggle state
  toggle.addEventListener('change', () => {
    chrome.storage.local.set({ isEnabled: toggle.checked }, () => {
      if (toggle.checked) {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          const tab = tabs[0];
          if (tab && tab.id) {
            chrome.tabs.reload(tab.id);
          }
        });
      }
    });
  });

  // Save autoReload toggle state
  autoReloadToggle.addEventListener('change', () => {
    chrome.storage.local.set({ autoReload: autoReloadToggle.checked });
  });

  // Settings dropdown logic
  // Ensure settings menu is hidden by default
  settingsMenu.style.display = 'none';

  function resizePopupToFit() {
    // Try to resize the popup window to fit content (works in most browsers)
    if (window.resizeTo) {
      setTimeout(() => {
        window.resizeTo(document.body.offsetWidth + 20, document.body.offsetHeight + 20);
      }, 10);
    }
  }

  settingsBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (settingsMenu.style.display === 'flex') {
      settingsMenu.style.display = 'none';
    } else {
      settingsMenu.style.display = 'flex';
    }
    resizePopupToFit();
  });
  // Only close settings menu if click is outside
  document.addEventListener('click', (e) => {
    if (!settingsMenu.contains(e.target) && e.target !== settingsBtn && settingsMenu.style.display === 'flex') {
      settingsMenu.style.display = 'none';
      resizePopupToFit();
    }
  });

  // Add new selector
  const addSelector = () => {
    const value = input.value.trim();
    if (value) {
      chrome.storage.local.get(['selectors'], (data) => {
        const currentSelectors = data.selectors || defaultSelectors;
        if (!currentSelectors.includes(value)) {
          const newSelectors = [...currentSelectors, value];
          chrome.storage.local.set({ selectors: newSelectors }, () => {
            renderList(newSelectors);
            input.value = '';
          });
        }
      });
    }
  };

  addBtn.addEventListener('click', addSelector);
  input.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addSelector();
  });

  // Find button logic
  findBtn.addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (tab) {
        chrome.tabs.executeScript(tab.id, { file: 'element-picker.js' });
        window.close();
      }
    });
  });

  // Render the list in the UI
  function renderList(selectors) {
    list.innerHTML = '';
    selectors.forEach(selector => {
      const li = document.createElement('li');
      const text = document.createElement('span');
      text.textContent = selector;
      li.appendChild(text);

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'delete-btn';
      deleteBtn.innerHTML = '&times;';
      deleteBtn.onclick = () => removeSelector(selector);
      li.appendChild(deleteBtn);
      list.appendChild(li);
    });
    addHoverEffect();
  }

  // Remove a selector
  function removeSelector(selectorToRemove) {
    chrome.storage.local.get(['selectors'], (data) => {
      const currentSelectors = data.selectors || defaultSelectors;
      const newSelectors = currentSelectors.filter(s => s !== selectorToRemove);
      chrome.storage.local.set({ selectors: newSelectors }, () => {
        renderList(newSelectors);
      });
    });
  }

  // Function to apply the mouse-following hover effect
  function addHoverEffect() {
    document.querySelectorAll('#selectorList li').forEach(item => {
      item.addEventListener('mousemove', e => {
        const rect = item.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        item.style.setProperty('--x', `${x}px`);
        item.style.setProperty('--y', `${y}px`);
      });
    });
  }
});

