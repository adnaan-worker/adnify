/**
 * Tools Service
 * 工具验证、执行和结果字符串化
 * 参考 void 编辑器的 toolsService.ts
 */

import {
  ToolDefinition,
  BuiltinToolName,
  BuiltinToolParams,
  PAGE_SIZE,
  SearchReplaceBlock,
  DirTreeNode,
  APPROVAL_TYPE_OF_TOOL,
} from './types/toolTypes'
import { ToolApprovalType } from './types/chatTypes'
import { terminalService } from './terminalService'
import { lintService } from './lintService'
import { toFullPath } from '../utils/pathUtils'

// ===== 参数验证辅助函数 =====

const isFalsy = (u: unknown): boolean => !u || u === 'null' || u === 'undefined'

const validateStr = (argName: string, value: unknown): string => {
  if (value === null) throw new Error(`Invalid: ${argName} was null.`)
  if (typeof value !== 'string')
    throw new Error(`Invalid: ${argName} must be a string, got ${typeof value}.`)
  return value
}

const validateOptionalStr = (argName: string, value: unknown): string | undefined => {
  if (isFalsy(value)) return undefined
  return validateStr(argName, value)
}

const validateNumber = (value: unknown, defaultVal: number): number => {
  if (typeof value === 'number') return value
  if (typeof value === 'string') {
    const parsed = parseInt(value, 10)
    if (!isNaN(parsed)) return parsed
  }
  return defaultVal
}

const validateBoolean = (value: unknown, defaultVal: boolean): boolean => {
  if (typeof value === 'boolean') return value
  if (value === 'true') return true
  if (value === 'false') return false
  return defaultVal
}

const validatePath = (value: unknown, workspacePath?: string): string => {
  const pathStr = validateStr('path', value)
  return toFullPath(pathStr, workspacePath ?? null)
}

