/**
 * 工具调用卡片 - 简洁扁平化设计
 */

import { useState } from 'react'
import { Check, X, ChevronDown, ChevronRight, Loader2, Terminal, Search, FolderOpen } from 'lucide-react'
import { ToolCall } from '../../agent/core/types'

interface ToolCallCardProps {
  toolCall: ToolCall
  isAwaitingApproval?: boolean
  onApprove?: () => void
  onReject?: () => void
}

const TOOL_ICONS: Record<string, React.ReactNode> = {
  run_command: <Terminal className="w-4 h-4" />,
  search_files: <Search className="w-4 h-4" />,
  list_directory: <FolderOpen className="w-4 h-4" />,
  read_file: <span className="text-sm">{'<>'}</span>,
}

const TOOL_LABELS: Record<string, string> = {
  run_command: 'Terminal',
  search_files: 'Search',
  list_directory: 'List Dir',
  read_file: 'Read',
}

export default function ToolCallCard({
  toolCall,
  isAwaitingApproval,
  onApprove,
  onReject,
}: ToolCallCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  
  const args = toolCall.arguments as Record<string, unknown>
  const isRunning = toolCall.status === 'running' || toolCall.status === 'pending'
  const isSuccess = toolCall.status === 'success'
  const isError = toolCall.status === 'error'
  
  // 获取简短描述
  const getDescription = () => {
    if (toolCall.name === 'run_command') return args.command as string
    if (toolCall.name === 'read_file') return args.path as string
    if (toolCall.name === 'search_files') return args.query as string
    if (toolCall.name === 'list_directory') return args.path as string
    return toolCall.name
  }

  return (
    <div className="my-1.5 rounded border border-border-subtle/30 bg-surface/10 overflow-hidden">
      {/* 头部 */}
      <div 
        className="flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-surface/20 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {isExpanded ? (
          <ChevronDown className="w-3.5 h-3.5 text-text-muted" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 text-text-muted" />
        )}
        
        <span className="text-text-muted">
          {TOOL_ICONS[toolCall.name] || <span className="text-xs">⚡</span>}
        </span>
        
        <span className="text-xs text-text-muted">
          {TOOL_LABELS[toolCall.name] || toolCall.name}
        </span>
        
        <span className="text-xs text-text-secondary flex-1 truncate">
          {getDescription()}
        </span>
        
        {/* 状态 */}
        {isRunning && <Loader2 className="w-3.5 h-3.5 text-accent animate-spin" />}
        {isSuccess && <Check className="w-3.5 h-3.5 text-green-400" />}
        {isError && <X className="w-3.5 h-3.5 text-red-400" />}
      </div>
      
      {/* 展开的结果 */}
      {isExpanded && toolCall.result && (
        <div className="border-t border-border-subtle/20 max-h-32 overflow-auto">
          <pre className="p-2 text-[11px] font-mono text-text-muted whitespace-pre-wrap">
            {toolCall.result.slice(0, 300)}
            {toolCall.result.length > 300 && '\n...'}
          </pre>
        </div>
      )}
      
      {/* 审批按钮 */}
      {isAwaitingApproval && (
        <div className="flex items-center justify-end gap-2 px-2 py-1.5 border-t border-border-subtle/20">
          <button
            onClick={onReject}
            className="px-2 py-0.5 text-xs text-text-muted hover:text-red-400 rounded transition-colors"
          >
            Reject
          </button>
          <button
            onClick={onApprove}
            className="px-2 py-0.5 text-xs text-green-400 hover:bg-green-500/10 rounded transition-colors"
          >
            Accept
          </button>
        </div>
      )}
    </div>
  )
}
