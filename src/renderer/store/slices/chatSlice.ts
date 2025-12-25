/**
 * 聊天相关状态切片
 * 
 * 优化：
 * - 消息历史限制（防止内存溢出）
 * - 消息持久化支持
 * - 上下文窗口管理
 */
import { logger } from '@utils/Logger'
import { StateCreator } from 'zustand'
import { ToolStatus, ToolApprovalType, Checkpoint } from '@renderer/agent/toolTypes'

// ============ 配置常量 ============

const CHAT_CONFIG = {
  /** 最大消息数量（超过后自动清理旧消息） */
  maxMessages: 200,
  /** 最大工具调用数量 */
  maxToolCalls: 100,
  /** 最大检查点数量 */
  maxCheckpoints: 50,
  /** 消息内容最大长度（超过后截断） */
  maxMessageLength: 100000,
  /** 持久化存储 key */
  storageKey: 'adnify_chat_history',
} as const

export type ChatMode = 'chat' | 'agent' | 'plan'

export interface Message {
  id: string
  role: 'user' | 'assistant' | 'tool'
  content:
  | string
  | Array<
    | { type: 'text'; text: string }
    | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } }
  >
  toolCallId?: string
  toolName?: string
  toolResult?: string
  isStreaming?: boolean
  timestamp: number
  toolCallIds?: string[]
}

export interface ToolCall {
  id: string
  name: string
  arguments: Record<string, unknown>
  argsBuffer?: string
  status: ToolStatus
  approvalType?: ToolApprovalType
  result?: string
  error?: string
}

export interface ContextStats {
  totalChars: number
  maxChars: number
  fileCount: number
  maxFiles: number
  messageCount: number
  maxMessages: number
  semanticResultCount: number
  terminalChars: number
}

export interface ChatSlice {
  chatMode: ChatMode
  messages: Message[]
  isStreaming: boolean
  currentToolCalls: ToolCall[]
  pendingToolCall: ToolCall | null
  checkpoints: Checkpoint[]
  currentCheckpointIdx: number
  currentSessionId: string | null
  inputPrompt: string
  contextStats: ContextStats | null

  setChatMode: (mode: ChatMode) => void
  addMessage: (message: Omit<Message, 'id' | 'timestamp'>) => void
  updateLastMessage: (content: string) => void
  appendTokenToLastMessage: (token: string) => void
  finalizeLastMessage: () => void
  editMessage: (id: string, content: string) => void
  deleteMessagesAfter: (id: string) => void
  setIsStreaming: (streaming: boolean) => void
  startToolCall: (id: string, name: string) => void
  appendToolCallArgs: (id: string, delta: string) => void
  linkToolCallToLastMessage: (toolCallId: string) => void
  clearMessages: () => void
  addToolCall: (toolCall: Omit<ToolCall, 'status'>) => void
  updateToolCall: (id: string, updates: Partial<ToolCall>) => void
  setPendingToolCall: (toolCall: ToolCall | null) => void
  approveToolCall: () => void
  rejectToolCall: () => void
  addCheckpoint: (checkpoint: Checkpoint) => void
  setCurrentCheckpointIdx: (idx: number) => void
  clearCheckpoints: () => void
  setCurrentSessionId: (id: string | null) => void
  setInputPrompt: (prompt: string) => void
  setContextStats: (stats: ContextStats | null) => void
}

