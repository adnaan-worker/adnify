/**
 * 增强版 DiffViewer
 * - Split/Unified 视图模式
 * - 使用通用 VirtualList 组件
 * - 使用 workerService 进行 diff 计算
 * - 流式编辑预览
 */

import { useState, useMemo, useCallback, useEffect, memo } from 'react'
import { X, Check, ChevronDown, ChevronUp, Copy, FileEdit, Columns, AlignJustify } from 'lucide-react'
import { useStore } from '@store'
import { t } from '@renderer/i18n'
import { getFileName } from '@shared/utils/pathUtils'
import { VirtualList, useVirtualListRef } from '../common/VirtualList'
import { workerService } from '@services/workerService'

// ===== 类型定义 =====
export interface DiffLine {
  type: 'add' | 'remove' | 'unchanged'
  content: string
  oldLineNum?: number
  newLineNum?: number
}

export interface SplitDiffLine {
  left: { lineNum?: number; content: string; type: 'remove' | 'unchanged' | 'empty' }
  right: { lineNum?: number; content: string; type: 'add' | 'unchanged' | 'empty' }
}

interface DiffViewerProps {
  originalContent: string
  modifiedContent: string
  filePath: string
  onAccept: () => void
  onReject: () => void
  onClose?: () => void
  isStreaming?: boolean
  minimal?: boolean
}

// ===== 常量 =====
const VIRTUAL_ROW_HEIGHT = 22
const MAX_VISIBLE_ROWS = 500
const USE_WORKER_THRESHOLD = 10000 // 超过此字符数使用 Worker

// ===== 优化的 LCS 算法（主线程降级用） =====
function computeLCS(a: string[], b: string[]): string[] {
  const m = a.length
  const n = b.length

  if (m * n > 1000000) {
    return computeLCSOptimized(a, b)
  }

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

function computeLCSOptimized(a: string[], b: string[]): string[] {
  const m = a.length
  const n = b.length

  let prev = new Array(n + 1).fill(0)
  let curr = new Array(n + 1).fill(0)
  const path: number[][] = []

  for (let i = 1; i <= m; i++) {
    path[i] = []
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        curr[j] = prev[j - 1] + 1
        path[i][j] = 0
      } else if (prev[j] >= curr[j - 1]) {
        curr[j] = prev[j]
        path[i][j] = 1
      } else {
        curr[j] = curr[j - 1]
        path[i][j] = 2
      }
    }
    ;[prev, curr] = [curr, prev]
  }

  const lcs: string[] = []
  let i = m, j = n
  while (i > 0 && j > 0) {
    if (path[i]?.[j] === 0) {
      lcs.unshift(a[i - 1])
      i--
      j--
    } else if (path[i]?.[j] === 1) {
      i--
    } else {
      j--
    }
  }

  return lcs
}

// ===== Diff 计算（主线程） =====
export function computeDiff(original: string, modified: string): DiffLine[] {
  const originalLines = original.split('\n')
  const modifiedLines = modified.split('\n')
  const diff: DiffLine[] = []

  const lcs = computeLCS(originalLines, modifiedLines)
  let oldIdx = 0
  let newIdx = 0
  let lcsIdx = 0

  while (oldIdx < originalLines.length || newIdx < modifiedLines.length) {
    if (lcsIdx < lcs.length && oldIdx < originalLines.length && originalLines[oldIdx] === lcs[lcsIdx]) {
      if (newIdx < modifiedLines.length && modifiedLines[newIdx] === lcs[lcsIdx]) {
        diff.push({
          type: 'unchanged',
          content: originalLines[oldIdx],
          oldLineNum: oldIdx + 1,
          newLineNum: newIdx + 1,
        })
        oldIdx++
        newIdx++
        lcsIdx++
      } else {
        diff.push({ type: 'add', content: modifiedLines[newIdx], newLineNum: newIdx + 1 })
        newIdx++
      }
    } else if (oldIdx < originalLines.length) {
      diff.push({ type: 'remove', content: originalLines[oldIdx], oldLineNum: oldIdx + 1 })
      oldIdx++
    } else if (newIdx < modifiedLines.length) {
      diff.push({ type: 'add', content: modifiedLines[newIdx], newLineNum: newIdx + 1 })
      newIdx++
    }
  }

  return diff
}

