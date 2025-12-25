/**
 * 设置 IPC handlers
 */

import { logger } from '@shared/utils/Logger'
import { ipcMain, BrowserWindow } from 'electron'
import * as fs from 'fs'
import Store from 'electron-store'

// 安全模块接口
interface SecurityModuleRef {
  securityManager: any
  updateWhitelist: (shell: string[], git: string[]) => void
  getWhitelist: () => { shell: string[]; git: string[] }
}

let securityRef: SecurityModuleRef | null = null

export function registerSettingsHandlers(
  mainStore: Store,
  bootstrapStore: Store,
  setMainStore: (store: Store) => void,
  securityModule?: SecurityModuleRef
) {
  // 保存安全模块引用
  if (securityModule) {
    securityRef = securityModule
  }

  // 获取设置
  ipcMain.handle('settings:get', (_, key: string) => mainStore.get(key))

  // 设置值
  ipcMain.handle('settings:set', (_event, key: string, value: unknown) => {
    mainStore.set(key, value)

    // 广播给所有窗口
    BrowserWindow.getAllWindows().forEach(win => {
      if (!win.isDestroyed()) {
        win.webContents.send('settings:changed', { key, value })
      }
    })

    // 如果是安全设置，同步更新到 SecurityManager 和白名单
    if (key === 'securitySettings' && securityRef) {
      const securitySettings = value as any
      securityRef.securityManager.updateConfig(securitySettings)

      // 更新白名单
      const shellCommands = securitySettings.allowedShellCommands || []
      const gitCommands = securitySettings.allowedGitSubcommands || []
      securityRef.updateWhitelist(shellCommands, gitCommands)
    }

    return true
  })

  // 获取当前白名单
  ipcMain.handle('settings:getWhitelist', () => {
    if (!securityRef) {
      return { shell: [], git: [] }
    }
    return securityRef.getWhitelist()
  })

  // 重置白名单到默认值
  ipcMain.handle('settings:resetWhitelist', () => {
    const defaultShellCommands = ['npm', 'yarn', 'pnpm', 'node', 'npx', 'git', 'python', 'python3', 'java', 'go', 'rust', 'cargo', 'make', 'gcc', 'clang', 'pwd', 'ls', 'cat', 'echo', 'mkdir', 'touch', 'rm', 'mv', 'cd']
    const defaultGitCommands = ['status', 'log', 'diff', 'add', 'commit', 'push', 'pull', 'branch', 'checkout', 'merge', 'rebase', 'clone', 'remote', 'fetch', 'show', 'rev-parse', 'init']

    if (securityRef) {
      securityRef.updateWhitelist(defaultShellCommands, defaultGitCommands)
    }

    // 保存到配置
    const currentSecuritySettings = mainStore.get('securitySettings', {}) as any
    const newSecuritySettings = {
      ...currentSecuritySettings,
      allowedShellCommands: defaultShellCommands,
      allowedGitSubcommands: defaultGitCommands
    }
    mainStore.set('securitySettings', newSecuritySettings)

    return { shell: defaultShellCommands, git: defaultGitCommands }
  })

  // 获取配置路径
  ipcMain.handle('settings:getConfigPath', () => {
    return mainStore.path
  })

  // 设置配置路径
  ipcMain.handle('settings:setConfigPath', async (_, newPath: string) => {
    try {
      if (!fs.existsSync(newPath)) {
        fs.mkdirSync(newPath, { recursive: true })
      }

      // 保存到 bootstrapStore (存储在默认位置)
      bootstrapStore.set('customConfigPath', newPath)

      // 迁移当前配置到新位置
      const currentData = mainStore.store
      const newStore = new Store({ name: 'config', cwd: newPath })
      newStore.store = currentData
      setMainStore(newStore)

      return true
    } catch (err) {
      logger.ipc.error('[Settings] Failed to set config path:', err)
      return false
    }
  })

  // 恢复工作区 (Legacy fallback, secureFile.ts has a better one)
  ipcMain.handle('workspace:restore:legacy', () => {
    return mainStore.get('lastWorkspacePath')
  })
}
