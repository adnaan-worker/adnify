/**
 * Agent 服务
 * 核心的 Agent 循环逻辑，处理 LLM 通信和工具执行
 * 
 * 架构设计（参考 Cursor/Void）：
 * 1. 内部使用 ChatMessage 格式存储消息
 * 2. 发送给 LLM 前，使用 MessageConverter 转换为 OpenAI API 格式
 * 3. 工具调用必须在 assistant 消息中声明，tool 结果 must 紧随其后
 * 4. 上下文文件内容在发送前异步读取并嵌入用户消息
 * 5. 流式响应实时更新 UI
 */

import { logger } from '@utils/Logger'
import { useAgentStore } from './AgentStore'
import { useStore, ChatMode } from '@store'
import { executeTool, getToolDefinitions, getToolApprovalType } from './ToolExecutor'
import { buildOpenAIMessages, validateOpenAIMessages, OpenAIMessage } from './MessageConverter'
import {
  ContextItem,
  MessageContent,
  ToolExecutionResult,
  TextContent,
  ToolStatus,
} from './types'
import { LLMStreamChunk, LLMToolCall } from '@/renderer/types/electron'
import { truncateToolResult } from '@/renderer/utils/partialJson'
import { READ_ONLY_TOOLS, isFileModifyingTool } from '@/shared/constants'

// 导入拆分的模块
import {
  getAgentConfig,
  READ_TOOLS,
  RETRYABLE_ERROR_CODES,
  isRetryableError,
} from './AgentConfig'
import {
  createStreamHandlerState,
  StreamHandlerState,
  handleTextChunk,
  handleReasoningChunk,
  closeReasoningIfNeeded,
  handleToolCallStart,
  handleToolCallDelta,
  handleToolCallEnd,
  handleFullToolCall,
  handleLLMToolCall,
  handleLLMDone,
  detectStreamingXMLToolCalls,
} from './LLMStreamHandler'
import {
  buildContextContent,
  buildUserContent,
  calculateContextStats,
} from './ContextBuilder'

export interface LLMCallConfig {
  provider: string
  model: string
  apiKey: string
  baseUrl?: string
  timeout?: number
  maxTokens?: number
  adapterId?: string
  adapterConfig?: import('@/shared/types/llmAdapter').LLMAdapterConfig
}

// ===== Agent 服务类 =====

class AgentServiceClass {
  private abortController: AbortController | null = null
  private approvalResolver: ((approved: boolean) => void) | null = null
  private currentAssistantId: string | null = null
  private isRunning = false
  private unsubscribers: (() => void)[] = []
  private streamState: StreamHandlerState = createStreamHandlerState()
  private throttleState = { lastUpdate: 0, lastArgsLen: 0 }

  // 会话级文件追踪
  private readFilesInSession = new Set<string>()

  hasReadFile(filePath: string): boolean {
    const normalizedPath = filePath.replace(/\\/g, '/').toLowerCase()
    return this.readFilesInSession.has(normalizedPath)
  }

  markFileAsRead(filePath: string): void {
    const normalizedPath = filePath.replace(/\\/g, '/').toLowerCase()
    this.readFilesInSession.add(normalizedPath)
    logger.agent.info(`[Agent] File marked as read: ${filePath}`)
  }

  clearSession(): void {
    this.readFilesInSession.clear()
    logger.agent.info('[Agent] Session cleared')
  }

  async calculateContextStats(contextItems: ContextItem[], currentInput: string): Promise<void> {
    return calculateContextStats(contextItems, currentInput)
  }

  // ===== 公共方法 =====

