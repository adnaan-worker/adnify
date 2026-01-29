/**
 * 计算密集型任务 Web Worker
 * 用于处理大文件 diff、文本搜索等重计算任务
 */

// Worker 消息类型
export type WorkerMessageType = 
  | 'diff'
  | 'search'
  | 'format'

export interface WorkerRequest {
  id: string
  type: WorkerMessageType
  payload: unknown
}

export interface WorkerResponse {
  id: string
  type: WorkerMessageType
  success: boolean
  result?: unknown
  error?: string
}

// Diff 计算
interface DiffRequest {
  oldText: string
  newText: string
  options?: {
    ignoreWhitespace?: boolean
    contextLines?: number
  }
}

interface DiffLine {
  type: 'add' | 'remove' | 'unchanged'
  content: string
  oldLineNumber?: number
  newLineNumber?: number
}

function computeDiff(request: DiffRequest): DiffLine[] {
  const { oldText, newText, options = {} } = request
  const { ignoreWhitespace = false } = options
  // contextLines 保留用于未来扩展

  const oldLines = oldText.split('\n')
  const newLines = newText.split('\n')

  // 简化的 LCS diff 算法
  const result: DiffLine[] = []
  
  // 使用 Myers diff 算法的简化版本
  const normalize = (line: string) => ignoreWhitespace ? line.trim() : line
  
  let oldIdx = 0
  let newIdx = 0
  let oldLineNum = 1
  let newLineNum = 1

  while (oldIdx < oldLines.length || newIdx < newLines.length) {
    if (oldIdx >= oldLines.length) {
      // 剩余的都是新增
      result.push({
        type: 'add',
        content: newLines[newIdx],
        newLineNumber: newLineNum++,
      })
      newIdx++
    } else if (newIdx >= newLines.length) {
      // 剩余的都是删除
      result.push({
        type: 'remove',
        content: oldLines[oldIdx],
        oldLineNumber: oldLineNum++,
      })
      oldIdx++
    } else if (normalize(oldLines[oldIdx]) === normalize(newLines[newIdx])) {
      // 相同行
      result.push({
        type: 'unchanged',
        content: newLines[newIdx],
        oldLineNumber: oldLineNum++,
        newLineNumber: newLineNum++,
      })
      oldIdx++
      newIdx++
    } else {
      // 查找最近的匹配
      let foundInOld = -1
      let foundInNew = -1
      
      // 在接下来的几行中查找匹配
      const lookAhead = 10
      for (let i = 1; i <= lookAhead && foundInOld === -1 && foundInNew === -1; i++) {
        if (oldIdx + i < oldLines.length && normalize(oldLines[oldIdx + i]) === normalize(newLines[newIdx])) {
          foundInOld = i
        }
        if (newIdx + i < newLines.length && normalize(newLines[newIdx + i]) === normalize(oldLines[oldIdx])) {
          foundInNew = i
        }
      }

      if (foundInOld !== -1 && (foundInNew === -1 || foundInOld <= foundInNew)) {
        // 删除 foundInOld 行
        for (let i = 0; i < foundInOld; i++) {
          result.push({
            type: 'remove',
            content: oldLines[oldIdx + i],
            oldLineNumber: oldLineNum++,
          })
        }
        oldIdx += foundInOld
      } else if (foundInNew !== -1) {
        // 新增 foundInNew 行
        for (let i = 0; i < foundInNew; i++) {
          result.push({
            type: 'add',
            content: newLines[newIdx + i],
            newLineNumber: newLineNum++,
          })
        }
        newIdx += foundInNew
      } else {
        // 没找到匹配，当作替换
        result.push({
          type: 'remove',
          content: oldLines[oldIdx],
          oldLineNumber: oldLineNum++,
        })
        result.push({
          type: 'add',
          content: newLines[newIdx],
          newLineNumber: newLineNum++,
        })
        oldIdx++
        newIdx++
      }
    }
  }

  return result
}

// 文本搜索
interface SearchRequest {
  text: string
  pattern: string
  options?: {
    isRegex?: boolean
    caseSensitive?: boolean
    wholeWord?: boolean
    maxResults?: number
  }
}

interface SearchMatch {
  line: number
  column: number
  length: number
  text: string
}

function searchText(request: SearchRequest): SearchMatch[] {
  const { text, pattern, options = {} } = request
  const { isRegex = false, caseSensitive = false, wholeWord = false, maxResults = 1000 } = options

  const results: SearchMatch[] = []
  const lines = text.split('\n')

  let regex: RegExp
  try {
    let patternStr = pattern
    if (!isRegex) {
      patternStr = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    }
    if (wholeWord) {
      patternStr = `\\b${patternStr}\\b`
    }
    regex = new RegExp(patternStr, caseSensitive ? 'g' : 'gi')
  } catch {
    return results
  }

  for (let lineIdx = 0; lineIdx < lines.length && results.length < maxResults; lineIdx++) {
    const line = lines[lineIdx]
    let match: RegExpExecArray | null

    regex.lastIndex = 0
    while ((match = regex.exec(line)) !== null && results.length < maxResults) {
      results.push({
        line: lineIdx + 1,
        column: match.index + 1,
        length: match[0].length,
        text: line,
      })
      
      // 防止无限循环（空匹配）
      if (match[0].length === 0) {
        regex.lastIndex++
      }
    }
  }

  return results
}

// Worker 消息处理
self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const { id, type, payload } = e.data
  
  try {
    let result: unknown

    switch (type) {
      case 'diff':
        result = computeDiff(payload as DiffRequest)
        break
      case 'search':
        result = searchText(payload as SearchRequest)
        break
      default:
        throw new Error(`Unknown message type: ${type}`)
    }

    const response: WorkerResponse = {
      id,
      type,
      success: true,
      result,
    }
    self.postMessage(response)
  } catch (error) {
    const response: WorkerResponse = {
      id,
      type,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }
    self.postMessage(response)
  }
}

export {}
