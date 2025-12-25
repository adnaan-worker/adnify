/**
 * 工具执行器
 * 负责工具的验证和执行
 */

import { ToolExecutionResult } from './types'
import { validatePath, isSensitivePath } from '@/renderer/utils/pathUtils'
import { logger } from '@/renderer/utils/Logger'
import { pathToLspUri } from '@/renderer/services/lspService'
import {
  parseSearchReplaceBlocks,
  applySearchReplaceBlocks,
  calculateLineChanges,
} from '@/renderer/utils/searchReplace'
import { WRITE_TOOLS as WRITE_TOOLS_CONST } from '@/shared/constants'

// 从统一的工具定义文件导入
import {
  TOOL_DEFINITIONS,
  TOOL_DISPLAY_NAMES,
  getToolApprovalType,
  getToolDefinitions,
  validateToolArgs,
  formatValidationError,
} from './toolDefinitions'

// 重新导出供其他模块使用
export { TOOL_DEFINITIONS, TOOL_DISPLAY_NAMES, getToolApprovalType, getToolDefinitions }

// 写入类工具（需要显示代码预览）- 使用 constants.ts 的统一定义
export const WRITE_TOOLS = WRITE_TOOLS_CONST as readonly string[]


// ===== 目录树构建 =====

interface DirTreeNode {
  name: string
  path: string
  isDirectory: boolean
  children?: DirTreeNode[]
}

async function buildDirTree(dirPath: string, maxDepth: number, currentDepth = 0): Promise<DirTreeNode[]> {
  if (currentDepth >= maxDepth) return []

  const items = await window.electronAPI.readDir(dirPath)
  if (!items) return []

  const nodes: DirTreeNode[] = []
  const ignoreDirs = ['node_modules', '.git', 'dist', 'build', '.next', '__pycache__', '.venv']

  for (const item of items) {
    if (item.name.startsWith('.') && item.name !== '.env') continue
    if (ignoreDirs.includes(item.name)) continue

    const node: DirTreeNode = {
      name: item.name,
      path: item.path,
      isDirectory: item.isDirectory,
    }

    if (item.isDirectory && currentDepth < maxDepth - 1) {
      node.children = await buildDirTree(item.path, maxDepth, currentDepth + 1)
    }

    nodes.push(node)
  }

  return nodes.sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
    return a.name.localeCompare(b.name)
  })
}

function formatDirTree(nodes: DirTreeNode[], prefix = ''): string {
  let result = ''

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i]
    const isLast = i === nodes.length - 1
    const connector = isLast ? '└── ' : '├── '
    const icon = node.isDirectory ? '📁 ' : '📄 '

    result += `${prefix}${connector}${icon}${node.name}\\n`

    if (node.children?.length) {
      const childPrefix = prefix + (isLast ? '    ' : '│   ')
      result += formatDirTree(node.children, childPrefix)
    }
  }

  return result
}

// ===== Plan Markdown 生成 =====

/**
 * 生成 Plan 的 Markdown 内容（使用清单格式）
 */
function generatePlanMarkdown(plan: {
  items: Array<{
    id: string
    title: string
    description?: string
    status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped'
  }>
}, planTitle?: string): string {
  const timestamp = new Date().toLocaleString()

  let content = `# 📋 ${planTitle || 'Execution Plan'}\n\n`
  content += `> Generated: ${timestamp}\n\n`
  content += `## Steps\n`

  plan.items.forEach((item) => {
    const checkbox = item.status === 'completed' ? '[x]' :
      item.status === 'in_progress' ? '[/]' :
        item.status === 'failed' ? '[!]' :
          '[ ]'

    const statusIcon = item.status === 'completed' ? '✅' :
      item.status === 'in_progress' ? '🔄' :
        item.status === 'failed' ? '❌' :
          '⬜'

    content += `- ${checkbox} ${statusIcon} [id: ${item.id}] ${item.title}\n`
    if (item.description) {
      content += `  > ${item.description}\n`
    }
  })

  content += `\n---\n`
  content += `*Plan ID: ${plan.items[0]?.id?.slice(0, 8) || 'N/A'}*\n`

  return content
}

// ===== 工具执行结果 =====



// ===== 工具执行 =====