// ===== 工具定义 =====

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  // 读取类
  {
    name: 'read_file',
    description: 'Read file contents with optional line range and pagination.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Full path to the file.' },
        start_line: { type: 'number', description: 'Starting line (1-indexed, optional).' },
        end_line: { type: 'number', description: 'Ending line (optional).' },
        page: { type: 'number', description: 'Page number for large files (default: 1).' },
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
        path: { type: 'string', description: 'Directory path.' },
        page: { type: 'number', description: 'Page number (default: 1).' },
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
        path: { type: 'string', description: 'Root directory path.' },
        max_depth: { type: 'number', description: 'Maximum depth (default: 3, max: 5).' },
      },
      required: ['path'],
    },
  },
  {
    name: 'search_files',
    description: 'Search for text pattern in files within a directory.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Directory to search in.' },
        pattern: { type: 'string', description: 'Text or regex pattern.' },
        is_regex: { type: 'boolean', description: 'Treat as regex (default: false).' },
        file_pattern: { type: 'string', description: 'File name filter (e.g., "*.ts").' },
        page: { type: 'number', description: 'Page number (default: 1).' },
      },
      required: ['path', 'pattern'],
    },
  },
  {
    name: 'search_in_file',
    description: 'Search for pattern within a specific file.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path.' },
        pattern: { type: 'string', description: 'Text or regex pattern.' },
        is_regex: { type: 'boolean', description: 'Treat as regex (default: false).' },
      },
      required: ['path', 'pattern'],
    },
  },
  // 编辑类
  {
    name: 'edit_file',
    description:
      'Edit file using search/replace blocks. Format: <<<SEARCH\\nold\\n===\\nnew\\n>>>',
    approvalType: 'edits',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path.' },
        search_replace_blocks: {
          type: 'string',
          description: 'Search/replace blocks string.',
        },
      },
      required: ['path', 'search_replace_blocks'],
    },
  },
  {
    name: 'write_file',
    description: 'Write or overwrite entire file content.',
    approvalType: 'edits',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path.' },
        content: { type: 'string', description: 'Complete file content.' },
      },
      required: ['path', 'content'],
    },
  },
  {
    name: 'create_file_or_folder',
    description: 'Create a new file or folder. Path ending with / creates folder.',
    approvalType: 'edits',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Path (end with / for folder).' },
        content: { type: 'string', description: 'Initial content for files.' },
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
        path: { type: 'string', description: 'Path to delete.' },
        recursive: { type: 'boolean', description: 'Delete recursively (default: false).' },
      },
      required: ['path'],
    },
  },
  // 终端类
  {
    name: 'run_command',
    description: 'Execute a shell command and wait for completion.',
    approvalType: 'terminal',
    parameters: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'Shell command.' },
        cwd: { type: 'string', description: 'Working directory.' },
        timeout: { type: 'number', description: 'Timeout in seconds (default: 30).' },
      },
      required: ['command'],
    },
  },
  {
    name: 'open_terminal',
    description: 'Open a persistent terminal session.',
    approvalType: 'terminal',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Terminal name.' },
        cwd: { type: 'string', description: 'Working directory.' },
      },
      required: ['name'],
    },
  },
  {
    name: 'run_in_terminal',
    description: 'Run command in a persistent terminal.',
    approvalType: 'terminal',
    parameters: {
      type: 'object',
      properties: {
        terminal_id: { type: 'string', description: 'Terminal ID.' },
        command: { type: 'string', description: 'Command to run.' },
        wait: { type: 'boolean', description: 'Wait for completion.' },
      },
      required: ['terminal_id', 'command'],
    },
  },
  {
    name: 'get_terminal_output',
    description: 'Get recent output from a terminal.',
    parameters: {
      type: 'object',
      properties: {
        terminal_id: { type: 'string', description: 'Terminal ID.' },
        lines: { type: 'number', description: 'Number of lines (default: 50).' },
      },
      required: ['terminal_id'],
    },
  },
  {
    name: 'list_terminals',
    description: 'List all open terminals.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  // Lint
  {
    name: 'get_lint_errors',
    description: 'Get lint/compile errors for a file.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path.' },
        refresh: { type: 'boolean', description: 'Force refresh.' },
      },
      required: ['path'],
    },
  },
]

// ===== 参数验证器 =====

type ValidateParams = {
  [K in BuiltinToolName]: (
    raw: Record<string, unknown>,
    workspacePath?: string
  ) => BuiltinToolParams[K]
}

