/**
 * Code Apply Service
 * 处理代码块的应用、Diff 预览和编辑操作
 */

import { toFullPath } from '@utils/pathUtils'

// ===== 类型定义 =====

export interface CodeBlock {
  id: string
  language: string
  code: string
  filePath?: string  // 从代码块第一行或上下文推断
  startLine?: number
  endLine?: number
}

export interface ApplyResult {
  success: boolean
  filePath: string
  originalContent: string
  newContent: string
  error?: string
}

export interface DiffLine {
  type: 'unchanged' | 'added' | 'removed'
  content: string
  oldLineNumber?: number
  newLineNumber?: number
}

// ===== 代码块解析 =====

/**
 * 从 Markdown 内容中提取代码块
 */
export function extractCodeBlocks(markdown: string): CodeBlock[] {
  const blocks: CodeBlock[] = []
  const regex = /```(\w+)?\s*(?:\n)?(?:\/\/\s*(.+?)\n|#\s*(.+?)\n)?([\s\S]*?)```/g
  let match

  while ((match = regex.exec(markdown)) !== null) {
    const language = match[1] || ''
    const commentPath = match[2] || match[3] // // path 或 # path
    const code = match[4].trim()
    
    // 尝试从代码第一行提取文件路径
    let filePath = commentPath
    if (!filePath) {
      const firstLine = code.split('\n')[0]
      // 检查是否是文件路径注释
      const pathMatch = firstLine.match(/^(?:\/\/|#|\/\*)\s*(?:file:|path:)?\s*(.+?)(?:\s*\*\/)?$/)
      if (pathMatch) {
        filePath = pathMatch[1].trim()
      }
    }

    blocks.push({
      id: crypto.randomUUID(),
      language,
      code,
      filePath,
    })
  }

  return blocks
}

/**
 * 推断代码块的目标文件路径
 */
export function inferFilePath(
  codeBlock: CodeBlock,
  context: { activeFile?: string; openFiles?: string[] }
): string | null {
  // 1. 如果代码块已有路径，直接使用
  if (codeBlock.filePath) {
    return codeBlock.filePath
  }

  // 2. 根据语言和当前活动文件推断
  const langExtMap: Record<string, string[]> = {
    typescript: ['.ts', '.tsx'],
    javascript: ['.js', '.jsx'],
    python: ['.py'],
    java: ['.java'],
    cpp: ['.cpp', '.cc', '.cxx', '.hpp', '.h'],
    c: ['.c', '.h'],
    rust: ['.rs'],
    go: ['.go'],
    ruby: ['.rb'],
    php: ['.php'],
    swift: ['.swift'],
    kotlin: ['.kt', '.kts'],
    scala: ['.scala'],
    css: ['.css', '.scss', '.less'],
    html: ['.html', '.htm'],
    json: ['.json'],
    yaml: ['.yaml', '.yml'],
    xml: ['.xml'],
    sql: ['.sql'],
    shell: ['.sh', '.bash'],
    powershell: ['.ps1'],
  }

  const extensions = langExtMap[codeBlock.language.toLowerCase()] || []
  
  // 检查活动文件是否匹配
  if (context.activeFile) {
    const ext = '.' + context.activeFile.split('.').pop()?.toLowerCase()
    if (extensions.includes(ext)) {
      return context.activeFile
    }
  }

  // 检查打开的文件
  if (context.openFiles) {
    for (const file of context.openFiles) {
      const ext = '.' + file.split('.').pop()?.toLowerCase()
      if (extensions.includes(ext)) {
        return file
      }
    }
  }

  return null
}

// ===== Diff 计算 =====

/**
 * 计算两个文本之间的 Diff
 */
export function computeDiff(original: string, modified: string): DiffLine[] {
  const originalLines = original.split('\n')
  const modifiedLines = modified.split('\n')
  const result: DiffLine[] = []

  // 使用简单的 LCS (Longest Common Subsequence) 算法
  const lcs = computeLCS(originalLines, modifiedLines)
  
  let origIdx = 0
  let modIdx = 0
  let lcsIdx = 0

  while (origIdx < originalLines.length || modIdx < modifiedLines.length) {
    if (lcsIdx < lcs.length && origIdx < originalLines.length && originalLines[origIdx] === lcs[lcsIdx]) {
      if (modIdx < modifiedLines.length && modifiedLines[modIdx] === lcs[lcsIdx]) {
        // 相同行
        result.push({
          type: 'unchanged',
          content: originalLines[origIdx],
          oldLineNumber: origIdx + 1,
          newLineNumber: modIdx + 1,
        })
        origIdx++
        modIdx++
        lcsIdx++
      } else {
        // 新增行
        result.push({
          type: 'added',
          content: modifiedLines[modIdx],
          newLineNumber: modIdx + 1,
        })
        modIdx++
      }
    } else if (origIdx < originalLines.length) {
      // 删除行
      result.push({
        type: 'removed',
        content: originalLines[origIdx],
        oldLineNumber: origIdx + 1,
      })
      origIdx++
    } else if (modIdx < modifiedLines.length) {
      // 新增行
      result.push({
        type: 'added',
        content: modifiedLines[modIdx],
        newLineNumber: modIdx + 1,
      })
      modIdx++
    }
  }

  return result
}

/**
 * 计算最长公共子序列
 */
function computeLCS(a: string[], b: string[]): string[] {
  const m = a.length
  const n = b.length
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0))

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1])
      }
    }
  }

  // 回溯找出 LCS
  const lcs: string[] = []
  let i = m, j = n
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      lcs.unshift(a[i - 1])
      i--
      j--
    } else if (dp[i - 1][j] > dp[i][j - 1]) {
      i--
    } else {
      j--
    }
  }

  return lcs
}

