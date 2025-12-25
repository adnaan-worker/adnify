/**
 * Agent 循环控制器
 * 从 AgentService 提取的主循环逻辑
 */

import { logger } from '@/renderer/utils/Logger'
import { useAgentStore } from './AgentStore'
import { useStore, ChatMode } from '../../store'
import { OpenAIMessage } from './MessageConverter'
import { LLMToolCall } from '@/renderer/types/electron'
import { READ_ONLY_TOOLS } from '@/shared/constants'
import { AGENT_DEFAULTS } from '@/shared/constants'

/**
 * Agent 循环配置
 */
export interface AgentLoopConfig {
    maxToolLoops: number
    maxConsecutiveRepeats: number
    maxRecentCalls: number
}

/**
 * 循环上下文
 */
export interface LoopContext {
    config: import('./AgentService').LLMCallConfig
    messages: OpenAIMessage[]
    workspacePath: string | null
    chatMode: ChatMode
    assistantId: string
    abortSignal?: AbortSignal
}

/**
 * 工具执行器接口
 */
export interface ToolExecutorFn {
    (toolCall: LLMToolCall, workspacePath: string | null): Promise<{
        success: boolean
        content: string
        rejected: boolean
    }>
}

/**
 * LLM 调用器接口
 */
export interface LLMCallerFn {
    (config: import('./AgentService').LLMCallConfig, messages: OpenAIMessage[], chatMode: ChatMode): Promise<{
        content?: string
        toolCalls?: LLMToolCall[]
        error?: string
    }>
}

/**
 * 获取默认循环配置
 */
export function getLoopConfig(): AgentLoopConfig {
    const agentConfig = useStore.getState().agentConfig || {}
    return {
        maxToolLoops: agentConfig.maxToolLoops ?? AGENT_DEFAULTS.MAX_TOOL_LOOPS,
        maxConsecutiveRepeats: 2,
        maxRecentCalls: 5,
    }
}

/**
 * 检测重复工具调用
 */
export function detectRepetition(
    toolCalls: LLMToolCall[],
    recentCalls: string[],
    config: AgentLoopConfig
): { isRepeating: boolean; signature: string } {
    const signature = toolCalls
        .map(tc => `${tc.name}:${JSON.stringify(tc.arguments)}`)
        .sort()
        .join('|')

    const isRepeating = recentCalls.includes(signature)

    return { isRepeating, signature }
}

/**
 * 分离只读和写入工具
 */
export function separateToolCalls(toolCalls: LLMToolCall[]): {
    readTools: LLMToolCall[]
    writeTools: LLMToolCall[]
} {
    const readTools = toolCalls.filter(tc => READ_ONLY_TOOLS.includes(tc.name))
    const writeTools = toolCalls.filter(tc => !READ_ONLY_TOOLS.includes(tc.name))
    return { readTools, writeTools }
}

/**
 * 并行执行只读工具
 */
export async function executeReadToolsParallel(
    toolCalls: LLMToolCall[],
    executor: ToolExecutorFn,
    workspacePath: string | null
): Promise<Array<{ toolCall: LLMToolCall; result: { success: boolean; content: string; rejected: boolean } }>> {
    logger.agent.info('Executing read tools in parallel', { count: toolCalls.length })

    const results = await Promise.all(
        toolCalls.map(async (toolCall) => {
            try {
                const result = await executor(toolCall, workspacePath)
                return { toolCall, result }
            } catch (error: any) {
                logger.tool.error('Error executing read tool', { name: toolCall.name, error })
                return {
                    toolCall,
                    result: { success: false, content: `Error: ${error.message}`, rejected: false }
                }
            }
        })
    )

    return results
}

/**
 * 串行执行写入工具
 */
export async function executeWriteToolsSerial(
    toolCalls: LLMToolCall[],
    executor: ToolExecutorFn,
    workspacePath: string | null,
    abortSignal?: AbortSignal,
    onUserRejected?: () => void
): Promise<Array<{ toolCall: LLMToolCall; result: { success: boolean; content: string; rejected: boolean } }>> {
    const results: Array<{ toolCall: LLMToolCall; result: { success: boolean; content: string; rejected: boolean } }> = []

    for (const toolCall of toolCalls) {
        if (abortSignal?.aborted) break

        // 微任务断点：保持 UI 响应
        await new Promise(resolve => setTimeout(resolve, 0))

        logger.tool.debug('Executing write tool', { name: toolCall.name })

        let result
        try {
            result = await executor(toolCall, workspacePath)
        } catch (error: any) {
            logger.tool.error('Error executing write tool', { name: toolCall.name, error })
            result = { success: false, content: `Error: ${error.message}`, rejected: false }
        }

        results.push({ toolCall, result })

        if (result.rejected) {
            onUserRejected?.()
            break
        }
    }

    return results
}

/**
 * 将工具结果添加到消息历史
 */
export function appendToolResults(
    messages: OpenAIMessage[],
    results: Array<{ toolCall: LLMToolCall; result: { content: string } }>
): void {
    for (const { toolCall, result } of results) {
        messages.push({
            role: 'tool' as const,
            tool_call_id: toolCall.id,
            content: result.content,
        })
    }
}

/**
 * 检查是否有白名单错误
 */
export function checkWhitelistError(): boolean {
    const store = useAgentStore.getState()
    const recentMessages = store.getMessages()
    return recentMessages.some(msg =>
        msg.role === 'tool' && (msg.content.includes('whitelist') || msg.content.includes('白名单'))
    )
}
