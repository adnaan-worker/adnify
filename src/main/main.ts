/**
 * Adnify Main Process
 * 重构后的主进程入口（支持多窗口和安全模块）
 */

import { logger } from '@shared/utils/Logger'
import { app, BrowserWindow } from 'electron'
import * as path from 'path'
import * as fs from 'fs'
import Store from 'electron-store'
import { registerAllHandlers, cleanupAllHandlers, updateLLMServiceWindow } from './ipc'
import { lspManager } from './lspManager'
import { securityManager, updateWhitelist } from './security'
import { SECURITY_DEFAULTS, WINDOW_DEFAULTS } from '../shared/constants'

// 移除硬编码的 SECURITY_DEFAULTS，已从 ../shared/constants 导入

// ==========================================
// Store & Path 初始化
// ==========================================

// 1. 优先初始化 bootstrapStore (存储在默认位置)
const bootstrapStore = new Store({ name: 'bootstrap' })

// Debug logging
logger.system.info('[Main] UserData Path:', app.getPath('userData'))
logger.system.info('[Main] Bootstrap Store Path:', bootstrapStore.path)
logger.system.info('[Main] Bootstrap Store Content:', bootstrapStore.store)

// 2. 检查是否有自定义配置路径
const customConfigPath = bootstrapStore.get('customConfigPath') as string | undefined
logger.system.info('[Main] Read customConfigPath:', customConfigPath)

let mainStore: Store

function initStore() {
  const options: any = { name: 'config' }

  if (customConfigPath && fs.existsSync(customConfigPath)) {
    logger.system.info('[Main] Using custom config path:', customConfigPath)
    options.cwd = customConfigPath
  } else {
    logger.system.info('[Main] Using default config path:', app.getPath('userData'))
    if (customConfigPath) {
      logger.system.info('[Main] Custom path exists?', fs.existsSync(customConfigPath))
    }
  }

  mainStore = new Store(options)
}

initStore()

// ==========================================
// 全局状态
// ==========================================

const windows = new Map<number, BrowserWindow>()
const windowWorkspaces = new Map<number, string[]>()  // 窗口ID -> 项目根路径列表
let lastActiveWindow: BrowserWindow | null = null
let isQuitting = false

function getMainWindow() {
  return lastActiveWindow || Array.from(windows.values())[0] || null
}

// 检查是否已有窗口打开了指定项目
function findWindowByWorkspace(roots: string[]): BrowserWindow | null {
  const normalizedRoots = roots.map(r => r.toLowerCase().replace(/\\/g, '/'))

  for (const [windowId, workspaceRoots] of windowWorkspaces) {
    const normalizedWindowRoots = workspaceRoots.map(r => r.toLowerCase().replace(/\\/g, '/'))

    // 检查是否有相同的根路径
    const hasMatch = normalizedRoots.some(root =>
      normalizedWindowRoots.some(wr => wr === root)
    )

    if (hasMatch) {
      const win = windows.get(windowId)
      if (win && !win.isDestroyed()) {
        return win
      }
    }
  }
  return null
}

// 设置窗口的工作区
function setWindowWorkspace(windowId: number, roots: string[]) {
  windowWorkspaces.set(windowId, roots)
  logger.system.info('[Main] Window workspace set:', windowId, roots)
}
// 清理窗口工作区
function clearWindowWorkspace(windowId: number) {
  windowWorkspaces.delete(windowId)
}
// 获取指定窗口的工作区
function getWindowWorkspace(windowId: number): string[] | null {
  return windowWorkspaces.get(windowId) || null
}

// 单例锁定
const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.quit()
}

// ==========================================
// 窗口创建
// ==========================================

