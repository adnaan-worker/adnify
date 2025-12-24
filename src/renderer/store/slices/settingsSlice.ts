/**
 * 设置相关状态切片
 * 统一管理所有应用设置
 * 
 * 注意：类型定义和默认值从 settingsService 导入
 */
import { StateCreator } from 'zustand'
import { SECURITY_DEFAULTS, AGENT_DEFAULTS } from '@/shared/constants'
import { saveEditorConfig, getEditorConfig, defaultEditorConfig } from '../../config/editorConfig'
import { ProviderModelConfig } from '../../types/provider'
import { PROVIDERS, getAdapterConfig, type ProviderType as UnifiedProviderType } from '@/shared/config/providers'
import {
  settingsService,
  type LLMConfig as ServiceLLMConfig,
  type LLMParameters,
  type AutoApproveSettings as ServiceAutoApprove,
  type AgentConfig as ServiceAgentConfig,
  defaultLLMConfig as serviceDefaultLLMConfig,
  defaultAutoApprove as serviceDefaultAutoApprove,
  defaultAgentConfig as serviceDefaultAgentConfig,
} from '../../services/settingsService'

// ============ 导出类型 ============

export type ProviderType = UnifiedProviderType

// 重新导出 settingsService 的类型
export type { LLMParameters }

// LLMConfig 扩展 ServiceLLMConfig，确保 provider 类型更精确
export interface LLMConfig extends Omit<ServiceLLMConfig, 'provider'> {
  provider: ProviderType
  parameters: LLMParameters  // 确保 parameters 是必需的
}

export type AutoApproveSettings = ServiceAutoApprove

// 安全设置（特定于此 slice）
export interface SecuritySettings {
  enablePermissionConfirm: boolean
  enableAuditLog: boolean
  strictWorkspaceMode: boolean
  allowedShellCommands?: string[]
  showSecurityWarnings?: boolean
}

// Agent 配置（扩展 ServiceAgentConfig）
export interface AgentConfig extends ServiceAgentConfig { }

// ============ Slice 接口 ============

export interface SettingsSlice {
  llmConfig: LLMConfig
  language: 'en' | 'zh'
  autoApprove: AutoApproveSettings
  promptTemplateId: string
  providerConfigs: Record<string, ProviderModelConfig>
  securitySettings: SecuritySettings
  agentConfig: AgentConfig
  editorConfig: import('../../config/editorConfig').EditorConfig
  onboardingCompleted: boolean
  hasExistingConfig: boolean
  aiInstructions: string

  setLLMConfig: (config: Partial<LLMConfig>) => void
  setLanguage: (lang: 'en' | 'zh') => void
  setAutoApprove: (settings: Partial<AutoApproveSettings>) => void
  setPromptTemplateId: (id: string) => void
  setProviderConfig: (providerId: string, config: ProviderModelConfig) => void
  addCustomModel: (providerId: string, model: string) => void
  removeCustomModel: (providerId: string, model: string) => void
  setSecuritySettings: (settings: Partial<SecuritySettings>) => void
  setAgentConfig: (config: Partial<AgentConfig>) => void
  setEditorConfig: (config: Partial<import('../../config/editorConfig').EditorConfig>) => void
  setOnboardingCompleted: (completed: boolean) => void
  setHasExistingConfig: (hasConfig: boolean) => void
  setAiInstructions: (instructions: string) => void
  loadSettings: (isEmptyWindow?: boolean) => Promise<void>
}

// ============ 默认值（从 settingsService 派生） ============

const defaultLLMConfig: LLMConfig = {
  ...serviceDefaultLLMConfig,
  provider: 'openai',
  parameters: serviceDefaultLLMConfig.parameters!,
  adapterId: 'openai',
  adapterConfig: getAdapterConfig('openai'),
}

const defaultAutoApprove = serviceDefaultAutoApprove

// 从统一配置生成默认 Provider 配置
function generateDefaultProviderConfigs(): Record<string, ProviderModelConfig> {
  const configs: Record<string, ProviderModelConfig> = {}
  for (const [id, provider] of Object.entries(PROVIDERS)) {
    configs[id] = {
      customModels: [],
      adapterId: provider.adapter.id,
      adapterConfig: provider.adapter,
      model: provider.models.recommended || provider.models.default[0] || '',
      baseUrl: provider.endpoint.default,
    }
  }
  return configs
}

const defaultProviderConfigs = generateDefaultProviderConfigs()

const defaultSecuritySettings: SecuritySettings = {
  enablePermissionConfirm: true,
  enableAuditLog: true,
  strictWorkspaceMode: true,
  allowedShellCommands: [...SECURITY_DEFAULTS.SHELL_COMMANDS],
  showSecurityWarnings: true,
}

const defaultAgentConfig: AgentConfig = {
  ...serviceDefaultAgentConfig,
  maxToolLoops: AGENT_DEFAULTS.MAX_TOOL_LOOPS,
  maxFileContentChars: AGENT_DEFAULTS.MAX_FILE_CONTENT_CHARS,
}

