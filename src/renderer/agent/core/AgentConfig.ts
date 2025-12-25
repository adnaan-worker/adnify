/**
 * Agent 配置管理
 * 集中管理 Agent 运行时配置
 */

import { useStore } from '@store'
import { AGENT_DEFAULTS, READ_ONLY_TOOLS } from '@/shared/constants'
import { LLMToolCall } from '@/renderer/types/electron'

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
    // 用户可配置的值（优先使用 store 中的配置，否则使用统一默认值）
    maxToolLoops: agentConfig.maxToolLoops ?? AGENT_DEFAULTS.MAX_TOOL_LOOPS,
    maxHistoryMessages: agentConfig.maxHistoryMessages ?? AGENT_DEFAULTS.MAX_HISTORY_MESSAGES,
    maxToolResultChars: agentConfig.maxToolResultChars ?? AGENT_DEFAULTS.MAX_TOOL_RESULT_CHARS,
    maxFileContentChars: agentConfig.maxFileContentChars ?? AGENT_DEFAULTS.MAX_FILE_CONTENT_CHARS,
    maxTotalContextChars: agentConfig.maxTotalContextChars ?? AGENT_DEFAULTS.MAX_TOTAL_CONTEXT_CHARS,
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

// ===== 循环检测器 =====

interface ToolCallSignature {
  name: string
  keyParam: string | null
  argsHash: string
  timestamp: number
}

interface LoopCheckResult {
  isLoop: boolean
  reason?: string
}

/**
 * 增强的循环检测器
 * 支持多种检测策略：
 * 1. 精确重复检测 - 完全相同的工具调用
 * 2. 语义重复检测 - 相同工具+相同目标文件
 * 3. 模式检测 - 检测 A→B→A→B 等循环模式
 */
export class LoopDetector {
  private history: ToolCallSignature[] = []
  private readonly maxHistory = 15
  private readonly maxExactRepeats = 2
  private readonly maxSameTargetRepeats = 3

  /**
   * 检查是否存在循环
   */
  checkLoop(toolCalls: LLMToolCall[]): LoopCheckResult {
    const signatures = toolCalls.map(tc => this.createSignature(tc))

    // 1. 精确重复检测（完全相同的调用）
    const exactResult = this.checkExactRepeat(signatures)
    if (exactResult.isLoop) return exactResult

    // 2. 同目标重复检测（相同工具+相同文件/命令）
    const targetResult = this.checkSameTargetRepeat(signatures)
    if (targetResult.isLoop) return targetResult

    // 3. 模式检测（A→B→A→B）
    const patternResult = this.checkPatternLoop(signatures)
    if (patternResult.isLoop) return patternResult

    // 记录本次调用
    this.history.push(...signatures)
    if (this.history.length > this.maxHistory) {
      this.history = this.history.slice(-this.maxHistory)
    }

    return { isLoop: false }
  }

  /**
   * 创建工具调用签名
   */
  private createSignature(tc: LLMToolCall): ToolCallSignature {
    const args = tc.arguments as Record<string, unknown>
    return {
      name: tc.name,
      keyParam: (args.path || args.file || args.command || args.query || null) as string | null,
      argsHash: this.hashArgs(tc.arguments),
      timestamp: Date.now(),
    }
  }

  /**
   * 参数哈希
   */
  private hashArgs(args: Record<string, unknown>): string {
    const normalized = JSON.stringify(args, Object.keys(args).sort())
    let hash = 0
    for (let i = 0; i < normalized.length; i++) {
      const char = normalized.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash
    }
    return hash.toString(36)
  }

  /**
   * 精确重复检测
   */
  private checkExactRepeat(signatures: ToolCallSignature[]): LoopCheckResult {
    for (const sig of signatures) {
      const exactMatches = this.history.filter(
        h => h.name === sig.name && h.argsHash === sig.argsHash
      )
      if (exactMatches.length >= this.maxExactRepeats) {
        return {
          isLoop: true,
          reason: `Detected exact repeat of ${sig.name} (${exactMatches.length + 1} times).`,
        }
      }
    }
    return { isLoop: false }
  }

  /**
   * 同目标重复检测
   * 检测相同工具对相同文件/路径的重复操作
   */
  private checkSameTargetRepeat(signatures: ToolCallSignature[]): LoopCheckResult {
    for (const sig of signatures) {
      if (!sig.keyParam) continue

      // 统计历史中相同工具+相同目标的调用次数
      const sameTargetCalls = this.history.filter(
        h => h.name === sig.name && h.keyParam === sig.keyParam
      )

      // 写操作更严格
      const isWriteOp = ['edit_file', 'write_file', 'run_command'].includes(sig.name)
      const threshold = isWriteOp ? 2 : this.maxSameTargetRepeats

      if (sameTargetCalls.length >= threshold) {
        return {
          isLoop: true,
          reason: `Detected repeated ${sig.name} on "${sig.keyParam}" (${sameTargetCalls.length + 1} times).`,
        }
      }
    }
    return { isLoop: false }
  }

  /**
   * 模式循环检测
   * 检测 A→B→A→B 或 A→B→C→A→B→C 等模式
   */
  private checkPatternLoop(newSignatures: ToolCallSignature[]): LoopCheckResult {
    // 将新签名加入临时历史进行检测
    const tempHistory = [...this.history, ...newSignatures]
    if (tempHistory.length < 4) return { isLoop: false }

    // 检测长度为 2 和 3 的循环模式
    for (const patternLen of [2, 3]) {
      if (tempHistory.length < patternLen * 2) continue

      const recent = tempHistory.slice(-patternLen * 2)
      const firstHalf = recent.slice(0, patternLen)
      const secondHalf = recent.slice(patternLen)

      const isPattern = firstHalf.every((sig, i) =>
        sig.name === secondHalf[i].name && sig.argsHash === secondHalf[i].argsHash
      )

      if (isPattern) {
        const pattern = firstHalf.map(s => s.name).join(' → ')
        return {
          isLoop: true,
          reason: `Detected repeating pattern: ${pattern}.`,
        }
      }
    }

    return { isLoop: false }
  }

  /**
   * 重置检测器
   */
  reset(): void {
    this.history = []
  }
}
