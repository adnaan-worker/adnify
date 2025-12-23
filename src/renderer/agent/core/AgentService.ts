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

import { useAgentStore } from './AgentStore'
import { useModeStore } from '@/renderer/modes'
import { useStore, ChatMode } from '../../store'  // 用于读取 autoApprove 配置和记录日志
import { executeTool, getToolDefinitions, getToolApprovalType } from './ToolExecutor'
import { buildOpenAIMessages, validateOpenAIMessages, OpenAIMessage } from './MessageConverter'
import {
  UserMessage,
  AssistantMessage,
  ToolResultMessage,
  ContextItem,
  MessageContent,
  ToolDefinition,
  ToolExecutionResult,
  TextContent,
  ToolStatus,
} from './types'
import { LLMStreamChunk, LLMToolCall } from '@/renderer/types/electron'
import { parsePartialJson, truncateToolResult } from '@/renderer/utils/partialJson'
import { AGENT_DEFAULTS, READ_ONLY_TOOLS, isFileModifyingTool } from '@/shared/constants'

// 读取类工具（可以并行执行）- 使用 constants.ts 的统一定义
const READ_TOOLS = READ_ONLY_TOOLS as readonly string[]

// ===== 配置 =====

// 从 store 获取动态配置（使用 AGENT_DEFAULTS 作为默认值）
const getConfig = () => {
  const agentConfig = useStore.getState().agentConfig || {}
  return {
    // 用户可配置的值
    maxToolLoops: agentConfig.maxToolLoops ?? AGENT_DEFAULTS.MAX_TOOL_LOOPS,
    maxHistoryMessages: agentConfig.maxHistoryMessages ?? 50,
    maxToolResultChars: agentConfig.maxToolResultChars ?? 10000,
    maxFileContentChars: agentConfig.maxFileContentChars ?? AGENT_DEFAULTS.MAX_FILE_CONTENT_CHARS,
    maxTotalContextChars: agentConfig.maxTotalContextChars ?? 50000,
    // 重试配置（使用统一默认值）
    maxRetries: AGENT_DEFAULTS.MAX_RETRIES,
    retryDelayMs: AGENT_DEFAULTS.RETRY_DELAY_MS,
    retryBackoffMultiplier: AGENT_DEFAULTS.RETRY_BACKOFF_MULTIPLIER,
    // 工具执行超时
    toolTimeoutMs: AGENT_DEFAULTS.TOOL_TIMEOUT_MS,
    // 上下文压缩阈值
    contextCompressThreshold: AGENT_DEFAULTS.CONTEXT_COMPRESS_THRESHOLD,
    keepRecentTurns: AGENT_DEFAULTS.KEEP_RECENT_TURNS,
  }
}

// 保留旧的 CONFIG 引用以兼容现有代码
const CONFIG = getConfig()

/**
 * 智能消息压缩函数
 * 策略：
 * 1. 保留最近 N 条消息完整
 * 2. 中间消息的工具结果截断
 * 3. 超长的 assistant 回复也截断
 * @internal 供 buildMessagesForLLM 调用，暂未集成
 */
type AnyMessage = UserMessage | AssistantMessage | ToolResultMessage
export function compressMessages(messages: AnyMessage[], maxChars: number): AnyMessage[] {
  const recentKeepCount = 6  // 保留最近 6 条消息完整
  const toolResultMaxChars = 2000  // 中间消息的工具结果最大长度
  const assistantMaxChars = 4000  // 中间消息的 assistant 回复最大长度

  if (messages.length <= recentKeepCount) {
    return messages
  }

  let totalChars = 0
  const compressed: AnyMessage[] = []

  // 先计算最近消息的长度
  const recentMessages = messages.slice(-recentKeepCount)
  const olderMessages = messages.slice(0, -recentKeepCount)

  // 处理较早的消息
  for (const msg of olderMessages) {
    let content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)

    if (msg.role === 'tool') {
      // 截断工具结果
      if (content.length > toolResultMaxChars) {
        content = content.slice(0, toolResultMaxChars) + '\n...[truncated]'
      }
    } else if (msg.role === 'assistant') {
      // 截断 assistant 回复（但保留工具调用信息）
      const assistantMsg = msg as AssistantMessage
      if (content.length > assistantMaxChars && !assistantMsg.toolCalls?.length) {
        content = content.slice(0, assistantMaxChars) + '\n...[truncated]'
      }
    }

    const compressedMsg = { ...msg, content } as AnyMessage
    totalChars += content.length

    // 如果超过限制，只保留摘要
    if (totalChars > maxChars * 0.6) {
      compressed.push({
        ...msg,
        content: msg.role === 'tool'
          ? '[Tool result truncated due to context limit]'
          : `[Message truncated: ${content.slice(0, 100)}...]`
      } as AnyMessage)
    } else {
      compressed.push(compressedMsg)
    }
  }

  // 添加最近消息（保持完整）
  compressed.push(...recentMessages)

  return compressed
}

// 可重试的错误代码
const RETRYABLE_ERROR_CODES = new Set([
  'RATE_LIMIT',
  'TIMEOUT',
  'NETWORK_ERROR',
  'SERVER_ERROR',
])

// ===== Agent 服务类 =====

class AgentServiceClass {
  private abortController: AbortController | null = null
  private approvalResolver: ((approved: boolean) => void) | null = null
  private currentAssistantId: string | null = null
  private isRunning = false
  private unsubscribers: (() => void)[] = []
  private contentBuffer: string = ''
  private activeStreamingToolCalls: Set<string> = new Set()

  // 会话级文件追踪：记录已读取的文件（用于 read-before-write 验证）
  private readFilesInSession = new Set<string>()

  /**
   * 检查文件是否已在当前会话中读取
   */
  hasReadFile(filePath: string): boolean {
    // 标准化路径以确保一致性
    const normalizedPath = filePath.replace(/\\/g, '/').toLowerCase()
    return this.readFilesInSession.has(normalizedPath)
  }

