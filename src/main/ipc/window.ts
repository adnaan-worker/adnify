/**
 * 窗口控制 IPC handlers
 */

import { ipcMain, BrowserWindow, app } from 'electron'

export function registerWindowHandlers(createWindow: (isEmpty?: boolean) => BrowserWindow) {
  ipcMain.on('window:minimize', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    win?.minimize()
  })

  ipcMain.on('window:maximize', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win?.isMaximized()) {
      win.unmaximize()
    } else {
      win?.maximize()
    }
  })

  ipcMain.on('window:close', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    win?.close()
  })

  ipcMain.on('window:toggleDevTools', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    win?.webContents.toggleDevTools()
  })

  // 新增：打开新窗口
  ipcMain.handle('window:new', () => {
    createWindow(true)
  })

  ipcMain.handle('app:getVersion', () => {
    return app.getVersion()
  })

  // 渲染端准备完毕，显示窗口
  ipcMain.on('app:ready', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win && !win.isDestroyed()) {
      win.show()
    }
  })

  // 获取当前窗口的唯一标识（webContents.id）
  ipcMain.handle('window:getId', (event) => {
    return event.sender.id
  })
}
