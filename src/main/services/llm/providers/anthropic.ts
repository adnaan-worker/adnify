/**
 * Anthropic Provider
 * 支持 Claude 系列模型
 *
 * 认证方式：
 * - 官方 API: x-api-key header
 * - 自定义 baseUrl (代理): Bearer token (可通过 advanced.auth 配置)
 *
 * 特性：
 * - 支持流式/非流式响应
 * - 支持 Claude Code CLI 兼容模式（用于代理）
 * - 支持 thinking 模式
 * - 支持工具调用
 */

import { logger } from '@shared/utils/Logger'
import Anthropic from '@anthropic-ai/sdk'
import { BaseProvider } from './base'
import {
  ChatParams,
  ToolDefinition,
  LLMToolCall,
  MessageContent,
  LLMErrorCode,
  LLMConfig,
} from '../types'
import { adapterService } from '../adapterService'
import { AGENT_DEFAULTS } from '@shared/constants'

// Claude Code CLI 兼容请求头
const CLAUDE_CODE_HEADERS: Record<string, string> = {
  'x-app': 'cli',
  'User-Agent': 'claude-cli/2.0.76 (external, cli)',
  'anthropic-beta': 'claude-code-20250219,interleaved-thinking-2025-05-14',
}

// 支持的图片类型
type SupportedMediaType = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'

export class AnthropicProvider extends BaseProvider {
  private client: Anthropic

  constructor(config: LLMConfig) {
    super('Anthropic')
    const { apiKey, baseUrl, useBearer } = this.parseConfig(config)

    this.client = this.createClient(config, apiKey, baseUrl, useBearer)

    this.log('info', 'Initialized', { baseUrl: baseUrl || 'default', useBearer })
  }

  /** 解析配置 */
  private parseConfig(config: LLMConfig) {
    let baseUrl = config.baseUrl?.replace(/\/v1\/?$/, '') || undefined

    // 判断认证方式：配置优先 > 有代理则用 Bearer > 默认 x-api-key
    const authConfig = config.advanced?.auth
    const useBearer = authConfig ? authConfig.type === 'bearer' : !!baseUrl

    return { apiKey: config.apiKey, baseUrl, useBearer }
  }

  /** 创建 Anthropic 客户端 */
  private createClient(
    config: LLMConfig,
    apiKey: string,
    baseUrl?: string,
    useBearer?: boolean
  ): Anthropic {
    const defaultHeaders: Record<string, string> = {
      ...CLAUDE_CODE_HEADERS,
      ...(useBearer ? { Authorization: `Bearer ${apiKey}` } : {}),
      ...config.advanced?.request?.headers,
    }

    return new Anthropic({
      apiKey,
      timeout: config.timeout || AGENT_DEFAULTS.DEFAULT_LLM_TIMEOUT,
      ...(baseUrl ? { baseURL: baseUrl } : {}),
      defaultHeaders,
    })
  }

  /** 转换消息内容为 Anthropic 格式 */
  private convertContent(
    content: MessageContent
  ): string | Array<Anthropic.TextBlockParam | Anthropic.ImageBlockParam> {
    if (typeof content === 'string') return content
    if (!content?.length) return ''

    return content.map((part) => {
      if (part.type === 'text') {
        return { type: 'text' as const, text: part.text ?? '' }
      }
      // 图片处理
      if (part.source.type === 'url') {
        logger.system.warn('[Anthropic] URL image not supported')
        return { type: 'text' as const, text: '[Image URL not supported]' }
      }
      return {
        type: 'image' as const,
        source: {
          type: 'base64' as const,
          media_type: part.source.media_type as SupportedMediaType,
          data: part.source.data,
        },
      }
    })
  }

