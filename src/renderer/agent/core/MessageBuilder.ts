/**
 * 消息构建器
 * 从 AgentService 提取的消息构建逻辑
 */

import { useAgentStore } from './AgentStore'
import { useStore } from '@store'
import { buildOpenAIMessages, validateOpenAIMessages, OpenAIMessage } from './MessageConverter'
import { truncateToolResult } from '@/renderer/utils/partialJson'
import { logger } from '@/renderer/utils/Logger'
import { MessageContent, TextContent, ContextItem } from './types'
import { executeTool } from './ToolExecutor'
import { AGENT_DEFAULTS } from '@/shared/constants'

/**
 * 消息构建配置
 */
export interface MessageBuilderConfig {
    maxHistoryMessages: number
    maxToolResultChars: number
    maxFileContentChars: number
    maxTotalContextChars: number
}

/**
 * 获取默认配置
 */
export function getMessageBuilderConfig(): MessageBuilderConfig {
    const agentConfig = useStore.getState().agentConfig || {}
    return {
        maxHistoryMessages: agentConfig.maxHistoryMessages ?? 50,
        maxToolResultChars: agentConfig.maxToolResultChars ?? 10000,
        maxFileContentChars: agentConfig.maxFileContentChars ?? AGENT_DEFAULTS.MAX_FILE_CONTENT_CHARS,
        maxTotalContextChars: agentConfig.maxTotalContextChars ?? 50000,
    }
}

/**
 * 构建发送给 LLM 的消息
 */
export async function buildLLMMessages(
    currentMessage: MessageContent,
    contextContent: string,
    systemPrompt: string
): Promise<OpenAIMessage[]> {
    const store = useAgentStore.getState()
    const historyMessages = store.getMessages()
    const config = getMessageBuilderConfig()

    // 导入压缩模块
    const { shouldCompactContext, prepareMessagesForCompact, createCompactedSystemMessage } = await import('./ContextCompressor')

    // 过滤 checkpoint 消息
    type NonCheckpointMessage = Exclude<typeof historyMessages[number], { role: 'checkpoint' }>
    let filteredMessages: NonCheckpointMessage[] = historyMessages.filter(
        (m): m is NonCheckpointMessage => m.role !== 'checkpoint'
    )
    let compactedSummary: string | null = null

    if (shouldCompactContext(filteredMessages)) {
        logger.agent.info('Context exceeds threshold, compacting')

        const existingSummary = (store as any).contextSummary
        if (existingSummary) {
            compactedSummary = existingSummary
            const { recentMessages } = prepareMessagesForCompact(filteredMessages as any)
            filteredMessages = recentMessages as NonCheckpointMessage[]
        } else {
            filteredMessages = filteredMessages.slice(-config.maxHistoryMessages)
        }
    } else {
        filteredMessages = filteredMessages.slice(-config.maxHistoryMessages)
    }

    // 构建系统提示词
    const effectiveSystemPrompt = compactedSummary
        ? `${systemPrompt}\n\n${createCompactedSystemMessage(compactedSummary)}`
        : systemPrompt

    // 转换为 OpenAI 格式
    const openaiMessages = buildOpenAIMessages(filteredMessages as any, effectiveSystemPrompt)

    // 截断过长的工具结果
    for (const msg of openaiMessages) {
        if (msg.role === 'tool' && typeof msg.content === 'string') {
            if (msg.content.length > config.maxToolResultChars) {
                msg.content = truncateToolResult(msg.content, 'default', config.maxToolResultChars)
            }
        }
    }

    // 添加用户消息
    const userContent = buildUserContent(currentMessage, contextContent)
    openaiMessages.push({ role: 'user', content: userContent })

    // 验证消息格式
    const validation = validateOpenAIMessages(openaiMessages)
    if (!validation.valid) {
        logger.agent.warn('Message validation warning', { error: validation.error })
    }

    // 调试日志: 计算总字符数
    const totalChars = openaiMessages.reduce((sum, msg) => {
        if (typeof msg.content === 'string') return sum + msg.content.length
        if (Array.isArray(msg.content)) {
            return sum + msg.content.reduce((s, c) => s + (c.type === 'text' ? c.text?.length || 0 : 0), 0)
        }
        return sum
    }, 0)
    logger.agent.info('buildLLMMessages result', {
        messageCount: openaiMessages.length,
        totalChars,
        historyCount: historyMessages.length,
        filteredCount: filteredMessages.length
    })

    return openaiMessages
}

/**
 * 构建用户消息内容
 */
export function buildUserContent(message: MessageContent, contextContent: string): MessageContent {
    if (!contextContent) return message

    const contextPart: TextContent = {
        type: 'text',
        text: `## Referenced Context\n${contextContent}\n\n## User Request\n`
    }

    if (typeof message === 'string') {
        return [contextPart, { type: 'text', text: message }]
    } else {
        return [contextPart, ...message]
    }
}

