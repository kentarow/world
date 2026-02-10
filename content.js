// X Saved Searches - Content Script
// 検索ページで現在の検索クエリを保存するボタンを追加

(function() {
  'use strict';

  let saveButton = null;
  let lastUrl = '';

  // 検索ページかどうかをチェック
  function isSearchPage() {
    return window.location.pathname.startsWith('/search');
  }

  // 現在の検索クエリを取得
  function getCurrentSearchQuery() {
    const params = new URLSearchParams(window.location.search);
    return params.get('q') || '';
  }

  // 保存ボタンを作成
  function createSaveButton() {
    const btn = document.createElement('button');
    btn.className = 'x-saved-search-btn';
    btn.innerHTML = `
      <svg viewBox="0 0 24 24" width="20" height="20">
        <path d="M4 4.5C4 3.12 5.119 2 6.5 2h11C18.881 2 20 3.12 20 4.5v18.44l-8-5.71-8 5.71V4.5zM6.5 4c-.276 0-.5.22-.5.5v14.56l6-4.29 6 4.29V4.5c0-.28-.224-.5-.5-.5h-11z"/>
      </svg>
      <span>保存</span>
    `;
    btn.title = '検索を保存';
    btn.addEventListener('click', saveCurrentSearch);
    return btn;
  }

  // 現在の検索を保存
  function saveCurrentSearch() {
    const query = getCurrentSearchQuery();
    if (!query) {
      showNotification('検索クエリがありません', 'error');
      return;
    }

    chrome.storage.sync.get(['savedSearches'], (result) => {
      const searches = result.savedSearches || [];

      // 重複チェック
      if (searches.some(s => s.query === query)) {
        showNotification('この検索は既に保存されています', 'info');
        return;
      }

      const newSearch = {
        id: Date.now().toString(),
        query: query,
        createdAt: new Date().toISOString()
      };

      searches.unshift(newSearch);

      chrome.storage.sync.set({ savedSearches: searches }, () => {
        showNotification('検索を保存しました', 'success');
        updateButtonState(true);
      });
    });
  }

  // ボタンの状態を更新（保存済みかどうか）
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

  // 現在の検索が保存済みかチェック
  function checkIfSaved() {
    const query = getCurrentSearchQuery();
    if (!query) return;

    chrome.storage.sync.get(['savedSearches'], (result) => {
      const searches = result.savedSearches || [];
      const isSaved = searches.some(s => s.query === query);
      updateButtonState(isSaved);
    });
  }

  // 通知を表示
  function showNotification(message, type) {
    const existing = document.querySelector('.x-saved-search-notification');
    if (existing) {
      existing.remove();
    }

    const notification = document.createElement('div');
    notification.className = `x-saved-search-notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => notification.classList.add('show'), 10);
    setTimeout(() => {
      notification.classList.remove('show');
      setTimeout(() => notification.remove(), 300);
    }, 2500);
  }

  // ボタンを挿入
  function insertButton() {
    if (!isSearchPage()) {
      if (saveButton && saveButton.parentElement) {
        saveButton.remove();
      }
      return;
    }

    // 既にボタンがある場合は状態だけ更新
    if (saveButton && saveButton.parentElement) {
      checkIfSaved();
      return;
    }

    // ヘッダー領域を探す（Xの検索ページのフィルタータブの近く）
    const tryInsert = () => {
      // 検索フィルターのタブを探す
      const tabList = document.querySelector('[role="tablist"]');
      if (tabList && !document.querySelector('.x-saved-search-btn')) {
        saveButton = createSaveButton();

        // ボタン用のコンテナを作成
        const container = document.createElement('div');
        container.className = 'x-saved-search-container';
        container.appendChild(saveButton);

        // タブリストの親要素の後に挿入
        const parent = tabList.closest('nav') || tabList.parentElement;
        if (parent && parent.parentElement) {
          parent.parentElement.insertBefore(container, parent.nextSibling);
          checkIfSaved();
        }
      }
    };

    tryInsert();

    // DOMの変更を監視（Xは動的にDOMを変更するため）
    if (!window.xSavedSearchObserver) {
      window.xSavedSearchObserver = new MutationObserver(() => {
        if (isSearchPage() && !document.querySelector('.x-saved-search-btn')) {
          tryInsert();
        }
      });

      window.xSavedSearchObserver.observe(document.body, {
        childList: true,
        subtree: true
      });
    }
  }

  // URLの変更を監視
  function watchUrlChanges() {
    const checkUrl = () => {
      if (window.location.href !== lastUrl) {
        lastUrl = window.location.href;
        setTimeout(insertButton, 500);
      }
    };

    // popstate イベントを監視
    window.addEventListener('popstate', checkUrl);

    // pushState と replaceState をフック
    const originalPushState = history.pushState;
    history.pushState = function() {
      originalPushState.apply(history, arguments);
      checkUrl();
    };

    const originalReplaceState = history.replaceState;
    history.replaceState = function() {
      originalReplaceState.apply(history, arguments);
      checkUrl();
    };

    // 定期的にチェック（バックアップ）
    setInterval(checkUrl, 1000);
  }

  // 初期化
  function init() {
    lastUrl = window.location.href;
    watchUrlChanges();

    // 少し遅延させて初期挿入
    setTimeout(insertButton, 1000);
  }

  // DOMが準備できたら初期化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