// ===== 代码应用 =====

/**
 * 应用代码到文件
 */
export async function applyCodeToFile(
  code: string,
  filePath: string,
  workspacePath: string | null,
  options: {
    mode: 'replace' | 'insert' | 'smart'
    startLine?: number
    endLine?: number
  } = { mode: 'smart' }
): Promise<ApplyResult> {
  const fullPath = toFullPath(filePath, workspacePath)
  
  try {
    // 读取原始内容
    const originalContent = await window.electronAPI.readFile(fullPath) || ''
    let newContent: string

    if (options.mode === 'replace') {
      // 完全替换
      newContent = code
    } else if (options.mode === 'insert' && options.startLine !== undefined) {
      // 插入到指定位置
      const lines = originalContent.split('\n')
      lines.splice(options.startLine - 1, 0, code)
      newContent = lines.join('\n')
    } else {
      // 智能模式：尝试找到最佳匹配位置
      newContent = smartApply(originalContent, code)
    }

    // 写入文件
    const success = await window.electronAPI.writeFile(fullPath, newContent)
    
    if (!success) {
      return {
        success: false,
        filePath: fullPath,
        originalContent,
        newContent,
        error: 'Failed to write file',
      }
    }

    return {
      success: true,
      filePath: fullPath,
      originalContent,
      newContent,
    }
  } catch (error) {
    return {
      success: false,
      filePath: fullPath,
      originalContent: '',
      newContent: code,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

/**
 * 智能应用代码
 * 尝试找到最佳匹配位置并替换
 */
function smartApply(original: string, code: string): string {
  const originalLines = original.split('\n')
  const codeLines = code.split('\n')
  
  // 如果原始文件为空，直接使用新代码
  if (!original.trim()) {
    return code
  }

  // 尝试找到匹配的函数/类定义
  const codeFirstLine = codeLines[0].trim()
  
  // 检查是否是函数或类定义
  const funcMatch = codeFirstLine.match(/^(?:export\s+)?(?:async\s+)?(?:function|const|let|var|class)\s+(\w+)/)
  if (funcMatch) {
    const name = funcMatch[1]
    // 在原始代码中查找同名定义
    for (let i = 0; i < originalLines.length; i++) {
      const line = originalLines[i]
      if (line.includes(name) && (
        line.includes('function') || 
        line.includes('const') || 
        line.includes('class') ||
        line.includes('let') ||
        line.includes('var')
      )) {
        // 找到匹配，计算要替换的范围
        const endIdx = findBlockEnd(originalLines, i)
        originalLines.splice(i, endIdx - i + 1, ...codeLines)
        return originalLines.join('\n')
      }
    }
  }

  // 没有找到匹配，追加到文件末尾
  return original + '\n\n' + code
}

/**
 * 找到代码块的结束位置
 */
function findBlockEnd(lines: string[], startIdx: number): number {
  let braceCount = 0
  let started = false

  for (let i = startIdx; i < lines.length; i++) {
    const line = lines[i]
    for (const char of line) {
      if (char === '{') {
        braceCount++
        started = true
      } else if (char === '}') {
        braceCount--
        if (started && braceCount === 0) {
          return i
        }
      }
    }
  }

  return startIdx
}

// ===== 撤销支持 =====

interface UndoEntry {
  filePath: string
  originalContent: string
  timestamp: number
}

const undoStack: UndoEntry[] = []
const MAX_UNDO_ENTRIES = 50

/**
 * 保存撤销点
 */
export function saveUndoPoint(filePath: string, content: string): void {
  undoStack.push({
    filePath,
    originalContent: content,
    timestamp: Date.now(),
  })
  
  // 限制撤销栈大小
  while (undoStack.length > MAX_UNDO_ENTRIES) {
    undoStack.shift()
  }
}

/**
 * 撤销最近的应用
 */
export async function undoLastApply(filePath: string): Promise<boolean> {
  const entry = undoStack.filter(e => e.filePath === filePath).pop()
  if (!entry) return false

  const success = await window.electronAPI.writeFile(entry.filePath, entry.originalContent)
  if (success) {
    // 从栈中移除
    const idx = undoStack.indexOf(entry)
    if (idx !== -1) undoStack.splice(idx, 1)
  }
  return success
}

// ===== 导出服务实例 =====

export const codeApplyService = {
  extractCodeBlocks,
  inferFilePath,
  computeDiff,
  applyCodeToFile,
  saveUndoPoint,
  undoLastApply,
}
