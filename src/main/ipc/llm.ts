/**
 * LLM IPC handlers
 * 支持多窗口隔离：每个窗口有独立的 LLM 服务实例
 */

import { ipcMain, BrowserWindow } from 'electron'
import { LLMService } from '../services/llm'

// 按窗口 webContents.id 管理独立的 LLM 服务
const llmServices = new Map<number, LLMService>()

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
      console.log('[LLMService] Creating new service for window:', webContentsId)
      llmServices.set(webContentsId, new LLMService(window))
    }

    try {
      await llmServices.get(webContentsId)!.sendMessage(params)
    } catch (error: any) {
      throw error
    }
  })

  // 中止消息 - 只中止发起请求的窗口
  ipcMain.on('llm:abort', (event) => {
    const webContentsId = event.sender.id
    llmServices.get(webContentsId)?.abort()
  })
}

// 清理指定窗口的 LLM 服务（窗口关闭时调用）
export function cleanupLLMService(webContentsId: number) {
  if (llmServices.has(webContentsId)) {
    console.log('[LLMService] Cleaning up service for window:', webContentsId)
    llmServices.delete(webContentsId)
  }
}

// 保留旧接口以兼容，但实际不再需要
export function updateLLMServiceWindow(_mainWindow: BrowserWindow) {
  // 不再需要，每个窗口有独立服务
  console.log('[LLMService] updateLLMServiceWindow called but no longer needed')
}