export const validateParams: ValidateParams = {
  read_file: (raw, ws) => ({
    path: validatePath(raw.path, ws),
    startLine: raw.start_line ? validateNumber(raw.start_line, 1) : undefined,
    endLine: raw.end_line ? validateNumber(raw.end_line, 0) : undefined,
    page: validateNumber(raw.page, 1),
  }),
  list_directory: (raw, ws) => ({
    path: validatePath(raw.path, ws),
    page: validateNumber(raw.page, 1),
  }),
  get_dir_tree: (raw, ws) => ({
    path: validatePath(raw.path, ws),
    maxDepth: Math.min(validateNumber(raw.max_depth, 3), 5),
  }),
  search_files: (raw, ws) => ({
    path: validatePath(raw.path, ws),
    pattern: validateStr('pattern', raw.pattern),
    isRegex: validateBoolean(raw.is_regex, false),
    filePattern: validateOptionalStr('file_pattern', raw.file_pattern),
    page: validateNumber(raw.page, 1),
  }),
  search_in_file: (raw, ws) => ({
    path: validatePath(raw.path, ws),
    pattern: validateStr('pattern', raw.pattern),
    isRegex: validateBoolean(raw.is_regex, false),
  }),
  search_pathnames: (raw) => ({
    query: validateStr('query', raw.query),
    includePattern: validateOptionalStr('include_pattern', raw.include_pattern),
    page: validateNumber(raw.page, 1),
  }),
  edit_file: (raw, ws) => ({
    path: validatePath(raw.path, ws),
    searchReplaceBlocks: validateStr('search_replace_blocks', raw.search_replace_blocks),
  }),
  write_file: (raw, ws) => ({
    path: validatePath(raw.path, ws),
    content: validateStr('content', raw.content),
  }),
  create_file_or_folder: (raw, ws) => {
    const pathStr = validateStr('path', raw.path)
    const isFolder = pathStr.endsWith('/') || pathStr.endsWith('\\')
    return {
      path: validatePath(raw.path, ws),
      content: validateOptionalStr('content', raw.content),
      isFolder,
    }
  },
  delete_file_or_folder: (raw, ws) => ({
    path: validatePath(raw.path, ws),
    recursive: validateBoolean(raw.recursive, false),
  }),
  run_command: (raw) => ({
    command: validateStr('command', raw.command),
    cwd: validateOptionalStr('cwd', raw.cwd),
    timeout: validateNumber(raw.timeout, 30),
  }),
  open_terminal: (raw) => ({
    name: validateStr('name', raw.name),
    cwd: validateOptionalStr('cwd', raw.cwd),
  }),
  run_in_terminal: (raw) => ({
    terminalId: validateStr('terminal_id', raw.terminal_id),
    command: validateStr('command', raw.command),
    wait: validateBoolean(raw.wait, false),
  }),
  get_terminal_output: (raw) => ({
    terminalId: validateStr('terminal_id', raw.terminal_id),
    lines: validateNumber(raw.lines, 50),
  }),
  list_terminals: () => ({}),
  get_lint_errors: (raw, ws) => ({
    path: validatePath(raw.path, ws),
    refresh: validateBoolean(raw.refresh, false),
  }),
}

// ===== Search/Replace 解析 =====

export function parseSearchReplaceBlocks(blocksStr: string): SearchReplaceBlock[] {
  const blocks: SearchReplaceBlock[] = []
  // 严格格式: <<<SEARCH\n...\n===\n...\n>>>
  const regex = /<<<SEARCH\n([\s\S]*?)\n===\n([\s\S]*?)\n>>>/g
  let match

  while ((match = regex.exec(blocksStr)) !== null) {
    blocks.push({ search: match[1], replace: match[2] })
  }

  return blocks
}

export function applySearchReplaceBlocks(
  content: string,
  blocks: SearchReplaceBlock[]
): { newContent: string; appliedCount: number; errors: string[] } {
  let newContent = content
  let appliedCount = 0
  const errors: string[] = []

  for (const block of blocks) {
    if (newContent.includes(block.search)) {
      newContent = newContent.replace(block.search, block.replace)
      appliedCount++
    } else {
      // 尝试模糊匹配
      const normalizedSearch = block.search.replace(/\s+/g, ' ').trim()
      const normalizedContent = newContent.replace(/\s+/g, ' ')

      if (normalizedContent.includes(normalizedSearch)) {
        const lines = newContent.split('\n')
        const searchLines = block.search.split('\n')
        let found = false

        for (let i = 0; i <= lines.length - searchLines.length; i++) {
          const slice = lines.slice(i, i + searchLines.length).join('\n')
          if (slice.replace(/\s+/g, ' ').trim() === normalizedSearch) {
            lines.splice(i, searchLines.length, ...block.replace.split('\n'))
            newContent = lines.join('\n')
            appliedCount++
            found = true
            break
          }
        }

        if (!found) {
          errors.push(`Could not find exact match: "${block.search.slice(0, 50)}..."`)
        }
      } else {
        errors.push(`Search block not found: "${block.search.slice(0, 50)}..."`)
      }
    }
  }

  return { newContent, appliedCount, errors }
}

// ===== 目录树构建 =====

