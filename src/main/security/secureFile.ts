import { ipcMain, dialog, shell } from 'electron'

import * as path from 'path'
import { promises as fsPromises } from 'fs'
import Store from 'electron-store'
import { securityManager, OperationType } from './securityModule'

let watcherSubscription: any = null

interface FileWatcherEvent {
  event: 'create' | 'update' | 'delete'
  path: string
}



// 读取带编码检测的文件
async function readFileWithEncoding(filePath: string): Promise<string | null> {
  try {
    const buffer = await fsPromises.readFile(filePath)
    if (buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
      return buffer.toString('utf-8').substring(3)
    }
    if (buffer.includes(0)) {
      return '[binary file]'
    }
    return buffer.toString('utf-8')
  } catch {
    return null
  }
}

// 读取大文件片段
async function readLargeFile(filePath: string, start: number, maxLength: number): Promise<string | null> {
  try {
    const fd = await fsPromises.open(filePath, 'r')
    const buffer = Buffer.alloc(maxLength)
    const { bytesRead } = await fd.read(buffer, 0, maxLength, start)
    await fd.close()
    return buffer.toString('utf-8', 0, bytesRead)
  } catch {
    return null
  }
}


// 文件监听
function setupFileWatcher(
  getWorkspaceSessionFn: () => { roots: string[] } | null,
  callback: (data: FileWatcherEvent) => void
) {
  const workspace = getWorkspaceSessionFn()
  if (!workspace || workspace.roots.length === 0) return

  const chokidar = require('chokidar')
  const watcher = chokidar.watch(workspace.roots, {
    ignored: [/node_modules/, /\.git/, /dist/, /build/, /\.adnify/, '**/*.tmp', '**/*.temp'],
    persistent: true,
    ignoreInitial: true,
  })

  watcherSubscription = watcher
    .on('add', (path: string) => callback({ event: 'create', path }))
    .on('change', (path: string) => callback({ event: 'update', path }))
    .on('unlink', (path: string) => callback({ event: 'delete', path }))
    .on('error', (error: Error) => console.error('[Watcher] Error:', error))

    ; (global as any).fileWatcher = watcher
}

// 窗口管理上下文类型
interface WindowManagerContext {
  findWindowByWorkspace?: (roots: string[]) => any
  setWindowWorkspace?: (windowId: number, roots: string[]) => void
}

