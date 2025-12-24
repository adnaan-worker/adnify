/**
 * 全局状态管理
 * 使用 Zustand 和 Slices 模式组织状态
 */
import { create } from 'zustand'
import { FileSlice, createFileSlice } from './slices/fileSlice'
import { ChatSlice, createChatSlice } from './slices/chatSlice'
import { SettingsSlice, createSettingsSlice } from './slices/settingsSlice'
import { UISlice, createUISlice } from './slices/uiSlice'
import { ThemeSlice, createThemeSlice } from './slices/themeSlice'
import { LogSlice, createLogSlice } from './slices/logSlice'

// 导出类型
export type { OpenFile } from './slices/fileSlice'
export type { ChatMode, Message, ToolCall, ContextStats } from './slices/chatSlice'
export type { ProviderType, LLMConfig, LLMParameters, AutoApproveSettings, SecuritySettings } from './slices/settingsSlice'
export type { ProviderModelConfig } from '../types/provider'
export type { SidePanel, DiffView } from './slices/uiSlice'
export type { ThemeName } from './slices/themeSlice'
export type { ToolCallLogEntry } from './slices/logSlice'

// 组合所有 slices
type StoreState = FileSlice & ChatSlice & SettingsSlice & UISlice & ThemeSlice & LogSlice

export const useStore = create<StoreState>()((...args) => ({
  ...createFileSlice(...args),
  ...createChatSlice(...args),
  ...createSettingsSlice(...args),
  ...createUISlice(...args),
  ...createThemeSlice(...args),
  ...createLogSlice(...args),
}))