export function convertToSplitView(diff: DiffLine[]): SplitDiffLine[] {
  const result: SplitDiffLine[] = []
  let i = 0

  while (i < diff.length) {
    const line = diff[i]

    if (line.type === 'unchanged') {
      result.push({
        left: { lineNum: line.oldLineNum, content: line.content, type: 'unchanged' },
        right: { lineNum: line.newLineNum, content: line.content, type: 'unchanged' },
      })
      i++
    } else if (line.type === 'remove') {
      const nextAdd = diff[i + 1]?.type === 'add' ? diff[i + 1] : null
      if (nextAdd) {
        result.push({
          left: { lineNum: line.oldLineNum, content: line.content, type: 'remove' },
          right: { lineNum: nextAdd.newLineNum, content: nextAdd.content, type: 'add' },
        })
        i += 2
      } else {
        result.push({
          left: { lineNum: line.oldLineNum, content: line.content, type: 'remove' },
          right: { content: '', type: 'empty' },
        })
        i++
      }
    } else {
      result.push({
        left: { content: '', type: 'empty' },
        right: { lineNum: line.newLineNum, content: line.content, type: 'add' },
      })
      i++
    }
  }

  return result
}


// ===== 行渲染组件 =====
const UnifiedRow = memo(function UnifiedRow({
  line,
  style,
}: {
  line: DiffLine
  style: React.CSSProperties
}) {
  return (
    <div
      style={style}
      className={`flex text-sm font-mono ${
        line.type === 'add' ? 'bg-green-500/10' : line.type === 'remove' ? 'bg-red-500/10' : ''
      }`}
    >
      <span className="w-12 px-2 py-0.5 text-right text-text-primary-muted select-none border-r border-border text-xs flex-shrink-0">
        {line.oldLineNum || ''}
      </span>
      <span className="w-12 px-2 py-0.5 text-right text-text-primary-muted select-none border-r border-border text-xs flex-shrink-0">
        {line.newLineNum || ''}
      </span>
      <span className="w-6 px-1 py-0.5 text-center select-none flex-shrink-0">
        {line.type === 'add' && <span className="text-green-400">+</span>}
        {line.type === 'remove' && <span className="text-red-400">-</span>}
      </span>
      <span className="px-3 py-0.5 whitespace-pre overflow-hidden text-ellipsis flex-1">
        <span className={`${
          line.type === 'add' ? 'text-green-300' : line.type === 'remove' ? 'text-red-300' : 'text-text-primary'
        }`}>
          {line.content}
        </span>
      </span>
    </div>
  )
})

const SplitRow = memo(function SplitRow({
  line,
  style,
}: {
  line: SplitDiffLine
  style: React.CSSProperties
}) {
  const leftBg = line.left.type === 'remove' ? 'bg-red-500/10' : line.left.type === 'empty' ? 'bg-background/30' : ''
  const rightBg = line.right.type === 'add' ? 'bg-green-500/10' : line.right.type === 'empty' ? 'bg-background/30' : ''

  return (
    <div style={style} className="flex text-sm font-mono">
      <span className={`w-10 px-2 py-0.5 text-right text-text-primary-muted select-none border-r border-border text-xs flex-shrink-0 ${leftBg}`}>
        {line.left.lineNum || ''}
      </span>
      <span className={`flex-1 px-3 py-0.5 whitespace-pre overflow-hidden text-ellipsis border-r border-border ${leftBg}`}>
        <span className={line.left.type === 'remove' ? 'text-red-300' : 'text-text-primary'}>
          {line.left.content}
        </span>
      </span>
      <span className={`w-10 px-2 py-0.5 text-right text-text-primary-muted select-none border-r border-border text-xs flex-shrink-0 ${rightBg}`}>
        {line.right.lineNum || ''}
      </span>
      <span className={`flex-1 px-3 py-0.5 whitespace-pre overflow-hidden text-ellipsis ${rightBg}`}>
        <span className={line.right.type === 'add' ? 'text-green-300' : 'text-text-primary'}>
          {line.right.content}
        </span>
      </span>
    </div>
  )
})

