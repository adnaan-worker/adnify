/**
 * 文件变更卡片 - 简洁扁平化设计
 */

import { useState } from 'react'
import { Check, X, ChevronDown, ChevronRight, ExternalLink, Loader2 } from 'lucide-react'
import { ToolCall } from '../../agent/core/types'

interface FileChangeCardProps {
  toolCall: ToolCall
  isAwaitingApproval?: boolean
  onApprove?: () => void
  onReject?: () => void
  onOpenInEditor?: (path: string, oldContent: string, newContent: string) => void
}

export default function FileChangeCard({
  toolCall,
  isAwaitingApproval,
  onApprove,
  onReject,
  onOpenInEditor,
}: FileChangeCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  
  const args = toolCall.arguments as Record<string, unknown>
  const meta = args._meta as Record<string, unknown> | undefined
  const filePath = (args.path || meta?.filePath) as string || 'unknown'
  const fileName = filePath.split(/[\\/]/).pop() || filePath
  const linesAdded = (meta?.linesAdded as number) || 0
  const linesRemoved = (meta?.linesRemoved as number) || 0
  const oldContent = (meta?.oldContent as string) || ''
  const newContent = (meta?.newContent as string) || (args.content as string) || ''
  
  const isRunning = toolCall.status === 'running' || toolCall.status === 'pending'
  const isSuccess = toolCall.status === 'success'
  const isError = toolCall.status === 'error'

  return (
    <div className="my-2 rounded-lg border border-border-subtle/50 bg-surface/20 overflow-hidden">
      {/* 头部 - 文件名 + 状态 */}
      <div 
        className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-surface/30 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {isExpanded ? (
          <ChevronDown className="w-4 h-4 text-text-muted" />
        ) : (
          <ChevronRight className="w-4 h-4 text-text-muted" />
        )}
        
        <span className="text-accent text-sm">{'<>'}</span>
        <span className="text-sm text-text-primary flex-1 truncate">{fileName}</span>
        
        {/* 行数变化 */}
        {isSuccess && (
          <span className="text-xs font-mono">
            <span className="text-green-400">+{linesAdded}</span>
            {linesRemoved > 0 && <span className="text-red-400 ml-1">-{linesRemoved}</span>}
          </span>
        )}
        
        {/* 状态指示 */}
        {isRunning && <Loader2 className="w-4 h-4 text-accent animate-spin" />}
        {isSuccess && <span className="px-1.5 py-0.5 text-[10px] bg-green-500/20 text-green-400 rounded">Applied</span>}
        {isError && <span className="px-1.5 py-0.5 text-[10px] bg-red-500/20 text-red-400 rounded">Failed</span>}
        
        {/* 打开按钮 */}
        {isSuccess && onOpenInEditor && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onOpenInEditor(filePath, oldContent, newContent)
            }}
            className="p-1 text-text-muted hover:text-accent rounded transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
          </button>
        )}
      </div>
      
      {/* 展开的代码预览 */}
      {isExpanded && newContent && (
        <div className="border-t border-border-subtle/30 max-h-48 overflow-auto">
          <pre className="p-3 text-xs font-mono text-text-secondary whitespace-pre-wrap">
            {newContent.slice(0, 500)}
            {newContent.length > 500 && '\n... (truncated)'}
          </pre>
        </div>
      )}
      
      {/* 审批按钮 */}
      {isAwaitingApproval && (
        <div className="flex items-center justify-end gap-2 px-3 py-2 border-t border-border-subtle/30 bg-surface/30">
          <button
            onClick={onReject}
            className="flex items-center gap-1 px-3 py-1 text-xs text-text-muted hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
          >
            <X className="w-3.5 h-3.5" />
            Reject
          </button>
          <button
            onClick={onApprove}
            className="flex items-center gap-1 px-3 py-1 text-xs text-white bg-green-500/80 hover:bg-green-500 rounded transition-colors"
          >
            <Check className="w-3.5 h-3.5" />
            Accept
          </button>
        </div>
      )}
    </div>
  )
}
