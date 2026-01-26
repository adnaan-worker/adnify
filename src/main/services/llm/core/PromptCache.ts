/**
 * Prompt Caching 配置
 * 支持 Anthropic 和 OpenAI 的 prompt caching
 */

import type { ModelMessage } from '@ai-sdk/provider-utils'

export interface CacheConfig {
  enabled: boolean
  provider: 'anthropic' | 'openai' | 'custom'
}

/**
 * 为消息添加缓存标记
 * Anthropic: 使用 cache_control
 * OpenAI: 自动缓存（无需配置）
 */
export function applyCaching(
  messages: ModelMessage[],
  config: CacheConfig
): ModelMessage[] {
  if (!config.enabled || messages.length === 0) {
    return messages
  }

  // Anthropic Prompt Caching
  if (config.provider === 'anthropic') {
    return messages.map((msg, index) => {
      // 缓存 system 消息和前面的消息
      if (msg.role === 'system' || index < messages.length - 2) {
        return {
          ...msg,
          experimental_providerMetadata: {
            anthropic: {
              cacheControl: { type: 'ephemeral' },
            },
          },
        }
      }
      return msg
    })
  }

  // OpenAI 自动缓存，无需配置
  return messages
}

/**
 * 获取缓存配置
 */
export function getCacheConfig(provider: string): CacheConfig {
  return {
    enabled: true,
    provider: provider === 'anthropic' ? 'anthropic' : 'openai',
  }
}
