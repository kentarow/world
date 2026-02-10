document.addEventListener('DOMContentLoaded', () => {
  const searchInput = document.getElementById('searchInput');
  const addBtn = document.getElementById('addBtn');
  const searchList = document.getElementById('searchList');
  const emptyState = document.getElementById('emptyState');
  const exportBtn = document.getElementById('exportBtn');
  const importBtn = document.getElementById('importBtn');
  const importFile = document.getElementById('importFile');

  loadSearches();

  addBtn.addEventListener('click', addSearch);
  searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addSearch();
  });
  exportBtn.addEventListener('click', exportSearches);
  importBtn.addEventListener('click', () => importFile.click());
  importFile.addEventListener('change', importSearches);

  function addSearch() {
    const query = searchInput.value.trim();
    if (!query) return;

    chrome.storage.sync.get(['savedSearches'], (result) => {
      const searches = result.savedSearches || [];
      if (searches.some(s => s.query === query)) {
        showToast('この検索は既に保存されています');
        return;
      }

      searches.unshift({
        id: Date.now().toString(),
        query: query,
        createdAt: new Date().toISOString()
      });

      chrome.storage.sync.set({ savedSearches: searches }, () => {
        searchInput.value = '';
        loadSearches();
        showToast('検索を保存しました');
      });
    });
  }

  function deleteSearch(id) {
    chrome.storage.sync.get(['savedSearches'], (result) => {
      const filtered = (result.savedSearches || []).filter(s => s.id !== id);
      chrome.storage.sync.set({ savedSearches: filtered }, () => {
        loadSearches();
        showToast('検索を削除しました');
      });
    });
  }

  function executeSearch(query) {
    chrome.tabs.create({ url: `https://x.com/search?q=${encodeURIComponent(query)}` });
  }

  function loadSearches() {
    chrome.storage.sync.get(['savedSearches'], (result) => {
      const searches = result.savedSearches || [];

      if (searches.length === 0) {
        searchList.innerHTML = '';
        emptyState.classList.remove('hidden');
        return;
      }

      emptyState.classList.add('hidden');
      searchList.innerHTML = searches.map(search => `
        <div class="search-item" data-id="${search.id}" data-query="${escapeHtml(search.query)}">
          <svg class="search-icon" viewBox="0 0 24 24">
            <path d="M10.25 3.75c-3.59 0-6.5 2.91-6.5 6.5s2.91 6.5 6.5 6.5c1.795 0 3.419-.726 4.596-1.904 1.178-1.177 1.904-2.801 1.904-4.596 0-3.59-2.91-6.5-6.5-6.5zm-8.5 6.5c0-4.694 3.806-8.5 8.5-8.5s8.5 3.806 8.5 8.5c0 1.986-.682 3.815-1.824 5.262l4.781 4.781-1.414 1.414-4.781-4.781c-1.447 1.142-3.276 1.824-5.262 1.824-4.694 0-8.5-3.806-8.5-8.5z"/>
          </svg>
          <span class="search-text">${escapeHtml(search.query)}</span>
          <button class="delete-btn" data-id="${search.id}" title="削除">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
              <path d="M10.59 12L4.54 5.96l1.42-1.42L12 10.59l6.04-6.05 1.42 1.42L13.41 12l6.05 6.04-1.42 1.42L12 13.41l-6.04 6.05-1.42-1.42L10.59 12z"/>
            </svg>
          </button>
        </div>
      `).join('');

      document.querySelectorAll('.search-item').forEach(item => {
        item.addEventListener('click', (e) => {
          if (!e.target.closest('.delete-btn')) {
            executeSearch(item.dataset.query);
          }
        });
      });

      document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          deleteSearch(btn.dataset.id);
        });
      });
    });
  }

  function exportSearches() {
    chrome.storage.sync.get(['savedSearches'], (result) => {
      const blob = new Blob([JSON.stringify(result.savedSearches || [], null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `x-saved-searches-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      showToast('エクスポートしました');
    });
  }

  function importSearches(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target.result);
        if (!Array.isArray(imported)) {
          showToast('無効なファイル形式です');
          return;
        }

        chrome.storage.sync.get(['savedSearches'], (result) => {
          const existing = result.savedSearches || [];
          const existingQueries = new Set(existing.map(s => s.query));
          const newSearches = imported
            .filter(s => s.query && !existingQueries.has(s.query))
            .map(s => ({
              id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
              query: s.query,
              createdAt: s.createdAt || new Date().toISOString()
            }));

          chrome.storage.sync.set({ savedSearches: [...newSearches, ...existing] }, () => {
            loadSearches();
            showToast(`${newSearches.length}件インポートしました`);
          });
        });
      } catch (err) {
        showToast('読み込み失敗');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function showToast(message) {
    document.querySelector('.toast')?.remove();
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 2000);
  }
});
