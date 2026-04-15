chrome.storage.local.get(['isEnabled', 'selectors'], (data) => {
  if (data.isEnabled === false) {
    return;
  }

  const targetSelectors = data.selectors || [
        '[data-testid="login-button"]',
        '[data-cy="login-button"]',
        'login'
  ];

  function findAndClickButton() {
    // 1. Search for exact CSS/data selectors
    for (const rule of targetSelectors) {
      try {
        const btn = document.querySelector(rule);
        if (btn) {
          console.log("Click Assistant: Clicked via selector:", btn);
          btn.click();
          return true;
        }
      } catch (e) {
        // Ignore errors if the rule is not a valid CSS selector (it might be plain text)
      }
    }

    // 2. Search for plain text content (case-insensitive)
    const elements = document.querySelectorAll('button, a, input[type="button"], input[type="submit"], div[role="button"]');
    const lowerCaseSelectors = targetSelectors.map(s => s.toLowerCase());

    for (const el of elements) {
      const text = (el.innerText || el.value || el.textContent || "").trim().toLowerCase();
      
      if (text && lowerCaseSelectors.includes(text)) {
        console.log("Click Assistant: Clicked via text:", el);
        el.click();
        return true;
      }
    }
    
    return false;
  }

  let attempts = 0;
  const maxAttempts = 10;

  const searchInterval = setInterval(() => {
    const clicked = findAndClickButton();
    if (clicked || attempts >= maxAttempts) {
      clearInterval(searchInterval);
    }
    attempts++;
  }, 500);
});
