/**
 * Monaco TypeScript 语言服务管理
 * 配置 TypeScript 编译选项以支持跨文件跳转和智能感知
 */

import { logger } from '@utils/Logger'
import type * as Monaco from 'monaco-editor'
import { getEditorConfig } from '@renderer/config/editorConfig'

// Monaco 实例引用
let monacoInstance: typeof Monaco | null = null
let isInitialized = false

// 已添加的 extraLib 缓存
const extraLibCache = new Map<string, Monaco.IDisposable>()

/**
 * 初始化 Monaco TypeScript 服务
 */
export function initMonacoTypeService(monaco: typeof Monaco) {
  if (isInitialized) return

  monacoInstance = monaco
  isInitialized = true

  // 配置 TypeScript 编译选项
  const compilerOptions: Monaco.languages.typescript.CompilerOptions = {
    target: monaco.languages.typescript.ScriptTarget.ESNext,
    module: monaco.languages.typescript.ModuleKind.ESNext,
    moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
    jsx: monaco.languages.typescript.JsxEmit.React,
    jsxImportSource: 'react',
    allowJs: true,
    checkJs: false,
    strict: false,
    esModuleInterop: true,
    skipLibCheck: true,
    allowSyntheticDefaultImports: true,
    resolveJsonModule: true,
    isolatedModules: true,
    noEmit: true,
    // 路径映射
    baseUrl: '.',
    paths: {
      '@/*': ['src/*'],
      '~/*': ['src/*'],
    },
  }

  monaco.languages.typescript.typescriptDefaults.setCompilerOptions(compilerOptions)
  monaco.languages.typescript.javascriptDefaults.setCompilerOptions(compilerOptions)

  // 设置诊断选项
  // 禁用语义验证以避免跨文件解析时的 URI 不匹配错误
  // 跳转功能通过 Editor.tsx 中的 LinkProvider 实现
  monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
    noSemanticValidation: true,
    noSyntaxValidation: false,
    noSuggestionDiagnostics: true,
  })

  monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
    noSemanticValidation: true,
    noSyntaxValidation: false,
    noSuggestionDiagnostics: true,
  })

  // 启用 eager model sync - 关键！这让 TypeScript 服务能看到所有模型
  monaco.languages.typescript.typescriptDefaults.setEagerModelSync(true)
  monaco.languages.typescript.javascriptDefaults.setEagerModelSync(true)

  logger.system.info('[MonacoTypeService] Initialized with eager model sync')
}

/**
 * 添加文件到 TypeScript 语言服务（作为 extraLib）
 * 用于添加项目中未打开的文件，以支持跳转
 */
export function addFileToTypeService(filePath: string, content: string) {
  if (!monacoInstance) return

  // 使用 Uri.file() 确保格式一致
  const uri = monacoInstance.Uri.file(filePath)
  const uriString = uri.toString()

  // 检查是否已经有这个文件的模型（已打开的文件）
  if (monacoInstance.editor.getModel(uri)) {
    // 已打开的文件不需要添加 extraLib，模型已经存在
    return
  }

  // 移除旧的 extraLib
  const oldDisposable = extraLibCache.get(uriString)
  if (oldDisposable) {
    oldDisposable.dispose()
    extraLibCache.delete(uriString)
  }

  // 获取语言
  const ext = filePath.split('.').pop()?.toLowerCase() || ''
  const isTypeScript = ['ts', 'tsx'].includes(ext)
  const isJavaScript = ['js', 'jsx', 'mjs', 'cjs'].includes(ext)

  let disposable: Monaco.IDisposable | undefined

  if (isTypeScript) {
    disposable = monacoInstance.languages.typescript.typescriptDefaults.addExtraLib(
      content,
      uriString
    )
  } else if (isJavaScript) {
    disposable = monacoInstance.languages.typescript.javascriptDefaults.addExtraLib(
      content,
      uriString
    )
  }

  if (disposable) {
    extraLibCache.set(uriString, disposable)
  }
}

/**
 * 递归获取目录中的所有 TS/JS 文件
 */
async function getProjectFiles(
  dirPath: string,
  maxDepth?: number,
  currentDepth = 0
): Promise<string[]> {
  const config = getEditorConfig()
  const actualMaxDepth = maxDepth ?? config.performance.maxFileTreeDepth
  
  if (currentDepth >= actualMaxDepth) return []

  const files: string[] = []
  const ignoredDirs = config.ignoredDirectories

  try {
    const entries = await window.electronAPI.readDir(dirPath)

    for (const entry of entries) {
      // 跳过不需要的目录
      if (entry.isDirectory) {
        const dirName = entry.name.toLowerCase()
        if (ignoredDirs.includes(dirName)) {
          continue
        }
        // 递归处理子目录
        const subFiles = await getProjectFiles(entry.path, actualMaxDepth, currentDepth + 1)
        files.push(...subFiles)
      } else {
        // 检查是否是 TS/JS 文件
        const ext = entry.name.split('.').pop()?.toLowerCase() || ''
        if (['ts', 'tsx', 'js', 'jsx'].includes(ext)) {
          files.push(entry.path)
        }
      }
    }
  } catch {
    // 忽略读取错误
  }

  return files
}

/**
 * 批量添加项目文件到语言服务
 */
export async function addProjectFilesToTypeService(workspacePath: string) {
  if (!monacoInstance || !workspacePath) return

  try {
    logger.system.info('[MonacoTypeService] Scanning project files...')

    // 获取项目中的 TS/JS 文件
    const files = await getProjectFiles(workspacePath)

    // 限制文件数量避免性能问题
    const maxFiles = getEditorConfig().performance.maxProjectFiles
    const filesToAdd = files.slice(0, maxFiles)

    let addedCount = 0
    for (const filePath of filesToAdd) {
      try {
        const content = await window.electronAPI.readFile(filePath)
        if (content) {
          addFileToTypeService(filePath, content)
          addedCount++
        }
      } catch {
        // 忽略读取失败的文件
      }
    }

    logger.system.info(`[MonacoTypeService] Added ${addedCount} files to language service`)
  } catch (error) {
    logger.system.error('[MonacoTypeService] Failed to add project files:', error)
  }
}

/**
 * 清理所有 extraLib
 */
export function clearExtraLibs() {
  extraLibCache.forEach((disposable) => disposable.dispose())
  extraLibCache.clear()
}

/**
 * 获取 Monaco 实例
 */
export function getMonacoInstance() {
  return monacoInstance
}
