/**
 * Adnify Main Process
 * 重构后的主进程入口
 */

import { app, BrowserWindow } from 'electron'
import * as path from 'path'
import * as fs from 'fs'
import Store from 'electron-store'
import { registerAllHandlers, cleanupAllHandlers, updateLLMServiceWindow } from './ipc'
import { lspManager } from './lspManager'

// ==========================================
// Store 初始化
// ==========================================

const bootstrapStore = new Store({ name: 'bootstrap' })
let mainStore: Store

function initStore() {
  const customPath = bootstrapStore.get('customConfigPath') as string | undefined
  if (customPath && fs.existsSync(customPath)) {
    console.log('[Main] Using custom config path:', customPath)
    mainStore = new Store({ cwd: customPath })
  } else {
    console.log('[Main] Using default config path')
    mainStore = new Store()
  }
}

initStore()

// ==========================================
// 全局状态
// ==========================================

let mainWindow: BrowserWindow | null = null

// ==========================================
// 窗口创建
// ==========================================

function createWindow() {
  // 图标路径：开发环境用 public，生产环境用 resources
  const iconPath =
    process.env.NODE_ENV === 'development'
      ? path.join(__dirname, '../../public/icon.png')
      : path.join(process.resourcesPath, 'icon.png')

  mainWindow = new BrowserWindow({
    width: 1600,
    height: 1000,
    minWidth: 1200,
    minHeight: 700,
    frame: false,
    titleBarStyle: 'hidden',
    icon: iconPath,
    trafficLightPosition: { x: 15, y: 15 },
    backgroundColor: '#0d1117',
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  // 更新 LLM 服务的窗口引用
  updateLLMServiceWindow(mainWindow)
}

// ==========================================
// 应用生命周期
// ==========================================

app.whenReady().then(() => {
  // 注册所有 IPC handlers
  registerAllHandlers({
    getMainWindow: () => mainWindow,
    mainStore,
    bootstrapStore,
    setMainStore: (store) => {
      mainStore = store
    },
  })



  // 创建窗口
  createWindow()
})

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

// 清理资源
app.on('before-quit', async () => {
  await cleanupAllHandlers()
  await lspManager.stopAllServers()
})