  /** 转换工具定义 */
  private convertTools(tools?: ToolDefinition[], adapterId?: string): Anthropic.Tool[] | undefined {
    if (!tools?.length) return undefined

    if (adapterId && adapterId !== 'anthropic') {
      return adapterService.convertTools(tools, adapterId) as Anthropic.Tool[]
    }

    return tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.parameters as Anthropic.Tool['input_schema'],
    }))
  }

  /** 安全解析 JSON 参数 */
  private parseToolArguments(argsStr: string): Record<string, unknown> {
    try {
      const firstBrace = argsStr.indexOf('{')
      const lastBrace = argsStr.lastIndexOf('}')
      if (firstBrace !== -1 && lastBrace > firstBrace) {
        return JSON.parse(argsStr.slice(firstBrace, lastBrace + 1))
      }
      return JSON.parse(argsStr || '{}')
    } catch {
      logger.system.warn('[Anthropic] Failed to parse tool arguments')
      return {}
    }
  }

  /** 转换消息列表为 Anthropic 格式 */
  private convertMessages(messages: ChatParams['messages']): {
    anthropicMessages: Anthropic.MessageParam[]
    systemPrompt: string
  } {
    const anthropicMessages: Anthropic.MessageParam[] = []
    let systemPrompt = ''

    for (const msg of messages) {
      // system 消息提取为 system prompt
      if (msg.role === 'system') {
        const content =
          typeof msg.content === 'string'
            ? msg.content
            : Array.isArray(msg.content)
              ? msg.content
                  .filter((p) => p.type === 'text')
                  .map((p) => (p as { type: 'text'; text: string }).text)
                  .join('')
              : ''
        if (content) {
          systemPrompt = systemPrompt ? `${systemPrompt}\n\n${content}` : content
        }
        continue
      }

      // tool 结果消息
      if (msg.role === 'tool') {
        const toolCallId = msg.toolCallId || (msg as unknown as Record<string, unknown>).tool_call_id
        if (toolCallId) {
          anthropicMessages.push({
            role: 'user',
            content: [
              {
                type: 'tool_result',
                tool_use_id: toolCallId as string,
                content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
              },
            ],
          })
        }
        continue
      }

      // assistant 消息带 tool_calls（OpenAI 格式）
      const toolCalls = (msg as unknown as Record<string, unknown>).tool_calls as
        | Array<{ id: string; function: { name: string; arguments: string } }>
        | undefined
      if (msg.role === 'assistant' && toolCalls?.length) {
        const contentBlocks: Anthropic.ContentBlockParam[] = []

        if (typeof msg.content === 'string' && msg.content) {
          contentBlocks.push({ type: 'text', text: msg.content })
        }

        for (const tc of toolCalls) {
          contentBlocks.push({
            type: 'tool_use',
            id: tc.id,
            name: tc.function.name,
            input: this.parseToolArguments(tc.function.arguments),
          })
        }

        anthropicMessages.push({ role: 'assistant', content: contentBlocks })
        continue
      }

      // assistant 消息带 toolName（旧格式）
      if (msg.role === 'assistant' && msg.toolName && msg.toolCallId) {
        const contentStr = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)
        anthropicMessages.push({
          role: 'assistant',
          content: [
            {
              type: 'tool_use',
              id: msg.toolCallId,
              name: msg.toolName,
              input: this.parseToolArguments(contentStr || '{}'),
            },
          ],
        })
        continue
      }

      // 普通 user/assistant 消息
      if ((msg.role === 'user' || msg.role === 'assistant') && msg.content != null) {
        anthropicMessages.push({
          role: msg.role,
          content: this.convertContent(msg.content),
        })
      }
    }

    return { anthropicMessages, systemPrompt }
  }

  /** 构建请求参数 */
  private buildRequestParams(
    params: ChatParams,
    anthropicMessages: Anthropic.MessageParam[],
    systemPrompt: string,
    convertedTools?: Anthropic.Tool[]
  ): Record<string, unknown> {
    const requestParams: Record<string, unknown> = {
      model: params.model,
      max_tokens: params.maxTokens || AGENT_DEFAULTS.DEFAULT_MAX_TOKENS,
      messages: anthropicMessages,
    }

    // 温度和 top_p
    if (params.temperature !== undefined) requestParams.temperature = params.temperature
    if (params.topP !== undefined) requestParams.top_p = params.topP

    // system prompt（Claude Code CLI 格式：数组）
    const finalSystemPrompt = params.systemPrompt
      ? params.systemPrompt + (systemPrompt ? `\n\n${systemPrompt}` : '')
      : systemPrompt

    if (finalSystemPrompt) {
      requestParams.system = [{ type: 'text', text: finalSystemPrompt }]
    }

    // 工具
    if (convertedTools?.length) {
      requestParams.tools = convertedTools
    }

    // 适配器模板参数（排除核心字段）
    const template = params.adapterConfig?.request?.bodyTemplate
    if (template) {
      const excludeKeys = ['model', 'messages', 'system', 'tools', 'stream']
      for (const [key, value] of Object.entries(template)) {
        if (!excludeKeys.includes(key) && !(typeof value === 'string' && value.startsWith('{{'))) {
          requestParams[key] = value
        }
      }
    }

    // thinking 模式下移除 temperature 和 top_p
    if (requestParams.thinking) {
      delete requestParams.temperature
      delete requestParams.top_p
    }

    return requestParams
  }

  /** 处理流式响应 */
  private async handleStreamResponse(
    requestParams: Record<string, unknown>,
    signal?: AbortSignal,
    onStream?: ChatParams['onStream'],
    onToolCall?: ChatParams['onToolCall'],
    onComplete?: ChatParams['onComplete']
  ): Promise<void> {
    const streamResponse = this.client.messages.stream(
      requestParams as unknown as Anthropic.MessageCreateParamsStreaming,
      { signal }
    )

    let fullContent = ''
    const toolCalls: LLMToolCall[] = []

    streamResponse.on('text', (text) => {
      fullContent += text
      onStream?.({ type: 'text', content: text })
    })

    // thinking 块支持
    streamResponse.on('streamEvent', (event) => {
      if (event.type === 'content_block_delta' && event.delta.type === 'thinking_delta') {
        onStream?.({ type: 'reasoning', content: (event.delta as { thinking?: string }).thinking || '' })
      }
    })

    const finalMessage = await streamResponse.finalMessage()

    for (const block of finalMessage.content) {
      if (block.type === 'tool_use') {
        const toolCall: LLMToolCall = {
          id: block.id,
          name: block.name,
          arguments: block.input as Record<string, unknown>,
        }
        toolCalls.push(toolCall)
        onToolCall?.(toolCall)
      }
    }

    onComplete?.({
      content: fullContent,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      usage: {
        promptTokens: finalMessage.usage.input_tokens,
        completionTokens: finalMessage.usage.output_tokens,
        totalTokens: finalMessage.usage.input_tokens + finalMessage.usage.output_tokens,
      },
    })
  }

  /** 处理非流式响应 */
  private async handleNonStreamResponse(
    requestParams: Record<string, unknown>,
    signal?: AbortSignal,
    onStream?: ChatParams['onStream'],
    onToolCall?: ChatParams['onToolCall'],
    onComplete?: ChatParams['onComplete']
  ): Promise<void> {
    const response = await this.client.messages.create(
      requestParams as unknown as Anthropic.MessageCreateParamsNonStreaming,
      { signal }
    )

    let fullContent = ''
    const toolCalls: LLMToolCall[] = []

    for (const block of response.content) {
      if (block.type === 'text') {
        fullContent += block.text
        onStream?.({ type: 'text', content: block.text })
      } else if (block.type === 'tool_use') {
        const toolCall: LLMToolCall = {
          id: block.id,
          name: block.name,
          arguments: block.input as Record<string, unknown>,
        }
        toolCalls.push(toolCall)
        onToolCall?.(toolCall)
      }
    }

    onComplete?.({
      content: fullContent,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      usage: {
        promptTokens: response.usage.input_tokens,
        completionTokens: response.usage.output_tokens,
        totalTokens: response.usage.input_tokens + response.usage.output_tokens,
      },
    })
  }

  /** 调试日志 */
  private logRequest(requestParams: Record<string, unknown>, stream: boolean, toolCount: number) {
    const systemArr = requestParams.system as Array<{ text: string }> | undefined
    const systemLength = systemArr?.reduce((acc, item) => acc + (item.text?.length || 0), 0) || 0

    logger.system.debug(
      '[Anthropic] Request:',
      JSON.stringify(
        {
          ...requestParams,
          stream,
          system: systemLength ? `[${systemLength} chars]` : undefined,
          tools: toolCount ? `[${toolCount} tools]` : undefined,
        },
        null,
        2
      )
    )
  }

  async chat(params: ChatParams): Promise<void> {
    const { model, messages, tools, stream = true, signal, adapterConfig, onStream, onToolCall, onComplete, onError } = params

    try {
      this.log('info', 'Chat', {
        model,
        messageCount: messages.length,
        stream,
        temperature: params.temperature,
        topP: params.topP,
        maxTokens: params.maxTokens,
      })

      // 转换消息
      const { anthropicMessages, systemPrompt } = this.convertMessages(messages)

      // 转换工具
      const convertedTools = this.convertTools(tools, adapterConfig?.id)

      // 构建请求参数
      const requestParams = this.buildRequestParams(params, anthropicMessages, systemPrompt, convertedTools)

      // 调试日志
      this.logRequest(requestParams, stream, convertedTools?.length || 0)

      // 发送请求
      if (stream) {
        await this.handleStreamResponse(requestParams, signal, onStream, onToolCall, onComplete)
      } else {
        await this.handleNonStreamResponse(requestParams, signal, onStream, onToolCall, onComplete)
      }
    } catch (error: unknown) {
      const llmError = this.parseError(error)
      if (llmError.code === LLMErrorCode.ABORTED) {
        this.log('info', 'Chat aborted by user')
      } else {
        this.log('error', 'Chat failed', { code: llmError.code, message: llmError.message })
      }
      onError(llmError)
    }
  }
}