// 注册所有 IPC Handlers
export function registerSecureFileHandlers(
  getMainWindowFn: () => any,
  store: any,
  getWorkspaceSessionFn: () => { roots: string[] } | null,
  windowManager?: WindowManagerContext
) {
  ; (global as any).mainWindow = getMainWindowFn()

  // 辅助函数：添加到最近工作区列表（存储到config store，支持自定义路径）
  function addRecentWorkspace(path: string) {
    const recent = store.get('recentWorkspaces', []) as string[]

    // 移除重复项，添加到开头，最多保留10个
    const filtered = recent.filter((p: string) => p.toLowerCase() !== path.toLowerCase())
    const updated = [path, ...filtered].slice(0, 10)

    store.set('recentWorkspaces', updated)
    console.log('[SecureFile] Updated recent workspaces:', updated.length, 'items')
  }

  // ========== 文件操作处理器 ==========

  // 打开文件
  ipcMain.handle('file:open', async () => {
    const mainWindow = getMainWindowFn()
    if (!mainWindow) return null

    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [{ name: 'All Files', extensions: ['*'] }],
    })

    if (!result.canceled && result.filePaths[0]) {
      const filePath = result.filePaths[0]
      if (securityManager.isSensitivePath(filePath)) {
        dialog.showErrorBox('安全警告', '不允许访问系统敏感路径')
        return null
      }

      const content = await fsPromises.readFile(filePath, 'utf-8')
      securityManager.logOperation(OperationType.FILE_READ, filePath, true, {
        userAction: true,
        size: content.length
      })
      return { path: filePath, content }
    }
    return null
  })

  // 打开文件夹
  ipcMain.handle('file:openFolder', async (event) => {
    const mainWindow = getMainWindowFn()
    if (!mainWindow) return null

    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
    })

    if (!result.canceled && result.filePaths[0]) {
      const folderPath = result.filePaths[0]

      // 检查是否已有窗口打开了该项目（单项目单窗口模式）
      if (windowManager?.findWindowByWorkspace) {
        const existingWindow = windowManager.findWindowByWorkspace([folderPath])
        if (existingWindow && existingWindow !== mainWindow) {
          // 聚焦已有窗口
          if (existingWindow.isMinimized()) {
            existingWindow.restore()
          }
          existingWindow.focus()
          console.log('[SecureFile] Project already open in another window, focusing:', folderPath)
          // 返回特殊标记，告诉渲染进程项目已在其他窗口打开
          return { redirected: true, path: folderPath }
        }
      }

      // 记录当前窗口的工作区
      const webContentsId = event.sender.id
      if (windowManager?.setWindowWorkspace) {
        windowManager.setWindowWorkspace(webContentsId, [folderPath])
      }

      // Update legacy store
      const store = new Store({ name: 'main' })
      store.set('lastWorkspacePath', folderPath)
      // Update new store
      store.set('lastWorkspaceSession', { configPath: null, roots: [folderPath] })
      // 添加到最近工作区
      addRecentWorkspace(folderPath)
      return folderPath
    }
    return null
  })

  // 打开工作区 (多根支持)
  ipcMain.handle('workspace:open', async (event) => {
    const mainWindow = getMainWindowFn()
    if (!mainWindow) return null

    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile', 'openDirectory'],
      filters: [
        { name: 'Adnify Workspace', extensions: ['adnify-workspace'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    })

    if (!result.canceled && result.filePaths[0]) {
      const targetPath = result.filePaths[0]
      const store = new Store({ name: 'main' })

      let roots: string[] = []

      // Check if it's a workspace file
      if (targetPath.endsWith('.adnify-workspace')) {
        try {
          const content = await fsPromises.readFile(targetPath, 'utf-8')
          const config = JSON.parse(content)
          roots = config.folders.map((f: any) => f.path)
        } catch (e) {
          console.error('Failed to parse workspace file', e)
          return null
        }
      } else {
        // It's a folder
        roots = [targetPath]
      }

      // 检查是否已有窗口打开了该项目（单项目单窗口模式）
      if (windowManager?.findWindowByWorkspace && roots.length > 0) {
        const existingWindow = windowManager.findWindowByWorkspace(roots)
        if (existingWindow && existingWindow !== mainWindow) {
          // 聚焦已有窗口
          if (existingWindow.isMinimized()) {
            existingWindow.restore()
          }
          existingWindow.focus()
          console.log('[SecureFile] Workspace already open in another window, focusing:', roots)
          return { redirected: true, roots }
        }
      }

      // 记录当前窗口的工作区
      const webContentsId = event.sender.id
      if (windowManager?.setWindowWorkspace) {
        windowManager.setWindowWorkspace(webContentsId, roots)
      }

      const session = { configPath: targetPath.endsWith('.adnify-workspace') ? targetPath : null, roots }
      store.set('lastWorkspaceSession', session)
      store.set('lastWorkspacePath', roots[0]) // Legacy fallback
      // 添加到最近工作区
      roots.forEach(r => addRecentWorkspace(r))
      return session
    }
    return null
  })

  // 添加文件夹到工作区
  ipcMain.handle('workspace:addFolder', async () => {
    const mainWindow = getMainWindowFn()
    if (!mainWindow) return null

    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory']
    })

    if (!result.canceled && result.filePaths[0]) {
      return result.filePaths[0]
    }
    return null
  })

  // 保存工作区
  ipcMain.handle('workspace:save', async (_, configPath: string, roots: string[]) => {
    if (!configPath || !roots) return false

    // If no config path, ask user to save
    let targetPath = configPath
    if (!targetPath) {
      const mainWindow = getMainWindowFn()
      const result = await dialog.showSaveDialog(mainWindow!, {
        filters: [{ name: 'Adnify Workspace', extensions: ['adnify-workspace'] }]
      })
      if (result.canceled || !result.filePath) return false
      targetPath = result.filePath
    }

    const content = JSON.stringify({
      folders: roots.map(path => ({ path }))
    }, null, 2)

    try {
      await fsPromises.writeFile(targetPath, content, 'utf-8')
      return true
    } catch (e) {
      console.error('Failed to save workspace', e)
      return false
    }
  })

  // 恢复工作区
  ipcMain.handle('workspace:restore', async () => {
    const session = store.get('lastWorkspaceSession') as { configPath: string | null; roots: string[] } | null

    if (session) {
      // 自动启动文件监听
      setupFileWatcher(getWorkspaceSessionFn, (data: FileWatcherEvent) => {
        const win = getMainWindowFn()
        if (win) {
          win.webContents.send('file:changed', data)
        }
      })
      return session
    }

    // Fallback to legacy
    const legacyPath = store.get('lastWorkspacePath') as string | null
    if (legacyPath) {
      // 自动启动文件监听
      setupFileWatcher(getWorkspaceSessionFn, (data: FileWatcherEvent) => {
        const win = getMainWindowFn()
        if (win) {
          win.webContents.send('file:changed', data)
        }
      })
      return { configPath: null, roots: [legacyPath] }
    }

    return null
  })

  // 读取目录
  ipcMain.handle('file:readDir', async (_, dirPath: string) => {
    if (!dirPath) return []
    if (securityManager.isSensitivePath(dirPath)) return []

    try {
      const items = await fsPromises.readdir(dirPath, { withFileTypes: true })
      return items.map(item => ({
        name: item.name,
        path: path.join(dirPath, item.name),
        isDirectory: item.isDirectory(),
      }))
    } catch {
      return []
    }
  })

  // 获取目录树
  ipcMain.handle('file:getTree', async (_, dirPath: string, maxDepth = 2) => {
    if (!dirPath || maxDepth < 0) return ''
    if (securityManager.isSensitivePath(dirPath)) return ''

    const buildTree = async (currentPath: string, currentDepth: number): Promise<string> => {
      if (currentDepth >= maxDepth) return ''
      try {
        const items = await fsPromises.readdir(currentPath, { withFileTypes: true })
        let result = ''
        for (const item of items) {
          const fullPath = path.join(currentPath, item.name)
          const indent = '  '.repeat(currentDepth)
          if (item.isDirectory()) {
            result += `${indent}📁 ${item.name}/\n`
            result += await buildTree(fullPath, currentDepth + 1)
          } else {
            result += `${indent}📄 ${item.name}\n`
          }
        }
        return result
      } catch {
        return ''
      }
    }
    return await buildTree(dirPath, 0)
  })

  // 读取文件 - 无弹窗
  ipcMain.handle('file:read', async (_, filePath: string) => {
    if (!filePath) return null
    const workspace = getWorkspaceSessionFn()

    // 强制工作区边界
    if (workspace && !securityManager.validateWorkspacePath(filePath, workspace.roots)) {
      securityManager.logOperation(OperationType.FILE_READ, filePath, false, {
        reason: '安全底线：超出工作区边界',
      })
      return null
    }

    if (securityManager.isSensitivePath(filePath)) {
      securityManager.logOperation(OperationType.FILE_READ, filePath, false, {
        reason: '安全底线：敏感路径',
      })
      return null
    }

    try {
      const stats = await fsPromises.stat(filePath)
      const content = stats.size > 5 * 1024 * 1024
        ? await readLargeFile(filePath, 0, 10000)
        : await readFileWithEncoding(filePath)

      securityManager.logOperation(OperationType.FILE_READ, filePath, true, {
        size: stats.size,
        bypass: true
      })
      return content
    } catch (e: any) {
      console.error('[File] read failed:', filePath, e.message)
      return null
    }
  })

  // 读取二进制文件为 base64 - 用于图片预览
  ipcMain.handle('file:readBinary', async (_, filePath: string) => {
    if (!filePath) return null
    const workspace = getWorkspaceSessionFn()

    // 强制工作区边界
    if (workspace && !securityManager.validateWorkspacePath(filePath, workspace.roots)) {
      securityManager.logOperation(OperationType.FILE_READ, filePath, false, {
        reason: '安全底线：超出工作区边界',
      })
      return null
    }

    if (securityManager.isSensitivePath(filePath)) {
      securityManager.logOperation(OperationType.FILE_READ, filePath, false, {
        reason: '安全底线：敏感路径',
      })
      return null
    }

    try {
      const stats = await fsPromises.stat(filePath)
      // 限制文件大小为 50MB
      if (stats.size > 50 * 1024 * 1024) {
        return null
      }

      const buffer = await fsPromises.readFile(filePath)
      const base64 = buffer.toString('base64')

      securityManager.logOperation(OperationType.FILE_READ, filePath, true, {
        size: stats.size,
        binary: true
      })
      return base64
    } catch (e: any) {
      console.error('[File] read binary failed:', filePath, e.message)
      return null
    }
  })

  // 写入文件 - 无弹窗
  ipcMain.handle('file:write', async (_, filePath: string, content: string) => {
    if (!filePath || typeof filePath !== 'string') return false
    if (content === undefined || content === null) return false

    const workspace = getWorkspaceSessionFn()

    // 强制工作区边界
    if (workspace && !securityManager.validateWorkspacePath(filePath, workspace.roots)) {
      securityManager.logOperation(OperationType.FILE_WRITE, filePath, false, {
        reason: '安全底线：超出工作区边界',
      })
      return false
    }

    // 底线：敏感路径
    if (securityManager.isSensitivePath(filePath)) {
      securityManager.logOperation(OperationType.FILE_WRITE, filePath, false, {
        reason: '安全底线：敏感路径',
      })
      return false
    }

    // 底线：禁止类型
    const forbiddenPatterns = [
      /\.exe$/i, /\.dll$/i, /\.sys$/i,
      /\.tmp$/i, /\.temp$/i,
    ]
    for (const pattern of forbiddenPatterns) {
      if (pattern.test(filePath)) {
        securityManager.logOperation(OperationType.FILE_WRITE, filePath, false, {
          reason: '安全底线：禁止类型',
        })
        return false
      }
    }

    try {
      const dir = path.dirname(filePath)
      await fsPromises.mkdir(dir, { recursive: true })
      await fsPromises.writeFile(filePath, content, 'utf-8')
      securityManager.logOperation(OperationType.FILE_WRITE, filePath, true, {
        size: content.length,
        bypass: true
      })
      return true
    } catch (e: any) {
      console.error('[File] write failed:', filePath, e.message)
      return false
    }
  })

  // 确保目录存在
  ipcMain.handle('file:ensureDir', async (_, dirPath: string) => {
    if (!dirPath) return false
    if (securityManager.isSensitivePath(dirPath)) return false
    try {
      await fsPromises.mkdir(dirPath, { recursive: true })
      return true
    } catch {
      return false
    }
  })

  // 保存文件 - 无弹窗（已有路径）
  ipcMain.handle('file:save', async (_, content: string, currentPath?: string) => {
    if (currentPath) {
      if (securityManager.isSensitivePath(currentPath)) return null
      try {
        const dir = path.dirname(currentPath)
        await fsPromises.mkdir(dir, { recursive: true })
        await fsPromises.writeFile(currentPath, content, 'utf-8')
        securityManager.logOperation(OperationType.FILE_WRITE, currentPath, true, {
          bypass: true
        })
        return currentPath
      } catch {
        return null
      }
    }

    // 新建文件：需要选择路径（用户操作，允许弹窗）
    const mainWindow = getMainWindowFn()
    if (!mainWindow) return null

    const workspace = getWorkspaceSessionFn()
    const defaultPath = (workspace && workspace.roots.length > 0) ? workspace.roots[0] : require('os').homedir()

    const result = await dialog.showSaveDialog(mainWindow, {
      defaultPath,
      filters: [{ name: 'All Files', extensions: ['*'] }],
    })

    if (!result.canceled && result.filePath) {
      const savePath = result.filePath
      if (securityManager.isSensitivePath(savePath)) {
        dialog.showErrorBox('安全警告', '不允许保存到系统敏感路径')
        return null
      }

      try {
        await fsPromises.writeFile(savePath, content, 'utf-8')
        securityManager.logOperation(OperationType.FILE_WRITE, savePath, true, {
          isNewFile: true,
          bypass: true
        })
        return savePath
      } catch {
        return null
      }
    }
    return null
  })

  // 文件是否存在
  ipcMain.handle('file:exists', async (_, filePath: string) => {
    try {
      await fsPromises.access(filePath)
      return true
    } catch {
      return false
    }
  })

  // 创建目录 - 无弹窗
  ipcMain.handle('file:mkdir', async (_, dirPath: string) => {
    if (!dirPath || typeof dirPath !== 'string') return false
    if (securityManager.isSensitivePath(dirPath)) return false

    try {
      await fsPromises.mkdir(dirPath, { recursive: true })
      securityManager.logOperation(OperationType.FILE_WRITE, dirPath, true, {
        isDirectory: true,
        bypass: true
      })
      return true
    } catch (e: any) {
      console.error('[File] mkdir failed:', dirPath, e.message)
      return false
    }
  })

  // 删除文件/目录 - 无弹窗，仅底线检查
  ipcMain.handle('file:delete', async (_, filePath: string) => {
    // 底线：敏感路径
    if (securityManager.isSensitivePath(filePath)) {
      securityManager.logOperation(OperationType.FILE_DELETE, filePath, false, {
        reason: '安全底线：敏感路径',
      })
      return false
    }

    // 底线：关键配置文件
    const criticalFiles = [
      /\.env$/i,
      /package-lock\.json$/i,
      /yarn\.lock$/i,
      /pnpm-lock\.yaml$/i,
    ]
    for (const pattern of criticalFiles) {
      if (pattern.test(filePath)) {
        securityManager.logOperation(OperationType.FILE_DELETE, filePath, false, {
          reason: '安全底线：关键配置文件',
        })
        return false
      }
    }

    // 底线：大目录保护
    try {
      const stat = await fsPromises.stat(filePath)
      if (stat.isDirectory() && stat.size > 100 * 1024 * 1024) {
        securityManager.logOperation(OperationType.FILE_DELETE, filePath, false, {
          reason: `安全底线：目录过大 (${(stat.size / 1024 / 1024).toFixed(1)}MB)`,
        })
        return false
      }
    } catch {
      return false
    }

    // 执行删除（信任 Agent 层）
    try {
      const stat = await fsPromises.stat(filePath)
      if (stat.isDirectory()) {
        await fsPromises.rm(filePath, { recursive: true, force: true })
      } else {
        await fsPromises.unlink(filePath)
      }
      securityManager.logOperation(OperationType.FILE_DELETE, filePath, true, {
        size: stat.size,
        bypass: true
      })
      return true
    } catch (e: any) {
      console.error('[File] delete failed:', filePath, e.message)
      return false
    }
  })

  // 重命名文件 - 无弹窗
  ipcMain.handle('file:rename', async (_, oldPath: string, newPath: string) => {
    if (!oldPath || !newPath) return false

    // 敏感路径检查
    if (securityManager.isSensitivePath(oldPath) || securityManager.isSensitivePath(newPath)) {
      securityManager.logOperation(OperationType.FILE_RENAME, oldPath, false, {
        reason: '安全底线：敏感路径',
        newPath,
      })
      return false
    }

    try {
      await fsPromises.rename(oldPath, newPath)
      securityManager.logOperation(OperationType.FILE_RENAME, oldPath, true, {
        newPath,
        bypass: true
      })
      return true
    } catch (e: any) {
      console.error('[File] rename failed:', oldPath, e.message)
      return false
    }
  })

  // 在文件管理器中显示
  ipcMain.handle('file:showInFolder', async (_, filePath: string) => {
    try {
      shell.showItemInFolder(filePath)
      return true
    } catch {
      return false
    }
  })

  // 文件监听
  ipcMain.handle('file:watch', (_, action: string) => {
    if (action === 'start') {
      setupFileWatcher(getWorkspaceSessionFn, (data: FileWatcherEvent) => {
        const win = getMainWindowFn()
        if (win) {
          win.webContents.send('file:changed', data)
        }
      })
    } else if (action === 'stop') {
      cleanupSecureFileWatcher()
    }
  })

  // 审计功能
  ipcMain.handle('security:getAuditLogs', (_, limit = 100) => {
    return securityManager.getAuditLogs(limit)
  })

  ipcMain.handle('security:getPermissions', () => {
    const store = new Store({ name: 'security' })
    return store.get('permissions', {})
  })

  ipcMain.handle('security:resetPermissions', () => {
    const store = new Store({ name: 'security' })
    store.delete('permissions')
    store.delete('audit')
    return true
  })

  // ========== 最近工作区管理 ==========

  // 获取最近打开的工作区列表（从config store读取，支持自定义路径）
  ipcMain.handle('workspace:getRecent', () => {
    return store.get('recentWorkspaces', []) as string[]
  })

  // 清除最近工作区
  ipcMain.handle('workspace:clearRecent', () => {
    store.set('recentWorkspaces', [])
    return true
  })
}

export function cleanupSecureFileWatcher() {
  if (watcherSubscription) {
    console.log('[Watcher] 清理文件监听器...')
    const subscription = watcherSubscription
    watcherSubscription = null
    subscription.close().catch((e: any) => {
      console.log('[Watcher] 清理完成 (已忽略错误):', e.message)
    })
  }
}

export { securityManager }
