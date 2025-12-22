/**
 * 工具执行器
 * 负责工具的验证和执行
 */

import { ToolDefinition, ToolApprovalType, ToolExecutionResult } from './types'
import { validatePath, isSensitivePath } from '@/renderer/utils/pathUtils'
import { pathToLspUri } from '@/renderer/services/lspService'
import {
  parseSearchReplaceBlocks,
  applySearchReplaceBlocks,
  calculateLineChanges,
} from '@/renderer/utils/searchReplace'
import { validateToolArgs, formatValidationError } from '../tools'

// ===== 工具定义 =====

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  // 读取类
  {
    name: 'read_file',
    description: 'Read file contents with optional line range.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path' },
        start_line: { type: 'number', description: 'Starting line (1-indexed)' },
        end_line: { type: 'number', description: 'Ending line' },
      },
      required: ['path'],
    },
  },
  {
    name: 'list_directory',
    description: 'List files and folders in a directory.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Directory path' },
      },
      required: ['path'],
    },
  },
  {
    name: 'get_dir_tree',
    description: 'Get recursive directory tree structure.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Root directory path' },
        max_depth: { type: 'number', description: 'Maximum depth (default: 3)' },
      },
      required: ['path'],
    },
  },
  {
    name: 'search_files',
    description: 'Search for text pattern in files.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Directory to search' },
        pattern: { type: 'string', description: 'Search pattern' },
        is_regex: { type: 'boolean', description: 'Use regex' },
        file_pattern: { type: 'string', description: 'File filter (e.g., "*.ts")' },
      },
      required: ['path', 'pattern'],
    },
  },
  {
    name: 'search_in_file',
    description: 'Search for pattern within a specific file. Returns matching line numbers and content.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path to search in' },
        pattern: { type: 'string', description: 'Search pattern' },
        is_regex: { type: 'boolean', description: 'Use regex pattern (default: false)' },
      },
      required: ['path', 'pattern'],
    },
  },
  // 编辑类
  {
    name: 'edit_file',
    description: 'Edit file using SEARCH/REPLACE blocks. Format: <<<<<<< SEARCH\\nold\\n=======\\nnew\\n>>>>>>> REPLACE',
    // 文件编辑不需要审批（可通过Checkpoint撤销）
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path' },
        search_replace_blocks: { type: 'string', description: 'SEARCH/REPLACE blocks' },
      },
      required: ['path', 'search_replace_blocks'],
    },
  },
  {
    name: 'write_file',
    description: 'Write or overwrite entire file content.',
    // 文件写入不需要审批（可通过Checkpoint撤销）
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path' },
        content: { type: 'string', description: 'File content' },
      },
      required: ['path', 'content'],
    },
  },
  {
    name: 'replace_file_content',
    description: 'Replace a specific range of lines in a file with new content.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path' },
        start_line: { type: 'number', description: 'Start line (1-indexed)' },
        end_line: { type: 'number', description: 'End line (inclusive)' },
        content: { type: 'string', description: 'New content' },
      },
      required: ['path', 'start_line', 'end_line', 'content'],
    },
  },
  {
    name: 'create_file_or_folder',
    description: 'Create a new file or folder. Path ending with / creates folder.',
    // 文件操作不需要审批（可通过Checkpoint撤销）
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Path (end with / for folder)' },
        content: { type: 'string', description: 'Initial content for files' },
      },
      required: ['path'],
    },
  },
  {
    name: 'delete_file_or_folder',
    description: 'Delete a file or folder.',
    approvalType: 'dangerous',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Path to delete' },
        recursive: { type: 'boolean', description: 'Delete recursively' },
      },
      required: ['path'],
    },
  },
  // 终端类
  {
    name: 'run_command',
    description: 'Execute a shell command.',
    approvalType: 'terminal',
    parameters: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'Shell command' },
        cwd: { type: 'string', description: 'Working directory' },
        timeout: { type: 'number', description: 'Timeout in seconds (default: 30)' },
      },
      required: ['command'],
    },
  },
  {
    name: 'get_lint_errors',
    description: 'Get lint/compile errors for a file.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path' },
      },
      required: ['path'],
    },
  },
  // 语义搜索类
  {
    name: 'codebase_search',
    description: 'Semantic search across the codebase using AI embeddings. Best for finding code by meaning/intent.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Natural language search query' },
        top_k: { type: 'number', description: 'Number of results (default: 10)' },
      },
      required: ['query'],
    },
  },
  // LSP 工具类
  {
    name: 'find_references',
    description: 'Find all references to a symbol at a specific location.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path' },
        line: { type: 'number', description: 'Line number (1-indexed)' },
        column: { type: 'number', description: 'Column number (1-indexed)' },
      },
      required: ['path', 'line', 'column'],
    },
  },
  {
    name: 'go_to_definition',
    description: 'Get the definition location of a symbol.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path' },
        line: { type: 'number', description: 'Line number (1-indexed)' },
        column: { type: 'number', description: 'Column number (1-indexed)' },
      },
      required: ['path', 'line', 'column'],
    },
  },
  {
    name: 'get_hover_info',
    description: 'Get type information and documentation for a symbol.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path' },
        line: { type: 'number', description: 'Line number (1-indexed)' },
        column: { type: 'number', description: 'Column number (1-indexed)' },
      },
      required: ['path', 'line', 'column'],
    },
  },
  {
    name: 'get_document_symbols',
    description: 'Get all symbols (functions, classes, variables) in a file.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path' },
      },
      required: ['path'],
    },
  },
  // 批量操作
  {
    name: 'read_multiple_files',
    description: 'Read multiple files at once. More efficient than multiple read_file calls.',
    parameters: {
      type: 'object',
      properties: {
        paths: { type: 'array', description: 'Array of file paths to read' },
      },
      required: ['paths'],
    },
  },
  // 网络工具 (Phase 2)
  {
    name: 'web_search',
    description: 'Search the web for information. Returns top results with titles, URLs, and snippets.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        max_results: { type: 'number', description: 'Maximum number of results (default: 5)' },
      },
      required: ['query'],
    },
  },
  {
    name: 'read_url',
    description: 'Fetch and read content from a URL. Returns the page title and text content.',
    parameters: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'URL to fetch content from' },
        timeout: { type: 'number', description: 'Timeout in seconds (default: 30)' },
      },
      required: ['url'],
    },
  },
  // Plan 工具
  {
    name: 'create_plan',
    description: 'Create a new execution plan with a list of steps.',
    parameters: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              description: { type: 'string' }
            },
            required: ['title']
          }
        }
      },
      required: ['items']
    }
  },
  {
    name: 'update_plan',
    description: 'Update the current plan status or specific items.',
    parameters: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['active', 'completed', 'failed'] },
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              status: { type: 'string', enum: ['pending', 'in_progress', 'completed', 'failed', 'skipped'] },
              title: { type: 'string' }
            },
            required: ['id']
          }
        },
        currentStepId: { type: 'string' }
      },
      required: []
    }
  },

]

