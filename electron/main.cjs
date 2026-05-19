const { app, BrowserWindow, ipcMain, dialog, globalShortcut } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;

const isDev = process.env.NODE_ENV === 'development';

function logToBrowser(msg) {
  if (!isDev) return; // Only emit debug logs in development
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('backend-log', String(msg));
  }
}

// ── Window state persistence ──────────────────────────────────────
const configPath = path.join(app.getPath('userData'), 'window-state.json');

function getSavedBounds() {
  try {
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }
  } catch (e) {
    console.error(e);
  }
  return { width: 500, height: 700 };
}

function saveBounds(bounds) {
  try {
    fs.writeFileSync(configPath, JSON.stringify(bounds));
  } catch (e) {
    console.error(e);
  }
}

// ── Keybindings persistence ───────────────────────────────────────
const keybindingsPath = path.join(app.getPath('userData'), 'keybindings.json');

const DEFAULT_KEYBINDINGS = {
  toggleLock: 'F8',
  toggleMinimalist: 'F9',
  resetEncounter: '',
  openReport: ''
};

function loadKeybindings() {
  try {
    if (fs.existsSync(keybindingsPath)) {
      const data = JSON.parse(fs.readFileSync(keybindingsPath, 'utf8'));
      return { ...DEFAULT_KEYBINDINGS, ...data };
    }
  } catch (e) {
    console.error('Failed to load keybindings:', e);
  }
  return { ...DEFAULT_KEYBINDINGS };
}

function saveKeybindings(bindings) {
  try {
    fs.writeFileSync(keybindingsPath, JSON.stringify(bindings, null, 2));
    return true;
  } catch (e) {
    console.error('Failed to save keybindings:', e);
    return false;
  }
}

// ── Window creation ───────────────────────────────────────────────
function createWindow() {
  const bounds = getSavedBounds();
  
  mainWindow = new BrowserWindow({
    width: bounds.width || 500,
    height: bounds.height || 700,
    x: bounds.x,
    y: bounds.y,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false
    }
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Save bounds when window is resized or moved
  mainWindow.on('close', () => saveBounds(mainWindow.getBounds()));
  
  let resizeTimer;
  mainWindow.on('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => saveBounds(mainWindow.getBounds()), 500);
  });

  mainWindow.on('move', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => saveBounds(mainWindow.getBounds()), 500);
  });

  // Force always on top (pop-up-menu is safer than screen-saver for mouse events on Windows)
  mainWindow.setAlwaysOnTop(true, 'pop-up-menu');
}

