/**
 * 统一日志工具
 * 提供结构化、分类的日志输出
 */

// 日志级别
export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

// 日志分类
export type LogCategory = 'Agent' | 'LLM' | 'Tool' | 'LSP' | 'UI' | 'System' | 'Completion' | 'Store'

// 日志条目
export interface LogEntry {
    timestamp: Date
    level: LogLevel
    category: LogCategory
    message: string
    data?: unknown
    duration?: number
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
}

class LoggerClass {
    private minLevel: LogLevel = 'info'
    private logs: LogEntry[] = []
    private maxLogs = 500
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
     * 获取所有日志
     */
    getLogs(): LogEntry[] {
        return [...this.logs]
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
    private log(level: LogLevel, category: LogCategory, message: string, data?: unknown, duration?: number): void {
        if (!this.enabled) return
        if (LEVEL_PRIORITY[level] < LEVEL_PRIORITY[this.minLevel]) return

        const entry: LogEntry = {
            timestamp: new Date(),
            level,
            category,
            message,
            data,
            duration,
        }

        // 添加到内存日志
        this.logs.push(entry)
        if (this.logs.length > this.maxLogs) {
            this.logs.shift()
        }

        // 控制台输出
        this.printToConsole(entry)
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
            fractionalSecondDigits: 3
        })

        const levelColor = LEVEL_COLORS[entry.level]
        const categoryColor = CATEGORY_COLORS[entry.category]

        const prefix = `%c${time}%c [${entry.category}]%c [${entry.level.toUpperCase()}]`
        const styles = [
            'color: #888',
            `color: ${categoryColor}; font-weight: bold`,
            `color: ${levelColor}; font-weight: bold`,
        ]

        const durationStr = entry.duration !== undefined ? ` (${entry.duration}ms)` : ''
        const fullMessage = `${entry.message}${durationStr}`

        const consoleMethod = entry.level === 'error' ? 'error'
            : entry.level === 'warn' ? 'warn'
                : 'log'

        if (entry.data !== undefined) {
            console[consoleMethod](prefix, ...styles, fullMessage, entry.data)
        } else {
            console[consoleMethod](prefix, ...styles, fullMessage)
        }
    }

    // ===== 分类快捷方法 =====

    agent = {
        debug: (message: string, data?: unknown) => this.log('debug', 'Agent', message, data),
        info: (message: string, data?: unknown) => this.log('info', 'Agent', message, data),
        warn: (message: string, data?: unknown) => this.log('warn', 'Agent', message, data),
        error: (message: string, data?: unknown) => this.log('error', 'Agent', message, data),
        time: (message: string, duration: number, data?: unknown) => this.log('info', 'Agent', message, data, duration),
    }

    llm = {
        debug: (message: string, data?: unknown) => this.log('debug', 'LLM', message, data),
        info: (message: string, data?: unknown) => this.log('info', 'LLM', message, data),
        warn: (message: string, data?: unknown) => this.log('warn', 'LLM', message, data),
        error: (message: string, data?: unknown) => this.log('error', 'LLM', message, data),
        time: (message: string, duration: number, data?: unknown) => this.log('info', 'LLM', message, data, duration),
    }

    tool = {
        debug: (message: string, data?: unknown) => this.log('debug', 'Tool', message, data),
        info: (message: string, data?: unknown) => this.log('info', 'Tool', message, data),
        warn: (message: string, data?: unknown) => this.log('warn', 'Tool', message, data),
        error: (message: string, data?: unknown) => this.log('error', 'Tool', message, data),
        time: (message: string, duration: number, data?: unknown) => this.log('info', 'Tool', message, data, duration),
    }

    lsp = {
        debug: (message: string, data?: unknown) => this.log('debug', 'LSP', message, data),
        info: (message: string, data?: unknown) => this.log('info', 'LSP', message, data),
        warn: (message: string, data?: unknown) => this.log('warn', 'LSP', message, data),
        error: (message: string, data?: unknown) => this.log('error', 'LSP', message, data),
        time: (message: string, duration: number, data?: unknown) => this.log('info', 'LSP', message, data, duration),
    }

    ui = {
        debug: (message: string, data?: unknown) => this.log('debug', 'UI', message, data),
        info: (message: string, data?: unknown) => this.log('info', 'UI', message, data),
        warn: (message: string, data?: unknown) => this.log('warn', 'UI', message, data),
        error: (message: string, data?: unknown) => this.log('error', 'UI', message, data),
        time: (message: string, duration: number, data?: unknown) => this.log('info', 'UI', message, data, duration),
    }

    system = {
        debug: (message: string, data?: unknown) => this.log('debug', 'System', message, data),
        info: (message: string, data?: unknown) => this.log('info', 'System', message, data),
        warn: (message: string, data?: unknown) => this.log('warn', 'System', message, data),
        error: (message: string, data?: unknown) => this.log('error', 'System', message, data),
        time: (message: string, duration: number, data?: unknown) => this.log('info', 'System', message, data, duration),
    }

    completion = {
        debug: (message: string, data?: unknown) => this.log('debug', 'Completion', message, data),
        info: (message: string, data?: unknown) => this.log('info', 'Completion', message, data),
        warn: (message: string, data?: unknown) => this.log('warn', 'Completion', message, data),
        error: (message: string, data?: unknown) => this.log('error', 'Completion', message, data),
        time: (message: string, duration: number, data?: unknown) => this.log('info', 'Completion', message, data, duration),
    }

    store = {
        debug: (message: string, data?: unknown) => this.log('debug', 'Store', message, data),
        info: (message: string, data?: unknown) => this.log('info', 'Store', message, data),
        warn: (message: string, data?: unknown) => this.log('warn', 'Store', message, data),
        error: (message: string, data?: unknown) => this.log('error', 'Store', message, data),
        time: (message: string, duration: number, data?: unknown) => this.log('info', 'Store', message, data, duration),
    }

    // 通用方法（用于动态分类）
    logWithCategory(level: LogLevel, category: LogCategory, message: string, data?: unknown): void {
        this.log(level, category, message, data)
    }
}

// 单例导出
export const logger = new LoggerClass()

// 默认导出
export default logger
