/**
 * Anthropic Provider
 * 支持 Claude 系列模型
 */

import { logger } from '@shared/utils/Logger'
import Anthropic from '@anthropic-ai/sdk'
import { BaseProvider } from './base'
import { ChatParams, ToolDefinition, ToolCall, MessageContent } from '../types'
import { adapterService } from '../adapterService'

export class AnthropicProvider extends BaseProvider {
  private client: Anthropic

  constructor(apiKey: string, baseUrl?: string, timeout?: number) {
    super('Anthropic')
    const timeoutMs = timeout || 120000
    this.log('info', 'Initializing', { baseUrl: baseUrl || 'default', timeout: timeoutMs })
    this.client = new Anthropic({
      apiKey,
      baseURL: baseUrl,
      timeout: timeoutMs,
    })
  }

  private convertContent(
    content: MessageContent
  ): string | Array<Anthropic.TextBlockParam | Anthropic.ImageBlockParam> {
    if (typeof content === 'string') return content

    return content.map((part) => {
      if (part.type === 'text') {
        return { type: 'text', text: part.text }
      } else {
        if (part.source.type === 'url') {
          logger.system.warn('Anthropic provider received URL image, which is not directly supported.')
          return { type: 'text', text: '[Image URL not supported]' }
        }
        return {
          type: 'image',
          source: {
            type: 'base64',
            media_type: part.source.media_type as
              | 'image/jpeg'
              | 'image/png'
              | 'image/gif'
              | 'image/webp',
            data: part.source.data,
          },
        }
      }
    })
  }

  private convertTools(tools?: ToolDefinition[], adapterId?: string): Anthropic.Tool[] | undefined {
    if (!tools?.length) return undefined

    // 如果指定了自定义 adapterId 且不是默认 anthropic，使用 adapterService
    if (adapterId && adapterId !== 'anthropic') {
      return adapterService.convertTools(tools, adapterId) as Anthropic.Tool[]
    }

    // 默认使用 Anthropic 原生格式
    return tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.parameters as Anthropic.Tool['input_schema'],
    }))
  }

  async chat(params: ChatParams): Promise<void> {
    const {
      model,
      messages,
      tools,
      systemPrompt,
      signal,
      adapterConfig,
      onStream,
      onToolCall,
      onComplete,
      onError,
    } = params

    try {
      this.log('info', 'Starting chat', { model, messageCount: messages.length })

      const anthropicMessages: Anthropic.MessageParam[] = []

      for (const msg of messages) {
        if (msg.role === 'tool') {
          anthropicMessages.push({
            role: 'user',
            content: [
              {
                type: 'tool_result',
                tool_use_id: msg.toolCallId!,
                content:
                  typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
              },
            ],
          })
        } else if (msg.role === 'assistant' && msg.toolName) {
          anthropicMessages.push({
            role: 'assistant',
            content: [
              {
                type: 'tool_use',
                id: msg.toolCallId!,
                name: msg.toolName,
                input: JSON.parse(
                  typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)
                ),
              },
            ],
          })
        } else if (msg.role === 'user' || msg.role === 'assistant') {
          anthropicMessages.push({
            role: msg.role,
            content: this.convertContent(msg.content),
          })
        }
      }

      // 构建请求参数
      const requestParams: Record<string, unknown> = {
        model,
        max_tokens: 8192,
        system: systemPrompt,
        messages: anthropicMessages,
        tools: this.convertTools(tools, adapterConfig?.id),
      }

      // 应用适配器的请求体模板参数
      if (adapterConfig?.request?.bodyTemplate) {
        const template = adapterConfig.request.bodyTemplate
        for (const [key, value] of Object.entries(template)) {
          if (typeof value === 'string' && value.startsWith('{{')) continue
          if (['model', 'messages', 'system', 'tools'].includes(key)) continue
          requestParams[key] = value
        }
      }

      const stream = this.client.messages.stream(
        requestParams as unknown as Anthropic.MessageCreateParamsStreaming,
        { signal }
      )

      let fullContent = ''
      const toolCalls: ToolCall[] = []

      stream.on('text', (text) => {
        fullContent += text
        onStream({ type: 'text', content: text })
      })

      // 支持 Anthropic 的思考块（Claude 3.7+）
      // 使用 streamEvent 绕过 MessageStreamEvents 的类型限制
      stream.on('streamEvent', (event) => {
        if (event.type === 'content_block_delta' && event.delta.type === 'thinking_delta') {
          const thinking = (event.delta as any).thinking
          onStream({ type: 'reasoning', content: thinking })
        }
      })

      const finalMessage = await stream.finalMessage()

      for (const block of finalMessage.content) {
        if (block.type === 'tool_use') {
          const toolCall: ToolCall = {
            id: block.id,
            name: block.name,
            arguments: block.input as Record<string, unknown>,
          }
          toolCalls.push(toolCall)
          onToolCall(toolCall)
        }
      }

      this.log('info', 'Chat complete', {
        contentLength: fullContent.length,
        toolCallCount: toolCalls.length,
      })

      onComplete({
        content: fullContent,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        usage: {
          promptTokens: finalMessage.usage.input_tokens,
          completionTokens: finalMessage.usage.output_tokens,
          totalTokens: finalMessage.usage.input_tokens + finalMessage.usage.output_tokens,
        },
      })
    } catch (error: unknown) {
      const llmError = this.parseError(error)
      this.log('error', 'Chat failed', { code: llmError.code, message: llmError.message })
      onError(llmError)
    }
  }
}