// ── Application ready ─────────────────────────────────────────────
app.whenReady().then(() => {
  createWindow();

  let isLocked = false;
  let isMinimalist = false;

  // ── Lock toggle ───────────────────────────────────────────────
  const setLockState = (locked) => {
    if (!mainWindow) return;
    isLocked = locked;
    mainWindow.setIgnoreMouseEvents(isLocked, { forward: true });
    mainWindow.webContents.send('lock-state-changed', isLocked);
  };

  const toggleLock = () => setLockState(!isLocked);

  // ── Minimalist toggle (auto-locks on enter, auto-unlocks on exit)
  const toggleMinimalist = () => {
    if (!mainWindow) return;
    isMinimalist = !isMinimalist;

    if (isMinimalist) {
      // Entering minimalist → auto-lock
      mainWindow.webContents.send('toggle-minimalist');
      if (!isLocked) setLockState(true);
    } else {
      // Exiting minimalist → auto-unlock
      if (isLocked) setLockState(false);
      mainWindow.webContents.send('toggle-minimalist');
    }
  };

  // ── Shortcut actions for reset/report ─────────────────────────
  const resetEncounter = () => {
    if (mainWindow) mainWindow.webContents.send('reset-encounter');
  };

  const openReport = () => {
    if (mainWindow) mainWindow.webContents.send('open-report');
  };

  // ── Action map for dynamic shortcut registration ──────────────
  const actionMap = {
    toggleLock,
    toggleMinimalist,
    resetEncounter,
    openReport
  };

  // ── Register shortcuts from keybindings config ────────────────
  let currentBindings = loadKeybindings();

  function registerShortcuts(bindings) {
    // Unregister all first, then re-register
    globalShortcut.unregisterAll();

    // Always-available fallback: Ctrl+Shift+L for lock toggle
    globalShortcut.register('CommandOrControl+Shift+L', toggleLock);

    for (const [action, accelerator] of Object.entries(bindings)) {
      if (!accelerator || accelerator === '') continue;
      // Skip if this is the same as the hardcoded fallback
      if (accelerator === 'CommandOrControl+Shift+L') continue;

      const handler = actionMap[action];
      if (!handler) continue;

      try {
        globalShortcut.register(accelerator, handler);
        logToBrowser(`Registered shortcut: ${accelerator} → ${action}`);
      } catch (e) {
        console.error(`Failed to register shortcut ${accelerator} for ${action}:`, e);
      }
    }
  }

  registerShortcuts(currentBindings);

  // ── IPC: Renderer requests ────────────────────────────────────
  ipcMain.on('request-toggle-lock', () => toggleLock());
  ipcMain.on('request-toggle-minimalist', () => toggleMinimalist());

  // ── IPC: Keybindings ──────────────────────────────────────────
  ipcMain.handle('get-keybindings', () => {
    return currentBindings;
  });

  ipcMain.handle('save-keybindings', (_event, bindings) => {
    currentBindings = { ...DEFAULT_KEYBINDINGS, ...bindings };
    const ok = saveKeybindings(currentBindings);
    if (ok) registerShortcuts(currentBindings);
    return ok;
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// ── IPC Handlers ──────────────────────────────────────────────────
ipcMain.on('window-controls', (event, action) => {
  if (!mainWindow) return;
  if (action === 'close') {
    app.quit();
  } else if (action === 'minimize') {
    mainWindow.minimize();
  }
});

ipcMain.on('set-opacity', (event, opacity) => {
  if (mainWindow) {
    mainWindow.setOpacity(opacity);
  }
});

// ── File Parser Setup ─────────────────────────────────────────────
let currentLogPath = '';
let lastSize = 0;

ipcMain.handle('select-folder', async () => {
  logToBrowser('select-folder requested');
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });
  if (!result.canceled && result.filePaths.length > 0) {
    logToBrowser('Folder selected: ' + result.filePaths[0]);
    return result.filePaths[0];
  }
  logToBrowser('Folder selection canceled');
  return null;
});

ipcMain.handle('start-watching', (event, folderPath) => {
  logToBrowser('start-watching called with: ' + folderPath);
  if (currentLogPath) {
    fs.unwatchFile(currentLogPath);
  }
  const filePath = path.join(folderPath, 'Damage.log');
  currentLogPath = filePath;
  lastSize = 0;
  
  if (fs.existsSync(filePath)) {
    lastSize = fs.statSync(filePath).size;
    logToBrowser('File exists, watching. Initial size: ' + lastSize);
    
    // Using watchFile for reliable size tracking, watching every 500ms
    fs.watchFile(filePath, { interval: 500 }, (curr, prev) => {
      if (curr.size < prev.size) {
        logToBrowser('File cleared (size decreased)');
        // File was cleared
        lastSize = curr.size;
        mainWindow.webContents.send('log-cleared');
      } else if (curr.size > prev.size) {
        logToBrowser('File size increased from ' + prev.size + ' to ' + curr.size);
        // Read new data
        const stream = fs.createReadStream(filePath, {
          start: lastSize,
          end: curr.size,
          encoding: 'utf8'
        });
        
        stream.on('error', (err) => {
          logToBrowser('Stream error: ' + err.message);
        });
        
        let newContent = '';
        stream.on('data', chunk => {
          newContent += chunk;
        });
        
        stream.on('end', () => {
          lastSize = curr.size;
          const lines = newContent.split(/\r?\n/).filter(line => line.trim() !== '');
          logToBrowser('Extracted ' + lines.length + ' new lines');
          if (lines.length > 0) {
            mainWindow.webContents.send('new-log-lines', lines);
          }
        });
      }
    });
    return true;
  }
  logToBrowser('File does not exist: ' + filePath);
  return false;
});

ipcMain.handle('export-html', async (event, htmlContent) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Export Encounter Report',
    defaultPath: 'HellClock_DamageReport.html',
    filters: [{ name: 'HTML Files', extensions: ['html'] }]
  });

  if (!result.canceled && result.filePath) {
    fs.writeFileSync(result.filePath, htmlContent, 'utf-8');
    return true;
  }
  return false;
});
