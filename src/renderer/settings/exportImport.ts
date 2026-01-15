/**
 * 设置导出/导入工具
 */

import { isBuiltinProvider } from '@shared/config/providers'
import type { SettingsState, ProviderModelConfig } from '@shared/config/settings'
import type { AppSettings } from '@shared/config/types'

export interface ExportedSettings {
  version: string
  exportedAt: string
  settings: Partial<AppSettings>
}

/**
 * 导出配置（不包含敏感信息如 API Key）
 */
export function exportSettings(settings: SettingsState, includeApiKeys = false): ExportedSettings {
  const exported: Partial<AppSettings> = {
    language: settings.language,
    autoApprove: settings.autoApprove,
    promptTemplateId: settings.promptTemplateId,
    agentConfig: settings.agentConfig,
    aiInstructions: settings.aiInstructions,
    llmConfig: {
      provider: settings.llmConfig.provider,
      model: settings.llmConfig.model,
    },
    providerConfigs: {},
  }

  for (const [id, config] of Object.entries(settings.providerConfigs)) {
    const cleanedConfig: Partial<ProviderModelConfig> = {
      model: config.model,
      baseUrl: config.baseUrl,
      timeout: config.timeout,
      customModels: config.customModels,
      advanced: config.advanced,
    }
    
    if (includeApiKeys && config.apiKey) {
      cleanedConfig.apiKey = config.apiKey
    }
    
    if (!isBuiltinProvider(id)) {
      cleanedConfig.displayName = config.displayName
      cleanedConfig.protocol = config.protocol
      cleanedConfig.adapterConfig = config.adapterConfig
    }
    
    exported.providerConfigs![id] = cleanedConfig as ProviderModelConfig
  }

  return {
    version: 'export-v1',
    exportedAt: new Date().toISOString(),
    settings: exported,
  }
}

/**
 * 从 JSON 导入配置
 */
export function importSettings(json: string): { success: boolean; settings?: Partial<AppSettings>; error?: string } {
  try {
    const parsed = JSON.parse(json) as ExportedSettings
    
    if (!parsed.version || !parsed.settings) {
      return { success: false, error: 'Invalid settings file format' }
    }
    
    if (typeof parsed.settings !== 'object') {
      return { success: false, error: 'Invalid settings data' }
    }
    
    return { success: true, settings: parsed.settings }
  } catch (e) {
    return { success: false, error: `Failed to parse JSON: ${e instanceof Error ? e.message : 'Unknown error'}` }
  }
}

/**
 * 下载配置文件
 */
export function downloadSettings(settings: SettingsState, includeApiKeys = false): void {
  const exported = exportSettings(settings, includeApiKeys)
  const json = JSON.stringify(exported, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  
  const a = document.createElement('a')
  a.href = url
  a.download = `adnify-settings-${new Date().toISOString().split('T')[0]}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
