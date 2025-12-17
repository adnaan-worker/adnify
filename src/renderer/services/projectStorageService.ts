/**
 * 项目级存储服务
 * 将重要数据存储在项目根目录的 .adnify 文件夹下
 * 
 * 存储结构：
 * .adnify/
 *   ├── index/              # 代码库索引
 *   ├── workspace-state.json # 工作区状态（打开的文件等）
 *   ├── checkpoints.json    # 检查点数据
 *   ├── sessions.json       # 聊天会话历史
 *   └── settings.json       # 项目级设置
 * 
 * 注意：此服务依赖 adnifyDirService 进行目录管理
 * 请确保在使用前已调用 adnifyDir.initialize()
 */

import { adnifyDir, ADNIFY_FILES } from './adnifyDirService'

// 重新导出文件常量以保持兼容性
export const STORAGE_FILES = ADNIFY_FILES

/**
 * 读取项目存储数据
 */
export async function readProjectData<T>(fileName: string): Promise<T | null> {
  return adnifyDir.readJson<T>(fileName as any)
}

/**
 * 写入项目存储数据
 */
export async function writeProjectData<T>(fileName: string, data: T): Promise<boolean> {
  return adnifyDir.writeJson(fileName as any, data)
}

/**
 * 删除项目存储数据
 */
export async function deleteProjectData(fileName: string): Promise<boolean> {
  return adnifyDir.deleteFile(fileName)
}

// ============ 检查点存储 ============

export interface CheckpointData {
  checkpoints: Array<{
    id: string
    type: 'user_message' | 'tool_edit'
    timestamp: number
    snapshots: Record<string, { path?: string; fsPath?: string; content: string | null; timestamp?: number }>
    description: string
    messageId?: string
  }>
  currentIdx: number
}

export async function loadCheckpoints(): Promise<CheckpointData | null> {
  return readProjectData<CheckpointData>(STORAGE_FILES.CHECKPOINTS)
}

export async function saveCheckpoints(data: CheckpointData): Promise<boolean> {
  return writeProjectData(STORAGE_FILES.CHECKPOINTS, data)
}

// ============ 会话存储 ============

export interface SessionData {
  threads: Array<{
    id: string
    title?: string
    messages: unknown[]
    createdAt: number
    lastModified: number
  }>
  currentThreadId: string | null
}

export async function loadSessions(): Promise<SessionData | null> {
  return readProjectData<SessionData>(STORAGE_FILES.SESSIONS)
}

export async function saveSessions(data: SessionData): Promise<boolean> {
  return writeProjectData(STORAGE_FILES.SESSIONS, data)
}

// ============ 项目设置存储 ============

export interface ProjectSettings {
  // 代理设置
  proxy?: {
    enabled: boolean
    http?: string
    https?: string
  }
  // 检查点保留策略
  checkpointRetention: {
    maxCount: number
    maxAgeDays: number
    maxFileSizeKB: number
  }
  // 日志设置
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error'
    saveToFile: boolean
  }
  // Agent 设置
  agent: {
    autoApproveReadOnly: boolean
    maxToolCallsPerTurn: number
  }
}

export const DEFAULT_PROJECT_SETTINGS: ProjectSettings = {
  checkpointRetention: {
    maxCount: 50,
    maxAgeDays: 7,
    maxFileSizeKB: 100,
  },
  logging: {
    level: 'info',
    saveToFile: false,
  },
  agent: {
    autoApproveReadOnly: true,
    maxToolCallsPerTurn: 25,
  },
}

export async function loadProjectSettings(): Promise<ProjectSettings> {
  const saved = await readProjectData<ProjectSettings>(STORAGE_FILES.SETTINGS)
  if (saved) {
    // 合并默认值，确保新增字段有默认值
    return { ...DEFAULT_PROJECT_SETTINGS, ...saved }
  }
  return DEFAULT_PROJECT_SETTINGS
}

export async function saveProjectSettings(settings: ProjectSettings): Promise<boolean> {
  return writeProjectData(STORAGE_FILES.SETTINGS, settings)
}
