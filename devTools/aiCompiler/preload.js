const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('fs', {
  openFolder: () => ipcRenderer.invoke('fs:open-folder'),
  getWorkspace: () => ipcRenderer.invoke('fs:get-workspace'),
  listDir: (rel) => ipcRenderer.invoke('fs:list-dir', rel),
  readFile: (rel) => ipcRenderer.invoke('fs:read-file', rel),
  writeFile: (rel, content) => ipcRenderer.invoke('fs:write-file', rel, content),
  createFile: (rel) => ipcRenderer.invoke('fs:create-file', rel),
  deleteFile: (rel) => ipcRenderer.invoke('fs:delete-file', rel),
  rename: (rel, newName) => ipcRenderer.invoke('fs:rename', rel, newName),
  createDir: (rel) => ipcRenderer.invoke('fs:create-dir', rel),
  deleteDir: (rel) => ipcRenderer.invoke('fs:delete-dir', rel),
});

contextBridge.exposeInMainWorld('shell', {
  openExternal: (url) => ipcRenderer.invoke('shell:open-external', url),
});

// 主进程转发的事件（Ctrl+W 等）
contextBridge.exposeInMainWorld('appEvents', {
  onCtrlW: (cb) => ipcRenderer.on('app:ctrl-w', () => cb()),
});