// ===== 主组件 =====
export default function DiffViewer({
  originalContent,
  modifiedContent,
  filePath,
  onAccept,
  onReject,
  onClose,
  isStreaming = false,
  minimal = false,
}: DiffViewerProps) {
  const { language } = useStore()
  const [collapsed, setCollapsed] = useState(false)
  const [viewMode, setViewMode] = useState<'split' | 'unified'>('unified')
  const [diff, setDiff] = useState<DiffLine[]>([])
  const [isComputing, setIsComputing] = useState(false)
  const listRef = useVirtualListRef()

  // 计算 diff（大文件使用 Worker）
  useEffect(() => {
    const totalLength = originalContent.length + modifiedContent.length
    
    if (totalLength > USE_WORKER_THRESHOLD && !isStreaming) {
      // 大文件使用 Worker
      setIsComputing(true)
      workerService.computeDiff(originalContent, modifiedContent)
        .then(result => {
          // Worker 返回的格式转换
          const diffLines: DiffLine[] = []
          let oldLineNum = 1
          let newLineNum = 1
          
          for (const item of result) {
            if (item.type === 'unchanged') {
              diffLines.push({ type: 'unchanged', content: item.content, oldLineNum: oldLineNum++, newLineNum: newLineNum++ })
            } else if (item.type === 'remove') {
              diffLines.push({ type: 'remove', content: item.content, oldLineNum: oldLineNum++ })
            } else {
              diffLines.push({ type: 'add', content: item.content, newLineNum: newLineNum++ })
            }
          }
          setDiff(diffLines)
        })
        .catch(() => {
          // Worker 失败，降级到主线程
          setDiff(computeDiff(originalContent, modifiedContent))
        })
        .finally(() => setIsComputing(false))
    } else {
      // 小文件或流式模式直接在主线程计算
      setDiff(computeDiff(originalContent, modifiedContent))
    }
  }, [originalContent, modifiedContent, isStreaming])

  // Split 视图数据
  const splitDiff = useMemo(
    () => viewMode === 'split' ? convertToSplitView(diff) : [],
    [diff, viewMode]
  )

  // 统计信息
  const stats = useMemo(() => {
    const added = diff.filter(d => d.type === 'add').length
    const removed = diff.filter(d => d.type === 'remove').length
    return { added, removed, total: diff.length }
  }, [diff])

  // 是否启用虚拟化
  const useVirtualization = diff.length > MAX_VISIBLE_ROWS

  // 流式模式自动滚动到底部
  useEffect(() => {
    if (isStreaming && listRef.current) {
      listRef.current.scrollToBottom()
    }
  }, [isStreaming, modifiedContent])

  const fileName = getFileName(filePath) || filePath

  const copyToClipboard = useCallback(() => {
    navigator.clipboard.writeText(modifiedContent)
  }, [modifiedContent])

  // 渲染 Unified 视图
  const renderUnifiedView = () => {
    if (useVirtualization) {
      return (
        <VirtualList
          ref={listRef}
          items={diff}
          itemHeight={VIRTUAL_ROW_HEIGHT}
          renderItem={(line) => <UnifiedRow line={line} style={{}} />}
          getKey={(_, index) => index}
          className="max-h-96"
        />
      )
    }

    return (
      <div className="max-h-96 overflow-auto custom-scrollbar">
        {diff.map((line, idx) => (
          <UnifiedRow key={idx} line={line} style={{}} />
        ))}
      </div>
    )
  }

  // 渲染 Split 视图
  const renderSplitView = () => {
    if (useVirtualization) {
      return (
        <VirtualList
          ref={listRef}
          items={splitDiff}
          itemHeight={VIRTUAL_ROW_HEIGHT}
          renderItem={(line) => <SplitRow line={line} style={{}} />}
          getKey={(_, index) => index}
          className="max-h-96"
        />
      )
    }

    return (
      <div className="max-h-96 overflow-auto custom-scrollbar">
        {splitDiff.map((line, idx) => (
          <SplitRow key={idx} line={line} style={{}} />
        ))}
      </div>
    )
  }

  // 极简模式
  if (minimal) {
    return (
      <div className="bg-background border border-border rounded-lg overflow-hidden">
        {isComputing ? (
          <div className="p-4 text-center text-text-muted text-sm">Computing diff...</div>
        ) : (
          viewMode === 'unified' ? renderUnifiedView() : renderSplitView()
        )}
      </div>
    )
  }

  return (
    <div className="bg-editor-sidebar border border-border rounded-xl overflow-hidden shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-background/50">
        <div className="flex items-center gap-3">
          <FileEdit className="w-5 h-5 text-editor-accent" />
          <span className="font-medium text-text-primary">{fileName}</span>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-green-400">+{stats.added}</span>
            <span className="text-red-400">-{stats.removed}</span>
            {isStreaming && (
              <span className="text-yellow-400 animate-pulse">● {t('streaming', language)}</span>
            )}
            {isComputing && (
              <span className="text-blue-400 animate-pulse">● Computing...</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-editor-hover rounded-lg p-0.5">
            <button
              onClick={() => setViewMode('unified')}
              className={`p-1.5 rounded transition-colors ${viewMode === 'unified' ? 'bg-editor-accent text-white' : 'text-text-primary-muted hover:text-text-primary'}`}
              title={t('unifiedView', language)}
            >
              <AlignJustify className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('split')}
              className={`p-1.5 rounded transition-colors ${viewMode === 'split' ? 'bg-editor-accent text-white' : 'text-text-primary-muted hover:text-text-primary'}`}
              title={t('splitView', language)}
            >
              <Columns className="w-4 h-4" />
            </button>
          </div>
          <button onClick={copyToClipboard} className="p-2 rounded-lg hover:bg-editor-hover transition-colors" title={t('copyModified', language)}>
            <Copy className="w-4 h-4 text-text-primary-muted" />
          </button>
          <button onClick={() => setCollapsed(!collapsed)} className="p-2 rounded-lg hover:bg-editor-hover transition-colors">
            {collapsed ? <ChevronDown className="w-4 h-4 text-text-primary-muted" /> : <ChevronUp className="w-4 h-4 text-text-primary-muted" />}
          </button>
          {onClose && (
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-editor-hover transition-colors">
              <X className="w-4 h-4 text-text-primary-muted" />
            </button>
          )}
        </div>
      </div>

      {/* Diff Content */}
      {!collapsed && (
        isComputing ? (
          <div className="p-8 text-center text-text-muted">Computing diff...</div>
        ) : (
          viewMode === 'unified' ? renderUnifiedView() : renderSplitView()
        )
      )}

      {/* Actions */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-background/50">
        <div className="text-xs text-text-primary-muted">
          {stats.total} {t('lines', language)} • {useVirtualization ? t('virtualized', language) : t('fullRender', language)}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onReject}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors"
            disabled={isStreaming || isComputing}
          >
            <X className="w-4 h-4" />
            {t('rejectChanges', language)}
          </button>
          <button
            onClick={onAccept}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-500 text-white hover:bg-green-600 transition-colors disabled:opacity-50"
            disabled={isStreaming || isComputing}
          >
            <Check className="w-4 h-4" />
            {t('acceptChanges', language)}
          </button>
        </div>
      </div>
    </div>
  )
}
