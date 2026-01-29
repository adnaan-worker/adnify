/**
 * Token 计数工具（使用 js-tiktoken 精确计算）
 * 
 * 统一的 token 计数接口，支持：
 * - 文本 token 计数
 * - 消息 token 计数（包含结构开销）
 * - 图片 token 计数
 * - 工具调用 token 计数
 */

import { Tiktoken, getEncoding } from 'js-tiktoken'

// ===== 类型定义 =====

export interface TokenCountOptions {
  model?: string
}

export interface MessageTokenCountOptions extends TokenCountOptions {
  includeSystemPrompt?: boolean
}

// ===== 编码器缓存 =====

let cachedEncoder: Tiktoken | null = null

/**
 * 获取编码器（带缓存）
 */
function getEncoder(): Tiktoken {
  if (!cachedEncoder) {
    // cl100k_base 用于 GPT-4, GPT-3.5-turbo, Claude 等
    cachedEncoder = getEncoding('cl100k_base')
  }
  return cachedEncoder
}

/**
 * 释放编码器资源（可选，通常不需要手动调用）
 */
export function freeEncoder(): void {
  cachedEncoder = null
}

// ===== 核心函数 =====

/**
 * 计算文本的 token 数量（精确）
 * 
 * @param text - 要计算的文本
 * @returns token 数量
 */
export function countTokens(text: string): number {
  if (!text) return 0
  
  try {
    const encoder = getEncoder()
    const tokens = encoder.encode(text)
    return tokens.length
  } catch (error) {
    // 降级到简单估算
    console.warn('[TokenCounter] Encoding failed, using fallback:', error)
    return estimateTokensFallback(text)
  }
}

/**
 * 计算消息内容的 token 数量
 * 
 * 支持：
 * - 纯文本字符串
 * - 结构化内容（文本 + 图片）
 * 
 * @param content - 消息内容
 * @returns token 数量
 */
export function countContentTokens(
  content: string | Array<{ type: string; text?: string; source?: unknown }>
): number {
  if (typeof content === 'string') {
    return countTokens(content)
  }
  
  let total = 0
  for (const part of content) {
    switch (part.type) {
      case 'text':
        if (part.text) {
          total += countTokens(part.text)
        }
        break
      
      case 'image':
        // Anthropic 图片 token 计算：
        // 实际公式：(width × height) / 750
        // 范围：258 - 1600 tokens
        // 由于无法获取实际尺寸，使用保守估计
        total += 1600
        break
      
      case 'tool_use':
      case 'tool_result':
        total += countTokens(JSON.stringify(part))
        break
      
      default:
        total += countTokens(JSON.stringify(part))
    }
  }
  
  return total
}

/**
 * 计算消息列表的 token 数量（包含结构开销）
 * 
 * 参考 OpenAI 官方文档：
 * - 每条消息固定开销：~4 tokens
 * - 每个字段（role, content, name）：~1 token
 * - 对话开始/结束：~3 tokens
 * 
 * @param messages - 消息列表
 * @returns token 数量
 */
export function countMessagesTokens(
  messages: Array<{
    role: string
    content?: string | Array<{ type: string; text?: string; source?: unknown }>
    name?: string
    tool_calls?: Array<{ id: string; name: string; arguments: unknown }>
    tool_call_id?: string
  }>
): number {
  let total = 3 // 对话开始/结束的固定开销
  
  for (const msg of messages) {
    total += 4 // 每条消息的固定开销
    
    // role
    total += countTokens(msg.role)
    
    // content
    if (msg.content) {
      total += countContentTokens(msg.content)
    }
    
    // name
    if (msg.name) {
      total += countTokens(msg.name)
    }
    
    // tool_calls
    if (msg.tool_calls) {
      for (const tc of msg.tool_calls) {
        total += countTokens(tc.name)
        total += countTokens(JSON.stringify(tc.arguments))
        total += 3 // 工具调用结构开销
      }
    }
    
    // tool_call_id
    if (msg.tool_call_id) {
      total += countTokens(msg.tool_call_id)
    }
  }
  
  return total
}

// ===== 降级方案 =====

/**
 * 简单估算（降级方案）
 * 
 * 当 tiktoken 失败时使用
 */
function estimateTokensFallback(text: string): number {
  if (!text) return 0
  
  // 统计中文字符
  const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length
  const totalChars = text.length
  const nonChineseChars = totalChars - chineseChars
  
  // 中文按 1.5 字符/token，其他按 4 字符/token
  return Math.ceil(chineseChars / 1.5 + nonChineseChars / 4)
}
