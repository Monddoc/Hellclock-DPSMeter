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

app.whenReady().then(() => {
  createWindow();

  let isLocked = false;

  const toggleLock = () => {
    if (!mainWindow) return;
    isLocked = !isLocked;
    // setIgnoreMouseEvents called directly here in the main process — always works
    mainWindow.setIgnoreMouseEvents(isLocked, { forward: true });
    // Notify renderer to update its UI (lock icon, indicator)
    mainWindow.webContents.send('lock-state-changed', isLocked);
  };

  globalShortcut.register('CommandOrControl+Shift+L', toggleLock);
  globalShortcut.register('F8', toggleLock);

  // Allow renderer to request a lock toggle (e.g. clicking the padlock button)
  ipcMain.on('request-toggle-lock', () => toggleLock());

  // Minimalist mode exit shortcut (F9)
  globalShortcut.register('F9', () => {
    if (mainWindow) mainWindow.webContents.send('exit-minimalist');
  });

  // Allow renderer to also request exit-minimalist via IPC (button click)
  ipcMain.on('request-exit-minimalist', () => {
    if (mainWindow) mainWindow.webContents.send('exit-minimalist');
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

// IPC Handlers
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

// Lock is now managed entirely in main process via request-toggle-lock and globalShortcut

// File Parser Setup
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
