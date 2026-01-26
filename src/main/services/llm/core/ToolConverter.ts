/**
 * 工具转换器 - 将应用工具定义转换为 AI SDK Tool 格式
 * 使用 AI SDK 6.0 的标准类型
 */

import { tool } from '@ai-sdk/provider-utils'
import { z } from 'zod'
import type { Tool } from '@ai-sdk/provider-utils'
import type { ToolDefinition } from '@shared/types'

export class ToolConverter {
  /**
   * 转换工具列表
   */
  convert(tools: ToolDefinition[]): Record<string, Tool> {
    const result: Record<string, Tool> = {}

    for (const t of tools) {
      const schema = this.convertSchema(t.parameters)
      result[t.name] = tool({
        description: t.description,
        inputSchema: schema,
        // 不提供 execute - 工具执行由外部处理
      })
    }

    return result
  }

  /**
   * 转换 JSON Schema 到 Zod Schema
   */
  private convertSchema(jsonSchema: Record<string, unknown>): z.ZodObject<z.ZodRawShape> {
    const properties = (jsonSchema.properties as Record<string, unknown>) || {}
    const required = (jsonSchema.required as string[]) || []

    const shape: z.ZodRawShape = {}

    for (const [key, value] of Object.entries(properties)) {
      const prop = value as { type?: string; description?: string }
      const isRequired = required.includes(key)

      let zodType: z.ZodTypeAny

      switch (prop.type) {
        case 'string':
          zodType = z.string()
          break
        case 'number':
          zodType = z.number()
          break
        case 'boolean':
          zodType = z.boolean()
          break
        case 'array':
          zodType = z.array(z.any())
          break
        case 'object':
          zodType = z.record(z.any())
          break
        default:
          zodType = z.any()
      }

      if (prop.description) {
        zodType = zodType.describe(prop.description)
      }

      shape[key] = isRequired ? zodType : zodType.optional()
    }

    return z.object(shape)
  }
}
