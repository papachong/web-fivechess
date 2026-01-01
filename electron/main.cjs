const { app, BrowserWindow, Menu, ipcMain, dialog } = require('electron')
const path = require('path')
// Check if app is packaged - when bundled, app.isPackaged is true
const isDev = !app.isPackaged

let mainWindow
let isQuitting = false

// 处理来自渲染进程的退出请求
ipcMain.on('quit-app', (event) => {
  // 设置标志并直接退出
  isQuitting = true
  app.quit()
})

function getAssetPath(asset) {
  if (isDev) {
    return path.join(__dirname, '../public', asset)
  }
  // 在打包后，资源在 app.asar 内的 dist 目录
  return path.join(__dirname, '../dist', asset)
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 900,
    minWidth: 600,
    minHeight: 700,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs')
    },
    icon: isDev ? path.join(__dirname, '../public/icon.png') : path.join(__dirname, '../dist/icon.png'),
    title: '小miu仔五子棋',
    backgroundColor: '#0f172a',
    show: false
  })

  // 加载HTML文件
  // 在开发和生产环境中，dist 目录都在相同位置
  const indexPath = path.join(__dirname, '../dist/index.html')
  
  console.log('Loading index.html from:', indexPath)
  console.log('isDev:', isDev)
  console.log('app.isPackaged:', app.isPackaged)
  console.log('__dirname:', __dirname)
  
  mainWindow.loadFile(indexPath)

  // 窗口准备好后再显示，避免闪烁
  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
  })

  // 创建菜单
  const template = [
    {
      label: '游戏',
      submenu: [
        {
          label: '重新开始',
          accelerator: 'CmdOrCtrl+R',
          click: () => {
            mainWindow.webContents.executeJavaScript('document.querySelector("#menu-reset")?.click()')
          }
        },
        {
          label: '悔棋',
          accelerator: 'CmdOrCtrl+Z',
          click: () => {
            mainWindow.webContents.executeJavaScript('document.querySelector("#top-undo")?.click()')
          }
        },
        { type: 'separator' },
        {
          label: '退出',
          accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Alt+F4',
          click: () => app.quit()
        }
      ]
    },
    {
      label: '视图',
      submenu: [
        { role: 'reload', label: '刷新' },
        { role: 'toggleDevTools', label: '开发者工具' },
        { type: 'separator' },
        { role: 'resetZoom', label: '重置缩放' },
        { role: 'zoomIn', label: '放大' },
        { role: 'zoomOut', label: '缩小' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: '全屏' }
      ]
    },
    {
      label: '帮助',
      submenu: [
        {
          label: '关于',
          click: () => {
            const { dialog } = require('electron')
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: '关于 小miu仔五子棋',
              message: '小miu仔五子棋 v1.0.0',
              detail: '一款简洁优雅的五子棋游戏\n\n作者: GallenMa\n© 2025 All rights reserved.'
            })
          }
        }
      ]
    }
  ]

  // macOS 特殊处理
  if (process.platform === 'darwin') {
    template.unshift({
      label: app.getName(),
      submenu: [
        { role: 'about', label: '关于' },
        { type: 'separator' },
        { role: 'services', label: '服务' },
        { type: 'separator' },
        { role: 'hide', label: '隐藏' },
        { role: 'hideOthers', label: '隐藏其他' },
        { role: 'unhide', label: '显示全部' },
        { type: 'separator' },
        { role: 'quit', label: '退出' }
      ]
    })
  }

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)

  // 处理窗口关闭事件
  mainWindow.on('close', (event) => {
    if (isQuitting) {
      return
    }
    // 阻止默认关闭
    event.preventDefault()
    
    // 在主进程显示确认对话框
    dialog.showMessageBox(mainWindow, {
      type: 'question',
      buttons: ['取消', '退出'],
      defaultId: 0,
      cancelId: 0,
      title: '确认退出',
      message: '确定要退出游戏吗？'
    }).then(result => {
      if (result.response === 1) {
        // 用户点击了"退出"按钮
        isQuitting = true
        mainWindow.destroy()
        app.quit()
      }
      // 用户点击了"取消"按钮，不做任何操作
    })
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

// 处理来自渲染进程的确认关闭
ipcMain.on('execute-exit', (event) => {
  isQuitting = true
  if (mainWindow) {
    mainWindow.destroy()
  }
  app.quit()
})

// 取消关闭
ipcMain.on('cancel-exit', (event) => {
  // 不做任何操作，用户取消了关闭
})

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})
