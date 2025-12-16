/**
 * Agent 提示词系统
 * 参考 Cursor, Windsurf, Void 等优秀 AI 编辑器的设计
 */

import { ChatMode } from '../store'
import { rulesService } from './rulesService'

// Search/Replace 块格式 (与 tools.ts 保持一致)
export const ORIGINAL = '<<<SEARCH'
export const DIVIDER = '==='
export const FINAL = '>>>'

// 限制常量（与 editorConfig.ts 保持一致）
export const MAX_FILE_CHARS = 60000
export const MAX_DIR_ITEMS = 150
export const MAX_SEARCH_RESULTS = 30
export const MAX_TERMINAL_OUTPUT = 3000
export const MAX_CONTEXT_CHARS = 30000

// Search/Replace 块模板
const searchReplaceBlockTemplate = `\
<<<SEARCH
// ... original code goes here
===
// ... updated code goes here
>>>`

// 工具描述
const toolDescriptions = {
	read_file: `Read the contents of a file. Returns the full file content with line numbers.
Parameters:
- path (required): The absolute or relative path to the file
- start_line (optional): Starting line number (1-indexed)
- end_line (optional): Ending line number
- page (optional): Page number for large files`,

	list_directory: `List files and folders in a directory.
Parameters:
- path (required): The directory path
- page (optional): Page number for pagination`,

	get_dir_tree: `Get a recursive tree view of a directory structure. Useful for understanding project layout.
Parameters:
- path (required): The root directory path
- max_depth (optional): Maximum depth to traverse (default: 3, max: 5)`,

	search_files: `Search for text or regex pattern across files in a directory.
Parameters:
- path (required): Directory to search in
- pattern (required): Text or regex pattern to search
- is_regex (optional): Whether pattern is regex (default: false)
- file_pattern (optional): File name filter (e.g., "*.ts")
- page (optional): Page number`,

	search_in_file: `Search for pattern within a specific file. Returns matching line numbers.
Parameters:
- path (required): File path to search in
- pattern (required): Text or regex pattern
- is_regex (optional): Whether pattern is regex`,

	edit_file: `Edit a file using SEARCH/REPLACE blocks. This is the PREFERRED method for making changes.
Parameters:
- path (required): File path to edit
- search_replace_blocks (required): String containing SEARCH/REPLACE blocks

Format:
${searchReplaceBlockTemplate}

Guidelines:
1. SEARCH block must EXACTLY match existing code (including whitespace and indentation)
2. Each SEARCH block must be unique in the file
3. You can use multiple <<<SEARCH...===...>>> blocks for multiple changes
4. Keep SEARCH blocks as small as possible while being unique
5. Include enough context lines to make the match unique`,

	write_file: `Write or overwrite entire file content. Use edit_file for partial changes.
Parameters:
- path (required): File path
- content (required): Complete file content`,

	create_file_or_folder: `Create a new file or folder. Path ending with / creates a folder.
Parameters:
- path (required): Path to create
- content (optional): Initial content for files`,

	delete_file_or_folder: `Delete a file or folder.
Parameters:
- path (required): Path to delete
- recursive (optional): Delete folder recursively`,

	run_command: `Execute a shell command and wait for completion. For long-running commands, use open_terminal + run_in_terminal.
Parameters:
- command (required): Shell command to execute
- cwd (optional): Working directory
- timeout (optional): Timeout in seconds (default: 30)`,

	open_terminal: `Open a persistent terminal session for long-running commands like dev servers.
Parameters:
- name (required): Terminal name (e.g., "dev-server")
- cwd (optional): Working directory`,

	run_in_terminal: `Run a command in a persistent terminal. Use for dev servers, watchers, etc.
Parameters:
- terminal_id (required): Terminal ID from open_terminal
- command (required): Command to run
- wait (optional): Wait for completion (default: false)`,

	get_terminal_output: `Get recent output from a persistent terminal.
Parameters:
- terminal_id (required): Terminal ID
- lines (optional): Number of recent lines (default: 50)`,

	get_lint_errors: `Get lint/compile errors for a file. Supports TypeScript, JavaScript, Python.
Parameters:
- path (required): File path to check
- refresh (optional): Force refresh cache`,
}

