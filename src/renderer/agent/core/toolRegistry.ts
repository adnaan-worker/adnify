/**
 * 统一工具注册表
 * 合并工具定义、Schema 验证和执行逻辑
 * 
 * 设计理念（参考 Claude Code）：
 * 1. 单一来源：工具定义、验证规则、执行函数统一管理
 * 2. 分类管理：按照读取/写入/终端/搜索/LSP 等分类
 * 3. 可配置：每个工具可以有独立的超时、重试策略
 */

import { logger } from '@utils/Logger'
import { z } from 'zod'
import { AGENT_DEFAULTS, TOOL_CATEGORIES } from '@/shared/constants'
import { ToolApprovalType } from './types'

// 重新导出类型以供外部使用
export type { ToolExecutionResult } from './types'

// ===== 类型定义 =====

export type ToolCategory = typeof TOOL_CATEGORIES[keyof typeof TOOL_CATEGORIES]

export interface ToolMetadata {
    name: string
    description: string
    category: ToolCategory
    approvalType?: ToolApprovalType
    /** 工具执行超时 (ms)，默认使用 AGENT_DEFAULTS.TOOL_TIMEOUT_MS */
    timeout?: number
    /** 是否可重试 */
    retryable?: boolean
    /** 最大重试次数 */
    maxRetries?: number
}

export interface RegisteredTool extends ToolMetadata {
    /** Zod Schema 用于参数验证 */
    schema: z.ZodSchema
    /** 通用函数调用格式的参数定义（由 ProviderAdapter 转换为各提供商格式）*/
    parameters: {
        type: 'object'
        properties: Record<string, any>
        required: string[]
    }
}

// ===== 工具注册表 =====

class ToolRegistry {
    private tools: Map<string, RegisteredTool> = new Map()

    /**
     * 注册工具
     */
    register(tool: RegisteredTool): void {
        if (this.tools.has(tool.name)) {
            logger.agent.warn(`[ToolRegistry] Tool "${tool.name}" already registered, overwriting`)
        }
        this.tools.set(tool.name, tool)
    }

    /**
     * 获取工具
     */
    get(name: string): RegisteredTool | undefined {
        return this.tools.get(name)
    }

    /**
     * 获取所有工具
     */
    getAll(): RegisteredTool[] {
        return Array.from(this.tools.values())
    }

    /**
     * 获取所有工具定义（用于发送给 LLM）
     */
    getToolDefinitions(): Array<{
        name: string
        description: string
        parameters: RegisteredTool['parameters']
    }> {
        return this.getAll().map(tool => ({
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters,
        }))
    }

    /**
     * 按分类获取工具
     */
    getByCategory(category: ToolCategory): RegisteredTool[] {
        return this.getAll().filter(tool => tool.category === category)
    }

    /**
     * 获取工具的审批类型
     */
    getApprovalType(name: string): ToolApprovalType | undefined {
        return this.get(name)?.approvalType
    }

    /**
     * 获取工具的超时时间
     */
    getTimeout(name: string): number {
        return this.get(name)?.timeout ?? AGENT_DEFAULTS.TOOL_TIMEOUT_MS
    }

    /**
     * 获取工具的重试配置
     */
    getRetryConfig(name: string): { retryable: boolean; maxRetries: number } {
        const tool = this.get(name)
        return {
            retryable: tool?.retryable ?? false,
            maxRetries: tool?.maxRetries ?? AGENT_DEFAULTS.MAX_RETRIES,
        }
    }

    /**
     * 验证工具参数
     */
    validate(name: string, args: unknown): { success: boolean; data?: any; error?: string } {
        const tool = this.get(name)
        if (!tool) {
            return { success: false, error: `Unknown tool: ${name}` }
        }

        const result = tool.schema.safeParse(args)
        if (result.success) {
            return { success: true, data: result.data }
        }

        const errorMessage = result.error.issues
            .map(issue => `${issue.path.join('.')}: ${issue.message}`)
            .join('; ')

        return { success: false, error: `Invalid parameters: ${errorMessage}` }
    }

    /**
     * 检查工具是否为只读类型（可并行执行）
     */
    isReadOnly(name: string): boolean {
        const tool = this.get(name)
        return tool?.category === TOOL_CATEGORIES.READ ||
            tool?.category === TOOL_CATEGORIES.SEARCH ||
            tool?.category === TOOL_CATEGORIES.LSP
    }

    /**
     * 检查工具是否为写入类型（需要串行执行）
     */
    isWriteTool(name: string): boolean {
        const tool = this.get(name)
        return tool?.category === TOOL_CATEGORIES.WRITE
    }
}

// ===== 单例导出 =====

export const toolRegistry = new ToolRegistry()

// ===== 辅助函数 =====

/**
 * 创建工具定义的便捷函数
 */
export function defineReadTool(
    name: string,
    description: string,
    schema: z.ZodSchema,
    parameters: RegisteredTool['parameters']
): RegisteredTool {
    return {
        name,
        description,
        category: TOOL_CATEGORIES.READ,
        schema,
        parameters,
        retryable: true,
        maxRetries: 2,
    }
}

export function defineWriteTool(
    name: string,
    description: string,
    schema: z.ZodSchema,
    parameters: RegisteredTool['parameters']
): RegisteredTool {
    return {
        name,
        description,
        category: TOOL_CATEGORIES.WRITE,
        schema,
        parameters,
        retryable: false,  // 写入操作不应自动重试
    }
}

export function defineTerminalTool(
    name: string,
    description: string,
    schema: z.ZodSchema,
    parameters: RegisteredTool['parameters']
): RegisteredTool {
    return {
        name,
        description,
        category: TOOL_CATEGORIES.TERMINAL,
        approvalType: 'terminal',
        schema,
        parameters,
        retryable: false,
    }
}

export function defineDangerousTool(
    name: string,
    description: string,
    schema: z.ZodSchema,
    parameters: RegisteredTool['parameters']
): RegisteredTool {
    return {
        name,
        description,
        category: TOOL_CATEGORIES.WRITE,
        approvalType: 'dangerous',
        schema,
        parameters,
        retryable: false,
    }
}
