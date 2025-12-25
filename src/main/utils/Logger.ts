/**
 * Main进程日志工具
 * 与renderer进程的Logger保持一致的接口
 */

// 日志级别
export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

// 日志分类
export type LogCategory = 'LLM' | 'IPC' | 'File' | 'LSP' | 'Window' | 'System'

// 日志级别优先级
const LEVEL_PRIORITY: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
}

// 日志级别颜色（ANSI）
const LEVEL_COLORS: Record<LogLevel, string> = {
    debug: '\x1b[90m',   // gray
    info: '\x1b[36m',    // cyan
    warn: '\x1b[33m',    // yellow
    error: '\x1b[31m',   // red
}

// 分类颜色
const CATEGORY_COLORS: Record<LogCategory, string> = {
    LLM: '\x1b[34m',     // blue
    IPC: '\x1b[35m',     // magenta
    File: '\x1b[32m',    // green
    LSP: '\x1b[91m',     // light red
    Window: '\x1b[95m',  // light magenta
    System: '\x1b[37m',  // white
}

const RESET = '\x1b[0m'

class MainLoggerClass {
    private minLevel: LogLevel = 'info'
    private enabled = true

    /**
     * 设置最低日志级别
     */
    setMinLevel(level: LogLevel): void {
        this.minLevel = level
    }

    /**
     * 启用/禁用日志
     */
    setEnabled(enabled: boolean): void {
        this.enabled = enabled
    }

    /**
     * 核心日志方法
     */
    private log(level: LogLevel, category: LogCategory, message: string, data?: unknown): void {
        if (!this.enabled) return
        if (LEVEL_PRIORITY[level] < LEVEL_PRIORITY[this.minLevel]) return

        const now = new Date()
        const time = now.toTimeString().slice(0, 8) + '.' + now.getMilliseconds().toString().padStart(3, '0')

        const levelColor = LEVEL_COLORS[level]
        const categoryColor = CATEGORY_COLORS[category]

        const prefix = `\x1b[90m${time}${RESET} ${categoryColor}[${category}]${RESET} ${levelColor}[${level.toUpperCase()}]${RESET}`

        if (data !== undefined) {
            console.log(prefix, message, data)
        } else {
            console.log(prefix, message)
        }
    }

    // ===== 分类快捷方法 =====

    llm = {
        debug: (message: string, data?: unknown) => this.log('debug', 'LLM', message, data),
        info: (message: string, data?: unknown) => this.log('info', 'LLM', message, data),
        warn: (message: string, data?: unknown) => this.log('warn', 'LLM', message, data),
        error: (message: string, data?: unknown) => this.log('error', 'LLM', message, data),
    }

    ipc = {
        debug: (message: string, data?: unknown) => this.log('debug', 'IPC', message, data),
        info: (message: string, data?: unknown) => this.log('info', 'IPC', message, data),
        warn: (message: string, data?: unknown) => this.log('warn', 'IPC', message, data),
        error: (message: string, data?: unknown) => this.log('error', 'IPC', message, data),
    }

    file = {
        debug: (message: string, data?: unknown) => this.log('debug', 'File', message, data),
        info: (message: string, data?: unknown) => this.log('info', 'File', message, data),
        warn: (message: string, data?: unknown) => this.log('warn', 'File', message, data),
        error: (message: string, data?: unknown) => this.log('error', 'File', message, data),
    }

    lsp = {
        debug: (message: string, data?: unknown) => this.log('debug', 'LSP', message, data),
        info: (message: string, data?: unknown) => this.log('info', 'LSP', message, data),
        warn: (message: string, data?: unknown) => this.log('warn', 'LSP', message, data),
        error: (message: string, data?: unknown) => this.log('error', 'LSP', message, data),
    }

    window = {
        debug: (message: string, data?: unknown) => this.log('debug', 'Window', message, data),
        info: (message: string, data?: unknown) => this.log('info', 'Window', message, data),
        warn: (message: string, data?: unknown) => this.log('warn', 'Window', message, data),
        error: (message: string, data?: unknown) => this.log('error', 'Window', message, data),
    }

    system = {
        debug: (message: string, data?: unknown) => this.log('debug', 'System', message, data),
        info: (message: string, data?: unknown) => this.log('info', 'System', message, data),
        warn: (message: string, data?: unknown) => this.log('warn', 'System', message, data),
        error: (message: string, data?: unknown) => this.log('error', 'System', message, data),
    }
}

// 单例导出
export const logger = new MainLoggerClass()

// 默认导出
export default logger
