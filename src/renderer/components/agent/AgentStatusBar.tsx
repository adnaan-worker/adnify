/**
 * Agent 状态栏组件
 * Cursor 风格的底部状态栏 - 扁平化设计
 * 支持折叠、单条文件预览、接受、拒绝
 */

import { useState } from 'react'
import { X, Check, ExternalLink, Square, ChevronDown, ChevronRight, Loader2 } from 'lucide-react'
import { PendingChange } from '@renderer/agent/core/types'
import { Button } from '../ui'

interface AgentStatusBarProps {
  pendingChanges: PendingChange[]
  isStreaming: boolean
  isAwaitingApproval: boolean
  streamingStatus?: string
  onStop?: () => void
  onReviewFile?: (filePath: string) => void
  onAcceptFile?: (filePath: string) => void
  onRejectFile?: (filePath: string) => void
  onUndoAll?: () => void
  onKeepAll?: () => void
}

export default function AgentStatusBar({
  pendingChanges,
  isStreaming,
  isAwaitingApproval,
  streamingStatus,
  onStop,
  onReviewFile,
  onAcceptFile,
  onRejectFile,
  onUndoAll,
  onKeepAll,
}: AgentStatusBarProps) {
  const [isExpanded, setIsExpanded] = useState(true)

  const hasChanges = pendingChanges.length > 0
  const showBar = isStreaming || isAwaitingApproval || hasChanges

  if (!showBar) return null

  return (
    <div className="mb-2 rounded-xl border border-white/10 bg-background/80 backdrop-blur-xl shadow-lg animate-fade-in overflow-hidden">
      {/* 顶部操作栏：文件标签 + 全局操作 */}
      {hasChanges && (
        <div className="flex items-center justify-between px-3 py-2 bg-white/5">
          {/* 左侧：折叠按钮 + 文件标签 */}
          <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1 text-text-muted hover:text-text-primary transition-colors hover:bg-white/10 rounded"
            >
              {isExpanded ? (
                <ChevronDown className="w-3.5 h-3.5" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5" />
              )}
            </button>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-medium text-text-muted uppercase tracking-wider">
                Pending Changes
              </span>
              <span className="px-1.5 py-0.5 rounded-full bg-accent/10 text-accent text-[10px] font-bold">
                {pendingChanges.length}
              </span>
            </div>
          </div>

          {/* 右侧：全局操作 */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={onUndoAll}
              className="h-6 px-2 text-[10px] text-text-muted hover:text-red-400 hover:bg-red-500/10"
            >
              Discard All
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={onKeepAll}
              className="h-6 px-3 text-[10px] bg-accent text-white hover:bg-accent-hover shadow-sm shadow-accent/20"
            >
              Accept All
            </Button>
          </div>
        </div>
      )}

      {/* 文件列表 - 可折叠 */}
      {hasChanges && isExpanded && (
        <div className="max-h-40 overflow-y-auto border-t border-white/5 custom-scrollbar bg-black/20">
          {pendingChanges.map((change) => {
            const fileName = change.filePath.split(/[\\/]/).pop() || change.filePath
            return (
              <div
                key={change.id}
                className="group flex items-center gap-3 px-4 py-2 hover:bg-white/5 transition-colors border-b border-white/5 last:border-0"
              >
                {/* 文件图标 + 名称 */}
                <div className="w-1.5 h-1.5 rounded-full bg-accent/40 group-hover:bg-accent transition-colors" />
                <span className="text-[11px] font-medium text-text-secondary flex-1 truncate group-hover:text-text-primary transition-colors">
                  {fileName}
                </span>

                {/* 行数变化 */}
                <div className="flex items-center gap-2 text-[10px] font-mono opacity-60 group-hover:opacity-100">
                  <span className="text-green-400">+{change.linesAdded}</span>
                  {change.linesRemoved > 0 && (
                    <span className="text-red-400">-{change.linesRemoved}</span>
                  )}
                </div>

                {/* 单条操作按钮 - hover 时显示 */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
                  <button
                    onClick={() => onRejectFile?.(change.filePath)}
                    className="p-1 text-text-muted hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                    title="Reject"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => onAcceptFile?.(change.filePath)}
                    className="p-1 text-text-muted hover:text-green-400 hover:bg-green-500/10 rounded transition-colors"
                    title="Accept"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => onReviewFile?.(change.filePath)}
                    className="p-1 text-text-muted hover:text-accent hover:bg-accent/10 rounded transition-colors"
                    title="Diff"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* 流式状态 / 等待审批状态 */}
      {(isStreaming || isAwaitingApproval) && (
        <div className={`flex items-center justify-between px-4 py-2 ${hasChanges ? 'border-t border-white/5' : ''} bg-accent/5`}>
          <div className="flex items-center gap-3">
            {isStreaming && (
              <div className="flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 text-accent animate-spin" />
                <span className="text-[10px] font-medium text-accent uppercase tracking-wider animate-pulse">
                  {streamingStatus || 'Processing...'}
                </span>
              </div>
            )}
            {isAwaitingApproval && !isStreaming && (
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-pulse" />
                <span className="text-[10px] font-medium text-amber-400 uppercase tracking-wider">
                  Waiting for approval
                </span>
              </div>
            )}
          </div>
          {isStreaming && (
            <button
              onClick={onStop}
              className="flex items-center gap-1.5 px-2 py-1 text-[10px] font-bold text-text-muted hover:text-red-400 hover:bg-red-500/10 rounded transition-all uppercase tracking-tighter"
            >
              <Square className="w-2.5 h-2.5 fill-current" />
              Stop
            </button>
          )}
        </div>
      )}
    </div>
  )
}
