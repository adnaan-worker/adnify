/**
 * Model Factory - 统一创建各协议的 LLM model 实例
 *
 * 使用 Vercel AI SDK，根据 provider 配置创建对应的 model
 */

import { createOpenAI } from '@ai-sdk/openai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import type { LanguageModel } from 'ai'
import type { LLMConfig } from '@shared/types/llm'
import { BUILTIN_PROVIDERS, isBuiltinProvider } from '@shared/config/providers'

export interface ModelOptions {
    enableThinking?: boolean
}

/**
 * 根据配置创建 AI SDK model 实例
 */
export function createModel(config: LLMConfig, options: ModelOptions = {}): LanguageModel {
    const { provider, model, apiKey, baseUrl } = config

    // 内置 provider
    if (isBuiltinProvider(provider)) {
        return createBuiltinModel(provider, model, apiKey, baseUrl, options)
    }

    // 自定义 provider - 根据 protocol 选择
    const protocol = config.protocol || 'openai'
    return createCustomModel(protocol, model, apiKey, baseUrl, options)
}

/**
 * 创建内置 provider 的 model
 */
function createBuiltinModel(
    providerId: string,
    model: string,
    apiKey: string,
    baseUrl?: string,
    _options: ModelOptions = {}
): LanguageModel {
    const providerDef = BUILTIN_PROVIDERS[providerId]
    if (!providerDef) {
        throw new Error(`Unknown builtin provider: ${providerId}`)
    }

    // 如果用户自定义了 baseUrl 且不是默认值，使用 OpenAI Compatible 模式
    // 这样可以兼容各种 OpenAI-compatible 的 API（如 NVIDIA、智谱等）
    const isCustomBaseUrl = baseUrl && baseUrl !== providerDef.baseUrl
    
    if (isCustomBaseUrl) {
        console.log(`[ModelFactory] Using OpenAI Compatible mode for custom baseUrl: ${baseUrl}`)
        const provider = createOpenAICompatible({
            name: `${providerId}-custom`,
            apiKey,
            baseURL: baseUrl,
        })
        return provider(model)
    }

    switch (providerId) {
        case 'openai': {
            const openai = createOpenAI({
                apiKey,
                baseURL: baseUrl || providerDef.baseUrl,
            })
            // ⚠️ 必须使用 .chat() 确保使用 Chat Completions API (/v1/chat/completions)
            // 直接调用 openai(model) 会使用 Responses API (/v1/responses)
            return openai.chat(model)
        }

        case 'anthropic': {
            const anthropic = createAnthropic({
                apiKey,
                baseURL: baseUrl || undefined,
            })
            // Anthropic 直接调用就是 messages API，无需 .chat()
            return anthropic(model)
        }

        case 'gemini': {
            const google = createGoogleGenerativeAI({
                apiKey,
                baseURL: baseUrl || undefined,
            })
            // Google 直接调用就是 generateContent API，无需 .chat()
            return google(model)
        }

        default:
            throw new Error(`Unsupported builtin provider: ${providerId}`)
    }
}

/**
 * 创建自定义 provider 的 model
 */
function createCustomModel(
    protocol: string,
    model: string,
    apiKey: string,
    baseUrl?: string,
    _options: ModelOptions = {}
): LanguageModel {
    if (!baseUrl) {
        throw new Error('Custom provider requires baseUrl')
    }

    switch (protocol) {
        case 'openai': {
            const provider = createOpenAICompatible({
                name: 'custom-openai',
                apiKey,
                baseURL: baseUrl,
            })
            return provider(model)
        }

        case 'anthropic': {
            const anthropic = createAnthropic({
                apiKey,
                baseURL: baseUrl,
            })
            return anthropic(model)
        }

        case 'gemini': {
            const google = createGoogleGenerativeAI({
                apiKey,
                baseURL: baseUrl,
            })
            return google(model)
        }

        default: {
            const fallback = createOpenAICompatible({
                name: 'custom',
                apiKey,
                baseURL: baseUrl,
            })
            return fallback(model)
        }
    }
}
