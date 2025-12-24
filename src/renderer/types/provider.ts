/**
 * LLM Provider 类型定义
 * 
 * ⚠️ 配置数据已迁移到 @/shared/config/providers.ts
 * 此文件仅保留渲染进程专用的类型定义
 */

import type { LLMAdapterConfig } from '@/shared/config/providers'

// ============ Provider 设置类型 ============

/** 单个 Provider 的用户配置 */
export interface ProviderModelConfig {
	enabledModels?: string[]   // 启用的内置模型
	customModels: string[]     // 用户添加的模型
	baseUrl?: string           // 自定义端点
	apiKey?: string            // API Key
	timeout?: number           // 请求超时
	adapterId?: string         // 适配器 ID
	adapterConfig?: LLMAdapterConfig  // 适配器配置
	model?: string             // 当前选择的模型
}

/** 所有 Provider 设置 */
export interface ProviderSettings {
	configs: Record<string, ProviderModelConfig>
}

// ============ 模型选择类型 ============

/** 模型选择 */
export interface ModelSelection {
	providerType: 'builtin' | 'custom'
	providerName: string
	modelName: string
}

/** 功能类型 */
export type FeatureName = 'chat' | 'agent' | 'autocomplete' | 'apply'

/** 各功能的模型选择 */
export type ModelSelectionOfFeature = Record<FeatureName, ModelSelection | null>

// ============ 自定义 Provider 类型 ============

/** 自定义 Provider 配置（用于完全自定义的 API 端点） */
export interface CustomProviderConfig {
	id: string
	name: string
	displayName: string
	endpoint: string
	apiKey?: string
	models: string[]
	requestTemplate: {
		method: 'POST'
		headers: Record<string, string>
		bodyTemplate: string
	}
	responseParser: {
		contentPath: string
		streamFormat: 'sse' | 'ndjson' | 'none'
		streamContentPath?: string
	}
}