async function buildDirTree(
  dirPath: string,
  maxDepth: number,
  currentDepth: number = 0
): Promise<DirTreeNode[]> {
  if (currentDepth >= maxDepth) return []

  const items = await window.electronAPI.readDir(dirPath)
  if (!items) return []

  const nodes: DirTreeNode[] = []

  for (const item of items) {
    if (item.name.startsWith('.') || item.name === 'node_modules') continue

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

function formatDirTree(nodes: DirTreeNode[], prefix: string = ''): string {
  let result = ''

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i]
    const isLast = i === nodes.length - 1
    const connector = isLast ? '└── ' : '├── '
    const icon = node.isDirectory ? '📁 ' : '📄 '

    result += `${prefix}${connector}${icon}${node.name}\n`

    if (node.children?.length) {
      const childPrefix = prefix + (isLast ? '    ' : '│   ')
      result += formatDirTree(node.children, childPrefix)
    }
  }

  return result
}

// ===== 工具执行器 =====

export async function executeTool(
  toolName: string,
  rawParams: Record<string, unknown>,
  workspacePath?: string
): Promise<{ result: string; error?: string }> {
  try {
    // 验证参数
    const validator = validateParams[toolName as BuiltinToolName]
    if (!validator) {
      throw new Error(`Unknown tool: ${toolName}`)
    }

    const params = validator(rawParams, workspacePath)
    const result = await executeToolInternal(toolName as BuiltinToolName, params)
    return { result }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { result: '', error: message }
  }
}

