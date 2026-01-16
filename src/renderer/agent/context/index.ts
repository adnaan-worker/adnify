/**
 * 上下文管理模块
 */

// 压缩管理器
export {
  prepareMessages,
  updateStats,
  calculateLevel,
  estimateTokens,
  estimateMessagesTokens,
  LEVEL_NAMES,
  type CompressionLevel,
  type CompressionStats,
  type PrepareResult,
} from './CompressionManager'

// 摘要服务
export {
  generateSummary,
  generateHandoffDocument,
  type SummaryResult,
} from './summaryService'

// Handoff 管理
export { buildHandoffContext, buildWelcomeMessage } from './HandoffManager'

// 类型
export type {
  StructuredSummary,
  HandoffDocument,
  FileChangeRecord,
} from './types'
