/**
 * Agent 配置管理
 * 集中管理 Agent 运行时配置
 */

import { useStore } from '@store'
import { AGENT_DEFAULTS, READ_ONLY_TOOLS } from '@/shared/constants'

/**
 * Agent 运行时配置
 */
export interface AgentRuntimeConfig {
  // 用户可配置
  maxToolLoops: number
  maxHistoryMessages: number
  maxToolResultChars: number
  maxFileContentChars: number
  maxTotalContextChars: number
  // 重试配置
  maxRetries: number
  retryDelayMs: number
  retryBackoffMultiplier: number
  // 工具执行
  toolTimeoutMs: number
  // 上下文压缩
  contextCompressThreshold: number
  keepRecentTurns: number
}

/**
 * 从 store 获取动态配置
 */
export function getAgentConfig(): AgentRuntimeConfig {
  const agentConfig = useStore.getState().agentConfig || {}
  return {
    // 用户可配置的值
    maxToolLoops: agentConfig.maxToolLoops ?? AGENT_DEFAULTS.MAX_TOOL_LOOPS,
    maxHistoryMessages: agentConfig.maxHistoryMessages ?? 50,
    maxToolResultChars: agentConfig.maxToolResultChars ?? 10000,
    maxFileContentChars: agentConfig.maxFileContentChars ?? AGENT_DEFAULTS.MAX_FILE_CONTENT_CHARS,
    maxTotalContextChars: agentConfig.maxTotalContextChars ?? 50000,
    // 重试配置
    maxRetries: AGENT_DEFAULTS.MAX_RETRIES,
    retryDelayMs: AGENT_DEFAULTS.RETRY_DELAY_MS,
    retryBackoffMultiplier: AGENT_DEFAULTS.RETRY_BACKOFF_MULTIPLIER,
    // 工具执行超时
    toolTimeoutMs: AGENT_DEFAULTS.TOOL_TIMEOUT_MS,
    // 上下文压缩阈值
    contextCompressThreshold: AGENT_DEFAULTS.CONTEXT_COMPRESS_THRESHOLD,
    keepRecentTurns: AGENT_DEFAULTS.KEEP_RECENT_TURNS,
  }
}

/**
 * 只读工具列表（可并行执行）
 */
export const READ_TOOLS = READ_ONLY_TOOLS as readonly string[]

/**
 * 可重试的错误代码
 */
export const RETRYABLE_ERROR_CODES = new Set([
  'RATE_LIMIT',
  'TIMEOUT',
  'NETWORK_ERROR',
  'SERVER_ERROR',
])

/**
 * 可重试的错误模式
 */
export const RETRYABLE_ERROR_PATTERNS = [
  /timeout/i,
  /ECONNRESET/i,
  /ETIMEDOUT/i,
  /ENOTFOUND/i,
  /network/i,
  /temporarily unavailable/i,
  /rate limit/i,
  /429/,
  /503/,
  /502/,
]

/**
 * 判断错误是否可重试
 */
export function isRetryableError(error: string): boolean {
  return RETRYABLE_ERROR_PATTERNS.some(pattern => pattern.test(error))
}
