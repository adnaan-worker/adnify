/**
 * 统一日志工具 - 跨进程通用
 * 支持 Main 进程和 Renderer 进程
 */

// 日志级别
export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

// 日志分类 - 扩展支持更多模块
export type LogCategory =
  | 'Agent'
  | 'LLM'
  | 'Tool'
  | 'LSP'
  | 'UI'
  | 'System'
  | 'Completion'
  | 'Store'
  | 'File'
  | 'Git'
  | 'IPC'
  | 'Index'
  | 'Security'
  | 'Settings'
  | 'Terminal'

// 日志条目
export interface LogEntry {
  timestamp: Date
  level: LogLevel
  category: LogCategory
  message: string
  data?: unknown
  duration?: number
  source?: 'main' | 'renderer'
}

// 日志级别优先级
const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

// 日志级别颜色（控制台）
const LEVEL_COLORS: Record<LogLevel, string> = {
  debug: '#888888',
  info: '#00bcd4',
  warn: '#ff9800',
  error: '#f44336',
}

// 分类颜色
const CATEGORY_COLORS: Record<LogCategory, string> = {
  Agent: '#9c27b0',
  LLM: '#2196f3',
  Tool: '#4caf50',
  LSP: '#ff5722',
  UI: '#e91e63',
  System: '#607d8b',
  Completion: '#00bcd4',
  Store: '#795548',
  File: '#8bc34a',
  Git: '#ff9800',
  IPC: '#3f51b5',
  Index: '#009688',
  Security: '#f44336',
  Settings: '#673ab7',
  Terminal: '#00bcd4',
}

// 日志配置
interface LoggerConfig {
  minLevel: LogLevel
  enabled: boolean
  maxLogs: number
  fileLogging: boolean
  consoleLogging: boolean
}

class LoggerClass {
  private config: LoggerConfig = {
    minLevel: 'info',
    enabled: true,
    maxLogs: 500,
    fileLogging: false,
    consoleLogging: true,
  }
  private logs: LogEntry[] = []
  private isMain = typeof window === 'undefined'

  /**
   * 配置日志器
   */
  configure(config: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...config }
  }

  /**
   * 设置最低日志级别
   */
  setMinLevel(level: LogLevel): void {
    this.config.minLevel = level
  }

  /**
   * 启用/禁用日志
   */
  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled
  }

  /**
   * 获取所有日志
   */
  getLogs(): LogEntry[] {
    return [...this.logs]
  }

  /**
   * 按分类获取日志
   */
  getLogsByCategory(category: LogCategory): LogEntry[] {
    return this.logs.filter(log => log.category === category)
  }

  /**
   * 按级别获取日志
   */
  getLogsByLevel(level: LogLevel): LogEntry[] {
    return this.logs.filter(log => log.level === level)
  }

  /**
   * 清空日志
   */
  clearLogs(): void {
    this.logs = []
  }

  /**
   * 核心日志方法
   */
  private log(
    level: LogLevel,
    category: LogCategory,
    message: string,
    data?: unknown,
    duration?: number
  ): void {
    if (!this.config.enabled) return
    if (LEVEL_PRIORITY[level] < LEVEL_PRIORITY[this.config.minLevel]) return

    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      category,
      message,
      data,
      duration,
      source: this.isMain ? 'main' : 'renderer',
    }

    // 添加到内存日志
    this.logs.push(entry)
    if (this.logs.length > this.config.maxLogs) {
      this.logs.shift()
    }

    // 控制台输出
    if (this.config.consoleLogging) {
      this.printToConsole(entry)
    }
  }

  /**
   * 格式化控制台输出
   */
  private printToConsole(entry: LogEntry): void {
    const time = entry.timestamp.toLocaleTimeString('zh-CN', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3,
    })

    const levelColor = LEVEL_COLORS[entry.level]
    const categoryColor = CATEGORY_COLORS[entry.category]
    const sourceTag = this.isMain ? '[M]' : '[R]'

    const prefix = `%c${time}%c ${sourceTag}%c [${entry.category}]%c [${entry.level.toUpperCase()}]`
    const styles = [
      'color: #888',
      'color: #666',
      `color: ${categoryColor}; font-weight: bold`,
      `color: ${levelColor}; font-weight: bold`,
    ]

    const durationStr = entry.duration !== undefined ? ` (${entry.duration}ms)` : ''
    const fullMessage = `${entry.message}${durationStr}`

    const consoleMethod =
      entry.level === 'error' ? 'error' : entry.level === 'warn' ? 'warn' : 'log'

    if (entry.data !== undefined) {
      console[consoleMethod](prefix, ...styles, fullMessage, entry.data)
    } else {
      console[consoleMethod](prefix, ...styles, fullMessage)
    }
  }

  // ===== 分类快捷方法 =====

  private createCategoryLogger(category: LogCategory) {
    return {
      debug: (message: string, ...args: unknown[]) => this.log('debug', category, message, args.length > 0 ? args : undefined),
      info: (message: string, ...args: unknown[]) => this.log('info', category, message, args.length > 0 ? args : undefined),
      warn: (message: string, ...args: unknown[]) => this.log('warn', category, message, args.length > 0 ? args : undefined),
      error: (message: string, ...args: unknown[]) => this.log('error', category, message, args.length > 0 ? args : undefined),
      time: (message: string, duration: number, data?: unknown) =>
        this.log('info', category, message, data, duration),
    }
  }

  agent = this.createCategoryLogger('Agent')
  llm = this.createCategoryLogger('LLM')
  tool = this.createCategoryLogger('Tool')
  lsp = this.createCategoryLogger('LSP')
  ui = this.createCategoryLogger('UI')
  system = this.createCategoryLogger('System')
  completion = this.createCategoryLogger('Completion')
  store = this.createCategoryLogger('Store')
  file = this.createCategoryLogger('File')
  git = this.createCategoryLogger('Git')
  ipc = this.createCategoryLogger('IPC')
  index = this.createCategoryLogger('Index')
  security = this.createCategoryLogger('Security')
  settings = this.createCategoryLogger('Settings')
  terminal = this.createCategoryLogger('Terminal')

  // 通用方法（用于动态分类）
  logWithCategory(level: LogLevel, category: LogCategory, message: string, data?: unknown): void {
    this.log(level, category, message, data)
  }
}

// 单例导出
export const logger = new LoggerClass()

// 默认导出
export default logger
