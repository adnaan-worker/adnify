/**
 * 检查点和文件快照类型定义
 */

import type { ContextItem } from './context'

/** 文件快照 */
export interface FileSnapshot {
  /** 文件完整路径 */
  path: string
  /** 文件内容，null 表示文件不存在 */
  content: string | null
  /** 快照时间戳 */
  timestamp?: number
}

/** 检查点中保存的图片信息 */
export interface CheckpointImage {
  /** 图片 ID */
  id: string
  /** 图片 MIME 类型 */
  mimeType: string
  /** Base64 编码的图片数据 */
  base64: string
}

/** 变更类型 */
export type ChangeType = 'create' | 'modify' | 'delete'

/** 待确认的更改 */
export interface PendingChange {
  id: string
  filePath: string
  toolCallId: string
  toolName: string
  status: 'pending' | 'accepted' | 'rejected'
  snapshot: FileSnapshot
  /** 新内容（用于 Diff 展示） */
  newContent: string | null
  /** 变更类型 */
  changeType: ChangeType
  timestamp: number
  linesAdded: number
  linesRemoved: number
}

/** 消息检查点 */
export interface MessageCheckpoint {
  id: string
  messageId: string
  timestamp: number
  fileSnapshots: Record<string, FileSnapshot>
  description: string
  /** 用户消息的图片（用于回滚时恢复到输入框） */
  images?: CheckpointImage[]
  /** 用户消息的上下文引用（用于回滚时恢复到输入框） */
  contextItems?: ContextItem[]
}

/** 检查点 */
export interface Checkpoint {
  id: string
  type: 'user_message' | 'tool_edit'
  timestamp: number
  snapshots: Record<string, FileSnapshot>
  description: string
  messageId?: string
}
