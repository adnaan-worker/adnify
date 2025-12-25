/**
 * Provider 基类
 * 提供通用的错误处理和工具方法
 */

import { logger } from '@shared/utils/Logger'
import { LLMProvider, ChatParams, LLMError, LLMErrorCode } from '../types'

export abstract class BaseProvider implements LLMProvider {
  protected name: string

  constructor(name: string) {
    this.name = name
  }

  abstract chat(params: ChatParams): Promise<void>

  /**
   * 解析 API 错误，转换为统一的 LLMError
   */
  protected parseError(error: unknown): LLMError {
    const err = error as {
      message?: string
      status?: number
      statusCode?: number
      code?: string
      name?: string
    }
    const message = err.message || 'Unknown error'
    const status = err.status || err.statusCode

    if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
      return new LLMError(
        'Network error: Unable to connect to API',
        LLMErrorCode.NETWORK_ERROR,
        undefined,
        true
      )
    }

    if (err.code === 'ETIMEDOUT' || err.name === 'TimeoutError') {
      return new LLMError('Request timeout', LLMErrorCode.TIMEOUT, undefined, true)
    }

    if (err.name === 'AbortError') {
      return new LLMError('Request aborted', LLMErrorCode.ABORTED, undefined, false)
    }

    if (status) {
      switch (status) {
        case 401:
          return new LLMError('Invalid API key', LLMErrorCode.INVALID_API_KEY, status, false)
        case 429:
          return new LLMError(
            'Rate limit exceeded. Please try again later.',
            LLMErrorCode.RATE_LIMIT,
            status,
            true
          )
        case 402:
        case 403:
          return new LLMError(
            'Quota exceeded or access denied',
            LLMErrorCode.QUOTA_EXCEEDED,
            status,
            false
          )
        case 404:
          return new LLMError(
            'Model not found or invalid endpoint',
            LLMErrorCode.MODEL_NOT_FOUND,
            status,
            false
          )
        case 400:
          if (message.includes('context') || message.includes('token')) {
            return new LLMError(
              'Context length exceeded. Try reducing the conversation history.',
              LLMErrorCode.CONTEXT_LENGTH_EXCEEDED,
              status,
              false
            )
          }
          return new LLMError(
            `Invalid request: ${message}`,
            LLMErrorCode.INVALID_REQUEST,
            status,
            false
          )
        case 500:
        case 502:
        case 503:
          return new LLMError('Server error. Please try again.', LLMErrorCode.UNKNOWN, status, true)
      }
    }

    return new LLMError(message, LLMErrorCode.UNKNOWN, status, false, error)
  }

  /**
   * 日志输出
   */
  protected log(level: 'info' | 'warn' | 'error', message: string, data?: unknown) {
    const prefix = `[${this.name}]`
    switch (level) {
      case 'info':
        logger.system.info(prefix, message, data || '')
        break
      case 'warn':
        logger.system.warn(prefix, message, data || '')
        break
      case 'error':
        logger.system.error(prefix, message, data || '')
        break
    }
  }
}