// ============ Slice 创建 ============

export const createSettingsSlice: StateCreator<SettingsSlice, [], [], SettingsSlice> = (set, get) => ({
  llmConfig: defaultLLMConfig,
  language: 'en',
  autoApprove: defaultAutoApprove,
  promptTemplateId: 'default',
  providerConfigs: defaultProviderConfigs,
  securitySettings: defaultSecuritySettings,
  agentConfig: defaultAgentConfig,
  editorConfig: defaultEditorConfig,
  onboardingCompleted: true,
  hasExistingConfig: true,
  aiInstructions: '',

  setLLMConfig: (config) =>
    set((state) => ({
      llmConfig: { ...state.llmConfig, ...config },
    })),

  setLanguage: (lang) => set({ language: lang }),

  setAutoApprove: (settings) =>
    set((state) => ({
      autoApprove: { ...state.autoApprove, ...settings },
    })),

  setPromptTemplateId: (id) => set({ promptTemplateId: id }),

  setProviderConfig: (providerId, config) =>
    set((state) => ({
      providerConfigs: {
        ...state.providerConfigs,
        [providerId]: config,
      },
    })),

  addCustomModel: (providerId, model) =>
    set((state) => {
      const current = state.providerConfigs[providerId] || { customModels: [] }
      const customModels = [...(current.customModels || []), model]
      return {
        providerConfigs: {
          ...state.providerConfigs,
          [providerId]: { ...current, customModels },
        },
      }
    }),

  removeCustomModel: (providerId, model) =>
    set((state) => {
      const current = state.providerConfigs[providerId]
      if (!current) return state
      const customModels = (current.customModels || []).filter((m) => m !== model)
      return {
        providerConfigs: {
          ...state.providerConfigs,
          [providerId]: { ...current, customModels },
        },
      }
    }),

  setSecuritySettings: (settings) =>
    set((state) => ({
      securitySettings: { ...state.securitySettings, ...settings },
    })),

  setAgentConfig: (config) =>
    set((state) => ({
      agentConfig: { ...state.agentConfig, ...config },
    })),

  setEditorConfig: (config) => {
    const newConfig = { ...get().editorConfig, ...config }
    saveEditorConfig(newConfig)
    set({ editorConfig: newConfig })
  },

  setOnboardingCompleted: (completed) => set({ onboardingCompleted: completed }),
  setHasExistingConfig: (hasConfig) => set({ hasExistingConfig: hasConfig }),
  setAiInstructions: (instructions) => set({ aiInstructions: instructions }),

  loadSettings: async (isEmptyWindow = false) => {
    try {
      // 使用统一的 settingsService 加载设置
      const settings = await settingsService.loadAll()

      // 确保 parameters 存在
      const llmConfig: LLMConfig = {
        ...defaultLLMConfig,
        ...settings.llmConfig,
        provider: (settings.llmConfig?.provider as ProviderType) || 'openai',
        parameters: {
          ...defaultLLMConfig.parameters,
          ...settings.llmConfig?.parameters,
        },
      }

      // 如果没有 adapterConfig 但有 adapterId，使用内置预设
      if (!llmConfig.adapterConfig && llmConfig.adapterId) {
        const preset = getAdapterConfig(llmConfig.adapterId)
        if (preset) {
          llmConfig.adapterConfig = preset
        }
      }

      console.log('[SettingsSlice] loadSettings via settingsService:', {
        hasAdapterConfig: !!llmConfig.adapterConfig,
        adapterId: llmConfig.adapterId,
        provider: llmConfig.provider,
      })

      // 合并 Provider 配置
      const mergedProviderConfigs = { ...defaultProviderConfigs }
      if (settings.providerConfigs) {
        for (const [id, config] of Object.entries(settings.providerConfigs)) {
          mergedProviderConfigs[id] = {
            ...defaultProviderConfigs[id],
            ...config
          }
        }
      }

      set({
        llmConfig,
        language: (settings.language as 'en' | 'zh') || 'en',
        autoApprove: { ...defaultAutoApprove, ...settings.autoApprove },
        providerConfigs: mergedProviderConfigs,
        agentConfig: { ...defaultAgentConfig, ...settings.agentConfig },
        promptTemplateId: settings.promptTemplateId || 'default',
        onboardingCompleted: settings.onboardingCompleted ?? !!settings.llmConfig?.apiKey,
        hasExistingConfig: !!settings.llmConfig?.apiKey,
        aiInstructions: settings.aiInstructions || '',
        editorConfig: getEditorConfig(),
      })

      if (!isEmptyWindow) {
        const workspace = await window.electronAPI.restoreWorkspace()
        if (workspace) {
          ; (get() as any).setWorkspace(workspace)
        }
      }
    } catch (e) {
      console.error('[SettingsSlice] Failed to load settings:', e)
    }
  },
})
