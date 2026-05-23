const { contextBridge, ipcRenderer } = require('electron');

/**
 * Helper: subscribe to an IPC channel and return an unsubscribe function.
 * This prevents listener stacking when React effects re-run.
 */
function onChannel(channel, transform) {
  const handler = (_event, ...args) => transform(...args);
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
}

contextBridge.exposeInMainWorld('electronAPI', {
  windowControl: (action) => ipcRenderer.send('window-controls', action),
  setOpacity: (opacity) => ipcRenderer.send('set-opacity', opacity),
  setIgnoreMouseEvents: (ignore, options) => ipcRenderer.send('set-ignore-mouse-events', ignore, options),
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  startWatching: (folderPath) => ipcRenderer.invoke('start-watching', folderPath),
  exportHtml: (htmlContent) => ipcRenderer.invoke('export-html', htmlContent),

  // All on* methods return an unsubscribe function to prevent listener leaks
  onNewLogLines: (callback) => onChannel('new-log-lines', (lines) => callback(lines)),
  onLogCleared: (callback) => onChannel('log-cleared', () => callback()),
  onLockStateChanged: (callback) => onChannel('lock-state-changed', (locked) => callback(locked)),
  onToggleMinimalist: (callback) => onChannel('toggle-minimalist', () => callback()),
  onBackendLog: (callback) => onChannel('backend-log', (msg) => callback(msg)),
  onResetEncounter: (callback) => onChannel('reset-encounter', () => callback()),
  onOpenReport: (callback) => onChannel('open-report', () => callback()),
  onToggleCollapseExpand: (callback) => onChannel('toggle-collapse-expand', () => callback()),

  // Requests to main process
  requestToggleLock: () => ipcRenderer.send('request-toggle-lock'),
  requestToggleMinimalist: () => ipcRenderer.send('request-toggle-minimalist'),

  // Keybindings
  getKeybindings: () => ipcRenderer.invoke('get-keybindings'),
  saveKeybindings: (bindings) => ipcRenderer.invoke('save-keybindings', bindings),
});
