/**
 * Gemini Provider
 * 支持 Google Gemini 系列模型
 */

import { GoogleGenerativeAI, SchemaType, Content } from '@google/generative-ai'
import { BaseProvider } from './base'
import { ChatParams, ToolDefinition, ToolCall, LLMError, LLMErrorCode } from '../types'
import { adapterService } from '../adapterService'
import { AGENT_DEFAULTS } from '@shared/constants'

export class GeminiProvider extends BaseProvider {
  private client: GoogleGenerativeAI
  private timeout: number
  private baseUrl?: string

  constructor(apiKey: string, baseUrl?: string, timeout?: number) {
    super('Gemini')
    this.timeout = timeout || AGENT_DEFAULTS.DEFAULT_LLM_TIMEOUT
    this.baseUrl = baseUrl
    this.log('info', 'Initializing', { timeout: this.timeout, baseUrl: baseUrl || 'default' })
    this.client = new GoogleGenerativeAI(apiKey)
  }

  private convertTools(tools?: ToolDefinition[], adapterId?: string) {
    if (!tools?.length) return undefined

    // 如果指定了自定义 adapterId 且不是默认 gemini，使用 adapterService
    if (adapterId && adapterId !== 'gemini') {
      const converted = adapterService.convertTools(tools, adapterId)
      return [{ functionDeclarations: converted }]
    }

    // 默认使用 Gemini 原生格式
    const functionDeclarations = tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      parameters: {
        type: SchemaType.OBJECT,
        properties: Object.fromEntries(
          Object.entries(tool.parameters.properties).map(([key, value]) => [
            key,
            {
              type: value.type as SchemaType,
              description: value.description,
              enum: value.enum,
            },
          ])
        ),
        required: tool.parameters.required,
      },
    }))

    return [{ functionDeclarations }]
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
      onError
    } = params

    try {
      this.log('info', 'Starting chat', { model, messageCount: messages.length })

      // 检查是否已经被中止
      if (signal?.aborted) {
        onError(new LLMError('Request aborted', LLMErrorCode.ABORTED, undefined, false))
        return
      }

      const requestOptions = this.baseUrl ? { baseUrl: this.baseUrl } : undefined

      // 构建模型配置
      const modelConfig: Record<string, unknown> = {
        model,
        systemInstruction: systemPrompt,
        tools: this.convertTools(tools, adapterConfig?.id) as Parameters<
          typeof this.client.getGenerativeModel
        >[0]['tools'],
      }

      // 应用适配器的请求体模板参数 (如 thinkingConfig)
      if (adapterConfig?.request?.bodyTemplate) {
        const template = adapterConfig.request.bodyTemplate
        for (const [key, value] of Object.entries(template)) {
          if (typeof value === 'string' && value.startsWith('{{')) continue
          if (['model', 'systemInstruction', 'tools'].includes(key)) continue
          modelConfig[key] = value
        }
      }

      const genModel = this.client.getGenerativeModel(
        modelConfig as unknown as Parameters<typeof this.client.getGenerativeModel>[0],
        requestOptions
      )

      const history: Content[] = []
      let lastUserMessage = ''

      const contentToString = (content: (typeof messages)[0]['content']): string => {
        if (typeof content === 'string') return content
        return content.map((part) => (part.type === 'text' ? part.text : '[image]')).join('')
      }

      let startIndex = 0
      for (let i = 0; i < messages.length; i++) {
        if (messages[i].role === 'user') {
          startIndex = i
          break
        }
      }

      for (let i = startIndex; i < messages.length; i++) {
        const msg = messages[i]
        if (msg.role === 'user') {
          const isLastUser = messages.slice(i + 1).every((m) => m.role !== 'user')
          if (isLastUser) {
            lastUserMessage = contentToString(msg.content)
          } else {
            history.push({
              role: 'user',
              parts: [{ text: contentToString(msg.content) }],
            })
          }
        } else if (msg.role === 'assistant') {
          if (msg.toolName) {
            history.push({
              role: 'model',
              parts: [
                {
                  functionCall: {
                    name: msg.toolName,
                    args: JSON.parse(contentToString(msg.content)),
                  },
                },
              ],
            })
          } else {
            history.push({
              role: 'model',
              parts: [{ text: contentToString(msg.content) }],
            })
          }
        } else if (msg.role === 'tool') {
          history.push({
            role: 'user',
            parts: [
              {
                functionResponse: {
                  name: msg.toolName || '',
                  response: { result: contentToString(msg.content) },
                },
              },
            ],
          })
        }
      }

      if (history.length > 0 && history[0].role !== 'user') {
        history.unshift({
          role: 'user',
          parts: [{ text: 'Continue the conversation.' }],
        })
      }

      if (!lastUserMessage) {
        lastUserMessage = 'Continue.'
      }

      const chat = genModel.startChat({ history })
      const result = await chat.sendMessageStream(lastUserMessage)

      let fullContent = ''
      const toolCalls: ToolCall[] = []

      for await (const chunk of result.stream) {
        // 检查中止信号
        if (signal?.aborted) {
          this.log('info', 'Stream aborted by user')
          onError(new LLMError('Request aborted', LLMErrorCode.ABORTED, undefined, false))
          return
        }

        const text = chunk.text()
        if (text) {
          fullContent += text
          onStream({ type: 'text', content: text })
        }

        // 支持 Gemini 的思考内容（如果适配器配置了）
        const reasoningField = adapterConfig?.response?.reasoningField
        if (reasoningField) {
          const candidate = chunk.candidates?.[0]
          const parts = candidate?.content?.parts
          if (parts) {
            for (const part of parts) {
              if ((part as any)[reasoningField]) {
                const reasoning = (part as any)[reasoningField]
                onStream({ type: 'reasoning', content: reasoning })
              }
            }
          }
        }

        const candidate = chunk.candidates?.[0]
        if (candidate?.content?.parts) {
          for (const part of candidate.content.parts) {
            if ('functionCall' in part && part.functionCall) {
              const toolCall: ToolCall = {
                id: `gemini-${Date.now()}-${Math.random().toString(36).slice(2)}`,
                name: part.functionCall.name,
                arguments: part.functionCall.args as Record<string, unknown>,
              }
              toolCalls.push(toolCall)
              onToolCall(toolCall)
            }
          }
        }
      }

      this.log('info', 'Chat complete', {
        contentLength: fullContent.length,
        toolCallCount: toolCalls.length,
      })

      // 尝试获取 usage 信息
      let usage: { promptTokens: number; completionTokens: number; totalTokens: number } | undefined
      try {
        const response = await result.response
        if (response.usageMetadata) {
          usage = {
            promptTokens: response.usageMetadata.promptTokenCount || 0,
            completionTokens: response.usageMetadata.candidatesTokenCount || 0,
            totalTokens: response.usageMetadata.totalTokenCount || 0,
          }
        }
      } catch {
        // 忽略获取 usage 失败
      }

      onComplete({
        content: fullContent,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        usage,
      })
    } catch (error: unknown) {
      const llmError = this.parseError(error)
      this.log('error', 'Chat failed', { code: llmError.code, message: llmError.message })
      onError(llmError)
    }
  }
}
