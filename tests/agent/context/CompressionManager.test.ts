/**
 * CompressionManager 测试
 * 
 * 测试图片占位符和 token 估算
 */

import { describe, it, expect } from 'vitest'
import { prepareMessages, estimateMessagesTokens, estimateTokens } from '@renderer/agent/context/CompressionManager'
import type { UserMessage, AssistantMessage } from '@renderer/agent/types'

describe('CompressionManager - Image Handling', () => {
  it('should replace images with placeholder in history messages but keep current message', () => {
    const messages = [
      {
        id: 'user-1',
        role: 'user',
        content: [
          { type: 'text', text: 'Look at this image' },
          { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'very-long-base64-string...' } }
        ],
        timestamp: Date.now(),
      } as UserMessage,
      {
        id: 'assistant-1',
        role: 'assistant',
        content: 'I see the image',
        timestamp: Date.now(),
        parts: [{ type: 'text', content: 'I see the image' }],
      } as AssistantMessage,
      {
        id: 'user-2',
        role: 'user',
        content: [
          { type: 'text', text: 'What about this one?' },
          { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'another-base64...' } }
        ],
        timestamp: Date.now(),
      } as UserMessage,
    ]

    const result = prepareMessages(messages, 0)
    
    // 第一条历史消息的图片应该被替换为占位符
    const firstMsg = result.messages[0] as UserMessage
    expect(Array.isArray(firstMsg.content)).toBe(true)
    if (Array.isArray(firstMsg.content)) {
      expect(firstMsg.content.some(p => p.type === 'image')).toBe(false)
      expect(firstMsg.content.some(p => p.type === 'text' && p.text?.includes('Previously analyzed'))).toBe(true)
    }
    
    // 最后一条消息（当前消息）的图片应该保留
    const lastMsg = result.messages[2] as UserMessage
    expect(Array.isArray(lastMsg.content)).toBe(true)
    if (Array.isArray(lastMsg.content)) {
      expect(lastMsg.content.some(p => p.type === 'image')).toBe(true)
      expect(lastMsg.content.some(p => p.type === 'text' && p.text === 'What about this one?')).toBe(true)
    }
  })

  it('should estimate image tokens correctly (not by base64 length)', () => {
    const messagesWithImage = [
      {
        id: 'user-1',
        role: 'user',
        content: [
          { type: 'text', text: 'Short text' },
          { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'x'.repeat(50000) } }
        ],
        timestamp: Date.now(),
      } as UserMessage,
    ]

    const tokens = estimateMessagesTokens(messagesWithImage)
    
    // 应该是文本 token + 固定的图片 token (1600)
    // 而不是 50000+ 的 base64 字符
    expect(tokens).toBeLessThan(2000)
    expect(tokens).toBeGreaterThan(1600)
  })

  it('should not modify messages without images (performance optimization)', () => {
    const messages = [
      {
        id: 'user-1',
        role: 'user',
        content: 'Just text',
        timestamp: Date.now(),
      } as UserMessage,
      {
        id: 'assistant-1',
        role: 'assistant',
        content: 'Response',
        timestamp: Date.now(),
        parts: [{ type: 'text', content: 'Response' }],
      } as AssistantMessage,
    ]

    const result = prepareMessages(messages, 0)
    
    // 没有图片时，应该保持原对象引用（性能优化）
    expect(result.messages[0]).toBe(messages[0])
    expect(result.messages[1]).toBe(messages[1])
  })

  it('should keep image in first message when it is the only message', () => {
    const messages = [
      {
        id: 'user-1',
        role: 'user',
        content: [
          { type: 'text', text: 'First message with image' },
          { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'base64-data...' } }
        ],
        timestamp: Date.now(),
      } as UserMessage,
    ]

    const result = prepareMessages(messages, 0)
    
    // 第一条消息如果是唯一的消息（当前消息），应该保留图片
    const firstMsg = result.messages[0] as UserMessage
    expect(Array.isArray(firstMsg.content)).toBe(true)
    if (Array.isArray(firstMsg.content)) {
      expect(firstMsg.content.some(p => p.type === 'image')).toBe(true)
    }
  })
})

describe('CompressionManager - Token Estimation', () => {
  it('should estimate English text tokens', () => {
    const text = 'Hello world, this is a test message.'
    const tokens = estimateTokens(text)
    
    // 英文约 4 字符 = 1 token
    expect(tokens).toBeGreaterThan(0)
    expect(tokens).toBeLessThan(text.length)
    expect(tokens).toBeCloseTo(text.length / 4, 2)
  })

  it('should estimate Chinese text tokens with higher ratio', () => {
    const chinese = '你好世界，这是一个测试消息。'
    const tokens = estimateTokens(chinese)
    
    // 中文约 1.5 字符 = 1 token（比英文占用更多）
    expect(tokens).toBeGreaterThan(chinese.length / 4)
    // 允许一定误差范围
    expect(tokens).toBeGreaterThanOrEqual(Math.floor(chinese.length / 1.5) - 1)
    expect(tokens).toBeLessThanOrEqual(Math.ceil(chinese.length / 1.5) + 1)
  })

  it('should estimate mixed language text tokens', () => {
    const mixed = 'Hello 你好 World 世界'
    const tokens = estimateTokens(mixed)
    
    // 混合文本应该正确计算
    expect(tokens).toBeGreaterThan(0)
    expect(tokens).toBeLessThan(mixed.length)
  })

  it('should handle empty string', () => {
    expect(estimateTokens('')).toBe(0)
    expect(estimateTokens(null as any)).toBe(0)
    expect(estimateTokens(undefined as any)).toBe(0)
  })
})
