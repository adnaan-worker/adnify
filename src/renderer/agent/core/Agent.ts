/**
 * Agent 核心类
 * 
 * 职责：
 * - 提供统一的公共 API
 * - 管理 Agent 生命周期（运行状态、中止、清理）
 * - 协调所有子模块（MessageBuilder, runLoop, EventBus）
 * - 处理错误和异常情况
 * 
 * 使用示例：
 * ```typescript
 * await Agent.send(
 *   "你好",
 *   config,
 *   workspacePath,
 *   systemPrompt,
 *   'agent'
 * )
 * ```
 */

import { api } from '@/renderer/services/electronAPI'
import { logger } from '@utils/Logger'
import { CacheService } from '@shared/utils'
import { AppError, formatErrorMessage } from '@/shared/errors'
import { normalizePath } from '@shared/utils/pathUtils'
import { useAgentStore } from '../store/AgentStore'
import { buildLLMMessages, buildContextContent } from '../llm/MessageBuilder'
import { runLoop } from './loop'
import { approvalService } from './tools'
import { EventBus } from './EventBus'
import type { WorkMode } from '@/renderer/modes/types'
import type { MessageContent, TextContent, ImageContent } from '../types'
import type { CheckpointImage } from '../types'
import type { LLMConfig } from './types'

// 文件缓存：避免重复读取相同文件
const fileCache = new CacheService<string>('AgentFileCache', {
  maxSize: 200,
  maxMemory: 30 * 1024 * 1024,
  defaultTTL: 10 * 60 * 1000,
})

class AgentClass {
  private abortController: AbortController | null = null
  private currentAssistantId: string | null = null
  private isRunning = false

  // ===== 公共 API =====

  /**
   * 发送消息并运行 Agent
   * 
   * @param userMessage - 用户消息（文本或多模态内容）
   * @param config - LLM 配置
   * @param workspacePath - 工作区路径
   * @param systemPrompt - 系统提示词
   * @param chatMode - 工作模式（chat/agent/plan）
   */
  async send(
    userMessage: MessageContent,
    config: LLMConfig,
    workspacePath: string | null,
    systemPrompt: string,
    chatMode: WorkMode = 'agent'
  ): Promise<void> {
    // 防止重复运行
    if (this.isRunning) {
      logger.agent.warn('[Agent] Already running, ignoring new request')
      return
    }

    const store = useAgentStore.getState()

    // 验证 API Key
    if (!config.apiKey) {
      this.showError('Please configure your API key in settings.')
      return
    }

    this.isRunning = true
    this.abortController = new AbortController()

    try {
      // 1. 准备上下文
      const contextItems = store.getCurrentThread()?.contextItems || []
      const userQuery = this.extractUserQuery(userMessage)
      const contextContent = await buildContextContent(contextItems, userQuery)

      // 2. 添加用户消息
      const userMessageId = store.addUserMessage(userMessage, contextItems)
      store.clearContextItems()

      // 3. 创建检查点（用于撤销）
      const checkpointImages = this.extractCheckpointImages(userMessage)
      const messageText = typeof userMessage === 'string' ? userMessage.slice(0, 50) : 'User message'
      await store.createMessageCheckpoint(userMessageId, messageText, checkpointImages, contextItems)

      // 4. 构建 LLM 消息（包含上下文压缩）
      const llmMessages = await buildLLMMessages(userMessage, contextContent, systemPrompt)

      // 5. 创建助手消息并开始流式响应
      this.currentAssistantId = store.addAssistantMessage()
      store.setStreamPhase('streaming')

      // 6. 运行主循环
      await runLoop(
        config,
        llmMessages,
        {
          workspacePath,
          chatMode,
          abortSignal: this.abortController.signal,
        },
        this.currentAssistantId
      )
    } catch (error) {
      // 统一错误处理
      const appError = AppError.fromError(error)
      logger.agent.error('[Agent] Error:', appError.toJSON())
      this.showError(formatErrorMessage(appError))
    } finally {
      // 确保清理资源
      this.cleanup()
    }
  }

  /**
   * 中止当前运行的 Agent
   * 
   * 会：
   * - 中止 LLM 请求
   * - 拒绝待审批的工具
   * - 更新所有运行中的工具状态为 error
   * - 清理资源
   */
  abort(): void {
    if (this.abortController) {
      this.abortController.abort()
    }
    api.llm.abort()
    approvalService.reject()

    const store = useAgentStore.getState()

    // 更新所有运行中的工具状态
    if (this.currentAssistantId) {
      const thread = store.getCurrentThread()
      if (thread) {
        const msg = thread.messages.find(m => m.id === this.currentAssistantId)
        if (msg?.role === 'assistant') {
          const assistantMsg = msg as import('../types').AssistantMessage
          for (const tc of assistantMsg.toolCalls || []) {
            if (['running', 'awaiting', 'pending'].includes(tc.status)) {
              store.updateToolCall(this.currentAssistantId, tc.id, {
                status: 'error',
                error: 'Aborted by user',
              })
            }
          }
        }
      }
      store.finalizeAssistant(this.currentAssistantId)
    }

    // 确保所有流式消息都被终止
    const thread = store.getCurrentThread()
    if (thread) {
      for (const msg of thread.messages) {
        if (msg.role === 'assistant') {
          const assistantMsg = msg as import('../types').AssistantMessage
          if (assistantMsg.isStreaming) {
            store.finalizeAssistant(msg.id)
          }
        }
      }
    }

    this.cleanup()
  }

