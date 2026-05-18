const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  windowControl: (action) => ipcRenderer.send('window-controls', action),
  setOpacity: (opacity) => ipcRenderer.send('set-opacity', opacity),
  setIgnoreMouseEvents: (ignore, options) => ipcRenderer.send('set-ignore-mouse-events', ignore, options),
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  startWatching: (folderPath) => ipcRenderer.invoke('start-watching', folderPath),
  exportHtml: (htmlContent) => ipcRenderer.invoke('export-html', htmlContent),
  onNewLogLines: (callback) => ipcRenderer.on('new-log-lines', (_event, lines) => callback(lines)),
  onLogCleared: (callback) => ipcRenderer.on('log-cleared', () => callback())
});
