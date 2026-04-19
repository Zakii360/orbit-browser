const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('orbit', {
  newTab: (url) => ipcRenderer.send('new-tab', url),
  activateTab: (id) => ipcRenderer.send('activate-tab', id),
  closeTab: (id) => ipcRenderer.send('close-tab', id),
  navigate: (url) => ipcRenderer.send('navigate', url),
  goBack: () => ipcRenderer.send('go-back'),
  goForward: () => ipcRenderer.send('go-forward'),
  reload: () => ipcRenderer.send('reload'),
  windowControl: (action) => ipcRenderer.send('window-control', action),

  onTabAdded: (cb) => ipcRenderer.on('tab-added', (_, data) => cb(data)),
  onTabUpdated: (cb) => ipcRenderer.on('tab-updated', (_, data) => cb(data)),
  onTabActivated: (cb) => ipcRenderer.on('tab-activated', (_, data) => cb(data)),
  onTabClosed: (cb) => ipcRenderer.on('tab-closed', (_, data) => cb(data)),
  onTabLoading: (cb) => ipcRenderer.on('tab-loading', (_, data) => cb(data)),

  onDownloadStarted: (cb) => ipcRenderer.on('download-started', (_, data) => cb(data)),
  onDownloadUpdated: (cb) => ipcRenderer.on('download-updated', (_, data) => cb(data)),
  onDownloadCompleted: (cb) => ipcRenderer.on('download-completed', (_, data) => cb(data))
});