  async sendMessage(
    userMessage: MessageContent,
    config: LLMCallConfig,
    workspacePath: string | null,
    systemPrompt: string,
    chatMode: ChatMode = 'agent'
  ): Promise<void> {
    if (this.isRunning) {
      logger.agent.warn('[Agent] Already running, ignoring new request')
      return
    }

    const store = useAgentStore.getState()

    if (!config.apiKey) {
      this.showError('Please configure your API key in settings.')
      return
    }

    this.isRunning = true
    this.abortController = new AbortController()

    try {
      const contextItems = store.getCurrentThread()?.contextItems || []
      const userQuery = typeof userMessage === 'string' ? userMessage :
        (Array.isArray(userMessage) ? userMessage.filter(p => p.type === 'text').map(p => (p as TextContent).text).join('') : '')

      const contextContent = await buildContextContent(contextItems, userQuery)
      const userMessageId = store.addUserMessage(userMessage, contextItems)
      store.clearContextItems()

      const messageText = typeof userMessage === 'string'
        ? userMessage.slice(0, 50)
        : 'User message'
      await store.createMessageCheckpoint(userMessageId, messageText)

      const llmMessages = await this.buildLLMMessages(userMessage, contextContent, systemPrompt)
      this.currentAssistantId = store.addAssistantMessage()
      store.setStreamPhase('streaming')

      await this.runAgentLoop(config, llmMessages, workspacePath, chatMode)
    } catch (error) {
      logger.agent.error('[Agent] Error:', error)
      this.showError(error instanceof Error ? error.message : 'Unknown error occurred')
    } finally {
      this.cleanup()
    }
  }

  approve(): void {
    if (this.approvalResolver) {
      this.approvalResolver(true)
      this.approvalResolver = null
    }
  }

  reject(): void {
    if (this.approvalResolver) {
      this.approvalResolver(false)
      this.approvalResolver = null
    }
  }

  approveAndEnableAuto(): void {
    const streamState = useAgentStore.getState().streamState
    if (streamState.currentToolCall) {
      const approvalType = getToolApprovalType(streamState.currentToolCall.name)
      if (approvalType) {
        useStore.getState().setAutoApprove({ [approvalType]: true })
        logger.agent.info(`[Agent] Auto-approve enabled for type: ${approvalType}`)
      }
    }
    this.approve()
  }

  abort(): void {
    if (this.abortController) {
      this.abortController.abort()
    }
    window.electronAPI.abortMessage()

    if (this.approvalResolver) {
      this.approvalResolver(false)
      this.approvalResolver = null
    }

    const store = useAgentStore.getState()
    if (this.currentAssistantId) {
      const thread = store.getCurrentThread()
      if (thread) {
        const assistantMsg = thread.messages.find(
          m => m.id === this.currentAssistantId && m.role === 'assistant'
        )
        if (assistantMsg && assistantMsg.role === 'assistant') {
          for (const tc of (assistantMsg as any).toolCalls || []) {
            if (['running', 'awaiting', 'pending'].includes(tc.status)) {
              store.updateToolCall(this.currentAssistantId, tc.id, {
                status: 'error',
                error: 'Aborted by user',
              })
            }
          }
        }
      }
    }

    this.cleanup()
  }

  // ===== 私有方法：核心逻辑 =====