  /**
   * 标记文件已读取
   */
  markFileAsRead(filePath: string): void {
    const normalizedPath = filePath.replace(/\\/g, '/').toLowerCase()
    this.readFilesInSession.add(normalizedPath)
    console.log(`[Agent] File marked as read: ${filePath}`)
  }

  /**
   * 清空会话状态（新对话开始时调用）
   */
  clearSession(): void {
    this.readFilesInSession.clear()
    console.log('[Agent] Session cleared')
  }

  /**
   * 计算并更新当前上下文统计信息
   */
  async calculateContextStats(contextItems: ContextItem[], currentInput: string): Promise<void> {
    const state = useStore.getState()
    const agentStore = useAgentStore.getState()
    const messages = agentStore.getMessages()
    const filteredMessages = messages.filter(m => m.role !== 'checkpoint')

    let totalChars = 0
    let fileCount = 0
    let semanticResultCount = 0

    // 1. 计算消息历史长度
    for (const msg of filteredMessages) {
      if (msg.role === 'user' || msg.role === 'assistant') {
        const content = (msg as UserMessage | AssistantMessage).content
        if (typeof content === 'string') {
          totalChars += content.length
        } else if (Array.isArray(content)) {
          for (const part of content) {
            if (part.type === 'text') totalChars += part.text.length
          }
        }
      } else if (msg.role === 'tool') {
        totalChars += (msg as ToolResultMessage).content.length
      }
    }

    // 2. 计算当前输入长度
    totalChars += currentInput.length

    // 3. 计算上下文项长度
    for (const item of contextItems) {
      if (item.type === 'File') {
        fileCount++
        const filePath = (item as any).uri
        if (filePath) {
          try {
            // 注意：这里频繁读取文件可能有性能影响，后续可考虑缓存
            const content = await window.electronAPI.readFile(filePath)
            if (content) {
              totalChars += Math.min(content.length, CONFIG.maxFileContentChars)
            }
          } catch (e) { }
        }
      } else if (item.type === 'Codebase') {
        semanticResultCount++
        // 预估搜索结果长度
        totalChars += 2000
      }
    }

    // 获取最新配置（动态获取以反映用户设置的更改）
    const currentConfig = getConfig()

    // 只统计 user + assistant 消息（不含 tool），更符合用户直觉
    const userAssistantMessages = filteredMessages.filter(m => m.role === 'user' || m.role === 'assistant')

    // 更新全局 Store 中的统计信息
    state.setContextStats({
      totalChars,
      maxChars: currentConfig.maxTotalContextChars,
      fileCount,
      maxFiles: 10,
      messageCount: userAssistantMessages.length,
      maxMessages: currentConfig.maxHistoryMessages,
      semanticResultCount,
      terminalChars: 0
    })
  }

  // ===== 公共方法 =====

  /**
   * 发送消息并启动 Agent 循环
   */
  async sendMessage(
    userMessage: MessageContent,
    config: {
      provider: string
      model: string
      apiKey: string
      baseUrl?: string
      thinkingEnabled?: boolean
      thinkingBudget?: number
    },
    workspacePath: string | null,
    systemPrompt: string,
    chatMode: ChatMode = 'agent'
  ): Promise<void> {
    // 防止重复执行
    if (this.isRunning) {
      console.warn('[Agent] Already running, ignoring new request')
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
      // 1. 获取并保存上下文
      const contextItems = store.getCurrentThread()?.contextItems || []

      // 2. 读取上下文文件内容
      const userQuery = typeof userMessage === 'string' ? userMessage :
        (Array.isArray(userMessage) ? userMessage.filter(p => p.type === 'text').map(p => (p as TextContent).text).join('') : '')

      const contextContent = await this.buildContextContent(contextItems, userQuery)

      // 3. 添加用户消息到 store
      const userMessageId = store.addUserMessage(userMessage, contextItems)
      store.clearContextItems()

      // 4. 创建消息检查点（在执行任何操作之前保存当前状态）
      const messageText = typeof userMessage === 'string'
        ? userMessage.slice(0, 50)
        : 'User message'
      await store.createMessageCheckpoint(userMessageId, messageText)

      // 5. 构建 LLM 消息历史
      const llmMessages = await this.buildLLMMessages(userMessage, contextContent, systemPrompt)

      // 6. 创建助手消息占位
      this.currentAssistantId = store.addAssistantMessage()
      store.setStreamPhase('streaming')

      // 7. 执行 Agent 循环
      await this.runAgentLoop(config, llmMessages, workspacePath, chatMode)

    } catch (error) {
      console.error('[Agent] Error:', error)
      this.showError(error instanceof Error ? error.message : 'Unknown error occurred')
    } finally {
      this.cleanup()
    }
  }

  /**
   * 批准当前等待的工具调用
   */
  approve(): void {
    if (this.approvalResolver) {
      this.approvalResolver(true)
      this.approvalResolver = null
    }
  }

  /**
   * 拒绝当前等待的工具调用
   */
  reject(): void {
    if (this.approvalResolver) {
      this.approvalResolver(false)
      this.approvalResolver = null
    }
  }

  /**
   * 批准当前工具并开启该类型的会话级自动审批
   * 用于"批准全部"功能
   */
  approveAndEnableAuto(): void {
    // 获取当前待审批工具的类型
    const streamState = useAgentStore.getState().streamState
    if (streamState.currentToolCall) {
      const approvalType = getToolApprovalType(streamState.currentToolCall.name)
      if (approvalType) {
        // 临时开启该类型的自动审批
        useStore.getState().setAutoApprove({ [approvalType]: true })
        console.log(`[Agent] Auto-approve enabled for type: ${approvalType}`)
      }
    }
    // 批准当前工具
    this.approve()
  }