/**
 * 构建上下文内容
 */
export async function buildContextContent(
    contextItems: ContextItem[],
    workspacePath: string | null,
    userQuery?: string
): Promise<string> {
    if (!contextItems || contextItems.length === 0) return ''

    const config = getMessageBuilderConfig()
    const parts: string[] = []
    let totalChars = 0

    for (const item of contextItems) {
        if (totalChars >= config.maxTotalContextChars) {
            parts.push('\n[Additional context truncated]')
            break
        }

        try {
            const result = await processContextItem(item, workspacePath, userQuery, config)
            if (result) {
                parts.push(result)
                totalChars += result.length
            }
        } catch (e) {
            logger.agent.error('Failed to process context item', { type: item.type, error: e })
        }
    }

    return parts.join('')
}

/**
 * 处理单个上下文项目
 */
async function processContextItem(
    item: ContextItem,
    workspacePath: string | null,
    userQuery: string | undefined,
    config: MessageBuilderConfig
): Promise<string | null> {
    switch (item.type) {
        case 'File': {
            const filePath = (item as { uri: string }).uri
            const content = await window.electronAPI.readFile(filePath)
            if (!content) return null

            const truncated = content.length > config.maxFileContentChars
                ? content.slice(0, config.maxFileContentChars) + '\n...(file truncated)'
                : content
            return `\n### File: ${filePath}\n\`\`\`\n${truncated}\n\`\`\`\n`
        }

        case 'Codebase': {
            if (!workspacePath || !userQuery) return null
            const cleanQuery = userQuery.replace(/@codebase\s*/i, '').trim() || userQuery
            const results = await window.electronAPI.indexSearch(workspacePath, cleanQuery, 20)

            if (!results || results.length === 0) {
                return '\n[No relevant codebase results found]\n'
            }

            return `\n### Codebase Search Results for "${cleanQuery}":\n` +
                results.map(r => `#### ${r.relativePath} (Score: ${r.score.toFixed(2)})\n\`\`\`${r.language}\n${r.content}\n\`\`\``).join('\n\n') + '\n'
        }

        case 'Web': {
            if (!userQuery) return null
            const cleanQuery = userQuery.replace(/@web\s*/i, '').trim() || userQuery
            const searchResult = await executeTool('web_search', { query: cleanQuery }, workspacePath || undefined)

            if (searchResult.success) {
                return `\n### Web Search Results for "${cleanQuery}":\n${searchResult.result}\n`
            }
            return `\n[Web search failed: ${searchResult.error}]\n`
        }

        case 'Git': {
            if (!workspacePath) return null
            const gitStatus = await executeTool('run_command', {
                command: 'git status --short && git log --oneline -5',
                cwd: workspacePath,
                timeout: 10
            }, workspacePath)

            if (gitStatus.success) {
                return `\n### Git Status:\n\`\`\`\n${gitStatus.result}\n\`\`\`\n`
            }
            return '\n[Git info not available]\n'
        }

        case 'Terminal': {
            const terminalOutput = await executeTool('get_terminal_output', {
                terminal_id: 'default',
                lines: 50
            }, workspacePath || undefined)

            if (terminalOutput.success && terminalOutput.result) {
                return `\n### Recent Terminal Output:\n\`\`\`\n${terminalOutput.result}\n\`\`\`\n`
            }
            return '\n[No terminal output available]\n'
        }

        case 'Symbols': {
            if (!workspacePath) return null
            const currentFile = useStore.getState().activeFilePath

            if (!currentFile) {
                return '\n[No active file for symbols]\n'
            }

            const symbols = await executeTool('get_document_symbols', {
                path: currentFile
            }, workspacePath)

            if (symbols.success && symbols.result) {
                return `\n### Symbols in ${currentFile}:\n\`\`\`\n${symbols.result}\n\`\`\`\n`
            }
            return '\n[No symbols found]\n'
        }

        default:
            return null
    }
}

/**
 * 更新上下文统计信息
 */
export function updateContextStats(
    contextItems: ContextItem[],
    totalChars: number,
    config: MessageBuilderConfig
): void {
    const agentMessages = useAgentStore.getState().getMessages()
    const fileCount = contextItems.filter(item => item.type === 'File').length
    const semanticResultCount = contextItems.filter(item => item.type === 'Codebase').length

    useStore.getState().setContextStats({
        totalChars,
        maxChars: config.maxTotalContextChars,
        fileCount,
        maxFiles: 10,
        messageCount: agentMessages.length,
        maxMessages: config.maxHistoryMessages,
        semanticResultCount,
        terminalChars: 0
    })
}
