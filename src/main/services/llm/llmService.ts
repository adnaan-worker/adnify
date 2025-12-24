/**
 * LLM 服务
 * 统一管理 LLM Provider，处理消息发送和事件分发
 */

import { BrowserWindow } from 'electron'
import { OpenAIProvider } from './providers/openai'
import { AnthropicProvider } from './providers/anthropic'
import { GeminiProvider } from './providers/gemini'
import { LLMProvider, LLMMessage, LLMConfig, ToolDefinition, LLMErrorCode } from './types'

export class LLMService {
  private window: BrowserWindow
  private providers: Map<string, LLMProvider> = new Map()
  private currentAbortController: AbortController | null = null

  constructor(window: BrowserWindow) {
    this.window = window
  }

  /**
   * 获取或创建 Provider 实例
   * 根据 adapter 类型选择实现：
   * - anthropic → AnthropicProvider
   * - gemini → GeminiProvider
   * - 其他（openai, deepseek, qwen, zhipu, groq, mistral, ollama, custom）→ OpenAIProvider
   */
  private getProvider(config: LLMConfig): LLMProvider {
    const adapterKey = config.adapterConfig?.id || config.adapterId || config.provider
    const key = `${config.provider}-${config.apiKey}-${config.baseUrl || 'default'}-${config.timeout || 'default'}-${adapterKey}`

    if (!this.providers.has(key)) {
      console.log('[LLMService] Creating new provider:', config.provider, 'adapter:', adapterKey, 'timeout:', config.timeout)

      // 根据 adapter 类型选择实现
      switch (adapterKey) {
        case 'anthropic':
          this.providers.set(key, new AnthropicProvider(config.apiKey, config.baseUrl, config.timeout))
          break
        case 'gemini':
          this.providers.set(key, new GeminiProvider(config.apiKey, config.baseUrl, config.timeout))
          break
        default:
          // 所有 OpenAI 兼容的 provider：openai, deepseek, qwen, zhipu, groq, mistral, ollama, custom 等
          this.providers.set(key, new OpenAIProvider(
            config.apiKey || 'ollama', // Ollama 不需要 API key
            config.baseUrl,
            config.timeout
          ))
          break
      }
    }

    return this.providers.get(key)!
  }

  /**
   * 发送消息到 LLM
   */
  async sendMessage(params: {
    config: LLMConfig
    messages: LLMMessage[]
    tools?: ToolDefinition[]
    systemPrompt?: string
  }) {
    const { config, messages, tools, systemPrompt } = params

    console.log('[LLMService] sendMessage', {
      provider: config.provider,
      model: config.model,
      messageCount: messages.length,
      hasTools: !!tools?.length,
    })

    this.currentAbortController = new AbortController()

    try {
      const provider = this.getProvider(config)

      await provider.chat({
        model: config.model,
        messages,
        tools,
        systemPrompt,
        maxTokens: config.maxTokens,
        signal: this.currentAbortController.signal,
        // 完整适配器配置
        adapterConfig: config.adapterConfig,

        onStream: (chunk) => {
          if (!this.window.isDestroyed()) {
            try {
              this.window.webContents.send('llm:stream', chunk)
            } catch (e) {
              // 忽略窗口已销毁的错误
            }
          }
        },

        onToolCall: (toolCall) => {
          if (!this.window.isDestroyed()) {
            try {
              this.window.webContents.send('llm:toolCall', toolCall)
            } catch (e) {
              // 忽略窗口已销毁的错误
            }
          }
        },

        onComplete: (result) => {
          console.log('[LLMService] Complete', {
            contentLength: result.content.length,
            toolCallCount: result.toolCalls?.length || 0,
          })
          if (!this.window.isDestroyed()) {
            try {
              this.window.webContents.send('llm:done', result)
            } catch (e) {
              // 忽略窗口已销毁的错误
            }
          }
        },

        onError: (error) => {
          console.error('[LLMService] Error', {
            code: error.code,
            message: error.message,
            retryable: error.retryable,
          })
          if (!this.window.isDestroyed()) {
            try {
              this.window.webContents.send('llm:error', {
                message: error.message,
                code: error.code,
                retryable: error.retryable,
              })
            } catch (e) {
              // 忽略窗口已销毁的错误
            }
          }
        },
      })
    } catch (error: unknown) {
      const err = error as { name?: string; message?: string }
      if (err.name !== 'AbortError') {
        console.error('[LLMService] Uncaught error:', error)
        if (!this.window.isDestroyed()) {
          try {
            this.window.webContents.send('llm:error', {
              message: err.message || 'Unknown error',
              code: LLMErrorCode.UNKNOWN,
              retryable: false,
            })
          } catch (e) {
            // 忽略窗口已销毁的错误
          }
        }
      }
    }
  }

  /**
   * 中止当前请求
   */
  abort() {
    if (this.currentAbortController) {
      console.log('[LLMService] Aborting request')
      this.currentAbortController.abort()
      this.currentAbortController = null
    }
  }

  /**
   * 清除 Provider 缓存
   */
  clearProviders() {
    this.providers.clear()
  }
}