  /**
   * 中止当前执行
   */
  abort(): void {
    if (this.abortController) {
      this.abortController.abort()
    }
    window.electronAPI.abortMessage()

    if (this.approvalResolver) {
      this.approvalResolver(false)
      this.approvalResolver = null
    }

    // 标记正在执行的工具调用为中止状态
    const store = useAgentStore.getState()
    if (this.currentAssistantId) {
      const thread = store.getCurrentThread()
      if (thread) {
        const assistantMsg = thread.messages.find(
          m => m.id === this.currentAssistantId && m.role === 'assistant'
        )
        if (assistantMsg && assistantMsg.role === 'assistant') {
          // 更新所有 running/awaiting/pending 状态的工具调用为 error
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

  /**
   * 压缩上下文以节省 Token
   */
  private async compressContext(messages: OpenAIMessage[]): Promise<void> {
    const config = getConfig()
    const MAX_CHARS = config.contextCompressThreshold
    let totalChars = 0

    for (const msg of messages) {
      if (typeof msg.content === 'string') {
        totalChars += msg.content.length
      } else if (Array.isArray(msg.content)) {
        totalChars += 1000 // 简略估算
      }
    }

    if (totalChars <= MAX_CHARS) return

    console.log(`[Agent] Context size ${totalChars} exceeds limit ${MAX_CHARS}, compressing...`)

    // 保留最后 3 轮对话 (User + Assistant + Tools)
    // 倒序寻找第 3 个 User 消息的位置
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

    // 压缩 cutOffIndex 之前的消息
    for (let i = 0; i < cutOffIndex; i++) {
      const msg = messages[i]

      // 1. 压缩工具输出
      if (msg.role === 'tool' && typeof msg.content === 'string' && msg.content.length > 100) {
        msg.content = '[Tool output removed to save context]'
      }

      // 2. 压缩助手回复 (保留思维链/工具调用，仅压缩文本)
      if (msg.role === 'assistant' && typeof msg.content === 'string' && msg.content.length > 500) {
        // 如果包含 tool_calls，通常 content 为 null 或简短说明，但如果有长思维链，可以压缩
        if (!msg.tool_calls || msg.tool_calls.length === 0) {
          msg.content = msg.content.slice(0, 200) + '\n...[Content truncated]...\n' + msg.content.slice(-200)
        }
      }
    }
  }

  /**
   * Agent 主循环
   */
  private async runAgentLoop(
    config: { provider: string; model: string; apiKey: string; baseUrl?: string },
    llmMessages: OpenAIMessage[],
    workspacePath: string | null,
    chatMode: ChatMode
  ): Promise<void> {
    const store = useAgentStore.getState()
    let loopCount = 0
    let shouldContinue = true

    // 用于检测重复调用
    const recentToolCalls: string[] = []
    const MAX_RECENT_CALLS = 5
    let consecutiveRepeats = 0
    const MAX_CONSECUTIVE_REPEATS = 2

    while (shouldContinue && loopCount < CONFIG.maxToolLoops && !this.abortController?.signal.aborted) {
      loopCount++
      shouldContinue = false

      console.log(`[Agent] Loop iteration ${loopCount}`)

      // 压缩上下文
      await this.compressContext(llmMessages)

      // 调用 LLM（带自动重试）
      const result = await this.callLLMWithRetry(config, llmMessages, chatMode)

      if (this.abortController?.signal.aborted) break

      if (result.error) {
        store.appendToAssistant(this.currentAssistantId!, `\n\n❌ Error: ${result.error}`)
        break
      }

      // Update store with cleaned content (remove XML artifacts from UI)
      if (this.currentAssistantId && result.content !== undefined) {
        const currentMsg = store.getMessages().find(m => m.id === this.currentAssistantId)
        if (currentMsg && currentMsg.role === 'assistant' && currentMsg.content !== result.content) {
          // Update parts to reflect cleaned content
          const newParts = currentMsg.parts.map(p => 
            p.type === 'text' ? { ...p, content: result.content! } : p
          )
          
          store.updateMessage(this.currentAssistantId, { 
            content: result.content,
            parts: newParts
          })
        }
      }

      // 如果没有工具调用，LLM 认为任务完成，结束循环
      if (!result.toolCalls || result.toolCalls.length === 0) {
        // [Plan Mode Reminder] 如果在计划模式下，且本轮执行了写操作但未更新计划，则注入提醒
        const hasWriteOps = llmMessages.some(m => m.role === 'assistant' && m.tool_calls?.some((tc: any) => !READ_ONLY_TOOLS.includes(tc.function.name)))
        const hasUpdatePlan = llmMessages.some(m => m.role === 'assistant' && m.tool_calls?.some((tc: any) => tc.function.name === 'update_plan'))

        if (store.plan && hasWriteOps && !hasUpdatePlan && loopCount < CONFIG.maxToolLoops) {
          console.log('[Agent] Plan mode detected: Reminding AI to update plan status')
          llmMessages.push({
            role: 'user' as const,
            content: 'Reminder: You have performed some actions. Please use `update_plan` to update the plan status (e.g., mark the current step as completed) before finishing your response.',
          })
          shouldContinue = true
          continue
        }

        console.log('[Agent] No tool calls, task complete')
        break
      }

      // 检测重复调用
      const currentCallSignature = result.toolCalls
        .map(tc => `${tc.name}:${JSON.stringify(tc.arguments)}`)
        .sort()
        .join('|')

      // 确保所有工具调用都已添加到 Store，并且状态正确
      if (this.currentAssistantId) {
        const currentMsg = store.getMessages().find(m => m.id === this.currentAssistantId)
        if (currentMsg && currentMsg.role === 'assistant') {
          const existingToolCalls = (currentMsg as any).toolCalls || []

          for (const tc of result.toolCalls) {
            const existing = existingToolCalls.find((e: any) => e.id === tc.id)
            if (!existing) {
              // 不存在则添加
              store.addToolCallPart(this.currentAssistantId, {
                id: tc.id,
                name: tc.name,
                arguments: tc.arguments,
              })
            } else if (!existing.status) {
              // 存在但无状态，更新为 pending
              store.updateToolCall(this.currentAssistantId, tc.id, { status: 'pending' })
            }
          }
        }
      }

      if (recentToolCalls.includes(currentCallSignature)) {
        consecutiveRepeats++
        console.warn(`[Agent] Detected repeated tool call (${consecutiveRepeats}/${MAX_CONSECUTIVE_REPEATS}):`, currentCallSignature.slice(0, 100))

        if (consecutiveRepeats >= MAX_CONSECUTIVE_REPEATS) {
          console.error('[Agent] Too many repeated calls, stopping loop')
          store.appendToAssistant(this.currentAssistantId!, '\n\n⚠️ Detected repeated operations. Stopping to prevent infinite loop.')
          break
        }
      } else {
        consecutiveRepeats = 0
      }

      // 记录最近的调用
      recentToolCalls.push(currentCallSignature)
      if (recentToolCalls.length > MAX_RECENT_CALLS) {
        recentToolCalls.shift()
      }

      // 添加 assistant 消息（包含 tool_calls）到历史
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

      // 执行所有工具调用（只读工具并行，写入工具串行）
      let userRejected = false

      console.log(`[Agent] Executing ${result.toolCalls.length} tool calls`)

      // 分离只读工具和写入工具
      const readToolCalls = result.toolCalls.filter(tc => READ_TOOLS.includes(tc.name))
      const writeToolCalls = result.toolCalls.filter(tc => !READ_TOOLS.includes(tc.name))

      // 并行执行只读工具
      if (readToolCalls.length > 0 && !this.abortController?.signal.aborted) {
        console.log(`[Agent] Executing ${readToolCalls.length} read tools in parallel`)
        const readResults = await Promise.all(
          readToolCalls.map(async (toolCall) => {
            console.log(`[Agent] Executing read tool: ${toolCall.name}`, toolCall.arguments)
            try {
              const toolResult = await this.executeToolCall(toolCall, workspacePath)
              return { toolCall, toolResult }
            } catch (error: any) {
              console.error(`[Agent] Error executing read tool ${toolCall.name}:`, error)
              return {
                toolCall,
                toolResult: { success: false, content: `Error executing tool: ${error.message}`, rejected: false }
              }
            }
          })
        )

        // 按原始顺序添加结果到消息历史
        for (const { toolCall, toolResult } of readResults) {
          llmMessages.push({
            role: 'tool' as const,
            tool_call_id: toolCall.id,
            content: toolResult.content,
          })

          if (toolResult.rejected) userRejected = true
        }
      }

      // 串行执行写入工具（添加微任务断点以保持 UI 响应）
      for (const toolCall of writeToolCalls) {
        if (this.abortController?.signal.aborted || userRejected) break

        // 微任务断点：让出主线程，保持 UI 响应
        await new Promise(resolve => setTimeout(resolve, 0))

        console.log(`[Agent] Executing write tool: ${toolCall.name}`, toolCall.arguments)
        let toolResult
        try {
          toolResult = await this.executeToolCall(toolCall, workspacePath)
        } catch (error: any) {
          console.error(`[Agent] Error executing write tool ${toolCall.name}:`, error)
          toolResult = { success: false, content: `Error executing tool: ${error.message}`, rejected: false }
        }

        llmMessages.push({
          role: 'tool' as const,
          tool_call_id: toolCall.id,
          content: toolResult.content,
        })

        if (toolResult.rejected) userRejected = true
      }

      // === Observe Phase ===
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

      // 检测白名单错误
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

    if (loopCount >= CONFIG.maxToolLoops) {
      store.appendToAssistant(this.currentAssistantId!, '\n\n⚠️ Reached maximum tool call limit.')
    }
  }

  /**
   * 调用 LLM API（带自动重试）
   */
  private async callLLMWithRetry(
    config: { provider: string; model: string; apiKey: string; baseUrl?: string },
    messages: OpenAIMessage[],
    chatMode: ChatMode
  ): Promise<{ content?: string; toolCalls?: LLMToolCall[]; error?: string }> {
    let lastError: string | undefined
    let delay = CONFIG.retryDelayMs

    for (let attempt = 0; attempt <= CONFIG.maxRetries; attempt++) {
      if (this.abortController?.signal.aborted) return { error: 'Aborted' }

      if (attempt > 0) {
        await new Promise(resolve => setTimeout(resolve, delay))
        delay *= CONFIG.retryBackoffMultiplier
      }

      const result = await this.callLLM(config, messages, chatMode)
      if (!result.error) return result

      const isRetryable = RETRYABLE_ERROR_CODES.has(result.error) ||
        result.error.includes('timeout') ||
        result.error.includes('rate limit') ||
        result.error.includes('network')

      if (!isRetryable || attempt === CONFIG.maxRetries) return result
      lastError = result.error
    }

    return { error: lastError || 'Max retries exceeded' }
  }

  /**
   * 调用 LLM API
   */
  private async callLLM(
    config: { provider: string; model: string; apiKey: string; baseUrl?: string },
    messages: OpenAIMessage[],
    chatMode: ChatMode
  ): Promise<{ content?: string; toolCalls?: LLMToolCall[]; error?: string }> {
    const store = useAgentStore.getState()

    return new Promise((resolve) => {
      let content = ''
      const toolCalls: LLMToolCall[] = []
      let currentToolCall: { id: string; name: string; argsString: string } | null = null

      // 只清除监听器，不重置完整状态
      // 完整 cleanup 在 sendMessage finally 中进行
      const cleanupListeners = () => {
        this.unsubscribers.forEach(unsub => unsub())
        this.unsubscribers = []
      }

      // 验证工具名称是否合法
      const isValidToolName = (name: string) => {
        if (!/^[a-zA-Z0-9_-]+$/.test(name)) return false
        // 获取 Plan 模式状态，动态过滤工具
        const isPlanMode = useModeStore.getState().currentMode === 'plan'
        // 确保工具在定义中存在
        return getToolDefinitions(isPlanMode).some((t: ToolDefinition) => t.name === name)
      }

      // 监听流式文本
      this.unsubscribers.push(
        window.electronAPI.onLLMStream((chunk: LLMStreamChunk) => {
          if (chunk.type === 'text' && chunk.content) {
            content += chunk.content
            this.contentBuffer += chunk.content
            if (this.currentAssistantId) {
              store.appendToAssistant(this.currentAssistantId, chunk.content)
              this.detectStreamingXMLToolCalls()
            }
          }

          // 流式工具调用开始
          if (chunk.type === 'tool_call_start' && chunk.toolCallDelta) {
            const toolId = chunk.toolCallDelta.id || `tool_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
            const toolName = chunk.toolCallDelta.name || 'unknown'

            // 记录调试日志
            console.log(`[Agent] Tool call start: ${toolName} (${toolId})`)

            if (toolName !== 'unknown' && !isValidToolName(toolName)) {
              console.warn(`[Agent] Invalid tool name detected: ${toolName}`)
              return
            }

            currentToolCall = { id: toolId, name: toolName, argsString: '' }

            if (this.currentAssistantId) {
              store.addToolCallPart(this.currentAssistantId, {
                id: toolId,
                name: toolName,
                arguments: { _streaming: true },
              })
            }
          }

          // 流式工具调用参数
          if (chunk.type === 'tool_call_delta' && chunk.toolCallDelta && currentToolCall) {
            if (chunk.toolCallDelta.name) {
              const newName = chunk.toolCallDelta.name
              if (isValidToolName(newName)) {
                currentToolCall.name = newName
                if (this.currentAssistantId) {
                  store.updateToolCall(this.currentAssistantId, currentToolCall.id, { name: newName })
                }
              }
            }

            if (chunk.toolCallDelta.args) {
              currentToolCall.argsString += chunk.toolCallDelta.args
              const partialArgs = this.parsePartialArgs(currentToolCall.argsString, currentToolCall.name)

              if (this.currentAssistantId) {
                const now = Date.now()
                const lastUpdate = (this as any)._lastToolUpdate || 0
                const lastLen = (this as any)._lastArgsLen || 0
                const currentLen = currentToolCall.argsString.length

                // Optimize throttle: update every 30ms OR if content grew significantly (> 50 chars)
                if (now - lastUpdate > 30 || currentLen - lastLen > 50) {
                  store.updateToolCall(this.currentAssistantId, currentToolCall.id, {
                    arguments: { ...partialArgs, _streaming: true },
                  })
                    ; (this as any)._lastToolUpdate = now
                    ; (this as any)._lastArgsLen = currentLen
                }
              }
            }
          }

          // 流式工具调用结束
          if (chunk.type === 'tool_call_end' && currentToolCall) {
            console.log(`[Agent] Tool call end: ${currentToolCall.name} (${currentToolCall.id})`)
            try {
              const args = JSON.parse(currentToolCall.argsString || '{}')
              toolCalls.push({ id: currentToolCall.id, name: currentToolCall.name, arguments: args })
              if (this.currentAssistantId) {
                store.updateToolCall(this.currentAssistantId, currentToolCall.id, {
                  arguments: args,
                  status: 'pending',
                })
              }
            } catch (e) {
              console.error(`[Agent] Failed to parse tool args for ${currentToolCall.name}:`, e)
              toolCalls.push({ id: currentToolCall.id, name: currentToolCall.name, arguments: { _parseError: true, _rawArgs: currentToolCall.argsString } })
            }
            currentToolCall = null
          }

          // 完整工具调用
          if (chunk.type === 'tool_call' && chunk.toolCall) {
            if (!isValidToolName(chunk.toolCall.name)) return
            if (!toolCalls.find(tc => tc.id === chunk.toolCall!.id)) {
              toolCalls.push(chunk.toolCall)
              if (this.currentAssistantId) {
                store.addToolCallPart(this.currentAssistantId, {
                  id: chunk.toolCall.id,
                  name: chunk.toolCall.name,
                  arguments: chunk.toolCall.arguments,
                })
              }
            }
          }
        })
      )

      // 监听非流式工具调用
      this.unsubscribers.push(
        window.electronAPI.onLLMToolCall((toolCall: LLMToolCall) => {
          if (!isValidToolName(toolCall.name)) return
          if (!toolCalls.find(tc => tc.id === toolCall.id)) {
            toolCalls.push(toolCall)
            if (this.currentAssistantId) {
              store.addToolCallPart(this.currentAssistantId, {
                id: toolCall.id,
                name: toolCall.name,
                arguments: toolCall.arguments,
              })
            }
          }
        })
      )

      // 监听完成
      this.unsubscribers.push(
        window.electronAPI.onLLMDone((result) => {
          cleanupListeners()
          if (result.toolCalls) {
            for (const tc of result.toolCalls) {
              if (!toolCalls.find(t => t.id === tc.id)) toolCalls.push(tc)
            }
          }

          // 始终尝试从内容中解析 XML 格式的工具调用（支持混合模式）
          let finalContent = content || result.content || ''
          if (finalContent) {
            const xmlToolCalls = this.parseXMLToolCalls(finalContent)
            if (xmlToolCalls.length > 0) {
              // 移除 XML 工具调用字符串
              finalContent = finalContent.replace(/<tool_call>[\s\S]*?<\/tool_call>/gi, '').trim()

              for (const tc of xmlToolCalls) {
                // 如果已经在流式中添加过了，就不再重复添加，但要更新最终结果
                const existing = toolCalls.find(t => t.name === tc.name && JSON.stringify(t.arguments) === JSON.stringify(tc.arguments))
                if (!existing) {
                  toolCalls.push(tc)
                  // 添加到 UI
                  if (this.currentAssistantId) {
                    const store = useAgentStore.getState()
                    store.addToolCallPart(this.currentAssistantId, {
                      id: tc.id,
                      name: tc.name,
                      arguments: tc.arguments,
                    })
                  }
                }
              }
            }
          }

          resolve({ content: finalContent, toolCalls })
        })
      )

      // 监听错误
      this.unsubscribers.push(
        window.electronAPI.onLLMError((error) => {
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

  /**
   * 判断错误是否可重试
   */
  private isRetryableError(error: string): boolean {
    const retryablePatterns = [
      /timeout/i,
      /ECONNRESET/i,
      /ETIMEDOUT/i,
      /ENOTFOUND/i,
      /network/i,
      /temporarily unavailable/i,
      /rate limit/i,
      /429/,
      /503/,
      /502/,
    ]
    return retryablePatterns.some(pattern => pattern.test(error))
  }

  /**
   * 执行单个工具调用
   */
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

    // 记录工具调用请求日志
    const startTime = Date.now()
    useStore.getState().addToolCallLog({ type: 'request', toolName: name, data: { name, arguments: args } })

    let originalContent: string | null = null
    let fullPath: string | null = null
    // 使用智能函数判断是否需要创建文件快照
    if (isFileModifyingTool(name)) {
      const filePath = args.path as string
      if (filePath && workspacePath) {
        fullPath = filePath.startsWith(workspacePath) ? filePath : `${workspacePath}/${filePath}`
        originalContent = await window.electronAPI.readFile(fullPath)
        store.addSnapshotToCurrentCheckpoint(fullPath, originalContent)
      }
    }

    // 使用配置的超时和重试参数
    const config = getConfig()
    const timeoutMs = config.toolTimeoutMs
    const maxRetries = config.maxRetries
    const retryDelayMs = config.retryDelayMs

    const executeWithTimeout = () => Promise.race([
      executeTool(name, args, workspacePath || undefined),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Tool execution timed out after ${timeoutMs / 1000}s`)), timeoutMs)
      )
    ])

    let result: ToolExecutionResult
    let lastError: string = ''

    // 重试机制
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        result = await executeWithTimeout()
        if (result.success) break
        lastError = result.error || 'Unknown error'

        // 只对特定可恢复错误重试
        if (attempt < maxRetries && this.isRetryableError(lastError)) {
          console.log(`[AgentService] Tool ${name} failed (attempt ${attempt}/${maxRetries}), retrying...`)
          await new Promise(resolve => setTimeout(resolve, retryDelayMs * attempt))
        } else {
          break
        }
      } catch (error: any) {
        lastError = error.message
        if (attempt < maxRetries && this.isRetryableError(lastError)) {
          console.log(`[AgentService] Tool ${name} error (attempt ${attempt}/${maxRetries}): ${lastError}, retrying...`)
          await new Promise(resolve => setTimeout(resolve, retryDelayMs * attempt))
        } else {
          result = { success: false, result: '', error: lastError }
          break
        }
      }
    }

    if (!result!) {
      result = { success: false, result: '', error: lastError }
    }

    // 记录工具调用响应日志
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

    // 使用智能函数判断是否需要记录文件修改
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
        console.warn('[Agent] Failed to add to composer:', e)
      }
    }

    const resultContent = result.success ? (result.result || '') : `Error: ${result.error || 'Unknown error'}`
    const truncatedContent = truncateToolResult(resultContent, name, CONFIG.maxToolResultChars)
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

    // 导入压缩模块
    const { shouldCompactContext, prepareMessagesForCompact, createCompactedSystemMessage } = await import('./ContextCompressor')

    // 检查是否需要压缩上下文
    // 使用类型断言：过滤后的消息不包含 checkpoint 类型
    type NonCheckpointMessage = Exclude<typeof historyMessages[number], { role: 'checkpoint' }>
    let filteredMessages: NonCheckpointMessage[] = historyMessages.filter(
      (m): m is NonCheckpointMessage => m.role !== 'checkpoint'
    )
    let compactedSummary: string | null = null

    if (shouldCompactContext(filteredMessages)) {
      console.log('[Agent] Context exceeds threshold, compacting...')

      // 如果已有压缩摘要，直接使用
      const existingSummary = (store as any).contextSummary
      if (existingSummary) {
        compactedSummary = existingSummary
        // 只保留最近的消息
        const { recentMessages } = prepareMessagesForCompact(filteredMessages as any)
        filteredMessages = recentMessages as NonCheckpointMessage[]
      } else {
        // 这里只做准备，实际压缩需要在会话开始时或定期执行
        // 为了不阻塞当前请求，先截断消息
        filteredMessages = filteredMessages.slice(-CONFIG.maxHistoryMessages)
      }
    } else {
      filteredMessages = filteredMessages.slice(-CONFIG.maxHistoryMessages)
    }

    // 构建系统提示词（可能包含压缩摘要）
    const effectiveSystemPrompt = compactedSummary
      ? `${systemPrompt}\n\n${createCompactedSystemMessage(compactedSummary)}`
      : systemPrompt

    // 类型断言：过滤后的消息不包含 checkpoint
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const openaiMessages = buildOpenAIMessages(filteredMessages as any, effectiveSystemPrompt)

    for (const msg of openaiMessages) {
      if (msg.role === 'tool' && typeof msg.content === 'string') {
        if (msg.content.length > CONFIG.maxToolResultChars) {
          msg.content = truncateToolResult(msg.content, 'default', CONFIG.maxToolResultChars)
        }
      }
    }

    const userContent = this.buildUserContent(currentMessage, contextContent)
    openaiMessages.push({ role: 'user', content: userContent })

    const validation = validateOpenAIMessages(openaiMessages)
    if (!validation.valid) console.warn('[Agent] Message validation warning:', validation.error)

    return openaiMessages
  }

  private async buildContextContent(contextItems: ContextItem[], userQuery?: string): Promise<string> {
    if (!contextItems || contextItems.length === 0) return ''
    const parts: string[] = []
    let totalChars = 0

    // Get workspace path from store
    const workspacePath = useStore.getState().workspacePath

    for (const item of contextItems) {
      if (totalChars >= CONFIG.maxTotalContextChars) {
        parts.push('\n[Additional context truncated]')
        break
      }

      if (item.type === 'File') {
        const filePath = (item as { uri: string }).uri
        try {
          const content = await window.electronAPI.readFile(filePath)
          if (content) {
            const truncated = content.length > CONFIG.maxFileContentChars
              ? content.slice(0, CONFIG.maxFileContentChars) + '\n...(file truncated)'
              : content
            const fileBlock = `\n### File: ${filePath}\n\`\`\`\n${truncated}\n\`\`\`\n`
            parts.push(fileBlock)
            totalChars += fileBlock.length
          }
        } catch (e) { }
      } else if (item.type === 'Codebase' && workspacePath && userQuery) {
        try {
          parts.push('\n[Searching codebase...]\n')
          // Strip @codebase from query for better results
          const cleanQuery = userQuery.replace(/@codebase\s*/i, '').trim() || userQuery
          const results = await window.electronAPI.indexSearch(workspacePath, cleanQuery, 20)
          if (results && results.length > 0) {
            const searchBlock = `\n### Codebase Search Results for "${cleanQuery}":\n` +
              results.map(r => `#### ${r.relativePath} (Score: ${r.score.toFixed(2)})\n\`\`\`${r.language}\n${r.content}\n\`\`\``).join('\n\n') + '\n'
            parts.push(searchBlock)
            totalChars += searchBlock.length
          } else {
            parts.push('\n[No relevant codebase results found]\n')
          }
        } catch (e) {
          console.error('[Agent] Codebase search failed:', e)
          parts.push('\n[Codebase search failed]\n')
        }
      } else if (item.type === 'Web' && userQuery) {
        try {
          parts.push('\n[Searching web...]\n')
          // Strip @web from query
          const cleanQuery = userQuery.replace(/@web\s*/i, '').trim() || userQuery
          const searchResult = await executeTool('web_search', { query: cleanQuery }, workspacePath || undefined)

          if (searchResult.success) {
            const searchBlock = `\n### Web Search Results for "${cleanQuery}":\n${searchResult.result}\n`
            parts.push(searchBlock)
            totalChars += searchBlock.length
          } else {
            parts.push(`\n[Web search failed: ${searchResult.error}]\n`)
          }
        } catch (e) {
          console.error('[Agent] Web search failed:', e)
          parts.push('\n[Web search failed]\n')
        }
      } else if (item.type === 'Git' && workspacePath) {
        // @git context - Get git status and recent changes
        try {
          parts.push('\n[Getting Git info...]\n')
          const gitStatus = await executeTool('run_command', {
            command: 'git status --short && git log --oneline -5',
            cwd: workspacePath,
            timeout: 10
          }, workspacePath)

          if (gitStatus.success) {
            const gitBlock = `\n### Git Status:\n\`\`\`\n${gitStatus.result}\n\`\`\`\n`
            parts.push(gitBlock)
            totalChars += gitBlock.length
          } else {
            parts.push('\n[Git info not available]\n')
          }
        } catch (e) {
          console.error('[Agent] Git context failed:', e)
          parts.push('\n[Git info failed]\n')
        }
      } else if (item.type === 'Terminal') {
        // @terminal context - Get recent terminal output
        try {
          parts.push('\n[Getting Terminal output...]\n')
          const terminalOutput = await executeTool('get_terminal_output', {
            terminal_id: 'default',
            lines: 50
          }, workspacePath || undefined)

          if (terminalOutput.success && terminalOutput.result) {
            const terminalBlock = `\n### Recent Terminal Output:\n\`\`\`\n${terminalOutput.result}\n\`\`\`\n`
            parts.push(terminalBlock)
            totalChars += terminalBlock.length
          } else {
            parts.push('\n[No terminal output available]\n')
          }
        } catch (e) {
          console.error('[Agent] Terminal context failed:', e)
          parts.push('\n[Terminal output failed]\n')
        }
      } else if (item.type === 'Symbols' && workspacePath) {
        // @symbols context - Get symbols from current/recent files
        try {
          parts.push('\n[Getting Document Symbols...]\n')
          const currentFile = useStore.getState().activeFilePath

          if (currentFile) {
            const symbols = await executeTool('get_document_symbols', {
              path: currentFile
            }, workspacePath)

            if (symbols.success && symbols.result) {
              const symbolsBlock = `\n### Symbols in ${currentFile}:\n\`\`\`\n${symbols.result}\n\`\`\`\n`
              parts.push(symbolsBlock)
              totalChars += symbolsBlock.length
            } else {
              parts.push('\n[No symbols found]\n')
            }
          } else {
            parts.push('\n[No active file for symbols]\n')
          }
        } catch (e) {
          console.error('[Agent] Symbols context failed:', e)
          parts.push('\n[Symbols retrieval failed]\n')
        }
      }
    }

    // 更新上下文统计信息
    const messages = useStore.getState().messages
    const fileCount = contextItems.filter(item => item.type === 'File').length
    const semanticResultCount = contextItems.filter(item => item.type === 'Codebase').length

    useStore.getState().setContextStats({
      totalChars,
      maxChars: CONFIG.maxTotalContextChars,
      fileCount,
      maxFiles: 10, // 假设最多支持 10 个文件
      messageCount: messages.length,
      maxMessages: CONFIG.maxHistoryMessages,
      semanticResultCount,
      terminalChars: 0
    })

    return parts.join('')
  }

  private buildUserContent(message: MessageContent, contextContent: string): MessageContent {
    if (!contextContent) return message

    const contextPart: TextContent = {
      type: 'text',
      text: `## Referenced Context\n${contextContent}\n\n## User Request\n`
    }

    if (typeof message === 'string') {
      return [contextPart, { type: 'text', text: message }]
    } else {
      return [contextPart, ...message]
    }
  }

  /**
   * 解析 XML 格式的工具调用
   * 支持格式如：<tool_call><function=tool_name><parameter=param>value</parameter></function></tool_call>
   */
  private parseXMLToolCalls(content: string): LLMToolCall[] {
    const toolCalls: LLMToolCall[] = []

    // 匹配 <tool_call>...</tool_call> 块
    const toolCallRegex = /<tool_call>([\s\S]*?)<\/tool_call>/gi
    let toolCallMatch

    while ((toolCallMatch = toolCallRegex.exec(content)) !== null) {
      const toolCallContent = toolCallMatch[1]

      // 匹配 <function=name>...</function> 或 <function name="...">...</function>
      const funcRegex = /<function[=\s]+["']?([^"'>\s]+)["']?\s*>([\s\S]*?)<\/function>/gi
      let funcMatch

      while ((funcMatch = funcRegex.exec(toolCallContent)) !== null) {
        const toolName = funcMatch[1]
        const paramsContent = funcMatch[2]

        // 解析参数
        const args: Record<string, unknown> = {}

        // 匹配 <parameter=name>value</parameter> 或 <parameter name="...">value</parameter>
        const paramRegex = /<parameter[=\s]+["']?([^"'>\s]+)["']?\s*>([\s\S]*?)<\/parameter>/gi
        let paramMatch

        while ((paramMatch = paramRegex.exec(paramsContent)) !== null) {
          const paramName = paramMatch[1]
          let paramValue: unknown = paramMatch[2].trim()

          // 尝试解析 JSON 值
          try {
            paramValue = JSON.parse(paramValue as string)
          } catch {
            // 保持字符串格式
          }

          args[paramName] = paramValue
        }

        toolCalls.push({
          id: `xml-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          name: toolName,
          arguments: args
        })
      }
    }

    // 同时也支持直接的 <function> 标签（不被 <tool_call> 包裹）
    const standaloneFuncRegex = /<function[=\s]+["']?([^"'>\s]+)["']?\s*>([\s\S]*?)<\/function>/gi
    let standaloneMatch
    while ((standaloneMatch = standaloneFuncRegex.exec(content)) !== null) {
      // 检查是否已经被包含在 tool_call 中
      const isInsideToolCall = /<tool_call>[\s\S]*?<function[=\s]+["']?([^"'>\s]+)["']?\s*>[\s\S]*?<\/function>[\s\S]*?<\/tool_call>/gi.test(content)
      if (isInsideToolCall) continue

      const toolName = standaloneMatch[1]
      const paramsContent = standaloneMatch[2]
      const args: Record<string, unknown> = {}

      const paramRegex = /<parameter[=\s]+["']?([^"'>\s]+)["']?\s*>([\s\S]*?)<\/parameter>/gi
      let paramMatch
      while ((paramMatch = paramRegex.exec(paramsContent)) !== null) {
        const paramName = paramMatch[1]
        let paramValue: unknown = paramMatch[2].trim()
        try {
          paramValue = JSON.parse(paramValue as string)
        } catch { }
        args[paramName] = paramValue
      }

      toolCalls.push({
        id: `xml-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: toolName,
        arguments: args
      })
    }

    return toolCalls
  }

  /**
   * 流式解析 XML 工具调用
   */
  private detectStreamingXMLToolCalls(): void {
    if (!this.currentAssistantId) return
    const store = useAgentStore.getState()
    const content = this.contentBuffer

    // 1. 寻找正在进行的 <tool_call> 或 <function>
    // 我们寻找最后一个未闭合的标签，或者最近更新的标签

    // 匹配 <function=name> 或 <function name="...">
    const funcStartRegex = /<function[=\s]+["']?([^"'>\s]+)["']?\s*>/gi
    let match
    let lastFunc: { name: string, index: number, fullMatch: string } | null = null

    while ((match = funcStartRegex.exec(content)) !== null) {
      lastFunc = {
        name: match[1],
        index: match.index,
        fullMatch: match[0]
      }
    }

    if (!lastFunc) return

    // 检查这个函数是否已经闭合
    const remainingContent = content.slice(lastFunc.index + lastFunc.fullMatch.length)
    const isClosed = remainingContent.includes('</function>')

    // 提取参数
    const args: Record<string, unknown> = {}
    const paramRegex = /<parameter[=\s]+["']?([^"'>\s]+)["']?\s*>([\s\S]*?)(?:<\/parameter>|$)/gi
    let paramMatch
    while ((paramMatch = paramRegex.exec(remainingContent)) !== null) {
      const paramName = paramMatch[1]
      let paramValue = paramMatch[2].trim()

      // 如果参数值看起来像 JSON，尝试解析
      if (paramValue.startsWith('{') || paramValue.startsWith('[')) {
        const parsed = parsePartialJson(paramValue)
        if (parsed) paramValue = parsed as any
      }

      args[paramName] = paramValue
    }

    // 生成或获取稳定的流式 ID
    // 我们使用函数名和它在内容中的位置作为唯一标识
    const streamingId = `stream-xml-${lastFunc.name}-${lastFunc.index}`

    if (!this.activeStreamingToolCalls.has(streamingId)) {
      this.activeStreamingToolCalls.add(streamingId)
      store.addToolCallPart(this.currentAssistantId, {
        id: streamingId,
        name: lastFunc.name,
        arguments: { ...args, _streaming: true }
      })
    } else {
      store.updateToolCall(this.currentAssistantId, streamingId, {
        arguments: { ...args, _streaming: !isClosed }
      })
    }
  }

  private parsePartialArgs(argsString: string, _toolName: string): Record<string, unknown> {
    if (!argsString || argsString.length < 2) return {}
    const parsed = parsePartialJson(argsString)
    return (parsed && Object.keys(parsed).length > 0) ? parsed : {}
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
    this.contentBuffer = ''
    this.activeStreamingToolCalls.clear()
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
            // 精确检查是否包含 [error] 标记，避免警告触发
            // get_lint_errors 的输出格式为 [severity] message ...
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
