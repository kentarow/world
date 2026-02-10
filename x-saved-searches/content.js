(function() {
  'use strict';

  let saveButton = null;
  let lastUrl = '';

  function isSearchPage() {
    return window.location.pathname.startsWith('/search');
  }

  function getCurrentSearchQuery() {
    return new URLSearchParams(window.location.search).get('q') || '';
  }

  function createSaveButton() {
    const btn = document.createElement('button');
    btn.className = 'x-saved-search-btn';
    btn.innerHTML = `
      <svg viewBox="0 0 24 24" width="20" height="20">
        <path d="M4 4.5C4 3.12 5.119 2 6.5 2h11C18.881 2 20 3.12 20 4.5v18.44l-8-5.71-8 5.71V4.5zM6.5 4c-.276 0-.5.22-.5.5v14.56l6-4.29 6 4.29V4.5c0-.28-.224-.5-.5-.5h-11z"/>
      </svg>
      <span>保存</span>
    `;
    btn.addEventListener('click', saveCurrentSearch);
    return btn;
  }

  function saveCurrentSearch() {
    const query = getCurrentSearchQuery();
    if (!query) {
      showNotification('検索クエリがありません', 'error');
      return;
    }

    chrome.storage.sync.get(['savedSearches'], (result) => {
      const searches = result.savedSearches || [];
      if (searches.some(s => s.query === query)) {
        showNotification('既に保存されています', 'info');
        return;
      }

      searches.unshift({
        id: Date.now().toString(),
        query: query,
        createdAt: new Date().toISOString()
      });

      chrome.storage.sync.set({ savedSearches: searches }, () => {
        showNotification('検索を保存しました', 'success');
        updateButtonState(true);
      });
    });
  }

  function updateButtonState(isSaved) {
    if (!saveButton) return;
    if (isSaved) {
      saveButton.classList.add('saved');
      saveButton.innerHTML = `
        <svg viewBox="0 0 24 24" width="20" height="20">
          <path d="M4 4.5C4 3.12 5.119 2 6.5 2h11C18.881 2 20 3.12 20 4.5v18.44l-8-5.71-8 5.71V4.5z"/>
        </svg>
        <span>保存済み</span>
      `;
    } else {
      saveButton.classList.remove('saved');
      saveButton.innerHTML = `
        <svg viewBox="0 0 24 24" width="20" height="20">
          <path d="M4 4.5C4 3.12 5.119 2 6.5 2h11C18.881 2 20 3.12 20 4.5v18.44l-8-5.71-8 5.71V4.5zM6.5 4c-.276 0-.5.22-.5.5v14.56l6-4.29 6 4.29V4.5c0-.28-.224-.5-.5-.5h-11z"/>
        </svg>
        <span>保存</span>
      `;
    }
  }

  function checkIfSaved() {
    const query = getCurrentSearchQuery();
    if (!query) return;
    chrome.storage.sync.get(['savedSearches'], (result) => {
      updateButtonState((result.savedSearches || []).some(s => s.query === query));
    });
  }

  function showNotification(message, type) {
    document.querySelector('.x-saved-search-notification')?.remove();
    const n = document.createElement('div');
    n.className = `x-saved-search-notification ${type}`;
    n.textContent = message;
    document.body.appendChild(n);
    setTimeout(() => n.classList.add('show'), 10);
    setTimeout(() => {
      n.classList.remove('show');
      setTimeout(() => n.remove(), 300);
    }, 2500);
  }

  function insertButton() {
    if (!isSearchPage()) {
      saveButton?.remove();
      return;
    }

    if (saveButton?.parentElement) {
      checkIfSaved();
      return;
    }

    const tabList = document.querySelector('[role="tablist"]');
    if (tabList && !document.querySelector('.x-saved-search-btn')) {
      saveButton = createSaveButton();
      const container = document.createElement('div');
      container.className = 'x-saved-search-container';
      container.appendChild(saveButton);
      const parent = tabList.closest('nav') || tabList.parentElement;
      parent?.parentElement?.insertBefore(container, parent.nextSibling);
      checkIfSaved();
    }
  }

  function init() {
    lastUrl = window.location.href;

    const checkUrl = () => {
      if (window.location.href !== lastUrl) {
        lastUrl = window.location.href;
        setTimeout(insertButton, 500);
      }
    };

    window.addEventListener('popstate', checkUrl);
    const pushState = history.pushState;
    history.pushState = function() { pushState.apply(history, arguments); checkUrl(); };
    const replaceState = history.replaceState;
    history.replaceState = function() { replaceState.apply(history, arguments); checkUrl(); };

    setInterval(checkUrl, 1000);
    setTimeout(insertButton, 1000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
