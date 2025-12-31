const { contextBridge, ipcRenderer } = require('electron')

// 暴露 IPC API 到 window 对象
contextBridge.exposeInMainWorld('electronAPI', {
  quitApp: () => ipcRenderer.send('quit-app'),
  onConfirmExit: (callback) => ipcRenderer.on('confirm-exit', callback),
  executeExit: () => ipcRenderer.send('execute-exit'),
  cancelExit: () => ipcRenderer.send('cancel-exit')
})