export async function executeTool(
  toolName: string,
  args: Record<string, unknown>,
  workspacePath?: string
): Promise<ToolExecutionResult> {
  // 1. Zod 参数校验
  const validation = validateToolArgs(toolName, args)

  if (!validation.success) {
    return {
      success: false,
      result: '',
      error: formatValidationError(toolName, validation)
    }
  }

  // 使用校验后的参数（类型安全）
  const validatedArgs = validation.data as any

  try {

    /**
     * 安全路径解析
     */
    const resolvePath = (p: unknown, allowRead = false) => {
      if (typeof p !== 'string') throw new Error('Invalid path: not a string')

      // 使用安全验证
      const validation = validatePath(p, workspacePath ?? null, {
        allowSensitive: false,
        allowOutsideWorkspace: false,
      })

      if (!validation.valid) {
        throw new Error(`Security: ${validation.error}`)
      }

      // 额外检查敏感文件（即使在工作区内）
      if (!allowRead && isSensitivePath(validation.sanitizedPath!)) {
        throw new Error('Security: Cannot modify sensitive files')
      }

      return validation.sanitizedPath!
    }

    switch (toolName) {
      case 'read_file': {
        const path = resolvePath(validatedArgs.path, true) // 读取允许访问更多文件
        const content = await window.electronAPI.readFile(path)
        if (content === null) {
          return { success: false, result: '', error: `File not found: ${path}` }
        }

        // 标记文件已读取（用于 read-before-write 验证）
        const { AgentService } = await import('./AgentService')
        AgentService.markFileAsRead(path)

        const lines = content.split('\n')
        const startLine = typeof validatedArgs.start_line === 'number' ? Math.max(1, validatedArgs.start_line) : 1
        const endLine = typeof validatedArgs.end_line === 'number' ? Math.min(lines.length, validatedArgs.end_line) : lines.length

        const selectedLines = lines.slice(startLine - 1, endLine)
        const numberedContent = selectedLines
          .map((line, i) => `${startLine + i}: ${line}`)
          .join('\n')

        return {
          success: true,
          result: numberedContent,
          meta: { filePath: path }
        }
      }

      case 'list_directory': {
        const path = resolvePath(validatedArgs.path, true)
        const items = await window.electronAPI.readDir(path)

        if (!items) {
          return { success: false, result: '', error: `Directory not found: ${path}` }
        }

        const result = items
          .map(item => `${item.isDirectory ? '📁' : '📄'} ${item.name}`)
          .join('\n')

        return { success: true, result }
      }

      case 'get_dir_tree': {
        const path = resolvePath(validatedArgs.path, true)
        const maxDepth = validatedArgs.max_depth || 3
        const tree = await buildDirTree(path, maxDepth)
        const result = formatDirTree(tree)
        return { success: true, result }
      }

      case 'search_files': {
        const path = resolvePath(validatedArgs.path, true)
        const { pattern, is_regex, file_pattern } = validatedArgs

        const results = await window.electronAPI.searchFiles(pattern, path, {
          isRegex: !!is_regex,
          include: file_pattern,
          isCaseSensitive: false
        })

        if (!results) {
          return { success: false, result: 'Search failed' }
        }

        const formatted = results
          .slice(0, 50) // Limit results
          .map(r => `${r.path}:${r.line}: ${r.text.trim()}`)
          .join('\n')

        return {
          success: true,
          result: formatted || 'No matches found'
        }
      }

      case 'search_in_file': {
        const path = resolvePath(validatedArgs.path, true)
        const { pattern, is_regex } = validatedArgs

        const content = await window.electronAPI.readFile(path)
        if (content === null) {
          return { success: false, result: '', error: `File not found: ${path}` }
        }

        const lines = content.split('\n')
        const matches: string[] = []

        lines.forEach((line, index) => {
          const lineNum = index + 1
          let matched = false

          if (is_regex) {
            try {
              const regex = new RegExp(pattern, 'gi')
              matched = regex.test(line)
            } catch {
              matched = false
            }
          } else {
            matched = line.toLowerCase().includes(pattern.toLowerCase())
          }

          if (matched) {
            matches.push(`${lineNum}: ${line.trim()}`)
          }
        })

        if (matches.length === 0) {
          return { success: true, result: `No matches found for "${pattern}" in ${path}` }
        }

        return {
          success: true,
          result: `Found ${matches.length} matches in ${path}:\n${matches.slice(0, 100).join('\n')}`
        }
      }

      case 'edit_file': {
        const path = resolvePath(validatedArgs.path)
        const { search_replace_blocks } = validatedArgs

        // 验证文件是否已读取
        const { AgentService } = await import('./AgentService')
        if (!AgentService.hasReadFile(path)) {
          return {
            success: false,
            result: '',
            error: 'Read-before-write required: You must read the file using read_file before editing it.'
          }
        }

        const originalContent = await window.electronAPI.readFile(path)
        if (originalContent === null) {
          return { success: false, result: '', error: `File not found: ${path}` }
        }

        // 解析块
        const blocks = parseSearchReplaceBlocks(search_replace_blocks)
        if (blocks.length === 0) {
          return { success: false, result: '', error: 'No valid SEARCH/REPLACE blocks found.' }
        }

        // 应用编辑
        const applyResult = applySearchReplaceBlocks(originalContent, blocks)
        if (applyResult.errors.length > 0) {
          return { success: false, result: '', error: applyResult.errors.join('\n') }
        }

        // 写入文件
        const success = await window.electronAPI.writeFile(path, applyResult.newContent)
        if (!success) {
          return { success: false, result: '', error: 'Failed to write file' }
        }

        // 计算变更行数
        const lineChanges = calculateLineChanges(originalContent, applyResult.newContent)

        return {
          success: true,
          result: 'File updated successfully',
          meta: {
            filePath: path,
            oldContent: originalContent,
            newContent: applyResult.newContent,
            linesAdded: lineChanges.added,
            linesRemoved: lineChanges.removed
          }
        }
      }

      case 'write_file': {
        const path = resolvePath(validatedArgs.path)
        const { content } = validatedArgs

        const originalContent = await window.electronAPI.readFile(path) || ''
        const success = await window.electronAPI.writeFile(path, content)

        if (!success) {
          return { success: false, result: '', error: 'Failed to write file' }
        }

        const lineChanges = calculateLineChanges(originalContent, content)

        return {
          success: true,
          result: 'File written successfully',
          meta: {
            filePath: path,
            oldContent: originalContent,
            newContent: content,
            linesAdded: lineChanges.added,
            linesRemoved: lineChanges.removed
          }
        }
      }

      case 'replace_file_content': {
        const path = resolvePath(validatedArgs.path)
        const { start_line, end_line, content } = validatedArgs

        // 验证文件是否已读取
        const { AgentService } = await import('./AgentService')
        if (!AgentService.hasReadFile(path)) {
          return {
            success: false,
            result: '',
            error: 'Read-before-write required: You must read the file using read_file before editing it.'
          }
        }

        const originalContent = await window.electronAPI.readFile(path)
        if (originalContent === null) {
          return { success: false, result: '', error: `File not found: ${path}` }
        }

        const lines = originalContent.split('\n')
        // 验证行号范围
        if (start_line < 1 || end_line > lines.length || start_line > end_line) {
          return { success: false, result: '', error: `Invalid line range: ${start_line}-${end_line}. File has ${lines.length} lines.` }
        }

        // 替换行
        // splice 参数: start index (0-indexed), delete count, items to add
        lines.splice(start_line - 1, end_line - start_line + 1, ...content.split('\n'))
        const newContent = lines.join('\n')

        const success = await window.electronAPI.writeFile(path, newContent)
        if (!success) {
          return { success: false, result: '', error: 'Failed to write file' }
        }

        const lineChanges = calculateLineChanges(originalContent, newContent)

        return {
          success: true,
          result: 'File updated successfully',
          meta: {
            filePath: path,
            oldContent: originalContent,
            newContent: newContent,
            linesAdded: lineChanges.added,
            linesRemoved: lineChanges.removed
          }
        }
      }

      case 'create_file_or_folder': {
        const path = resolvePath(validatedArgs.path)
        const isFolder = path.endsWith('/') || path.endsWith('\\')

        if (isFolder) {
          const success = await window.electronAPI.mkdir(path)
          return {
            success,
            result: success ? 'Folder created' : 'Failed to create folder'
          }
        } else {
          const content = validatedArgs.content || ''
          const success = await window.electronAPI.writeFile(path, content)
          return {
            success,
            result: success ? 'File created' : 'Failed to create file',
            meta: {
              filePath: path,
              isNewFile: true,
              newContent: content,
              linesAdded: content.split('\n').length
            }
          }
        }
      }

      case 'delete_file_or_folder': {
        const path = resolvePath(validatedArgs.path)

        const success = await window.electronAPI.deleteFile(path)
        return {
          success,
          result: success ? 'Deleted successfully' : 'Failed to delete'
        }
      }

      case 'run_command': {
        const { command, cwd, timeout } = validatedArgs

        // 验证 cwd
        const validCwd = cwd ? resolvePath(cwd, true) : workspacePath

        // 使用正则正确解析带引号的参数
        const args: string[] = []
        const regex = /[^\s"]+|"([^"]*)"/gi
        let match

        // 移除命令本身，只保留参数部分
        const commandStr = command.trim()
        const firstSpace = commandStr.indexOf(' ')

        let cmdName = commandStr
        let argsStr = ''

        if (firstSpace > -1) {
          cmdName = commandStr.substring(0, firstSpace)
          argsStr = commandStr.substring(firstSpace + 1)
        }

        while ((match = regex.exec(argsStr)) !== null) {
          // match[1] 是引号内的内容，match[0] 是整个匹配项
          args.push(match[1] ? match[1] : match[0])
        }

        const result = await window.electronAPI.executeSecureCommand({
          command: cmdName,
          args: args,
          cwd: validCwd,
          timeout: (timeout || 30) * 1000,
          requireConfirm: false
        })

        // Always return success: true for run_command if we got output, so the UI shows a checkmark.
        // The content will indicate if the command failed (e.g. exit code).
        // This prevents the "Red X" confusion when running tests that fail.
        return {
          success: true,
          result: result.output || (result.success ? 'Command executed' : 'Command failed'),
          meta: {
            command: command,
            cwd: validCwd,
            exitCode: result.success ? 0 : 1 // We don't have exact exit code from executeSecureCommand yet, but this is a proxy
          },
          error: result.error
        }
      }

      case 'get_lint_errors': {
        const path = resolvePath(validatedArgs.path, true)
        const { refresh } = validatedArgs

        const { lintService } = await import('../lintService')
        const errors = await lintService.getLintErrors(path, refresh)

        const formatted = errors.length > 0
          ? errors.map((e: any) => `[${e.severity}] ${e.message} (Line ${e.startLine})`).join('\n')
          : 'No lint errors found.'

        return { success: true, result: formatted }
      }

      case 'codebase_search': {
        const { query, top_k } = validatedArgs

        if (!workspacePath) {
          return { success: false, result: '', error: 'No workspace open' }
        }

        const results = await window.electronAPI.indexSearch(workspacePath, query, top_k || 10)

        if (!results || results.length === 0) {
          return { success: false, result: 'No results found' }
        }

        const formatted = results
          .map(r => `${r.relativePath}:${r.startLine}: ${r.content.trim()}`)
          .join('\n')

        return { success: true, result: formatted }
      }

      case 'find_references': {
        const path = resolvePath(validatedArgs.path, true)
        const { line, column } = validatedArgs
        const uri = pathToLspUri(path)

        const locations = await window.electronAPI.lspReferences({
          uri,
          line: line - 1, // LSP is 0-indexed
          character: column - 1,
          workspacePath
        })

        if (!locations || locations.length === 0) {
          return { success: true, result: 'No references found' }
        }

        const result = locations.map(loc =>
          `${loc.uri}:${loc.range.start.line + 1}:${loc.range.start.character + 1}`
        ).join('\n')

        return { success: true, result }
      }

      case 'go_to_definition': {
        const path = resolvePath(validatedArgs.path, true)
        const { line, column } = validatedArgs
        const uri = pathToLspUri(path)

        const locations = await window.electronAPI.lspDefinition({
          uri,
          line: line - 1,
          character: column - 1,
          workspacePath
        })

        if (!locations || locations.length === 0) {
          return { success: true, result: 'Definition not found' }
        }

        const result = locations.map(loc =>
          `${loc.uri}:${loc.range.start.line + 1}:${loc.range.start.character + 1}`
        ).join('\n')

        return { success: true, result }
      }

      case 'get_hover_info': {
        const path = resolvePath(validatedArgs.path, true)
        const { line, column } = validatedArgs
        const uri = pathToLspUri(path)

        const hover = await window.electronAPI.lspHover({
          uri,
          line: line - 1,
          character: column - 1,
          workspacePath
        })

        if (!hover || !hover.contents) {
          return { success: true, result: 'No hover info' }
        }

        const contents = Array.isArray(hover.contents)
          ? hover.contents.join('\n')
          : (typeof hover.contents === 'string' ? hover.contents : hover.contents.value)

        return { success: true, result: contents }
      }

      case 'get_document_symbols': {
        const path = resolvePath(validatedArgs.path, true)
        const uri = pathToLspUri(path)

        const symbols = await window.electronAPI.lspDocumentSymbol({
          uri,
          workspacePath
        })

        if (!symbols || symbols.length === 0) {
          return { success: true, result: 'No symbols found' }
        }

        // 简单格式化
        const formatSymbol = (s: any, depth: number): string => {
          const indent = '  '.repeat(depth)
          let out = `${indent}${s.name} (${s.kind})\n`
          if (s.children) {
            out += s.children.map((c: any) => formatSymbol(c, depth + 1)).join('')
          }
          return out
        }

        const result = symbols.map(s => formatSymbol(s, 0)).join('')
        return { success: true, result }
      }

      case 'read_multiple_files': {
        const { paths } = validatedArgs
        let result = ''

        for (const p of paths) {
          try {
            const validPath = resolvePath(p, true)
            const content = await window.electronAPI.readFile(validPath)

            if (content !== null) {
              result += `\n--- File: ${p} ---\n${content}\n`

              // 标记已读
              const { AgentService } = await import('./AgentService')
              AgentService.markFileAsRead(validPath)
            } else {
              result += `\n--- File: ${p} ---\n[File not found]\n`
            }
          } catch (e: any) {
            result += `\n--- File: ${p} ---\n[Error: ${e.message}]\n`
          }
        }

        return { success: true, result }
      }

      case 'web_search': {
        const { query, max_results } = validatedArgs
        const result = await window.electronAPI.httpWebSearch(query, max_results)

        if (!result.success || !result.results) {
          return { success: false, result: '', error: result.error || 'Search failed' }
        }

        const formatted = result.results
          .map((r: any) => `[${r.title}](${r.url})\n${r.content}`)
          .join('\n\n')

        return { success: true, result: formatted }
      }

      case 'read_url': {
        const { url, timeout } = validatedArgs
        const result = await window.electronAPI.httpReadUrl(url, timeout || 30)

        if (!result.success || !result.content) {
          return { success: false, result: '', error: result.error || 'Failed to read URL' }
        }

        return {
          success: true,
          result: `Title: ${result.title}\n\n${result.content}`
        }
      }

      case 'create_plan': {
        const { items, title } = validatedArgs as {
          items: Array<{ title: string; description?: string }>
          title?: string
        }
        const { useAgentStore } = await import('./AgentStore')
        useAgentStore.getState().createPlan(items)

        // 生成 plan.md 内容（使用清单格式）
        const plan = useAgentStore.getState().plan
        if (plan) {
          const planContent = generatePlanMarkdown(plan, title)

          // 获取工作区路径并保存到 plans/ 目录
          if (workspacePath) {
            // 生成唯一的计划文件名
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
            const planName = title
              ? title.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_').slice(0, 30)
              : `plan_${timestamp}`
            const planFilePath = `${workspacePath}/.adnify/plans/${planName}.md`

            // 确保目录存在
            await window.electronAPI.ensureDir(`${workspacePath}/.adnify/plans`)

            // 写入计划文件
            await window.electronAPI.writeFile(planFilePath, planContent)

            // 在编辑器中打开
            const { useStore } = await import('@/renderer/store')
            useStore.getState().openFile(planFilePath, planContent)
            useStore.getState().setActiveFile(planFilePath)

            // 保存当前活动计划路径
            await window.electronAPI.writeFile(
              `${workspacePath}/.adnify/active_plan.txt`,
              planFilePath
            )
          }

          const itemsSummary = plan.items.map((item, idx) =>
            `[${idx}] ${item.id.slice(0, 8)}... - ${item.title}`
          ).join('\n')
          return {
            success: true,
            result: `Plan created and opened in editor with ${plan.items.length} items:\n${itemsSummary}\n\nPlan file: .adnify/plans/${title || 'plan'}.md`
          }
        }
        return { success: true, result: 'Plan created successfully' }
      }

      case 'update_plan': {
        const { status, items, currentStepId, title } = validatedArgs as {
          status?: string
          items?: Array<{ id: string; status: string; title?: string }>
          currentStepId?: string | null
          title?: string
        }
        const { useAgentStore } = await import('./AgentStore')
        const store = useAgentStore.getState()
        const plan = store.plan

        // 调试日志
        logger.tool.debug('update_plan received args', { args: validatedArgs })

        if (status) {
          store.updatePlanStatus(status as any)
        }

        if (items && plan) {
          for (const item of items) {
            let targetId = item.id

            if (!targetId) {
              // 如果没有 ID，尝试通过标题匹配
              if (item.title) {
                const titleMatch = plan.items.find(p => p.title === item.title)
                if (titleMatch) {
                  targetId = titleMatch.id
                  logger.tool.debug('update_plan: Mapped title to id', { title: item.title, targetId })
                }
              }

              if (!targetId) {
                logger.tool.warn('update_plan: Item missing id and no title match found', { item })
                continue
              }
            }

            // 1. 优先检查是否直接匹配某个 item 的 id (UUID)
            let matchedItem = plan.items.find(p => p.id === targetId)

            // 2. 如果没有直接匹配，尝试前缀匹配 (支持 AI 使用短 ID，如 8 位)
            if (!matchedItem && targetId && targetId.length >= 4) {
              const prefixMatches = plan.items.filter(p => p.id.startsWith(targetId!))
              if (prefixMatches.length === 1) {
                matchedItem = prefixMatches[0]
                targetId = matchedItem.id
                logger.tool.debug('update_plan: Mapped prefix to id', { prefix: item.id, targetId })
              }
            }

            // 3. 如果还是没有匹配，尝试作为数字索引解析
            if (!matchedItem) {
              const maybeIndex = parseInt(targetId!, 10)
              if (!isNaN(maybeIndex)) {
                // 支持 1-based 索引（AI 自然语言习惯）
                const adjustedIndex = maybeIndex > 0 && maybeIndex <= plan.items.length
                  ? maybeIndex - 1  // 1-based 转 0-based
                  : maybeIndex      // 已经是 0-based 或超界

                if (adjustedIndex >= 0 && adjustedIndex < plan.items.length) {
                  matchedItem = plan.items[adjustedIndex]
                  targetId = matchedItem.id
                  logger.tool.debug('update_plan: Mapped index to id', { index: item.id, adjustedIndex, targetId })
                }
              }
            }

            if (matchedItem) {
              store.updatePlanItem(targetId!, {
                status: item.status as any,
                title: item.title
              })
            } else {
              logger.tool.warn('update_plan: Could not find item', { identifier: item.id })
            }
          }
        }

        if (currentStepId !== undefined) {
          // 同样支持索引
          let stepId = currentStepId
          if (plan && currentStepId !== null) {
            const maybeIndex = parseInt(currentStepId, 10)
            if (!isNaN(maybeIndex)) {
              const adjustedIndex = maybeIndex > 0 && maybeIndex <= plan.items.length
                ? maybeIndex - 1
                : maybeIndex
              if (adjustedIndex >= 0 && adjustedIndex < plan.items.length) {
                stepId = plan.items[adjustedIndex].id
              }
            }
          }
          store.setPlanStep(stepId)
        }

        // 同步更新活动计划文件
        const updatedPlan = useAgentStore.getState().plan
        if (updatedPlan && workspacePath) {
          // 读取活动计划路径
          let planFilePath = await window.electronAPI.readFile(`${workspacePath}/.adnify/active_plan.txt`)
          if (!planFilePath) {
            planFilePath = `${workspacePath}/.adnify/plan.md`
          }
          planFilePath = planFilePath.trim()

          // 提取现有标题（如果 update_plan 没传 title）
          let finalTitle = title
          if (!finalTitle) {
            const oldContent = await window.electronAPI.readFile(planFilePath)
            if (oldContent) {
              const titleMatch = oldContent.match(/^# 📋 (.*)$/m)
              if (titleMatch) finalTitle = titleMatch[1]
            }
          }

          const planContent = generatePlanMarkdown(updatedPlan, finalTitle)
          const writeSuccess = await window.electronAPI.writeFile(planFilePath, planContent)

          if (writeSuccess) {
            // 更新编辑器中的文件内容（使用 reloadFileFromDisk 确保同步且清除 dirty 状态）
            // 注意：避免在 IPC 回调中直接使用复杂的动态导入，可能会触发 require is not defined
            try {
              const { useStore } = await import('@/renderer/store')
              const storeState = useStore.getState()
              const openFile = storeState.openFiles.find(f => f.path === planFilePath)
              if (openFile) {
                storeState.reloadFileFromDisk(planFilePath, planContent)
              }
            } catch (err) {
              logger.tool.error('update_plan: Failed to sync editor state', { error: err })
            }
          }
        }

        return { success: true, result: 'Plan updated successfully' }
      }

      default:
        return { success: false, result: '', error: `Unknown tool: ${toolName}` }
    }

  } catch (error: any) {
    return {
      success: false,
      result: '',
      error: `Execution error: ${error.message}`
    }
  }
}

