const {
  app,
  BrowserWindow,
  BrowserView,
  Menu,
  ipcMain,
  session
} = require('electron');
const path = require('path');

let mainWindow;
let tabs = [];
let activeTabId = null;

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    frame: false,
    backgroundColor: '#050509',
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'ui/index.html'));

  mainWindow.on('resize', () => {
    resizeActiveTab();
  });
}

function createTab(url = 'https://360-search.com') {
  const view = new BrowserView({
    webPreferences: {
      preload: path.join(__dirname, 'preload.js')
    }
  });

  const id = Date.now().toString();
  tabs.push({ id, view });

  attachTabEvents(id, view);
  attachContextMenu(view);

  view.webContents.loadURL(url);
  setActiveTab(id);

  mainWindow.webContents.send('tab-added', {
    id,
    url,
    title: 'New Tab'
  });
}

function attachTabEvents(id, view) {
  view.webContents.on('page-title-updated', (_, title) => {
    mainWindow.webContents.send('tab-updated', {
      id,
      title,
      url: view.webContents.getURL()
    });
  });

  view.webContents.on('did-navigate', (_, url) => {
    mainWindow.webContents.send('tab-updated', {
      id,
      title: view.webContents.getTitle(),
      url
    });
  });

  view.webContents.on('did-start-loading', () => {
    mainWindow.webContents.send('tab-loading', { id, loading: true });
  });

  view.webContents.on('did-stop-loading', () => {
    mainWindow.webContents.send('tab-loading', { id, loading: false });
  });
}

function attachContextMenu(view) {
  view.webContents.on('context-menu', (event, params) => {
    const menu = Menu.buildFromTemplate([
      {
        label: 'Back',
        enabled: view.webContents.canGoBack(),
        click: () => view.webContents.goBack()
      },
      {
        label: 'Forward',
        enabled: view.webContents.canGoForward(),
        click: () => view.webContents.goForward()
      },
      { type: 'separator' },
      {
        label: 'Reload',
        click: () => view.webContents.reload()
      },
      { type: 'separator' },
      {
        label: 'Copy',
        role: 'copy',
        enabled: params.editFlags.canCopy
      },
      {
        label: 'Paste',
        role: 'paste',
        enabled: params.editFlags.canPaste
      },
      { type: 'separator' },
      {
        label: 'Inspect',
        click: () => view.webContents.inspectElement(params.x, params.y)
      }
    ]);
    menu.popup();
  });
}

function setActiveTab(id) {
  const tab = tabs.find(t => t.id === id);
  if (!tab || !mainWindow) return;

  activeTabId = id;
  mainWindow.setBrowserView(tab.view);
  resizeActiveTab();

  mainWindow.webContents.send('tab-activated', {
    id,
    url: tab.view.webContents.getURL(),
    title: tab.view.webContents.getTitle()
  });
}

function resizeActiveTab() {
  if (!mainWindow || !activeTabId) return;
  const tab = tabs.find(t => t.id === activeTabId);
  if (!tab) return;

  const bounds = mainWindow.getBounds();
  const chromeHeight = 64; // height of top bar
  tab.view.setBounds({
    x: 0,
    y: chromeHeight,
    width: bounds.width,
    height: bounds.height - chromeHeight
  });
  tab.view.setAutoResize({ width: true, height: true });
}

function closeTab(id) {
  const idx = tabs.findIndex(t => t.id === id);
  if (idx === -1) return;

  const [tab] = tabs.splice(idx, 1);
  tab.view.webContents.destroy();

  if (tabs.length === 0) {
    createTab();
  } else {
    const next = tabs[Math.max(0, idx - 1)];
    setActiveTab(next.id);
  }

  mainWindow.webContents.send('tab-closed', { id });
}

function getActiveTab() {
  return tabs.find(t => t.id === activeTabId) || null;
}

// Downloads
app.on('session-created', (ses) => {
  ses.on('will-download', (event, item) => {
    const fileName = item.getFilename();
    const savePath = path.join(app.getPath('downloads'), fileName);
    item.setSavePath(savePath);

    const id = Date.now().toString();
    mainWindow.webContents.send('download-started', {
      id,
      fileName,
      savePath
    });

    item.on('updated', (_, state) => {
      mainWindow.webContents.send('download-updated', {
        id,
        state,
        receivedBytes: item.getReceivedBytes(),
        totalBytes: item.getTotalBytes()
      });
    });

    item.on('done', (_, state) => {
      mainWindow.webContents.send('download-completed', {
        id,
        state,
        savePath
      });
    });
  });
});

// IPC

ipcMain.on('new-tab', (_, url) => {
  createTab(url || 'https://360-search.com');
});

ipcMain.on('activate-tab', (_, id) => {
  setActiveTab(id);
});

ipcMain.on('close-tab', (_, id) => {
  closeTab(id);
});

ipcMain.on('navigate', (_, url) => {
  const tab = getActiveTab();
  if (!tab) return;

  if (!/^https?:\/\//i.test(url)) {
    const q = encodeURIComponent(url);
    url = `https://360-search.com/search?q=${q}`;
  }

  tab.view.webContents.loadURL(url);
});

ipcMain.on('go-back', () => {
  const tab = getActiveTab();
  if (tab && tab.view.webContents.canGoBack()) {
    tab.view.webContents.goBack();
  }
});

ipcMain.on('go-forward', () => {
  const tab = getActiveTab();
  if (tab && tab.view.webContents.canGoForward()) {
    tab.view.webContents.goForward();
  }
});

ipcMain.on('reload', () => {
  const tab = getActiveTab();
  if (tab) tab.view.webContents.reload();
});

ipcMain.on('window-control', (_, action) => {
  if (!mainWindow) return;
  if (action === 'minimize') mainWindow.minimize();
  if (action === 'maximize') {
    if (mainWindow.isMaximized()) mainWindow.unmaximize();
    else mainWindow.maximize();
  }
  if (action === 'close') mainWindow.close();
});

app.whenReady().then(() => {
  createMainWindow();
  createTab();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
      createTab();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