function createWindow(isEmpty: boolean = false) {
  // 图标路径：开发环境用 public，生产环境用 resources
  const iconPath = app.isPackaged
    ? path.join(process.resourcesPath, 'icon.png')
    : path.join(__dirname, '../../public/icon.png')

  const win = new BrowserWindow({
    width: WINDOW_DEFAULTS.WIDTH,
    height: WINDOW_DEFAULTS.HEIGHT,
    minWidth: WINDOW_DEFAULTS.MIN_WIDTH,
    minHeight: WINDOW_DEFAULTS.MIN_HEIGHT,
    frame: false,
    titleBarStyle: 'hidden',
    icon: iconPath,
    trafficLightPosition: { x: 15, y: 15 },
    backgroundColor: WINDOW_DEFAULTS.BACKGROUND_COLOR,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  // 显示窗口
  win.once('ready-to-show', () => {
    win.show()
  })

  const windowId = win.id
  windows.set(windowId, win)
  lastActiveWindow = win

  win.on('focus', () => {
    lastActiveWindow = win
    updateLLMServiceWindow(win)
  })

  win.on('close', async (e) => {
    if (windows.size === 1 && !isQuitting) {
      // 最后一个窗口关闭时，执行全局清理
      isQuitting = true
      e.preventDefault()
      logger.system.info('[Main] Last window closing, starting cleanup...')
      try {
        cleanupAllHandlers()
        await lspManager.stopAllServers()
        logger.system.info('[Main] Cleanup completed')
      } catch (err) {
        logger.system.error('[Main] Cleanup error:', err)
      }
      win.destroy()
      app.quit()
    } else {
      // 非最后一个窗口，直接移除引用
      windows.delete(windowId)
      clearWindowWorkspace(windowId)  // 清理窗口-工作区映射
      if (lastActiveWindow === win) {
        lastActiveWindow = Array.from(windows.values())[0] || null
      }
    }
  })

  // 注册快捷键监听 (Frameless window workaround)
  win.webContents.on('before-input-event', (_, input) => {
    // Ctrl+Shift+P: Command Palette
    if ((input.control && input.shift && input.key.toLowerCase() === 'p') || input.key === 'F1') {
      if (input.type === 'keyDown') {
        // Do NOT prevent default, let it propagate to renderer as fallback
        // event.preventDefault() 
        win.webContents.send('workbench:execute-command', 'workbench.action.showCommands')
      }
    }
    // F12: Toggle DevTools
    if (input.key === 'F12' && input.type === 'keyDown') {
      // Do NOT prevent default, let it propagate to renderer as fallback
      // event.preventDefault()
      win.webContents.toggleDevTools()
    }
  })

  // 加载页面
  const query = isEmpty ? '?empty=1' : ''
  if (!app.isPackaged) {
    win.loadURL(`http://localhost:5173${query}`)
  } else {
    win.loadFile(path.join(__dirname, '../renderer/index.html'), { query: isEmpty ? { empty: '1' } : undefined })
  }

  return win
}

// ==========================================
// 应用生命周期
// ==========================================

app.whenReady().then(() => {
  logger.system.info('[Security] 🔒 初始化安全模块...')

  const securityConfig = mainStore.get('securitySettings', {
    enablePermissionConfirm: true,
    enableAuditLog: true,
    strictWorkspaceMode: true,
    allowedShellCommands: [...SECURITY_DEFAULTS.SHELL_COMMANDS],
    allowedGitSubcommands: [...SECURITY_DEFAULTS.GIT_SUBCOMMANDS],
  }) as any

  securityManager.updateConfig(securityConfig)

  // 初始化白名单
  const shellCommands = securityConfig.allowedShellCommands || [...SECURITY_DEFAULTS.SHELL_COMMANDS]
  const gitCommands = securityConfig.allowedGitSubcommands || [...SECURITY_DEFAULTS.GIT_SUBCOMMANDS]
  updateWhitelist(shellCommands, gitCommands)

  logger.system.info('[Security] ✅ 安全模块已初始化')

  // 注册所有 IPC handlers
  registerAllHandlers({
    getMainWindow,
    createWindow,
    mainStore,
    bootstrapStore,
    setMainStore: (store) => {
      mainStore = store
    },
    // 窗口-工作区管理函数
    findWindowByWorkspace,
    setWindowWorkspace,
    getWindowWorkspace,
  })

  // 创建应用菜单
  const { Menu } = require('electron')
  const template = [
    {
      label: 'File',
      submenu: [
        { role: 'quit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        {
          label: 'Command Palette',
          // accelerator: 'Ctrl+Shift+P', // Remove accelerator to let renderer handle it
          click: (_: any, focusedWindow: BrowserWindow) => {
            logger.system.info('[Main] Menu: Command Palette triggered')
            if (focusedWindow) {
              logger.system.info('[Main] Sending workbench:execute-command to renderer')
              focusedWindow.webContents.send('workbench:execute-command', 'workbench.action.showCommands')
            } else {
              logger.system.info('[Main] No focused window to send command to')
            }
          }
        }
      ]
    }
  ]
  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)

  // 创建第一个窗口
  const firstWin = createWindow()
  securityManager.setMainWindow(firstWin)
})

// 处理第二个实例启动（打开新窗口）
app.on('second-instance', () => {
  createWindow(false)
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (windows.size === 0) {
    createWindow()
  }
})
