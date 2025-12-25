/**
 * XML 工具调用解析器
 * 从 AgentService 提取的 XML 格式工具调用解析逻辑
 */

import { parsePartialJson } from '@/renderer/utils/partialJson'
import { logger } from '@/renderer/utils/Logger'

export interface ParsedToolCall {
    id: string
    name: string
    arguments: Record<string, unknown>
}

/**
 * 解析 XML 格式的工具调用
 */
export function parseXMLToolCalls(content: string): ParsedToolCall[] {
    const toolCalls: ParsedToolCall[] = []

    // 匹配 <tool_call>...</tool_call> 块
    const toolCallRegex = /<tool_call>([\s\S]*?)<\/tool_call>/gi
    let toolCallMatch

    while ((toolCallMatch = toolCallRegex.exec(content)) !== null) {
        const toolCallContent = toolCallMatch[1]
        const funcRegex = /<function[=\s]+["']?([^"'>\s]+)["']?\s*>([\s\S]*?)<\/function>/gi
        let funcMatch

        while ((funcMatch = funcRegex.exec(toolCallContent)) !== null) {
            const toolName = funcMatch[1]
            const paramsContent = funcMatch[2]
            const args = parseXMLParameters(paramsContent)

            toolCalls.push({
                id: generateToolCallId('xml'),
                name: toolName,
                arguments: args
            })
        }
    }

    // 支持独立的 <function> 标签
    const standaloneToolCalls = parseStandaloneFunctions(content)
    toolCalls.push(...standaloneToolCalls)

    if (toolCalls.length > 0) {
        logger.tool.debug('Parsed XML tool calls', { count: toolCalls.length })
    }

    return toolCalls
}

/**
 * 解析独立的 <function> 标签
 */
function parseStandaloneFunctions(content: string): ParsedToolCall[] {
    const toolCalls: ParsedToolCall[] = []

    // 收集 tool_call 块的位置范围
    const toolCallRanges: Array<{ start: number; end: number }> = []
    const toolCallBlockRegex = /<tool_call>[\s\S]*?<\/tool_call>/gi
    let blockMatch
    while ((blockMatch = toolCallBlockRegex.exec(content)) !== null) {
        toolCallRanges.push({ start: blockMatch.index, end: blockMatch.index + blockMatch[0].length })
    }

    const standaloneFuncRegex = /<function[=\s]+["']?([^"'>\s]+)["']?\s*>([\s\S]*?)<\/function>/gi
    let standaloneMatch
    while ((standaloneMatch = standaloneFuncRegex.exec(content)) !== null) {
        const matchPos = standaloneMatch.index
        const isInsideToolCall = toolCallRanges.some(range => matchPos >= range.start && matchPos < range.end)
        if (isInsideToolCall) continue

        const toolName = standaloneMatch[1]
        const paramsContent = standaloneMatch[2]
        const args = parseXMLParameters(paramsContent)

        toolCalls.push({
            id: generateToolCallId('xml'),
            name: toolName,
            arguments: args
        })
    }

    return toolCalls
}

/**
 * 解析 XML 参数
 */
function parseXMLParameters(paramsContent: string): Record<string, unknown> {
    const args: Record<string, unknown> = {}
    const paramRegex = /<parameter[=\s]+["']?([^"'>\s]+)["']?\s*>([\s\S]*?)<\/parameter>/gi
    let paramMatch

    while ((paramMatch = paramRegex.exec(paramsContent)) !== null) {
        const paramName = paramMatch[1]
        let paramValue: unknown = paramMatch[2].trim()

        try {
            paramValue = JSON.parse(paramValue as string)
        } catch {
            // 保持字符串格式
        }

        args[paramName] = paramValue
    }

    return args
}

/**
 * 生成工具调用 ID
 */
export function generateToolCallId(prefix: string = 'tool'): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

/**
 * 检测到的流式工具调用
 */
export interface DetectedStreamingToolCall {
    id: string
    name: string
    arguments: Record<string, unknown>
    isClosed: boolean
}

/**
 * 检测流式内容中的 XML 工具调用
 */
export function detectStreamingXMLToolCall(contentBuffer: string): DetectedStreamingToolCall | null {
    const funcStartRegex = /<function[=\s]+["']?([^"'>\s]+)["']?\s*>/gi
    let match
    let lastFunc: { name: string; index: number; fullMatch: string } | null = null

    while ((match = funcStartRegex.exec(contentBuffer)) !== null) {
        lastFunc = {
            name: match[1],
            index: match.index,
            fullMatch: match[0]
        }
    }

    if (!lastFunc) return null

    const remainingContent = contentBuffer.slice(lastFunc.index + lastFunc.fullMatch.length)
    const isClosed = remainingContent.includes('</function>')

    const args: Record<string, unknown> = {}
    const paramRegex = /<parameter[=\s]+["']?([^"'>\s]+)["']?\s*>([\s\S]*?)(?:<\/parameter>|$)/gi
    let paramMatch
    while ((paramMatch = paramRegex.exec(remainingContent)) !== null) {
        const paramName = paramMatch[1]
        let paramValue: string | Record<string, unknown> = paramMatch[2].trim()

        if (paramValue.startsWith('{') || paramValue.startsWith('[')) {
            const parsed = parsePartialJson(paramValue)
            if (parsed) paramValue = parsed
        }

        args[paramName] = paramValue
    }

    const streamingId = `stream-xml-${lastFunc.name}-${lastFunc.index}`

    return {
        id: streamingId,
        name: lastFunc.name,
        arguments: { ...args, _streaming: !isClosed },
        isClosed
    }
}

/**
 * 解析部分 JSON 参数字符串
 */
export function parsePartialArgs(argsString: string): Record<string, unknown> {
    if (!argsString || argsString.length < 2) return {}
    const parsed = parsePartialJson(argsString)
    return (parsed && Object.keys(parsed).length > 0) ? parsed : {}
}

/**
 * 从文本内容中移除 XML 工具调用标记
 */
export function removeXMLToolCallsFromContent(content: string): string {
    return content.replace(/<tool_call>[\s\S]*?<\/tool_call>/gi, '').trim()
}
