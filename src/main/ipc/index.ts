/**
 * IPC handlers 统一导出
 */

import { BrowserWindow } from 'electron'
import Store from 'electron-store'

import { registerWindowHandlers } from './window'
import { registerFileHandlers, cleanupFileWatcher } from './file'
import { registerSettingsHandlers } from './settings'
import { registerTerminalHandlers, cleanupTerminals } from './terminal'
import { registerSearchHandlers } from './search'
import { registerGitHandlers } from './git'
import { registerLLMHandlers, updateLLMServiceWindow } from './llm'
import { registerIndexingHandlers } from './indexing'
import { registerLspHandlers } from './lsp'
export interface IPCContext {
  getMainWindow: () => BrowserWindow | null
  mainStore: Store
  bootstrapStore: Store
  setMainStore: (store: Store) => void
}

/**
 * 注册所有 IPC handlers
 */
export function registerAllHandlers(context: IPCContext) {
  const { getMainWindow, mainStore, bootstrapStore, setMainStore } = context

  // 窗口控制
  registerWindowHandlers(getMainWindow)

  // 文件操作
  registerFileHandlers(getMainWindow, mainStore)

  // 设置
  registerSettingsHandlers(mainStore, bootstrapStore, setMainStore)

  // 终端
  registerTerminalHandlers(getMainWindow)

  // 搜索
  registerSearchHandlers()

  // Git
  registerGitHandlers()

  // LLM
  registerLLMHandlers(getMainWindow)

  // 索引
  registerIndexingHandlers(getMainWindow)

  // LSP 语言服务
  registerLspHandlers()
}

/**
 * 清理所有资源
 */
export async function cleanupAllHandlers() {
  cleanupTerminals()
  await cleanupFileWatcher()
}

export { updateLLMServiceWindow }