// 构建工具定义字符串
function buildToolDefinitions(mode: ChatMode): string {
	if (mode === 'chat') return ''

	const tools = Object.entries(toolDescriptions)
		.map(([name, desc], i) => `${i + 1}. **${name}**\n${desc}`)
		.join('\n\n')

	return `## Available Tools

${tools}

## Tool Usage Guidelines

1. **Always read before editing**: Read a file to understand its current state before making changes.
2. **Use edit_file for modifications**: Prefer SEARCH/REPLACE blocks over rewriting entire files.
3. **Be precise with SEARCH blocks**: The ORIGINAL text must match exactly, including whitespace.
4. **Handle errors gracefully**: If a tool fails, explain the error and try an alternative approach.
5. **Use persistent terminals for long-running processes**: Dev servers, watchers, etc.
6. **Check lint errors after edits**: Verify your changes don't introduce errors.`
}

// 主系统提示词
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
	const { getPromptTemplateById, getDefaultPromptTemplate } = await import('./promptTemplates')
	const template = promptTemplateId 
		? getPromptTemplateById(promptTemplateId) || getDefaultPromptTemplate()
		: getDefaultPromptTemplate()

	// 使用模板的人格提示词（包含身份、沟通风格、代码规范）
	const personalityPrompt = template.systemPrompt

	// 系统信息
	const systemInfo = `## Environment
- OS: ${typeof navigator !== 'undefined' ? ((navigator as any).userAgentData?.platform || navigator.platform || 'Unknown') : 'Unknown'}
- Workspace: ${workspacePath || 'No workspace open'}
- Active File: ${activeFile || 'None'}
- Open Files: ${openFiles.length > 0 ? openFiles.join(', ') : 'None'}
- Date: ${new Date().toLocaleDateString()}`

	// 工具定义（仅 agent 模式）
	const toolDefs = buildToolDefinitions(mode)

	// Agent 模式特定指导
	const agentGuidelines = mode === 'agent' ? `
## Agent Mode Guidelines
1. **Take Action**: Use tools to implement changes directly.
2. **Be Thorough**: Complete tasks fully without leaving TODOs.
3. **Verify Changes**: Check for lint errors after editing.
4. **Context First**: Read relevant files before making changes.
5. **Safety**: Never modify files outside workspace. Be cautious with destructive operations.` : ''

	// 自定义指令
	const customSection = customInstructions
		? `\n## Custom Instructions\n\n${customInstructions}`
		: ''

	// 项目规则
	const rulesSection = projectRules?.content
		? `\n## Project Rules (from ${projectRules.source})\n\n${projectRules.content}`
		: ''

	// 组装完整提示词
	const sections = [
		personalityPrompt,
		systemInfo,
		toolDefs,
		agentGuidelines,
		rulesSection,
		customSection,
	].filter(Boolean)

	return sections.join('\n\n').trim()
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

// 解析 Search/Replace 块
export function parseSearchReplaceBlocks(blocksStr: string): Array<{ search: string; replace: string }> {
	const blocks: Array<{ search: string; replace: string }> = []
	const regex = new RegExp(`${ORIGINAL}\\n([\\s\\S]*?)\\n${DIVIDER}\\n([\\s\\S]*?)\\n${FINAL}`, 'g')
	let match

	while ((match = regex.exec(blocksStr)) !== null) {
		blocks.push({
			search: match[1],
			replace: match[2],
		})
	}

	return blocks
}

// 应用 Search/Replace 块
export function applySearchReplaceBlocks(
	content: string,
	blocks: Array<{ search: string; replace: string }>
): { newContent: string; appliedCount: number; errors: string[] } {
	let newContent = content
	let appliedCount = 0
	const errors: string[] = []

	for (const block of blocks) {
		if (newContent.includes(block.search)) {
			newContent = newContent.replace(block.search, block.replace)
			appliedCount++
		} else {
			// 尝试模糊匹配（忽略行尾空白）
			const normalizedSearch = block.search.split('\n').map(l => l.trimEnd()).join('\n')
			const normalizedContent = newContent.split('\n').map(l => l.trimEnd()).join('\n')

			if (normalizedContent.includes(normalizedSearch)) {
				// 找到原始位置
				const lines = newContent.split('\n')
				const searchLines = block.search.split('\n')
				let found = false

				for (let i = 0; i <= lines.length - searchLines.length; i++) {
					const slice = lines.slice(i, i + searchLines.length)
					const sliceNormalized = slice.map(l => l.trimEnd()).join('\n')

					if (sliceNormalized === normalizedSearch) {
						lines.splice(i, searchLines.length, ...block.replace.split('\n'))
						newContent = lines.join('\n')
						appliedCount++
						found = true
						break
					}
				}

				if (!found) {
					errors.push(`Could not find exact match for: "${block.search.slice(0, 50)}..."`)
				}
			} else {
				errors.push(`Search block not found: "${block.search.slice(0, 50)}..."`)
			}
		}
	}

	return { newContent, appliedCount, errors }
}