  private async compressContext(messages: OpenAIMessage[]): Promise<void> {
    const config = getAgentConfig()
    const MAX_CHARS = config.contextCompressThreshold
    let totalChars = 0

    for (const msg of messages) {
      if (typeof msg.content === 'string') {
        totalChars += msg.content.length
      } else if (Array.isArray(msg.content)) {
        totalChars += 1000
      }
    }

    if (totalChars <= MAX_CHARS) return

    logger.agent.info(`[Agent] Context size ${totalChars} exceeds limit ${MAX_CHARS}, compressing...`)

    let userCount = 0
    let cutOffIndex = messages.length

    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        userCount++
        if (userCount === 3) {
          cutOffIndex = i
          break
        }
      }
    }

    for (let i = 0; i < cutOffIndex; i++) {
      const msg = messages[i]

      if (msg.role === 'tool' && typeof msg.content === 'string' && msg.content.length > 100) {
        msg.content = '[Tool output removed to save context]'
      }

      if (msg.role === 'assistant' && typeof msg.content === 'string' && msg.content.length > 500) {
        if (!msg.tool_calls || msg.tool_calls.length === 0) {
          msg.content = msg.content.slice(0, 200) + '\n...[Content truncated]...\n' + msg.content.slice(-200)
        }
      }
    }
  }

  private async runAgentLoop(
    config: LLMCallConfig,
    llmMessages: OpenAIMessage[],
    workspacePath: string | null,
    chatMode: ChatMode
  ): Promise<void> {
    const store = useAgentStore.getState()
    let loopCount = 0
    let shouldContinue = true

    const recentToolCalls: string[] = []
    const MAX_RECENT_CALLS = 5
    let consecutiveRepeats = 0
    const MAX_CONSECUTIVE_REPEATS = 2

    const agentLoopConfig = getAgentConfig()

    while (shouldContinue && loopCount < agentLoopConfig.maxToolLoops && !this.abortController?.signal.aborted) {
      loopCount++
      shouldContinue = false

      logger.agent.info(`[Agent] Loop iteration ${loopCount}`)

      await this.compressContext(llmMessages)

      const result = await this.callLLMWithRetry(config, llmMessages, chatMode)

      if (this.abortController?.signal.aborted) break

      if (result.error) {
        store.appendToAssistant(this.currentAssistantId!, `\n\n❌ Error: ${result.error}`)
        break
      }

      if (this.currentAssistantId && result.content !== undefined) {
        const currentMsg = store.getMessages().find(m => m.id === this.currentAssistantId)
        if (currentMsg && currentMsg.role === 'assistant' && currentMsg.content !== result.content) {
          const newParts = currentMsg.parts.map(p =>
            p.type === 'text' ? { ...p, content: result.content! } : p
          )
          store.updateMessage(this.currentAssistantId, {
            content: result.content,
            parts: newParts
          })
        }
      }

      if (!result.toolCalls || result.toolCalls.length === 0) {
        const hasWriteOps = llmMessages.some(m => m.role === 'assistant' && m.tool_calls?.some((tc: any) => !READ_ONLY_TOOLS.includes(tc.function.name)))
        const hasUpdatePlan = llmMessages.some(m => m.role === 'assistant' && m.tool_calls?.some((tc: any) => tc.function.name === 'update_plan'))

        if (store.plan && hasWriteOps && !hasUpdatePlan && loopCount < agentLoopConfig.maxToolLoops) {
          logger.agent.info('[Agent] Plan mode detected: Reminding AI to update plan status')
          llmMessages.push({
            role: 'user' as const,
            content: 'Reminder: You have performed some actions. Please use `update_plan` to update the plan status (e.g., mark the current step as completed) before finishing your response.',
          })
          shouldContinue = true
          continue
        }

        logger.agent.info('[Agent] No tool calls, task complete')
        break
      }

      const currentCallSignature = result.toolCalls
        .map(tc => `${tc.name}:${JSON.stringify(tc.arguments)}`)
        .sort()
        .join('|')

      if (this.currentAssistantId) {
        const currentMsg = store.getMessages().find(m => m.id === this.currentAssistantId)
        if (currentMsg && currentMsg.role === 'assistant') {
          const existingToolCalls = (currentMsg as any).toolCalls || []

          for (const tc of result.toolCalls) {
            const existing = existingToolCalls.find((e: any) => e.id === tc.id)
            if (!existing) {
              store.addToolCallPart(this.currentAssistantId, {
                id: tc.id,
                name: tc.name,
                arguments: tc.arguments,
              })
            } else if (!existing.status) {
              store.updateToolCall(this.currentAssistantId, tc.id, { status: 'pending' })
            }
          }
        }
      }

      if (recentToolCalls.includes(currentCallSignature)) {
        consecutiveRepeats++
        logger.agent.warn(`[Agent] Detected repeated tool call (${consecutiveRepeats}/${MAX_CONSECUTIVE_REPEATS}):`, currentCallSignature.slice(0, 100))

        if (consecutiveRepeats >= MAX_CONSECUTIVE_REPEATS) {
          logger.agent.error('[Agent] Too many repeated calls, stopping loop')
          store.appendToAssistant(this.currentAssistantId!, '\n\n⚠️ Detected repeated operations. Stopping to prevent infinite loop.')
          break
        }
      } else {
        consecutiveRepeats = 0
      }

      recentToolCalls.push(currentCallSignature)
      if (recentToolCalls.length > MAX_RECENT_CALLS) {
        recentToolCalls.shift()
      }

      llmMessages.push({
        role: 'assistant',
        content: result.content || null,
        tool_calls: result.toolCalls.map(tc => ({
          id: tc.id,
          type: 'function' as const,
          function: {
            name: tc.name,
            arguments: JSON.stringify(tc.arguments),
          },
        })),
      })

      let userRejected = false

      logger.agent.info(`[Agent] Executing ${result.toolCalls.length} tool calls`)

      const readToolCalls = result.toolCalls.filter(tc => READ_TOOLS.includes(tc.name))
      const writeToolCalls = result.toolCalls.filter(tc => !READ_TOOLS.includes(tc.name))

      if (readToolCalls.length > 0 && !this.abortController?.signal.aborted) {
        logger.agent.info(`[Agent] Executing ${readToolCalls.length} read tools in parallel`)
        const readResults = await Promise.all(
          readToolCalls.map(async (toolCall) => {
            logger.agent.info(`[Agent] Executing read tool: ${toolCall.name}`, toolCall.arguments)
            try {
              const toolResult = await this.executeToolCall(toolCall, workspacePath)
              return { toolCall, toolResult }
            } catch (error: any) {
              logger.agent.error(`[Agent] Error executing read tool ${toolCall.name}:`, error)
              return {
                toolCall,
                toolResult: { success: false, content: `Error executing tool: ${error.message}`, rejected: false }
              }
            }
          })
        )

        for (const { toolCall, toolResult } of readResults) {
          llmMessages.push({
            role: 'tool' as const,
            tool_call_id: toolCall.id,
            content: toolResult.content,
          })
          if (toolResult.rejected) userRejected = true
        }
      }

      for (const toolCall of writeToolCalls) {
        if (this.abortController?.signal.aborted || userRejected) break

        await new Promise(resolve => setTimeout(resolve, 0))

        logger.agent.info(`[Agent] Executing write tool: ${toolCall.name}`, toolCall.arguments)
        let toolResult
        try {
          toolResult = await this.executeToolCall(toolCall, workspacePath)
        } catch (error: any) {
          logger.agent.error(`[Agent] Error executing write tool ${toolCall.name}:`, error)
          toolResult = { success: false, content: `Error executing tool: ${error.message}`, rejected: false }
        }

        llmMessages.push({
          role: 'tool' as const,
          tool_call_id: toolCall.id,
          content: toolResult.content,
        })

        if (toolResult.rejected) userRejected = true
      }

      const { agentConfig } = useStore.getState()
      if (agentConfig.enableAutoFix && !userRejected && writeToolCalls.length > 0 && workspacePath) {
        const observation = await this.observeChanges(workspacePath, writeToolCalls)
        if (observation.hasErrors && observation.errors.length > 0) {
          const observeMessage = `[Observation] 检测到以下代码问题，请修复：\n\n${observation.errors.slice(0, 3).join('\n\n')}`
          llmMessages.push({
            role: 'user' as const,
            content: observeMessage,
          })
          store.appendToAssistant(this.currentAssistantId!, `\n\n🔍 **Auto-check**: Detected ${observation.errors.length} issue(s). Attempting to fix...`)
        }
      }

      const recentMessages = store.getMessages()
      const hasWhitelistError = recentMessages.some(msg =>
        msg.role === 'tool' && (msg.content.includes('whitelist') || msg.content.includes('白名单'))
      )
      if (hasWhitelistError) {
        store.appendToAssistant(this.currentAssistantId!, '\n\n💡 **Tip**: You can add commands to the whitelist in Settings > Security > Shell Command Whitelist.')
      }

      if (userRejected) break

      shouldContinue = true
      store.setStreamPhase('streaming')
    }

    if (loopCount >= agentLoopConfig.maxToolLoops) {
      store.appendToAssistant(this.currentAssistantId!, '\n\n⚠️ Reached maximum tool call limit.')
    }
  }

  private async callLLMWithRetry(
    config: LLMCallConfig,
    messages: OpenAIMessage[],
    chatMode: ChatMode
  ): Promise<{ content?: string; toolCalls?: LLMToolCall[]; error?: string }> {
    let lastError: string | undefined
    const retryConfig = getAgentConfig()
    let delay = retryConfig.retryDelayMs

    for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
      if (this.abortController?.signal.aborted) return { error: 'Aborted' }

      if (attempt > 0) {
        await new Promise(resolve => setTimeout(resolve, delay))
        delay *= retryConfig.retryBackoffMultiplier
      }

      const result = await this.callLLM(config, messages, chatMode)
      if (!result.error) return result

      const canRetry = RETRYABLE_ERROR_CODES.has(result.error) ||
        result.error.includes('timeout') ||
        result.error.includes('rate limit') ||
        result.error.includes('network')

      if (!canRetry || attempt === retryConfig.maxRetries) return result
      lastError = result.error
    }

    return { error: lastError || 'Max retries exceeded' }
  }

  private async callLLM(
    config: LLMCallConfig,
    messages: OpenAIMessage[],
    chatMode: ChatMode
  ): Promise<{ content?: string; toolCalls?: LLMToolCall[]; error?: string }> {
    return new Promise((resolve) => {
      // 重置流式状态
      this.streamState = createStreamHandlerState()
      this.throttleState = { lastUpdate: 0, lastArgsLen: 0 }

      const cleanupListeners = () => {
        this.unsubscribers.forEach(unsub => unsub())
        this.unsubscribers = []
      }

      // 监听流式文本
      this.unsubscribers.push(
        window.electronAPI.onLLMStream((chunk: LLMStreamChunk) => {
          // 如果正在推理但收到非推理内容，关闭推理标签
          if (this.streamState.isReasoning && chunk.type !== 'reasoning') {
            closeReasoningIfNeeded(this.streamState, this.currentAssistantId)
          }

          // 处理各类流式事件
          handleTextChunk(chunk, this.streamState, this.currentAssistantId)
          if (chunk.type === 'text' && this.currentAssistantId) {
            detectStreamingXMLToolCalls(this.streamState, this.currentAssistantId)
          }

          handleReasoningChunk(chunk, this.streamState, this.currentAssistantId)
          handleToolCallStart(chunk, this.streamState, this.currentAssistantId)
          handleToolCallDelta(chunk, this.streamState, this.currentAssistantId, this.throttleState)
          handleToolCallEnd(chunk, this.streamState, this.currentAssistantId)
          handleFullToolCall(chunk, this.streamState, this.currentAssistantId)
        })
      )

      // 监听非流式工具调用
      this.unsubscribers.push(
        window.electronAPI.onLLMToolCall((toolCall: LLMToolCall) => {
          handleLLMToolCall(toolCall, this.streamState, this.currentAssistantId)
        })
      )

      // 监听完成
      this.unsubscribers.push(
        window.electronAPI.onLLMDone((result) => {
          cleanupListeners()
          const finalResult = handleLLMDone(result, this.streamState, this.currentAssistantId)
          resolve(finalResult)
        })
      )

      // 监听错误
      this.unsubscribers.push(
        window.electronAPI.onLLMError((error) => {
          closeReasoningIfNeeded(this.streamState, this.currentAssistantId)
          cleanupListeners()
          resolve({ error: error.message })
        })
      )

      // 发送请求
      window.electronAPI.sendMessage({
        config,
        messages: messages as any,
        tools: chatMode === 'chat' ? [] : getToolDefinitions(chatMode === 'plan'),
        systemPrompt: '',
      }).catch((err) => {
        cleanupListeners()
        resolve({ error: err.message || 'Failed to send message' })
      })
    })
  }


  private async executeToolCall(
    toolCall: LLMToolCall,
    workspacePath: string | null
  ): Promise<{ success: boolean; content: string; rejected?: boolean }> {
    const store = useAgentStore.getState()
    const { id, name, arguments: args } = toolCall

    const approvalType = getToolApprovalType(name)
    const { autoApprove } = useStore.getState()
    const needsApproval = approvalType && !(autoApprove as any)[approvalType]

    if (this.currentAssistantId) {
      store.updateToolCall(this.currentAssistantId, id, {
        status: needsApproval ? 'awaiting' : 'running',
      })
    }

    if (needsApproval) {
      store.setStreamPhase('tool_pending', { id, name, arguments: args, status: 'awaiting' })
      const approved = await this.waitForApproval()

      if (!approved) {
        if (this.currentAssistantId) {
          store.updateToolCall(this.currentAssistantId, id, { status: 'rejected', error: 'Rejected by user' })
        }
        store.addToolResult(id, name, 'Tool call was rejected by the user.', 'rejected', args as Record<string, unknown>)
        return { success: false, content: 'Tool call was rejected by the user.', rejected: true }
      }

      if (this.currentAssistantId) {
        store.updateToolCall(this.currentAssistantId, id, { status: 'running' })
      }
    }

    store.setStreamPhase('tool_running', { id, name, arguments: args, status: 'running' })

    const startTime = Date.now()
    useStore.getState().addToolCallLog({ type: 'request', toolName: name, data: { name, arguments: args } })

    let originalContent: string | null = null
    let fullPath: string | null = null

    if (isFileModifyingTool(name)) {
      const filePath = args.path as string
      if (filePath && workspacePath) {
        fullPath = filePath.startsWith(workspacePath) ? filePath : `${workspacePath}/${filePath}`
        originalContent = await window.electronAPI.readFile(fullPath)
        store.addSnapshotToCurrentCheckpoint(fullPath, originalContent)
      }
    }

    const config = getAgentConfig()
    const timeoutMs = config.toolTimeoutMs
    const maxRetries = config.maxRetries
    const retryDelayMs = config.retryDelayMs

    const executeWithTimeout = () => Promise.race([
      executeTool(name, args, workspacePath || undefined),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Tool execution timed out after ${timeoutMs / 1000}s`)), timeoutMs)
      )
    ])

    let result: ToolExecutionResult | undefined
    let lastError: string = ''

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        result = await executeWithTimeout()
        if (result.success) break
        lastError = result.error || 'Unknown error'

        if (attempt < maxRetries && isRetryableError(lastError)) {
          logger.agent.info(`[AgentService] Tool ${name} failed (attempt ${attempt}/${maxRetries}), retrying...`)
          await new Promise(resolve => setTimeout(resolve, retryDelayMs * attempt))
        } else {
          break
        }
      } catch (error: any) {
        lastError = error.message
        if (attempt < maxRetries && isRetryableError(lastError)) {
          logger.agent.info(`[AgentService] Tool ${name} error (attempt ${attempt}/${maxRetries}): ${lastError}, retrying...`)
          await new Promise(resolve => setTimeout(resolve, retryDelayMs * attempt))
        } else {
          result = { success: false, result: '', error: lastError }
          break
        }
      }
    }

    if (!result) {
      result = { success: false, result: '', error: lastError || 'Tool execution failed' }
    }

    useStore.getState().addToolCallLog({
      type: 'response',
      toolName: name,
      data: { success: result.success, result: result.result?.slice?.(0, 500), error: result.error },
      duration: Date.now() - startTime
    })

    const status: ToolStatus = result.success ? 'success' : 'error'
    if (this.currentAssistantId) {
      store.updateToolCall(this.currentAssistantId, id, {
        status,
        result: result.result,
        error: result.error,
        arguments: { ...args, _meta: result.meta },
      })
    }

    if (result.success && fullPath && isFileModifyingTool(name)) {
      const meta = result.meta as { linesAdded?: number; linesRemoved?: number; newContent?: string; isNewFile?: boolean } | undefined
      store.addPendingChange({
        filePath: fullPath,
        toolCallId: id,
        toolName: name,
        snapshot: { fsPath: fullPath, content: originalContent },
        linesAdded: meta?.linesAdded || 0,
        linesRemoved: meta?.linesRemoved || 0,
      })

      try {
        const { composerService } = await import('../composerService')
        const relativePath = workspacePath ? fullPath.replace(workspacePath, '').replace(/^[\\/]/, '') : fullPath
        composerService.addChange({
          filePath: fullPath,
          relativePath,
          oldContent: originalContent,
          newContent: meta?.newContent || null,
          changeType: name === 'delete_file_or_folder' ? 'delete' : (meta?.isNewFile ? 'create' : 'modify'),
          linesAdded: meta?.linesAdded || 0,
          linesRemoved: meta?.linesRemoved || 0,
          toolCallId: id,
        })
      } catch (e) {
        logger.agent.warn('[Agent] Failed to add to composer:', e)
      }
    }

    const resultConfig = getAgentConfig()
    const resultContent = result.success ? (result.result || '') : `Error: ${result.error || 'Unknown error'}`
    const truncatedContent = truncateToolResult(resultContent, name, resultConfig.maxToolResultChars)
    const resultType = result.success ? 'success' : 'tool_error'
    store.addToolResult(id, name, truncatedContent, resultType, args as Record<string, unknown>)

    return { success: result.success, content: truncatedContent, rejected: false }
  }

  // ===== 私有方法：消息构建 =====

  private async buildLLMMessages(
    currentMessage: MessageContent,
    contextContent: string,
    systemPrompt: string
  ): Promise<OpenAIMessage[]> {
    const store = useAgentStore.getState()
    const historyMessages = store.getMessages()

    const { shouldCompactContext, prepareMessagesForCompact, createCompactedSystemMessage } = await import('./ContextCompressor')

    type NonCheckpointMessage = Exclude<typeof historyMessages[number], { role: 'checkpoint' }>
    let filteredMessages: NonCheckpointMessage[] = historyMessages.filter(
      (m): m is NonCheckpointMessage => m.role !== 'checkpoint'
    )
    let compactedSummary: string | null = null

    const llmConfig = getAgentConfig()

    if (shouldCompactContext(filteredMessages)) {
      logger.agent.info('[Agent] Context exceeds threshold, compacting...')

      const existingSummary = (store as any).contextSummary
      if (existingSummary) {
        compactedSummary = existingSummary
        const { recentMessages } = prepareMessagesForCompact(filteredMessages as any)
        filteredMessages = recentMessages as NonCheckpointMessage[]
      } else {
        filteredMessages = filteredMessages.slice(-llmConfig.maxHistoryMessages)
      }
    } else {
      filteredMessages = filteredMessages.slice(-llmConfig.maxHistoryMessages)
    }

    const effectiveSystemPrompt = compactedSummary
      ? `${systemPrompt}\n\n${createCompactedSystemMessage(compactedSummary)}`
      : systemPrompt

    const openaiMessages = buildOpenAIMessages(filteredMessages as any, effectiveSystemPrompt)

    for (const msg of openaiMessages) {
      if (msg.role === 'tool' && typeof msg.content === 'string') {
        if (msg.content.length > llmConfig.maxToolResultChars) {
          msg.content = truncateToolResult(msg.content, 'default', llmConfig.maxToolResultChars)
        }
      }
    }

    const userContent = buildUserContent(currentMessage, contextContent)
    openaiMessages.push({ role: 'user', content: userContent })

    const validation = validateOpenAIMessages(openaiMessages)
    if (!validation.valid) logger.agent.warn('[Agent] Message validation warning:', validation.error)

    return openaiMessages
  }

  private waitForApproval(): Promise<boolean> {
    return new Promise((resolve) => {
      this.approvalResolver = resolve
    })
  }

  private showError(message: string): void {
    const store = useAgentStore.getState()
    const id = store.addAssistantMessage()
    store.appendToAssistant(id, `❌ ${message}`)
    store.finalizeAssistant(id)
  }

  private cleanup(): void {
    this.unsubscribers.forEach(unsub => unsub())
    this.unsubscribers = []

    const store = useAgentStore.getState()
    if (this.currentAssistantId) store.finalizeAssistant(this.currentAssistantId)
    store.setStreamPhase('idle')
    this.currentAssistantId = null
    this.abortController = null
    this.isRunning = false
    this.streamState = createStreamHandlerState()
  }

  private async observeChanges(
    workspacePath: string,
    writeToolCalls: LLMToolCall[]
  ): Promise<{ hasErrors: boolean; errors: string[] }> {
    const errors: string[] = []
    const editedFiles = writeToolCalls
      .filter(tc => ['edit_file', 'write_file', 'create_file_or_folder'].includes(tc.name))
      .map(tc => {
        const filePath = tc.arguments.path as string
        return filePath.startsWith(workspacePath) ? filePath : `${workspacePath}/${filePath}`.replace(/\/+/g, '/')
      })
      .filter(path => !path.endsWith('/'))

    for (const filePath of editedFiles) {
      try {
        const lintResult = await executeTool('get_lint_errors', { path: filePath }, workspacePath)
        if (lintResult.success && lintResult.result) {
          const result = lintResult.result.trim()
          if (result && result !== '[]' && result !== 'No diagnostics found') {
            const hasActualError = /\[error\]/i.test(result) ||
              result.toLowerCase().includes('failed to compile') ||
              result.toLowerCase().includes('syntax error')

            if (hasActualError) {
              errors.push(`File: ${filePath}\n${result}`)
            }
          }
        }
      } catch (e) { }
    }
    return { hasErrors: errors.length > 0, errors }
  }
}

export const AgentService = new AgentServiceClass()
