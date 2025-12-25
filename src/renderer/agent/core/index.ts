/**
 * Agent 核心模块导出
 */

export * from './types'
export { useAgentStore, selectCurrentThread, selectMessages, selectStreamState, selectContextItems, selectIsStreaming, selectIsAwaitingApproval } from './AgentStore'
export { AgentService } from './AgentService'
export type { LLMCallConfig } from './AgentService'
export { executeTool, getToolDefinitions, getToolApprovalType, TOOL_DISPLAY_NAMES, WRITE_TOOLS } from './ToolExecutor'

// 配置和工具模块
export { getAgentConfig, isRetryableError } from './AgentConfig'
export type { AgentRuntimeConfig } from './AgentConfig'
export { buildContextContent, buildUserContent, calculateContextStats } from './ContextBuilder'
export { parseXMLToolCalls, parsePartialArgs, generateToolCallId } from './XMLToolParser'
