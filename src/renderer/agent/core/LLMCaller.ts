/**
 * LLM 调用器
 * 提取自 AgentService 的 LLM 调用、重试和错误处理逻辑
 */

import { logger } from '@/renderer/utils/Logger'
import { AGENT_DEFAULTS } from '@/shared/constants'

/**
 * LLM 调用配置
 */
export interface LLMCallConfig {
    provider: string
    model: string
    apiKey: string
    baseUrl?: string
    timeout?: number
    maxTokens?: number
    adapterId?: string
    adapterConfig?: import('@/shared/types/llmAdapter').LLMAdapterConfig
}

/**
 * LLM 调用结果
 */
export interface LLMCallResult {
    content?: string
    toolCalls?: import('@/renderer/types/electron').LLMToolCall[]
    error?: string
}

/**
 * 重试配置
 */
export interface RetryConfig {
    maxRetries: number
    retryDelayMs: number
    retryBackoffMultiplier: number
}

/**
 * 可重试的错误码
 */
export const RETRYABLE_ERROR_CODES = new Set([
    'RATE_LIMIT',
    'TIMEOUT',
    'NETWORK_ERROR',
    'SERVER_ERROR',
])

/**
 * 获取重试配置
 */
export function getRetryConfig(): RetryConfig {
    return {
        maxRetries: AGENT_DEFAULTS.MAX_RETRIES,
        retryDelayMs: AGENT_DEFAULTS.RETRY_DELAY_MS,
        retryBackoffMultiplier: AGENT_DEFAULTS.RETRY_BACKOFF_MULTIPLIER,
    }
}

/**
 * 判断错误是否可重试
 */
export function isRetryableError(error: string): boolean {
    return RETRYABLE_ERROR_CODES.has(error) ||
        error.toLowerCase().includes('timeout') ||
        error.toLowerCase().includes('rate limit') ||
        error.toLowerCase().includes('network') ||
        error.toLowerCase().includes('503') ||
        error.toLowerCase().includes('502')
}

/**
 * 判断工具执行错误是否可重试
 */
export function isToolRetryableError(error: string): boolean {
    return error.includes('ENOENT') ||
        error.includes('ETIMEDOUT') ||
        error.includes('ECONNRESET') ||
        error.includes('read timeout') ||
        error.includes('network')
}

/**
 * 带重试的异步操作包装器
 */
export async function withRetry<T>(
    operation: () => Promise<T>,
    config: RetryConfig,
    shouldRetry: (error: any) => boolean,
    onRetry?: (attempt: number, error: any) => void
): Promise<T> {
    let lastError: any
    let delay = config.retryDelayMs

    for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
        try {
            return await operation()
        } catch (error: any) {
            lastError = error

            if (attempt < config.maxRetries && shouldRetry(error)) {
                logger.llm.warn('Operation failed, retrying', {
                    attempt: attempt + 1,
                    maxRetries: config.maxRetries,
                    delay,
                    error: error.message || error
                })

                onRetry?.(attempt + 1, error)
                await sleep(delay)
                delay *= config.retryBackoffMultiplier
            } else {
                throw error
            }
        }
    }

    throw lastError
}

/**
 * 辅助函数：休眠
 */
function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * 计算指数退避延迟
 */
export function calculateBackoffDelay(
    baseDelay: number,
    attempt: number,
    multiplier: number,
    maxDelay: number = 30000
): number {
    const delay = baseDelay * Math.pow(multiplier, attempt)
    return Math.min(delay, maxDelay)
}

/**
 * LLM 错误类型
 */
export enum LLMErrorType {
    RATE_LIMIT = 'RATE_LIMIT',
    TIMEOUT = 'TIMEOUT',
    NETWORK_ERROR = 'NETWORK_ERROR',
    SERVER_ERROR = 'SERVER_ERROR',
    AUTH_ERROR = 'AUTH_ERROR',
    INVALID_REQUEST = 'INVALID_REQUEST',
    CONTEXT_LENGTH = 'CONTEXT_LENGTH',
    UNKNOWN = 'UNKNOWN',
}

/**
 * 解析错误消息以确定错误类型
 */
export function parseErrorType(errorMessage: string): LLMErrorType {
    const msg = errorMessage.toLowerCase()

    if (msg.includes('rate limit') || msg.includes('429')) {
        return LLMErrorType.RATE_LIMIT
    }
    if (msg.includes('timeout')) {
        return LLMErrorType.TIMEOUT
    }
    if (msg.includes('network') || msg.includes('econnreset') || msg.includes('enotfound')) {
        return LLMErrorType.NETWORK_ERROR
    }
    if (msg.includes('502') || msg.includes('503') || msg.includes('504') || msg.includes('server')) {
        return LLMErrorType.SERVER_ERROR
    }
    if (msg.includes('401') || msg.includes('403') || msg.includes('auth') || msg.includes('key')) {
        return LLMErrorType.AUTH_ERROR
    }
    if (msg.includes('400') || msg.includes('invalid')) {
        return LLMErrorType.INVALID_REQUEST
    }
    if (msg.includes('context') || msg.includes('token') || msg.includes('length')) {
        return LLMErrorType.CONTEXT_LENGTH
    }

    return LLMErrorType.UNKNOWN
}

/**
 * 获取错误的用户友好描述
 */
export function getErrorDescription(errorType: LLMErrorType): string {
    switch (errorType) {
        case LLMErrorType.RATE_LIMIT:
            return '请求过于频繁，请稍后再试'
        case LLMErrorType.TIMEOUT:
            return '请求超时，请检查网络连接'
        case LLMErrorType.NETWORK_ERROR:
            return '网络连接错误，请检查网络'
        case LLMErrorType.SERVER_ERROR:
            return 'AI 服务暂时不可用，请稍后再试'
        case LLMErrorType.AUTH_ERROR:
            return 'API 密钥无效或已过期'
        case LLMErrorType.INVALID_REQUEST:
            return '请求格式错误'
        case LLMErrorType.CONTEXT_LENGTH:
            return '对话过长，请开始新对话'
        default:
            return '发生未知错误'
    }
}

/**
 * 判断错误类型是否应该重试
 */
export function shouldRetryErrorType(errorType: LLMErrorType): boolean {
    return [
        LLMErrorType.RATE_LIMIT,
        LLMErrorType.TIMEOUT,
        LLMErrorType.NETWORK_ERROR,
        LLMErrorType.SERVER_ERROR,
    ].includes(errorType)
}
