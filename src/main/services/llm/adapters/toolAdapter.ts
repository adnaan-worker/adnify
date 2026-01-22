/**
 * 工具格式适配器
 * 
 * 将统一的 ToolDefinition 格式转换为各协议的工具格式
 */

import type { ToolDefinition } from '@/shared/types'
import type { LLMAdapterConfig, ApiProtocol, ToolFormatConfig } from '@/shared/config/providers'
import type { OpenAITool, AnthropicTool } from './types'

/**
 * 工具适配器
 */
export class ToolAdapter {
  /**
   * 转换工具定义为目标协议格式
   */
  static convert(
    tools: ToolDefinition[] | undefined,
    protocol: ApiProtocol,
    config?: LLMAdapterConfig
  ): unknown[] | undefined {
    if (!tools?.length) return undefined

    switch (protocol) {
      case 'anthropic':
        return this.convertToAnthropic(tools)
      case 'openai':
      case 'gemini':
        return this.convertToOpenAI(tools)
      case 'custom':
        return this.convertWithConfig(tools, config?.toolFormat)
      default:
        return this.convertToOpenAI(tools)
    }
  }

  /**
   * 转换为 OpenAI 格式
   */
  private static convertToOpenAI(tools: ToolDefinition[]): OpenAITool[] {
    return tools.map(tool => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: {
          type: 'object',
          properties: this.normalizeProperties(tool.parameters.properties),
          required: tool.parameters.required || [],
        },
      },
    }))
  }

  /**
   * 规范化属性定义，确保 array 类型有 items 字段
   */
  private static normalizeProperties(properties: Record<string, unknown>): Record<string, unknown> {
    const normalized: Record<string, unknown> = {}
    
    for (const [key, value] of Object.entries(properties)) {
      const prop = value as Record<string, unknown>
      const normalizedProp: Record<string, unknown> = { ...prop }
      
      // 处理 array 类型
      if (prop.type === 'array') {
        if (prop.items) {
          const items = prop.items as Record<string, unknown>
          // 递归处理 items 中的 properties
          if (items.type === 'object' && items.properties) {
            normalizedProp.items = {
              ...items,
              properties: this.normalizeProperties(items.properties as Record<string, unknown>),
            }
          } else {
            normalizedProp.items = items
          }
        } else {
          // 如果没有 items，添加默认的 string 类型
          normalizedProp.items = { type: 'string' }
        }
      }
      
      // 处理 object 类型
      if (prop.type === 'object' && prop.properties) {
        normalizedProp.properties = this.normalizeProperties(prop.properties as Record<string, unknown>)
      }
      
      normalized[key] = normalizedProp
    }
    
    return normalized
  }

  /**
   * 转换为 Anthropic 格式
   */
  private static convertToAnthropic(tools: ToolDefinition[]): AnthropicTool[] {
    return tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      input_schema: {
        type: 'object',
        properties: this.normalizeProperties(tool.parameters.properties),
        required: tool.parameters.required || [],
      },
    }))
  }

  /**
   * 使用配置转换（用于自定义协议）
   */
  private static convertWithConfig(
    tools: ToolDefinition[],
    formatConfig?: ToolFormatConfig
  ): unknown[] {
    // 默认使用 OpenAI 格式
    if (!formatConfig) {
      return this.convertToOpenAI(tools)
    }

    const { wrapMode, wrapField, parameterField, includeType } = formatConfig

    return tools.map(tool => {
      // 基础工具定义
      const toolDef: Record<string, unknown> = {
        name: tool.name,
        description: tool.description,
        [parameterField]: {
          type: 'object',
          properties: this.normalizeProperties(tool.parameters.properties),
          required: tool.parameters.required || [],
        },
      }

      // 根据包装模式处理
      if (wrapMode === 'function' && wrapField) {
        const wrapped: Record<string, unknown> = {
          [wrapField]: toolDef,
        }
        if (includeType) {
          wrapped.type = 'function'
        }
        return wrapped
      }

      if (wrapMode === 'tool' && includeType) {
        return { type: 'tool', ...toolDef }
      }

      return toolDef
    })
  }

  /**
   * 解析工具调用参数
   * 处理字符串和对象两种格式
   */
  static parseToolArguments(
    args: string | Record<string, unknown> | undefined
  ): Record<string, unknown> {
    if (!args) return {}

    // 已经是对象
    if (typeof args === 'object') {
      return args as Record<string, unknown>
    }

    // 字符串需要解析
    try {
      // 尝试找到 JSON 对象的边界
      const firstBrace = args.indexOf('{')
      const lastBrace = args.lastIndexOf('}')
      if (firstBrace !== -1 && lastBrace > firstBrace) {
        return JSON.parse(args.slice(firstBrace, lastBrace + 1))
      }
      return JSON.parse(args)
    } catch {
      // 解析失败，返回空对象
      return {}
    }
  }
}