async function executeToolInternal(
  toolName: BuiltinToolName,
  params: BuiltinToolParams[BuiltinToolName]
): Promise<string> {
  switch (toolName) {
    case 'read_file': {
      const p = params as BuiltinToolParams['read_file']
      const content = await window.electronAPI.readFile(p.path)
      if (content === null) throw new Error(`File not found: ${p.path}`)

      const lines = content.split('\n')
      const totalLines = lines.length
      const startLine = p.startLine ? Math.max(1, p.startLine) : 1
      const endLine = p.endLine ? Math.min(totalLines, p.endLine) : totalLines

      let selectedContent = lines.slice(startLine - 1, endLine).join('\n')
      const page = p.page || 1
      const startIdx = (page - 1) * PAGE_SIZE.FILE_CHARS
      const endIdx = page * PAGE_SIZE.FILE_CHARS
      const hasNextPage = selectedContent.length > endIdx

      selectedContent = selectedContent.slice(startIdx, endIdx)

      let result = `File: ${p.path}\nLines ${startLine}-${endLine} of ${totalLines}\n\`\`\`\n${selectedContent}\n\`\`\``
      if (hasNextPage) result += `\n\n(More on page ${page + 1}...)`
      return result
    }

    case 'list_directory': {
      const p = params as BuiltinToolParams['list_directory']
      const items = await window.electronAPI.readDir(p.path)
      if (!items?.length) return `Directory empty or not found: ${p.path}`

      const page = p.page || 1
      const startIdx = (page - 1) * PAGE_SIZE.DIR_ITEMS
      const endIdx = page * PAGE_SIZE.DIR_ITEMS
      const pageItems = items.slice(startIdx, endIdx)

      const formatted = pageItems
        .map((item) => `${item.isDirectory ? '📁' : '📄'} ${item.name}`)
        .join('\n')

      let result = `Contents of ${p.path} (${items.length} items):\n${formatted}`
      if (items.length > endIdx) result += `\n\n(${items.length - endIdx} more on page ${page + 1}...)`
      return result
    }

    case 'get_dir_tree': {
      const p = params as BuiltinToolParams['get_dir_tree']
      const tree = await buildDirTree(p.path, p.maxDepth || 3)
      if (!tree.length) return `Directory empty or not found: ${p.path}`
      return `Directory tree of ${p.path}:\n${formatDirTree(tree)}`
    }

    case 'search_files': {
      const p = params as BuiltinToolParams['search_files']
      const items = await window.electronAPI.readDir(p.path)
      if (!items) return `Directory not found: ${p.path}`

      const results: { file: string; matches: { line: number; content: string }[] }[] = []
      const regex = p.isRegex ? new RegExp(p.pattern, 'gi') : null
      const filePattern = p.filePattern
        ? new RegExp(p.filePattern.replace(/\*/g, '.*').replace(/\?/g, '.'), 'i')
        : null

      for (const item of items) {
        if (item.isDirectory) continue
        if (filePattern && !filePattern.test(item.name)) continue

        const content = await window.electronAPI.readFile(item.path)
        if (!content) continue

        const lines = content.split('\n')
        const matches: { line: number; content: string }[] = []

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i]
          const isMatch = regex
            ? regex.test(line)
            : line.toLowerCase().includes(p.pattern.toLowerCase())

          if (isMatch) {
            matches.push({ line: i + 1, content: line.trim().slice(0, 100) })
          }
          if (regex) regex.lastIndex = 0
        }

        if (matches.length > 0) {
          results.push({ file: item.name, matches: matches.slice(0, 5) })
        }
      }

      if (!results.length) return `No matches for "${p.pattern}" in ${p.path}`

      const page = p.page || 1
      const startIdx = (page - 1) * PAGE_SIZE.SEARCH_RESULTS
      const endIdx = page * PAGE_SIZE.SEARCH_RESULTS
      const pageResults = results.slice(startIdx, endIdx)

      let output = `Found ${results.length} files with matches:\n\n`
      for (const r of pageResults) {
        output += `📄 ${r.file}:\n`
        for (const m of r.matches) {
          output += `  Line ${m.line}: ${m.content}\n`
        }
        output += '\n'
      }

      if (results.length > endIdx) {
        output += `(${results.length - endIdx} more on page ${page + 1}...)`
      }
      return output
    }

    case 'search_in_file': {
      const p = params as BuiltinToolParams['search_in_file']
      const content = await window.electronAPI.readFile(p.path)
      if (content === null) throw new Error(`File not found: ${p.path}`)

      const lines = content.split('\n')
      const regex = p.isRegex ? new RegExp(p.pattern, 'gi') : null
      const matches: { line: number; content: string }[] = []

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        const isMatch = regex ? regex.test(line) : line.includes(p.pattern)
        if (isMatch) {
          matches.push({ line: i + 1, content: line.trim().slice(0, 100) })
        }
        if (regex) regex.lastIndex = 0
      }

      if (!matches.length) return `No matches for "${p.pattern}" in ${p.path}`

      let output = `Found ${matches.length} matches in ${p.path}:\n\n`
      for (const m of matches.slice(0, 50)) {
        output += `Line ${m.line}: ${m.content}\n`
      }
      if (matches.length > 50) output += `\n(${matches.length - 50} more...)`
      return output
    }

    case 'edit_file': {
      const p = params as BuiltinToolParams['edit_file']
      const content = await window.electronAPI.readFile(p.path)
      if (content === null) throw new Error(`File not found: ${p.path}`)

      const blocks = parseSearchReplaceBlocks(p.searchReplaceBlocks)
      if (!blocks.length) {
        throw new Error('No valid search/replace blocks. Use: <<<SEARCH\\nold\\n===\\nnew\\n>>>')
      }

      const { newContent, appliedCount, errors } = applySearchReplaceBlocks(content, blocks)
      if (appliedCount === 0) {
        throw new Error(`No changes applied. Errors:\n${errors.join('\n')}`)
      }

      const success = await window.electronAPI.writeFile(p.path, newContent)
      if (!success) throw new Error(`Failed to write: ${p.path}`)

      let result = `✅ Applied ${appliedCount}/${blocks.length} changes to ${p.path}`
      if (errors.length) result += `\n⚠️ Warnings:\n${errors.join('\n')}`
      return result
    }

    case 'write_file': {
      const p = params as BuiltinToolParams['write_file']
      const success = await window.electronAPI.writeFile(p.path, p.content)
      if (!success) throw new Error(`Failed to write: ${p.path}`)
      return `✅ Wrote ${p.content.length} chars to ${p.path}`
    }

    case 'create_file_or_folder': {
      const p = params as BuiltinToolParams['create_file_or_folder']
      if (p.isFolder) {
        const cleanPath = p.path.replace(/[/\\]$/, '')
        const success = await window.electronAPI.mkdir(cleanPath)
        if (!success) throw new Error(`Failed to create folder: ${cleanPath}`)
        return `✅ Created folder: ${cleanPath}`
      } else {
        const parentDir = p.path.replace(/[/\\][^/\\]+$/, '')
        if (parentDir && parentDir !== p.path) {
          await window.electronAPI.mkdir(parentDir)
        }
        const success = await window.electronAPI.writeFile(p.path, p.content || '')
        if (!success) throw new Error(`Failed to create file: ${p.path}`)
        return `✅ Created file: ${p.path}`
      }
    }

    case 'delete_file_or_folder': {
      const p = params as BuiltinToolParams['delete_file_or_folder']
      const success = await window.electronAPI.deleteFile(p.path)
      if (!success) throw new Error(`Failed to delete: ${p.path}`)
      return `✅ Deleted: ${p.path}`
    }

    case 'run_command': {
      const p = params as BuiltinToolParams['run_command']
      const timeout = (p.timeout || 30) * 1000
      const result = await Promise.race([
        window.electronAPI.executeCommand(p.command, p.cwd, timeout),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`Timeout after ${p.timeout}s`)), timeout + 1000)
        ),
      ])

      let output = `$ ${p.command}\n`
      if (p.cwd) output += `(cwd: ${p.cwd})\n`
      output += `Exit code: ${result.exitCode}\n\n`
      if (result.output) output += result.output
      if (result.errorOutput) output += `\nStderr:\n${result.errorOutput}`
      if (!result.output && !result.errorOutput) output += '(No output)'
      return output
    }

    case 'open_terminal': {
      const p = params as BuiltinToolParams['open_terminal']
      const terminal = await terminalService.openTerminal(p.name, p.cwd)
      return `✅ Opened terminal "${p.name}"\nID: ${terminal.id}\nCWD: ${terminal.cwd}`
    }

    case 'run_in_terminal': {
      const p = params as BuiltinToolParams['run_in_terminal']
      const result = await terminalService.runCommand(p.terminalId, p.command, p.wait || false)
      if (result.isComplete) {
        return `$ ${p.command}\nExit code: ${result.exitCode}\n\n${result.output}`
      }
      return `$ ${p.command}\nStarted in background. Use get_terminal_output to check.`
    }

    case 'get_terminal_output': {
      const p = params as BuiltinToolParams['get_terminal_output']
      const output = terminalService.getOutput(p.terminalId, p.lines || 50)
      return output.length ? output.join('\n') : '(No output yet)'
    }

    case 'list_terminals': {
      const terminals = terminalService.getAllTerminals()
      if (!terminals.length) return 'No open terminals.'

      let output = `Open terminals (${terminals.length}):\n\n`
      for (const t of terminals) {
        const status = t.isRunning ? '🟢 Running' : '⚪ Idle'
        output += `• ${t.name} (${t.id.slice(0, 8)}...)\n  Status: ${status}\n  CWD: ${t.cwd}\n\n`
      }
      return output
    }

    case 'get_lint_errors': {
      const p = params as BuiltinToolParams['get_lint_errors']
      const errors = await lintService.getLintErrors(p.path, p.refresh || false)
      return lintService.formatErrors(errors)
    }

    default:
      throw new Error(`Unknown tool: ${toolName}`)
  }
}

// ===== 导出 =====

export function getToolDefinitions(): ToolDefinition[] {
  return TOOL_DEFINITIONS
}

export function getToolApprovalType(toolName: string): ToolApprovalType | undefined {
  return APPROVAL_TYPE_OF_TOOL[toolName as BuiltinToolName]
}