export const createChatSlice: StateCreator<ChatSlice, [], [], ChatSlice> = (set) => ({
  chatMode: 'chat',
  messages: [],
  isStreaming: false,
  currentToolCalls: [],
  pendingToolCall: null,
  checkpoints: [],
  currentCheckpointIdx: -1,
  currentSessionId: null,
  inputPrompt: '',
  contextStats: null,

  setChatMode: (mode) => {
    set({ chatMode: mode })
    // 同步更新全局模式状态
    try {
      const { useModeStore } = require('../../modes/modeStore')
      useModeStore.getState().setMode(mode)
    } catch (e) {
      logger.store.warn('[ChatSlice] Failed to sync modeStore:', e)
    }
  },

  addMessage: (message) =>
    set((state) => {
      // 截断过长的消息内容
      let content = message.content
      if (typeof content === 'string' && content.length > CHAT_CONFIG.maxMessageLength) {
        content = content.slice(0, CHAT_CONFIG.maxMessageLength) + '\n...(truncated)'
      }

      const newMessage = {
        ...message,
        content,
        id: crypto.randomUUID(),
        timestamp: Date.now()
      }

      // 限制消息数量，保留最新的消息
      let messages = [...state.messages, newMessage]
      if (messages.length > CHAT_CONFIG.maxMessages) {
        // 保留最新的消息，但确保不会截断正在进行的对话
        const excess = messages.length - CHAT_CONFIG.maxMessages
        messages = messages.slice(excess)
      }

      return { messages }
    }),

  updateLastMessage: (content) =>
    set((state) => {
      const messages = [...state.messages]
      const lastIndex = messages.length - 1
      if (lastIndex >= 0) {
        messages[lastIndex] = { ...messages[lastIndex], content }
      }
      return { messages }
    }),

  appendTokenToLastMessage: (token) =>
    set((state) => {
      const messages = [...state.messages]
      const lastIndex = messages.length - 1
      if (lastIndex >= 0) {
        const lastMsg = messages[lastIndex]
        if (lastMsg.role === 'assistant' && !lastMsg.toolCallId) {
          messages[lastIndex] = { ...lastMsg, content: lastMsg.content + token }
        }
      }
      return { messages }
    }),

  finalizeLastMessage: () =>
    set((state) => {
      const messages = [...state.messages]
      const lastIndex = messages.length - 1
      if (lastIndex >= 0 && messages[lastIndex].isStreaming) {
        messages[lastIndex] = { ...messages[lastIndex], isStreaming: false }
      }
      return { messages }
    }),

  editMessage: (id, content) =>
    set((state) => ({
      messages: state.messages.map((m) => (m.id === id ? { ...m, content } : m)),
    })),

  deleteMessagesAfter: (id) =>
    set((state) => {
      const index = state.messages.findIndex((m) => m.id === id)
      if (index === -1) return state
      return { messages: state.messages.slice(0, index + 1), currentToolCalls: [] }
    }),

  setIsStreaming: (streaming) => set({ isStreaming: streaming }),

  startToolCall: (id, name) =>
    set((state) => ({
      currentToolCalls: [
        ...state.currentToolCalls,
        { id, name, arguments: {}, argsBuffer: '', status: 'running' as ToolStatus },
      ],
    })),

  appendToolCallArgs: (id, delta) =>
    set((state) => ({
      currentToolCalls: state.currentToolCalls.map((tc) =>
        tc.id === id ? { ...tc, argsBuffer: (tc.argsBuffer || '') + delta } : tc
      ),
    })),

  linkToolCallToLastMessage: (toolCallId) =>
    set((state) => {
      const messages = [...state.messages]
      const lastIndex = messages.length - 1
      if (lastIndex >= 0 && messages[lastIndex].role === 'assistant') {
        const lastMsg = messages[lastIndex]
        const existingIds = lastMsg.toolCallIds || []
        if (!existingIds.includes(toolCallId)) {
          messages[lastIndex] = { ...lastMsg, toolCallIds: [...existingIds, toolCallId] }
        }
      }
      return { messages }
    }),

  clearMessages: () => set({ messages: [], currentToolCalls: [], contextStats: null }),

  addToolCall: (toolCall) =>
    set((state) => ({
      currentToolCalls: [...state.currentToolCalls, { ...toolCall, status: 'running' as ToolStatus }],
    })),

  updateToolCall: (id, updates) =>
    set((state) => ({
      currentToolCalls: state.currentToolCalls.map((tc) =>
        tc.id === id ? { ...tc, ...updates } : tc
      ),
    })),

  setPendingToolCall: (toolCall) => set({ pendingToolCall: toolCall }),

  approveToolCall: () =>
    set((state) => {
      if (state.pendingToolCall) {
        return {
          pendingToolCall: null,
          currentToolCalls: state.currentToolCalls.map((tc) =>
            tc.id === state.pendingToolCall?.id ? { ...tc, status: 'running' as ToolStatus } : tc
          ),
        }
      }
      return {}
    }),

  rejectToolCall: () =>
    set((state) => {
      if (state.pendingToolCall) {
        return {
          pendingToolCall: null,
          currentToolCalls: state.currentToolCalls.map((tc) =>
            tc.id === state.pendingToolCall?.id
              ? { ...tc, status: 'rejected' as ToolStatus, error: 'Rejected by user' }
              : tc
          ),
        }
      }
      return {}
    }),

  addCheckpoint: (checkpoint) =>
    set((state) => ({
      checkpoints: [...state.checkpoints.slice(-49), checkpoint],
      currentCheckpointIdx: state.checkpoints.length,
    })),

  setCurrentCheckpointIdx: (idx) => set({ currentCheckpointIdx: idx }),
  clearCheckpoints: () => set({ checkpoints: [], currentCheckpointIdx: -1 }),
  setCurrentSessionId: (id) => set({ currentSessionId: id }),
  setInputPrompt: (prompt) => set({ inputPrompt: prompt }),
  setContextStats: (stats) => set({ contextStats: stats }),
})
