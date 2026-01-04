/**
 * 调试器类型定义
 * 基于 Debug Adapter Protocol (DAP)
 * https://microsoft.github.io/debug-adapter-protocol/
 */

/** 调试器状态 */
export type DebuggerState = 'idle' | 'running' | 'paused' | 'stopped'

/** 断点 */
export interface Breakpoint {
  id: string
  file: string
  line: number
  column?: number
  condition?: string
  hitCondition?: string
  logMessage?: string
  verified: boolean
}

/** 源断点（设置断点时使用） */
export interface SourceBreakpoint {
  line: number
  column?: number
  condition?: string
  hitCondition?: string
  logMessage?: string
}

/** 堆栈帧 */
export interface StackFrame {
  id: number
  name: string
  source?: Source
  line: number
  column: number
  endLine?: number
  endColumn?: number
  moduleId?: string | number
  presentationHint?: 'normal' | 'label' | 'subtle'
}

/** 源文件 */
export interface Source {
  name?: string
  path?: string
  sourceReference?: number
  presentationHint?: 'normal' | 'emphasize' | 'deemphasize'
  origin?: string
}

/** 线程 */
export interface Thread {
  id: number
  name: string
}

/** 变量 */
export interface Variable {
  name: string
  value: string
  type?: string
  variablesReference: number
  namedVariables?: number
  indexedVariables?: number
  evaluateName?: string
  memoryReference?: string
}

/** 作用域 */
export interface Scope {
  name: string
  variablesReference: number
  namedVariables?: number
  indexedVariables?: number
  expensive: boolean
  source?: Source
  line?: number
  column?: number
  endLine?: number
  endColumn?: number
}

/** 调试适配器配置 */
export interface DebugAdapterDescriptor {
  type: 'executable' | 'server'
  /** 可执行文件路径 (type=executable) */
  command?: string
  /** 命令参数 */
  args?: string[]
  /** 服务器端口 (type=server) */
  port?: number
  /** 服务器主机 */
  host?: string
}

/** 调试配置 */
export interface DebugConfig {
  /** 调试类型 (node, python, go, etc.) */
  type: string
  /** 配置名称 */
  name: string
  /** 请求类型 */
  request: 'launch' | 'attach'
  /** 程序路径 */
  program?: string
  /** 程序参数 */
  args?: string[]
  /** 工作目录 */
  cwd?: string
  /** 环境变量 */
  env?: Record<string, string>
  /** 端口 (attach) */
  port?: number
  /** 主机 (attach) */
  host?: string
  /** 是否在入口暂停 */
  stopOnEntry?: boolean
  /** 控制台类型 */
  console?: 'internalConsole' | 'integratedTerminal' | 'externalTerminal'
  /** 其他配置 */
  [key: string]: unknown
}

/** 调试事件 */
export type DebugEvent =
  | { type: 'initialized' }
  | { type: 'stopped'; reason: string; threadId?: number; allThreadsStopped?: boolean; hitBreakpointIds?: number[] }
  | { type: 'continued'; threadId?: number; allThreadsContinued?: boolean }
  | { type: 'exited'; exitCode: number }
  | { type: 'terminated'; restart?: boolean }
  | { type: 'thread'; reason: 'started' | 'exited'; threadId: number }
  | { type: 'output'; category: 'console' | 'stdout' | 'stderr' | 'telemetry'; output: string; source?: Source; line?: number }
  | { type: 'breakpoint'; reason: 'changed' | 'new' | 'removed'; breakpoint: Breakpoint }
  | { type: 'module'; reason: 'new' | 'changed' | 'removed'; module: { id: string | number; name: string } }
  | { type: 'process'; name: string; startMethod?: 'launch' | 'attach' }
  | { type: 'capabilities'; capabilities: DebugCapabilities }

/** 调试器能力 */
export interface DebugCapabilities {
  supportsConfigurationDoneRequest?: boolean
  supportsFunctionBreakpoints?: boolean
  supportsConditionalBreakpoints?: boolean
  supportsHitConditionalBreakpoints?: boolean
  supportsEvaluateForHovers?: boolean
  supportsStepBack?: boolean
  supportsSetVariable?: boolean
  supportsRestartFrame?: boolean
  supportsGotoTargetsRequest?: boolean
  supportsStepInTargetsRequest?: boolean
  supportsCompletionsRequest?: boolean
  supportsModulesRequest?: boolean
  supportsRestartRequest?: boolean
  supportsExceptionOptions?: boolean
  supportsValueFormattingOptions?: boolean
  supportsExceptionInfoRequest?: boolean
  supportTerminateDebuggee?: boolean
  supportsDelayedStackTraceLoading?: boolean
  supportsLoadedSourcesRequest?: boolean
  supportsLogPoints?: boolean
  supportsTerminateThreadsRequest?: boolean
  supportsSetExpression?: boolean
  supportsTerminateRequest?: boolean
  supportsDataBreakpoints?: boolean
  supportsReadMemoryRequest?: boolean
  supportsDisassembleRequest?: boolean
  supportsCancelRequest?: boolean
  supportsBreakpointLocationsRequest?: boolean
  supportsClipboardContext?: boolean
  supportsSteppingGranularity?: boolean
  supportsInstructionBreakpoints?: boolean
  supportsExceptionFilterOptions?: boolean
}

/** 已知的调试适配器类型 */
export interface DebugAdapterInfo {
  type: string
  label: string
  /** 语言 ID 列表 */
  languages: string[]
  /** 获取适配器描述符 */
  getDescriptor: (config: DebugConfig) => Promise<DebugAdapterDescriptor>
  /** 默认配置模板 */
  configurationSnippets: DebugConfigSnippet[]
}

/** 配置代码片段 */
export interface DebugConfigSnippet {
  label: string
  description: string
  body: DebugConfig
}
