/**
 * LLM IPC handlers
 * 支持多窗口隔离：每个窗口有独立的 LLM 服务实例
 */

import { logger } from '@shared/utils/Logger'
import { ipcMain, BrowserWindow } from 'electron'
import { LLMService } from '../services/llm'

// 按窗口 webContents.id 管理独立的 LLM 服务
const llmServices = new Map<number, LLMService>()
// 独立的压缩服务（不与主对话冲突）
const compactionServices = new Map<number, LLMService>()

export function registerLLMHandlers(_getMainWindow: () => BrowserWindow | null) {
  // 发送消息
  ipcMain.handle('llm:sendMessage', async (event, params) => {
    const webContentsId = event.sender.id
    const window = BrowserWindow.fromWebContents(event.sender)

    if (!window) {
      throw new Error('Window not found for LLM request')
    }

    // 按窗口 ID 获取或创建 LLM 服务
    if (!llmServices.has(webContentsId)) {
      logger.ipc.info('[LLMService] Creating new service for window:', webContentsId)
      llmServices.set(webContentsId, new LLMService(window))
    }

    try {
      await llmServices.get(webContentsId)!.sendMessage(params)
    } catch (error: any) {
      throw error
    }
  })

  // 独立的压缩请求（不使用流式，直接返回结果）
  ipcMain.handle('llm:compactContext', async (event, params) => {
    const webContentsId = event.sender.id
    const window = BrowserWindow.fromWebContents(event.sender)

    if (!window) {
      throw new Error('Window not found for compaction request')
    }

    // 使用独立的压缩服务
    if (!compactionServices.has(webContentsId)) {
      logger.ipc.info('[LLMService] Creating compaction service for window:', webContentsId)
      compactionServices.set(webContentsId, new LLMService(window))
    }

    try {
      const result = await compactionServices.get(webContentsId)!.sendMessageSync(params)
      return result
    } catch (error: any) {
      logger.ipc.error('[LLMService] Compaction error:', error)
      return { error: error.message }
    }
  })

  // 中止消息 - 只中止发起请求的窗口
  ipcMain.on('llm:abort', (event) => {
    const webContentsId = event.sender.id
    llmServices.get(webContentsId)?.abort()
  })

  // 使所有 Provider 缓存失效（API Key 变更时调用）
  ipcMain.handle('llm:invalidateProviders', (event) => {
    const webContentsId = event.sender.id
    const service = llmServices.get(webContentsId)
    if (service) {
      service.invalidateAllProviders()
      logger.ipc.info('[LLMService] Providers invalidated for window:', webContentsId)
    }
  })

  // 使指定 Provider 缓存失效
  ipcMain.handle('llm:invalidateProvider', (event, providerId: string) => {
    const webContentsId = event.sender.id
    const service = llmServices.get(webContentsId)
    if (service) {
      service.invalidateProvider(providerId)
      logger.ipc.info('[LLMService] Provider invalidated:', providerId, 'for window:', webContentsId)
    }
  })
}

// 清理指定窗口的 LLM 服务（窗口关闭时调用）
export function cleanupLLMService(webContentsId: number) {
  if (llmServices.has(webContentsId)) {
    logger.ipc.info('[LLMService] Cleaning up service for window:', webContentsId)
    llmServices.delete(webContentsId)
  }
}
