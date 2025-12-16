/**
 * 工具类型定义
 * 参考 void 编辑器的 toolsServiceTypes.ts
 */

import { ToolApprovalType } from './chatTypes'

// ===== 内置工具名称 =====

export type BuiltinToolName =
  | 'read_file'
  | 'list_directory'
  | 'get_dir_tree'
  | 'search_files'
  | 'search_in_file'
  | 'search_pathnames'
  | 'edit_file'
  | 'write_file'
  | 'create_file_or_folder'
  | 'delete_file_or_folder'
  | 'run_command'
  | 'open_terminal'
  | 'run_in_terminal'
  | 'get_terminal_output'
  | 'list_terminals'
  | 'get_lint_errors'

export type ToolName = BuiltinToolName | (string & {})

// ===== 工具参数类型 =====

export interface BuiltinToolParams {
  read_file: {
    path: string
    startLine?: number
    endLine?: number
    page?: number
  }
  list_directory: {
    path: string
    page?: number
  }
  get_dir_tree: {
    path: string
    maxDepth?: number
  }
  search_files: {
    path: string
    pattern: string
    isRegex?: boolean
    filePattern?: string
    page?: number
  }
  search_in_file: {
    path: string
    pattern: string
    isRegex?: boolean
  }
  search_pathnames: {
    query: string
    includePattern?: string
    page?: number
  }
  edit_file: {
    path: string
    searchReplaceBlocks: string
  }
  write_file: {
    path: string
    content: string
  }
  create_file_or_folder: {
    path: string
    content?: string
    isFolder?: boolean
  }
  delete_file_or_folder: {
    path: string
    recursive?: boolean
  }
  run_command: {
    command: string
    cwd?: string
    timeout?: number
  }
  open_terminal: {
    name: string
    cwd?: string
  }
  run_in_terminal: {
    terminalId: string
    command: string
    wait?: boolean
  }
  get_terminal_output: {
    terminalId: string
    lines?: number
  }
  list_terminals: Record<string, never>
  get_lint_errors: {
    path: string
    refresh?: boolean
  }
}

// ===== 工具结果类型 =====

export interface LintErrorItem {
  code: string
  message: string
  startLineNumber: number
  endLineNumber: number
  severity: 'error' | 'warning'
}

export interface TerminalResolveReason {
  type: 'timeout' | 'done'
  exitCode?: number
}

export interface BuiltinToolResults {
  read_file: {
    fileContents: string
    totalFileLen: number
    totalNumLines: number
    hasNextPage: boolean
  }
  list_directory: {
    items: Array<{ name: string; path: string; isDirectory: boolean }>
    hasNextPage: boolean
    total: number
  }
  get_dir_tree: {
    tree: string
  }
  search_files: {
    results: Array<{
      file: string
      matches: Array<{ line: number; content: string }>
    }>
    hasNextPage: boolean
  }
  search_in_file: {
    lines: number[]
  }
  search_pathnames: {
    paths: string[]
    hasNextPage: boolean
  }
  edit_file: {
    appliedCount: number
    totalBlocks: number
    errors: string[]
    lintErrors?: LintErrorItem[]
  }
  write_file: {
    bytesWritten: number
    lintErrors?: LintErrorItem[]
  }
  create_file_or_folder: {
    created: boolean
    isFolder: boolean
  }
  delete_file_or_folder: {
    deleted: boolean
  }
  run_command: {
    output: string
    exitCode: number
    resolveReason: TerminalResolveReason
  }
  open_terminal: {
    terminalId: string
    name: string
    cwd: string
  }
  run_in_terminal: {
    output: string
    isComplete: boolean
    exitCode?: number
  }
  get_terminal_output: {
    output: string[]
  }
  list_terminals: {
    terminals: Array<{
      id: string
      name: string
      cwd: string
      isRunning: boolean
    }>
  }
  get_lint_errors: {
    errors: LintErrorItem[]
  }
}

// ===== 工具定义 =====

export interface ToolParameterProperty {
  type: string
  description: string
  enum?: string[]
}

export interface ToolDefinition {
  name: string
  description: string
  approvalType?: ToolApprovalType
  parameters: {
    type: 'object'
    properties: Record<string, ToolParameterProperty>
    required: string[]
  }
}

// ===== 工具调用 =====

export type ToolCallStatus = 'pending' | 'running' | 'success' | 'error' | 'rejected' | 'tool_request'

export interface ToolCall {
  id: string
  name: ToolName
  arguments: Record<string, unknown>
  status?: ToolCallStatus
  result?: string
  error?: string
  approvalType?: ToolApprovalType
}

// ===== 分页常量 =====

export const PAGE_SIZE = {
  FILE_CHARS: 500_000,
  DIR_ITEMS: 500,
  SEARCH_RESULTS: 50,
} as const

// ===== Search/Replace Block =====

export interface SearchReplaceBlock {
  search: string
  replace: string
}

// ===== 目录树节点 =====

export interface DirTreeNode {
  name: string
  path: string
  isDirectory: boolean
  children?: DirTreeNode[]
}

// ===== 工具验证器类型 =====

export type ToolValidator<T extends BuiltinToolName> = (
  rawParams: Record<string, unknown>
) => BuiltinToolParams[T]

export type ToolExecutor<T extends BuiltinToolName> = (
  params: BuiltinToolParams[T],
  context: ToolExecutionContext
) => Promise<{ result: BuiltinToolResults[T]; interrupt?: () => void }>

export type ToolResultStringifier<T extends BuiltinToolName> = (
  params: BuiltinToolParams[T],
  result: BuiltinToolResults[T]
) => string

export interface ToolExecutionContext {
  workspacePath?: string
  abortSignal?: AbortSignal
}

// ===== 工具审批配置 =====

export const APPROVAL_TYPE_OF_TOOL: Partial<Record<BuiltinToolName, ToolApprovalType>> = {
  edit_file: 'edits',
  write_file: 'edits',
  create_file_or_folder: 'edits',
  delete_file_or_folder: 'dangerous',
  run_command: 'terminal',
  open_terminal: 'terminal',
  run_in_terminal: 'terminal',
}

export function getToolApprovalType(toolName: string): ToolApprovalType | undefined {
  return APPROVAL_TYPE_OF_TOOL[toolName as BuiltinToolName]
}

export function isBuiltinTool(toolName: string): toolName is BuiltinToolName {
  return toolName in APPROVAL_TYPE_OF_TOOL || [
    'read_file',
    'list_directory',
    'get_dir_tree',
    'search_files',
    'search_in_file',
    'search_pathnames',
    'get_terminal_output',
    'list_terminals',
    'get_lint_errors',
  ].includes(toolName)
}
