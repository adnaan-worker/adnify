/**
 * 共享常量配置
 * 集中管理所有硬编码值，实现定制化
 */

// ==========================================
// 文件和搜索限制（原 prompts.ts 硬编码）
// ==========================================

export const FILE_LIMITS = {
    /** 单个文件最大字符数 */
    MAX_FILE_CHARS: 60000,
    /** 目录列表最大条目数 */
    MAX_DIR_ITEMS: 150,
    /** 搜索结果最大数量 */
    MAX_SEARCH_RESULTS: 30,
    /** 终端输出最大字符数 */
    MAX_TERMINAL_OUTPUT: 3000,
    /** AI 上下文最大字符数 */
    MAX_CONTEXT_CHARS: 30000,
} as const

// ==========================================
// 布局限制（原 App.tsx 硬编码）
// ==========================================

export const LAYOUT_LIMITS = {
    /** ActivityBar 宽度 */
    ACTIVITY_BAR_WIDTH: 48,
    /** 侧边栏最小宽度 */
    SIDEBAR_MIN_WIDTH: 150,
    /** 侧边栏最大宽度 */
    SIDEBAR_MAX_WIDTH: 600,
    /** 聊天面板最小宽度 */
    CHAT_MIN_WIDTH: 300,
    /** 聊天面板最大宽度 */
    CHAT_MAX_WIDTH: 800,
} as const

// ==========================================
// 窗口默认值（原 main.ts 硬编码）
// ==========================================

export const WINDOW_DEFAULTS = {
    WIDTH: 1600,
    HEIGHT: 1000,
    MIN_WIDTH: 1200,
    MIN_HEIGHT: 700,
    BACKGROUND_COLOR: '#09090b',
} as const

// ==========================================
// 安全设置默认值（统一 main.ts 和 settingsSlice.ts）
// ==========================================

export const SECURITY_DEFAULTS = {
    /** 允许的 Shell 命令 */
    SHELL_COMMANDS: [
        // 包管理器
        'npm', 'yarn', 'pnpm', 'bun',
        // 运行时
        'node', 'npx', 'deno',
        // 版本控制
        'git',
        // 编程语言
        'python', 'python3', 'pip', 'pip3',
        'java', 'javac', 'mvn', 'gradle',
        'go', 'rust', 'cargo',
        // 构建工具
        'make', 'gcc', 'clang', 'cmake',
        // 常用命令
        'pwd', 'ls', 'dir', 'cat', 'type', 'echo', 'mkdir', 'touch', 'rm', 'mv', 'cp', 'cd',
    ],
    /** 允许的 Git 子命令 */
    GIT_SUBCOMMANDS: [
        // 查询命令
        'status', 'log', 'diff', 'show', 'ls-files', 'rev-parse', 'rev-list', 'blame',
        // 暂存和提交
        'add', 'commit', 'reset', 'restore',
        // 远程同步
        'push', 'pull', 'fetch', 'remote',
        // 分支管理
        'branch', 'checkout', 'switch', 'merge', 'rebase', 'cherry-pick',
        // 其他
        'clone', 'init', 'stash', 'tag', 'config',
    ],
} as const

// ==========================================
// AI 相关默认值（原 editorConfig.ts 和 settingsSlice.ts）
// ==========================================

export const AI_DEFAULTS = {
    /** 默认提供商 */
    DEFAULT_PROVIDER: 'openai' as const,
    /** 默认模型 */
    DEFAULT_MODEL: 'gpt-4o',
    /** 最大工具调用循环数 */
    MAX_TOOL_LOOPS: 15,
    /** 补全最大 token 数 */
    COMPLETION_MAX_TOKENS: 256,
    /** 补全温度 */
    COMPLETION_TEMPERATURE: 0.1,
} as const

// ==========================================
// LLM 调用默认参数
// ==========================================

export const LLM_DEFAULTS = {
    /** 默认温度 (0-2) */
    TEMPERATURE: 0.7,
    /** Top P 采样 (0-1) */
    TOP_P: 1,
    /** 最大输出 Token 数 */
    MAX_TOKENS: 8192,
    /** 请求超时 (ms) */
    TIMEOUT: 120000,
    /** 频率惩罚 (-2 to 2) */
    FREQUENCY_PENALTY: 0,
    /** 存在惩罚 (-2 to 2) */
    PRESENCE_PENALTY: 0,
} as const

// ==========================================
// 性能相关默认值
// ==========================================

export const PERFORMANCE_DEFAULTS = {
    /** 文件变化防抖延迟 (ms) */
    FILE_CHANGE_DEBOUNCE_MS: 300,
    /** 代码补全防抖延迟 (ms) */
    COMPLETION_DEBOUNCE_MS: 300,
    /** 搜索防抖延迟 (ms) */
    SEARCH_DEBOUNCE_MS: 200,
    /** Git 状态刷新间隔 (ms) */
    GIT_STATUS_INTERVAL_MS: 5000,
    /** API 请求超时 (ms) */
    REQUEST_TIMEOUT_MS: 120000,
    /** 命令执行超时 (ms) */
    COMMAND_TIMEOUT_MS: 30000,
} as const

