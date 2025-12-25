/**
 * LLM 客户端
 * 处理与 LLM 的通信
 */
import { LLMStreamChunk, LLMToolCall, LLMResult, LLMError } from '@app-types/electron'
import { getEditorConfig } from '@renderer/config/editorConfig'

const getRequestTimeout = () => getEditorConfig().performance.requestTimeoutMs

// 消息内容类型（支持文本和图片）
export type MessageContentPart =
  | { type: 'text'; text: string }
  | { type: 'image'; source: { type: 'base64' | 'url'; media_type: string; data: string } }

export type MessageContent = string | MessageContentPart[]

export interface LLMMessageForSend {
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: MessageContent
  toolCallId?: string
  toolName?: string
  rawParams?: Record<string, unknown>  // 工具调用的原始参数
}

export interface ToolDefinitionForSend {
  name: string
  description: string
  parameters: {
    type: 'object'
    properties: Record<
      string,
      {
        type: string
        description: string
        enum?: string[]
      }
    >
    required?: string[]
  }
}

export interface LLMConfigForSend {
  provider: string
  model: string
  apiKey: string
  baseUrl?: string
}

export interface SendToLLMParams {
  config: LLMConfigForSend
  messages: LLMMessageForSend[]
  tools?: ToolDefinitionForSend[]
  systemPrompt: string
  onStream: (chunk: LLMStreamChunk) => void
  onToolCall: (toolCall: LLMToolCall) => void
}

export interface SendToLLMResult {
  data?: LLMResult
  error?: LLMError
}

/**
 * 发送请求到 LLM 并等待响应
 * 
 * 超时策略：
 * - 初始超时：2 分钟
 * - 收到流式数据时重置超时（活动超时）
 * - 这样只要 LLM 还在响应，就不会超时
 */
export async function sendToLLM(params: SendToLLMParams): Promise<SendToLLMResult> {
  return new Promise((resolve) => {
    let resolved = false
    let timeoutId: ReturnType<typeof setTimeout> | null = null
    const unsubscribers: (() => void)[] = []
    const timeoutMs = getRequestTimeout()

    const cleanup = () => {
      if (!resolved) {
        resolved = true
        if (timeoutId) {
          clearTimeout(timeoutId)
          timeoutId = null
        }
        unsubscribers.forEach((unsub) => unsub())
      }
    }

    // 重置超时计时器（收到数据时调用）
    const resetTimeout = () => {
      if (resolved) return
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
      timeoutId = setTimeout(() => {
        if (!resolved) {
          cleanup()
          resolve({
            error: {
              message: 'Request timeout. No response received.',
              code: 'TIMEOUT',
              retryable: true,
            },
          })
        }
      }, timeoutMs)
    }

    // 启动初始超时
    resetTimeout()

    // 监听流式响应 - 收到数据时重置超时
    unsubscribers.push(window.electronAPI.onLLMStream((chunk) => {
      resetTimeout() // 收到数据，重置超时
      params.onStream(chunk)
    }))

    // 监听工具调用 - 收到数据时重置超时
    unsubscribers.push(window.electronAPI.onLLMToolCall((toolCall) => {
      resetTimeout() // 收到数据，重置超时
      params.onToolCall(toolCall)
    }))

    // 监听完成
    unsubscribers.push(
      window.electronAPI.onLLMDone((result) => {
        cleanup()
        resolve({ data: result })
      })
    )

    // 监听错误
    unsubscribers.push(
      window.electronAPI.onLLMError((error) => {
        cleanup()
        resolve({ error })
      })
    )

    // 发送请求
    window.electronAPI
      .sendMessage({
        config: params.config,
        messages: params.messages as any, // 类型兼容，但 TS 无法推断
        tools: params.tools,
        systemPrompt: params.systemPrompt,
      })
      .catch((err) => {
        if (!resolved) {
          cleanup()
          resolve({
            error: {
              message: err.message || 'IPC call failed',
              code: 'IPC_ERROR',
              retryable: false,
            },
          })
        }
      })
  })
}
