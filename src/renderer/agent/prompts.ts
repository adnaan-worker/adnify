/**
 * Agent 提示词系统
 * 基于新的提示词模板系统，支持多模板切换和预览
 */

import { ChatMode } from '@store'
import { rulesService } from './rulesService'
import { useAgentStore } from './core/AgentStore'
import { FILE_LIMITS } from '@shared/constants'

// Search/Replace 块格式 - 从统一模块导入
export {
	SEARCH_MARKER as ORIGINAL,
	DIVIDER_MARKER as DIVIDER,
	REPLACE_MARKER as FINAL,
	parseSearchReplaceBlocks,
	applySearchReplaceBlocks,
} from '@utils/searchReplace'

// 限制常量（从共享配置导入）
export const MAX_FILE_CHARS = FILE_LIMITS.MAX_FILE_CHARS
export const MAX_DIR_ITEMS = FILE_LIMITS.MAX_DIR_ITEMS
export const MAX_SEARCH_RESULTS = FILE_LIMITS.MAX_SEARCH_RESULTS
export const MAX_TERMINAL_OUTPUT = FILE_LIMITS.MAX_TERMINAL_OUTPUT
export const MAX_CONTEXT_CHARS = FILE_LIMITS.MAX_CONTEXT_CHARS

/**
 * 主系统提示词构建器
 * 使用新的提示词模板系统
 */
export async function buildSystemPrompt(
	mode: ChatMode,
	workspacePath: string | null,
	options?: {
		openFiles?: string[]
		activeFile?: string
		customInstructions?: string
		promptTemplateId?: string
	}
): Promise<string> {
	const { openFiles = [], activeFile, customInstructions, promptTemplateId } = options || {}

	// 加载项目规则
	const projectRules = await rulesService.getRules()

	// 获取提示词模板
	const { getPromptTemplateById, getDefaultPromptTemplate, PLANNING_TOOLS_DESC } = await import('./promptTemplates')
	const template = promptTemplateId
		? getPromptTemplateById(promptTemplateId) || getDefaultPromptTemplate()
		: getDefaultPromptTemplate()

	// 使用模板的完整系统提示词（新模板已包含工具定义和工作流规范）
	let systemPrompt = template.systemPrompt

	// 动态替换环境信息占位符
	const os = typeof navigator !== 'undefined' ? ((navigator as any).userAgentData?.platform || navigator.platform || 'Unknown') : 'Unknown'
	const date = new Date().toLocaleDateString()

	// 注入 Plan 工具描述（仅在 Plan 模式下）
	const planningTools = mode === 'plan' ? PLANNING_TOOLS_DESC : ''

	systemPrompt = systemPrompt
		.replace('{{PLANNING_TOOLS}}', planningTools)
		.replace('[Determined at runtime]', os)
		.replace('[Current workspace path]', workspacePath || 'No workspace open')
		.replace('[Currently open file]', activeFile || 'None')
		.replace('[List of open files]', openFiles.length > 0 ? openFiles.join(', ') : 'None')
		.replace('[Current date]', date)

	// 项目规则
	if (projectRules?.content) {
		systemPrompt = systemPrompt.replace(
			'[Project-specific rules from .adnify/rules.md or similar]',
			projectRules.content
		)
	}

	// 自定义指令
	if (customInstructions) {
		systemPrompt = systemPrompt.replace(
			'[User-defined custom instructions]',
			customInstructions
		)
	}

	// Agent 模式特定指导（仅在 agent 模式下添加计划管理部分）
	if (mode === 'agent') {
		const store = useAgentStore.getState()
		const plan = store.plan

		if (plan && plan.items.length > 0) {
			const planSection = `\n\n## Current Plan
Status: ${plan.status}

${plan.items.map((item, i) => `${i + 1}. [${item.status === 'completed' ? 'x' : item.status === 'in_progress' ? '/' : item.status === 'failed' ? '!' : ' '}] ${item.title}`).join('\n')}

### 📋 Plan Management
If a plan exists (see "Current Plan" above):
1. Check the current status of plan items
2. After completing a step, use \`update_plan\` to mark it as 'completed'
3. If a step fails, mark it as 'failed'
4. If you need to change the plan, use \`update_plan\` to modify items
5. ALWAYS keep the plan status in sync with your actions`

			systemPrompt += planSection
		}
	}

	// Chat 模式简化（移除工具定义，只保留基本指导）
	if (mode === 'chat') {
		// 移除工具定义部分，保留核心身份和沟通风格
		// 注意：promptTemplates.ts 中定义的是 "## Available Tools"
		const toolsStart = systemPrompt.indexOf('## Available Tools')
		if (toolsStart !== -1) {
			// 找到下一个大章节的开始 (通常是 ## Environment 或 ## Project Rules)
			// 我们尝试找到工具部分之后的第一个 "## "
			// CORE_TOOLS 结尾通常紧接 BASE_SYSTEM_INFO，它以 "## Environment" 开头
			const nextSection = systemPrompt.indexOf('\n\n## Environment', toolsStart)
			if (nextSection !== -1) {
				systemPrompt = systemPrompt.substring(0, toolsStart) + systemPrompt.substring(nextSection)
			} else {
				// 如果没找到 Environment，尝试找任意下一个章节
				const nextAnySection = systemPrompt.indexOf('\n\n## ', toolsStart + 20)
				if (nextAnySection !== -1) {
					systemPrompt = systemPrompt.substring(0, toolsStart) + systemPrompt.substring(nextAnySection)
				} else {
					systemPrompt = systemPrompt.substring(0, toolsStart)
				}
			}
		}
	}

	return systemPrompt.trim()
}

// 用户消息格式化
export function formatUserMessage(
	message: string,
	context?: {
		selections?: Array<{
			type: 'file' | 'code' | 'folder'
			path: string
			content?: string
			range?: [number, number]
		}>
	}
): string {
	let formatted = message

	if (context?.selections && context.selections.length > 0) {
		const selectionsStr = context.selections.map(s => {
			if (s.type === 'code' && s.content && s.range) {
				return `**${s.path}** (lines ${s.range[0]}-${s.range[1]}):\n\`\`\`\n${s.content}\n\`\`\``
			} else if (s.type === 'file' && s.content) {
				return `**${s.path}**:\n\`\`\`\n${s.content}\n\`\`\``
			} else {
				return `**${s.path}**`
			}
		}).join('\n\n')

		formatted += `\n\n---\n**Context:**\n${selectionsStr}`
	}

	return formatted
}

// 工具结果格式化
export function formatToolResult(
	toolName: string,
	result: string,
	success: boolean
): string {
	if (success) {
		return result
	}
	return `Error executing ${toolName}: ${result}`
}