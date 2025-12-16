/**
 * 设置相关状态切片
 */
import { StateCreator } from 'zustand'
import { Language } from '../../i18n'
import { ProviderModelConfig } from '../../types/provider'

export type ProviderType = 'openai' | 'anthropic' | 'gemini' | 'deepseek' | 'groq' | 'ollama' | 'custom'

export interface LLMConfig {
  provider: ProviderType
  model: string
  apiKey: string
  baseUrl?: string
  timeout?: number
  maxTokens?: number
}

export interface AutoApproveSettings {
  edits: boolean
  terminal: boolean
  dangerous: boolean
}

export interface SettingsSlice {
  // State
  llmConfig: LLMConfig
  providerConfigs: Record<string, ProviderModelConfig>
  showSettings: boolean
  language: Language
  autoApprove: AutoApproveSettings
  promptTemplateId: string  // 提示词模板 ID

  // Actions
  setLLMConfig: (config: Partial<LLMConfig>) => void
  setProviderConfig: (providerId: string, config: Partial<ProviderModelConfig>) => void
  addCustomModel: (providerId: string, model: string) => void
  removeCustomModel: (providerId: string, model: string) => void
  setShowSettings: (show: boolean) => void
  setLanguage: (lang: Language) => void
  setAutoApprove: (settings: Partial<AutoApproveSettings>) => void
  setPromptTemplateId: (id: string) => void
}

export const createSettingsSlice: StateCreator<SettingsSlice, [], [], SettingsSlice> = (set) => ({
  // Initial state
  llmConfig: {
    provider: 'openai',
    model: 'gpt-4o',
    apiKey: '',
    maxTokens: 16384, // 默认 16K，确保工具调用有足够空间
  },
  providerConfigs: {},
  showSettings: false,
  language: 'en',
  autoApprove: {
    edits: false,
    terminal: false,
    dangerous: false,
  },
  promptTemplateId: 'default',

  // Actions
  setLLMConfig: (config) =>
    set((state) => ({
      llmConfig: { ...state.llmConfig, ...config },
    })),

  setProviderConfig: (providerId, config) =>
    set((state) => {
      const current = state.providerConfigs[providerId] || { enabledModels: [], customModels: [] }
      return {
        providerConfigs: {
          ...state.providerConfigs,
          [providerId]: { ...current, ...config },
        },
      }
    }),

  addCustomModel: (providerId, model) =>
    set((state) => {
      const current = state.providerConfigs[providerId] || { enabledModels: [], customModels: [] }
      if (current.customModels.includes(model)) return {}
      return {
        providerConfigs: {
          ...state.providerConfigs,
          [providerId]: {
            ...current,
            customModels: [...current.customModels, model],
          },
        },
      }
    }),

  removeCustomModel: (providerId, model) =>
    set((state) => {
      const current = state.providerConfigs[providerId] || { enabledModels: [], customModels: [] }
      return {
        providerConfigs: {
          ...state.providerConfigs,
          [providerId]: {
            ...current,
            customModels: current.customModels.filter((m) => m !== model),
          },
        },
      }
    }),

  setShowSettings: (show) => set({ showSettings: show }),
  setLanguage: (lang) => set({ language: lang }),
  setAutoApprove: (settings) =>
    set((state) => ({
      autoApprove: { ...state.autoApprove, ...settings },
    })),
  setPromptTemplateId: (id) => set({ promptTemplateId: id }),
})
