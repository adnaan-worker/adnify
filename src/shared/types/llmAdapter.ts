/**
 * LLM 适配器配置类型定义
 * 
 * ⚠️ 配置数据已迁移到 @/shared/config/providers.ts
 * 此文件仅保留类型定义用于类型共享
 */

/** 请求配置 */
export interface RequestConfig {
    endpoint: string              // API 端点 (不包含 baseUrl)
    method: 'POST' | 'GET'
    headers: Record<string, string>
    bodyTemplate: Record<string, unknown>  // 请求体模板
}

/** 响应解析配置 */
export interface ResponseConfig {
    // 流式响应字段路径
    contentField: string          // 内容字段 'delta.content'
    reasoningField?: string       // 思考字段 'delta.reasoning'
    toolCallField?: string        // 工具调用 'delta.tool_calls'
    finishReasonField?: string    // 完成原因 'finish_reason'

    // 工具调用解析
    toolNamePath?: string         // 工具名 'function.name'
    toolArgsPath?: string         // 参数 'function.arguments'
    toolIdPath?: string           // ID 'id'
    argsIsObject?: boolean        // 参数是否已是对象

    // 结束标记
    doneMarker?: string           // 流结束标记 '[DONE]'
}

/** 完整适配器配置 */
export interface LLMAdapterConfig {
    id: string
    name: string
    description?: string
    request: RequestConfig
    response: ResponseConfig
    isBuiltin?: boolean
}