// ===== 工具审批类型映射 =====
// Cursor 风格：文件编辑直接执行，只有危险操作和终端命令需要审批

const APPROVAL_TYPE_MAP: Record<string, ToolApprovalType> = {
  // 文件编辑不需要审批 - Cursor 风格
  // edit_file: 不需要审批
  // write_file: 不需要审批
  // replace_file_content: 不需要审批
  // create_file_or_folder: 不需要审批

  // 危险操作需要审批
  delete_file_or_folder: 'dangerous',

  // 终端命令需要审批
  run_command: 'terminal',
}

export function getToolApprovalType(toolName: string): ToolApprovalType | undefined {
  return APPROVAL_TYPE_MAP[toolName]
}

export function getToolDefinitions(): ToolDefinition[] {
  return TOOL_DEFINITIONS
}

// ===== 工具显示名称 =====

export const TOOL_DISPLAY_NAMES: Record<string, string> = {
  read_file: 'Read',
  list_directory: 'List',
  get_dir_tree: 'Tree',
  search_files: 'Search',
  edit_file: 'Edit',
  replace_file_content: 'Replace',
  write_file: 'Write',
  create_file_or_folder: 'Create',
  delete_file_or_folder: 'Delete',
  run_command: 'Run',
  get_lint_errors: 'Lint',
  web_search: 'Web Search',
  read_url: 'Read URL',
  search_in_file: 'Search in File',
  create_plan: 'Create Plan',
  update_plan: 'Update Plan',
}

// 写入类工具（需要显示代码预览）
export const WRITE_TOOLS = ['edit_file', 'write_file', 'replace_file_content', 'create_file_or_folder']


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
        const { items } = validatedArgs
        const { useAgentStore } = await import('./AgentStore')
        useAgentStore.getState().createPlan(items)

        // 返回创建的计划详情（包含生成的 ID）
        const plan = useAgentStore.getState().plan
        if (plan) {
          const itemsSummary = plan.items.map((item, idx) =>
            `[${idx}] ${item.id.slice(0, 8)}... - ${item.title}`
          ).join('\n')
          return {
            success: true,
            result: `Plan created successfully with ${plan.items.length} items:\n${itemsSummary}\n\nUse index (0-based) or item ID to update items.`
          }
        }
        return { success: true, result: 'Plan created successfully' }
      }

      case 'update_plan': {
        const { status, items, currentStepId } = validatedArgs
        const { useAgentStore } = await import('./AgentStore')
        const store = useAgentStore.getState()
        const plan = store.plan

        // 调试日志
        console.log('[update_plan] Received args:', JSON.stringify(validatedArgs, null, 2))
        console.log('[update_plan] Current plan items:', plan?.items.map((p, i) => ({ index: i, id: p.id, title: p.title, status: p.status })))

        if (status) {
          store.updatePlanStatus(status as any)
        }

        if (items && plan) {
          for (const item of items) {
            let targetId = item.id

            // 优先检查是否直接匹配某个 item 的 id（UUID）
            const directMatch = plan.items.find(p => p.id === item.id)
            if (!directMatch) {
              // 如果没有直接匹配，尝试作为数字索引解析
              const maybeIndex = parseInt(item.id, 10)
              if (!isNaN(maybeIndex)) {
                // 支持 1-based 索引（AI 自然语言习惯）
                // "1" -> 第1个项目 -> 索引 0
                // "0" -> 也作为索引 0 处理
                const adjustedIndex = maybeIndex > 0 && maybeIndex <= plan.items.length
                  ? maybeIndex - 1  // 1-based 转 0-based
                  : maybeIndex      // 已经是 0-based 或超界

                if (adjustedIndex >= 0 && adjustedIndex < plan.items.length) {
                  targetId = plan.items[adjustedIndex].id
                  console.log(`[update_plan] Mapped "${item.id}" -> index ${adjustedIndex} -> id ${targetId}`)
                }
              }
            }

            store.updatePlanItem(targetId, {
              status: item.status as any,
              title: item.title
            })
          }
        }

        if (currentStepId !== undefined) {
          // 同样支持索引
          let stepId = currentStepId
          if (plan && currentStepId !== null) {
            const maybeIndex = parseInt(currentStepId, 10)
            if (!isNaN(maybeIndex) && maybeIndex >= 0 && maybeIndex < plan.items.length) {
              stepId = plan.items[maybeIndex].id
            }
          }
          store.setPlanStep(stepId)
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