  /**
   * 批准当前待审批的工具
   */
  approve(): void {
    approvalService.approve()
  }

  /**
   * 拒绝当前待审批的工具
   */
  reject(): void {
    approvalService.reject()
  }

  /**
   * 清除会话缓存
   * 
   * 用于：
   * - 切换工作区时清除缓存
   * - 手动刷新时清除缓存
   */
  clearSession(): void {
    fileCache.clear()
    EventBus.clear()
    logger.agent.info('[Agent] Session cleared')
  }

  /**
   * 获取诊断信息（用于调试）
   */
  getDiagnostics() {
    const { getActiveListenerCount } = require('./stream')
    return {
      isRunning: this.isRunning,
      hasAbortController: !!this.abortController,
      currentAssistantId: this.currentAssistantId,
      activeListeners: getActiveListenerCount(),
      cacheStats: fileCache.getStats(),
    }
  }

  /**
   * 检查是否正在运行
   */
  get running(): boolean {
    return this.isRunning
  }

  /**
   * 获取 EventBus（用于外部订阅）
   */
  get events() {
    return EventBus
  }

  // ===== 文件缓存 API =====

  /**
   * 检查文件是否有有效缓存
   */
  hasValidFileCache(filePath: string): boolean {
    return fileCache.has(normalizePath(filePath))
  }

  /**
   * 标记文件已读取（用于缓存）
   */
  markFileAsRead(filePath: string, content: string): void {
    fileCache.set(normalizePath(filePath), this.fnvHash(content))
  }

  /**
   * 获取文件缓存哈希
   */
  getFileCacheHash(filePath: string): string | null {
    return fileCache.get(normalizePath(filePath)) ?? null
  }

  /**
   * 获取缓存统计信息
   */
  getCacheStats() {
    return fileCache.getStats()
  }

  // ===== 私有方法 =====

  /**
   * 从消息中提取文本查询
   */
  private extractUserQuery(message: MessageContent): string {
    if (typeof message === 'string') return message
    if (Array.isArray(message)) {
      return message
        .filter(p => p.type === 'text')
        .map(p => (p as TextContent).text)
        .join('')
    }
    return ''
  }

  /**
   * 从消息中提取图片（用于检查点）
   */
  private extractCheckpointImages(message: MessageContent): CheckpointImage[] {
    if (typeof message === 'string') return []
    if (Array.isArray(message)) {
      return message
        .filter((p): p is ImageContent => p.type === 'image')
        .map(p => ({
          id: crypto.randomUUID(),
          mimeType: p.source.media_type,
          base64: p.source.data,
        }))
    }
    return []
  }

  /**
   * 显示错误消息给用户
   */
  private showError(message: string): void {
    const store = useAgentStore.getState()
    const id = store.addAssistantMessage()
    store.appendToAssistant(id, `❌ ${message}`)
    store.finalizeAssistant(id)
  }

  /**
   * 清理资源
   * 
   * 在以下情况调用：
   * - 正常完成（finally 块）
   * - 用户中止（abort 方法）
   * - 发生错误（finally 块）
   */
  private cleanup(): void {
    const store = useAgentStore.getState()
    
    // Finalize 当前助手消息
    if (this.currentAssistantId) {
      store.finalizeAssistant(this.currentAssistantId)
    }
    
    // 重置流状态
    store.setStreamPhase('idle')
    
    // 清理内部状态
    this.currentAssistantId = null
    this.abortController = null
    this.isRunning = false
  }

  /**
   * FNV-1a 哈希算法（用于文件内容哈希）
   */
  private fnvHash(str: string): string {
    let h1 = 0x811c9dc5
    let h2 = 0x811c9dc5
    const len = str.length
    const mid = len >> 1
    
    for (let i = 0; i < mid; i++) {
      h1 ^= str.charCodeAt(i)
      h1 = Math.imul(h1, 0x01000193)
    }
    
    for (let i = mid; i < len; i++) {
      h2 ^= str.charCodeAt(i)
      h2 = Math.imul(h2, 0x01000193)
    }
    
    return (h1 >>> 0).toString(36) + (h2 >>> 0).toString(36)
  }
}

// 导出单例
export const Agent = new AgentClass()
