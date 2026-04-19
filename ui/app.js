const tabsEl = document.getElementById('tabs');
const newTabBtn = document.getElementById('new-tab-btn');
const omnibox = document.getElementById('omnibox');
const backBtn = document.getElementById('back-btn');
const forwardBtn = document.getElementById('forward-btn');
const reloadBtn = document.getElementById('reload-btn');
const downloadsTray = document.getElementById('downloads-tray');
const windowControls = document.querySelector('.window-controls');

let tabs = {};
let activeTabId = null;
let downloads = {};

function createTabElement({ id, title }) {
  const tabEl = document.createElement('div');
  tabEl.className = 'tab';
  tabEl.dataset.id = id;

  const titleEl = document.createElement('div');
  titleEl.className = 'tab-title';
  titleEl.textContent = title || 'New Tab';

  const closeBtn = document.createElement('button');
  closeBtn.className = 'tab-close';
  closeBtn.textContent = '×';

  tabEl.appendChild(titleEl);
  tabEl.appendChild(closeBtn);

  tabEl.addEventListener('click', (e) => {
    if (e.target === closeBtn) return;
    window.orbit.activateTab(id);
  });

  closeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    window.orbit.closeTab(id);
  });

  tabsEl.appendChild(tabEl);
  tabs[id] = { id, el: tabEl, titleEl };
}

function setActiveTab(id) {
  activeTabId = id;
  Object.values(tabs).forEach(t => t.el.classList.remove('active'));
  if (tabs[id]) {
    tabs[id].el.classList.add('active');
  }
}

function updateTab({ id, title, url }) {
  if (!tabs[id]) return;
  if (title) tabs[id].titleEl.textContent = title;
  if (id === activeTabId && url) {
    omnibox.value = url;
  }
}

function removeTab(id) {
  if (!tabs[id]) return;
  tabs[id].el.remove();
  delete tabs[id];
}

// IPC bindings

window.orbit.onTabAdded((data) => {
  createTabElement(data);
});

window.orbit.onTabUpdated((data) => {
  updateTab(data);
});

window.orbit.onTabActivated((data) => {
  setActiveTab(data.id);
  if (data.url) omnibox.value = data.url;
});

window.orbit.onTabClosed((data) => {
  removeTab(data.id);
});

window.orbit.onTabLoading(({ id, loading }) => {
  if (!tabs[id]) return;
  tabs[id].el.style.opacity = loading ? '0.8' : '1';
});

// Downloads

window.orbit.onDownloadStarted((data) => {
  const { id, fileName } = data;
  const itemEl = document.createElement('div');
  itemEl.className = 'download-item';

  const titleEl = document.createElement('div');
  titleEl.className = 'download-item-title';
  titleEl.textContent = fileName;

  const statusEl = document.createElement('div');
  statusEl.textContent = 'Starting...';

  const progressEl = document.createElement('div');
  progressEl.className = 'download-progress';

  const barEl = document.createElement('div');
  barEl.className = 'download-progress-bar';
  progressEl.appendChild(barEl);

  itemEl.appendChild(titleEl);
  itemEl.appendChild(statusEl);
  itemEl.appendChild(progressEl);

  downloadsTray.appendChild(itemEl);

  downloads[id] = { itemEl, statusEl, barEl };
});

window.orbit.onDownloadUpdated((data) => {
  const { id, state, receivedBytes, totalBytes } = data;
  const dl = downloads[id];
  if (!dl) return;

  const pct = totalBytes > 0 ? (receivedBytes / totalBytes) * 100 : 0;
  dl.barEl.style.width = `${pct}%`;
  dl.statusEl.textContent = state === 'progressing'
    ? `Downloading... ${pct.toFixed(0)}%`
    : state;
});

window.orbit.onDownloadCompleted((data) => {
  const { id, state } = data;
  const dl = downloads[id];
  if (!dl) return;

  dl.barEl.style.width = '100%';
  dl.statusEl.textContent = state === 'completed' ? 'Completed' : `Failed: ${state}`;

  setTimeout(() => {
    dl.itemEl.remove();
    delete downloads[id];
  }, 5000);
});

// UI events

newTabBtn.addEventListener('click', () => {
  window.orbit.newTab();
});

omnibox.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    const value = omnibox.value.trim();
    if (!value) return;
    window.orbit.navigate(value);
  }
});

backBtn.addEventListener('click', () => {
  window.orbit.goBack();
});

forwardBtn.addEventListener('click', () => {
  window.orbit.goForward();
});

reloadBtn.addEventListener('click', () => {
  window.orbit.reload();
});

windowControls.addEventListener('click', (e) => {
  const btn = e.target.closest('.win-btn');
  if (!btn) return;
  const action = btn.dataset.action;
  window.orbit.windowControl(action);
});
