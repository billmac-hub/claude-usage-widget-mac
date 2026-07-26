const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  usage: {
    onData: (cb) => ipcRenderer.on('usage:data', (_e, payload) => cb(payload)),
    refresh: () => ipcRenderer.invoke('usage:refresh'),
  },
  settings: {
    load: () => ipcRenderer.invoke('settings:load'),
  },
  win: {
    togglePin: () => ipcRenderer.invoke('win:togglePin'),
    setExpanded: (expanded) => ipcRenderer.invoke('win:setExpanded', expanded),
    setHeight: (height) => ipcRenderer.invoke('win:setHeight', height),
  },
});