// ==========================================
// Agent 相关默认值（原 AgentService.ts 硬编码）
// ==========================================

export const AGENT_DEFAULTS = {
    /** 工具执行默认超时 (ms) */
    TOOL_TIMEOUT_MS: 60000,
    /** 最大工具循环次数 */
    MAX_TOOL_LOOPS: 15,
    /** 重试延迟基础值 (ms) */
    RETRY_DELAY_MS: 1000,
    /** 最大重试次数 */
    MAX_RETRIES: 3,
    /** 重试退避倍数 */
    RETRY_BACKOFF_MULTIPLIER: 1.5,
    /** 上下文压缩阈值 (chars) */
    CONTEXT_COMPRESS_THRESHOLD: 40000,
    /** 保留最近对话轮数 (用于压缩) */
    KEEP_RECENT_TURNS: 3,
    /** 重复调用检测窗口大小 */
    MAX_RECENT_CALLS: 5,
    /** 最大连续重复次数 */
    MAX_CONSECUTIVE_REPEATS: 2,
    /** 单个文件内容最大长度 (用于上下文) */
    MAX_FILE_CONTENT_CHARS: 100000,
} as const

// ==========================================
// 工具分类（用于工具注册表）
// ==========================================

export const TOOL_CATEGORIES = {
    READ: 'read',
    WRITE: 'write',
    TERMINAL: 'terminal',
    SEARCH: 'search',
    LSP: 'lsp',
    NETWORK: 'network',
    PLAN: 'plan',
} as const

/** 只读类工具列表（可并行执行） */
export const READ_ONLY_TOOLS = [
    'read_file',
    'read_multiple_files',
    'list_directory',
    'get_dir_tree',
    'search_files',
    'codebase_search',
    'find_references',
    'go_to_definition',
    'get_hover_info',
    'get_document_symbols',
    'get_lint_errors',
    'web_search',
    'read_url',
] as const

/** 写入类工具列表（需要预览） */
export const WRITE_TOOLS = [
    'edit_file',
    'write_file',
    'replace_file_content',
    'create_file_or_folder',
] as const

// ==========================================
// 服务层默认值（统一各服务的超时和间隔）
// ==========================================

export const SERVICE_DEFAULTS = {
    /** LSP 请求超时 (ms) */
    LSP_TIMEOUT_MS: 30000,
    /** HTTP 请求超时 (ms) */
    HTTP_TIMEOUT_MS: 30000,
    /** 终端命令超时 (ms) */
    TERMINAL_TIMEOUT_MS: 30000,
    /** 缓存 TTL (ms) */
    CACHE_TTL_MS: 60000,
    /** Lint 缓存超时 (ms) */
    LINT_CACHE_TIMEOUT_MS: 30000,
    /** 文件监听间隔 (ms) */
    FILE_WATCH_INTERVAL_MS: 5000,
    /** 数据刷新间隔 (ms) */
    FLUSH_INTERVAL_MS: 5000,
    /** LSP 崩溃冷却时间 (ms) */
    LSP_CRASH_COOLDOWN_MS: 5000,
    /** 终端输出最大行数 */
    MAX_TERMINAL_OUTPUT_LINES: 1000,
} as const

// ==========================================
// 工具分类辅助函数
// ==========================================

/** 检查工具是否需要用户审批 */
export const isApprovalRequired = (toolName: string): boolean => {
    return toolName === 'delete_file_or_folder' || toolName === 'run_command'
}

/** 检查工具是否为文件写入类（需要代码预览） */
export const isFileWriteTool = (toolName: string): boolean => {
    return WRITE_TOOLS.includes(toolName as typeof WRITE_TOOLS[number])
}

/** 检查工具是否会修改文件系统（写入或删除） */
export const isFileModifyingTool = (toolName: string): boolean => {
    return isFileWriteTool(toolName) || toolName === 'delete_file_or_folder'
}

/** 检查工具是否为只读类（可并行执行） */
export const isReadOnlyTool = (toolName: string): boolean => {
    return READ_ONLY_TOOLS.includes(toolName as typeof READ_ONLY_TOOLS[number])
}

/** 检查工具是否需要显示代码差异（写入+删除+终端） */
export const shouldShowToolPreview = (toolName: string): boolean => {
    return isFileWriteTool(toolName) ||
        toolName === 'run_command' ||
        toolName === 'delete_file_or_folder'
}

/** 检查工具是否需要创建文件快照（用于撤销） */
export const shouldCreateSnapshot = (toolName: string): boolean => {
    return isFileModifyingTool(toolName)
}

/** 获取工具的审批类型 */
export const getToolApprovalType = (toolName: string): 'dangerous' | 'terminal' | undefined => {
    if (toolName === 'delete_file_or_folder') return 'dangerous'
    if (toolName === 'run_command') return 'terminal'
    return undefined
}
