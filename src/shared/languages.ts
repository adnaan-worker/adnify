/**
 * 语言配置
 * 统一管理文件扩展名到语言 ID 的映射，避免重复定义
 */

// ==========================================
// 文件扩展名 -> 语言 ID 映射
// ==========================================

export const EXTENSION_TO_LANGUAGE: Record<string, string> = {
    // JavaScript / TypeScript
    ts: 'typescript',
    tsx: 'typescriptreact',
    js: 'javascript',
    jsx: 'javascriptreact',
    mjs: 'javascript',
    cjs: 'javascript',

    // Python
    py: 'python',
    pyw: 'python',
    pyi: 'python',
    pyx: 'python',

    // Rust
    rs: 'rust',

    // Go
    go: 'go',

    // Java / Kotlin / Scala
    java: 'java',
    kt: 'kotlin',
    kts: 'kotlin',
    scala: 'scala',

    // C / C++
    c: 'c',
    h: 'c',
    cpp: 'cpp',
    hpp: 'cpp',
    cc: 'cpp',
    cxx: 'cpp',
    hxx: 'cpp',

    // C#
    cs: 'csharp',

    // Web - Markup
    html: 'html',
    htm: 'html',
    vue: 'vue',
    svelte: 'svelte',

    // Web - Styles
    css: 'css',
    scss: 'scss',
    sass: 'sass',
    less: 'less',
    styl: 'stylus',

    // Data formats
    json: 'json',
    jsonc: 'jsonc',
    json5: 'json5',
    yaml: 'yaml',
    yml: 'yaml',
    toml: 'toml',
    xml: 'xml',
    svg: 'xml',

    // Shell
    sh: 'shell',
    bash: 'shell',
    zsh: 'shell',
    fish: 'shell',
    ps1: 'powershell',
    psm1: 'powershell',
    bat: 'batch',
    cmd: 'batch',

    // Markdown / Documentation
    md: 'markdown',
    mdx: 'mdx',
    rst: 'restructuredtext',
    tex: 'latex',

    // Database
    sql: 'sql',
    mysql: 'sql',
    pgsql: 'sql',

    // Other languages
    rb: 'ruby',
    php: 'php',
    swift: 'swift',
    dart: 'dart',
    lua: 'lua',
    r: 'r',
    R: 'r',
    jl: 'julia',
    ex: 'elixir',
    exs: 'elixir',
    erl: 'erlang',
    hrl: 'erlang',
    hs: 'haskell',
    lhs: 'haskell',
    ml: 'ocaml',
    mli: 'ocaml',
    clj: 'clojure',
    cljs: 'clojure',
    fs: 'fsharp',
    fsx: 'fsharp',
    nim: 'nim',
    zig: 'zig',
    v: 'v',
    sol: 'solidity',

    // Config files
    dockerfile: 'dockerfile',
    makefile: 'makefile',
    cmake: 'cmake',
    gradle: 'groovy',
    groovy: 'groovy',

    // GraphQL
    graphql: 'graphql',
    gql: 'graphql',

    // Protocol Buffers
    proto: 'protobuf',
}

// ==========================================
// LSP 支持的语言
// ==========================================

export const LSP_SUPPORTED_LANGUAGES = [
    // 完全支持（内置 LSP）
    'typescript',
    'typescriptreact',
    'javascript',
    'javascriptreact',
    'html',
    'css',
    'scss',
    'less',
    'json',
    'jsonc',
    // 新增支持（需要外部 LSP 服务器）
    'python',  // pylsp / pyright
    'go',      // gopls
    'rust',    // rust-analyzer
    'c',       // clangd
    'cpp',     // clangd
    'vue',     // vue-language-server
] as const

// 可扩展支持（需要额外 LSP 服务器）
export const LSP_EXTENSIBLE_LANGUAGES = [
    'java',    // jdtls
    'csharp',  // omnisharp
    'kotlin',  // kotlin-language-server
    'swift',   // sourcekit-lsp
    'ruby',    // solargraph
    'php',     // intelephense
    'elixir',  // elixir-ls
    'zig',     // zls
] as const

// ==========================================
// 忽略目录（完整列表）
// ==========================================

export const IGNORED_DIRECTORIES = [
    // Node.js / JavaScript
    'node_modules',
    '.npm',
    '.yarn',
    '.pnpm-store',
    'bower_components',

    // Build outputs
    'dist',
    'build',
    'out',
    '.next',
    '.nuxt',
    '.output',
    '.svelte-kit',
    '.parcel-cache',
    '.turbo',

    // Caches
    '.cache',
    '__pycache__',
    '.pytest_cache',
    '.mypy_cache',
    '.ruff_cache',
    '.tox',

    // Version control
    '.git',
    '.svn',
    '.hg',
    '.bzr',

    // IDE / Editor
    '.vscode',
    '.idea',
    '.vs',
    '.fleet',

    // Language-specific
    'vendor',           // Go, PHP, Ruby
    'target',           // Rust, Java (Maven)
    '.venv',            // Python
    'venv',             // Python
    'env',              // Python
    '.virtualenv',      // Python
    '__pypackages__',   // Python (PDM)
    '.gradle',          // Java (Gradle)
    '.maven',           // Java (Maven)
    'Pods',             // iOS (CocoaPods)
    'DerivedData',      // iOS (Xcode)
    '.dart_tool',       // Dart
    '.pub-cache',       // Dart
    'zig-cache',        // Zig
    '_build',           // Elixir
    'deps',             // Elixir

    // Coverage / Testing
    'coverage',
    '.nyc_output',
    'htmlcov',
    '.coverage',

    // Misc
    'tmp',
    'temp',
    'logs',
    '.DS_Store',
    'Thumbs.db',
] as const

// ==========================================
// FIM (Fill-in-the-Middle) 支持的模型
// ==========================================

export const FIM_CAPABLE_MODELS = [
    'deepseek-coder',
    'deepseek-coder-v2',
    'codellama',
    'code-llama',
    'starcoder',
    'starcoder2',
    'qwen-coder',
    'qwen2.5-coder',
    'yi-coder',
    'codestral',
    'codegemma',
] as const

// ==========================================
// 语言 ID -> LSP 语言 ID 映射 (用于 LSP 通信)
// ==========================================

export const LANGUAGE_TO_LSP_ID: Record<string, string> = {
    typescript: 'typescript',
    typescriptreact: 'typescriptreact',
    javascript: 'javascript',
    javascriptreact: 'javascriptreact',
    html: 'html',
    css: 'css',
    scss: 'scss',
    less: 'less',
    json: 'json',
    jsonc: 'jsonc',
    python: 'python',
    rust: 'rust',
    go: 'go',
    java: 'java',
}

// ==========================================
// 辅助函数
// ==========================================

/**
 * 根据文件路径获取语言 ID
 */
export function getLanguageFromPath(filePath: string): string {
    const ext = filePath.split('.').pop()?.toLowerCase() || ''
    return EXTENSION_TO_LANGUAGE[ext] || 'plaintext'
}

/**
 * 检查语言是否支持 LSP
 */
export function isLspSupported(languageId: string): boolean {
    return (LSP_SUPPORTED_LANGUAGES as readonly string[]).includes(languageId)
}

/**
 * 检查目录是否应被忽略
 */
export function shouldIgnoreDirectory(dirName: string): boolean {
    return IGNORED_DIRECTORIES.includes(dirName as any)
}
