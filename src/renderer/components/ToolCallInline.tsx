/**
 * ToolCallInline - 内联工具调用显示组件
 * 简洁的单行显示，可展开查看详情
 * 参考 Cursor/Claude 的设计风格
 */

import { useState, memo } from 'react'
import {
  FileText, Terminal, Search, FolderOpen, Trash2,
  Check, X, Loader2, AlertTriangle,
  ChevronDown, Edit3, FileCode, FolderPlus
} from 'lucide-react'
import { ToolCall, useStore } from '../store'
import { t } from '../i18n'

interface ToolCallInlineProps {
  toolCall: ToolCall
  onApprove?: () => void
  onReject?: () => void
  onFileClick?: (filePath: string) => void
}

// 工具图标和颜色配置
const TOOL_CONFIG: Record<string, { icon: typeof FileText; color: string; label: string }> = {
  read_file: { icon: FileText, color: 'text-blue-400', label: 'Read File' },
  write_file: { icon: Edit3, color: 'text-green-400', label: 'Write File' },
  create_file: { icon: FileCode, color: 'text-emerald-400', label: 'Create File' },
  edit_file: { icon: Edit3, color: 'text-amber-400', label: 'Edit File' },
  delete_file: { icon: Trash2, color: 'text-red-400', label: 'Delete File' },
  list_directory: { icon: FolderOpen, color: 'text-purple-400', label: 'List Directory' },
  create_directory: { icon: FolderPlus, color: 'text-purple-400', label: 'Create Directory' },
  search_files: { icon: Search, color: 'text-cyan-400', label: 'Search Files' },
  run_terminal: { icon: Terminal, color: 'text-orange-400', label: 'Run Command' },
  execute_command: { icon: Terminal, color: 'text-orange-400', label: 'Execute Command' },
}

function getFileName(path: string): string {
  return path.split(/[\\/]/).pop() || path
}

function extractFilePath(args: Record<string, unknown>): string | null {
  return (args.path || args.file_path || args.filePath || args.directory) as string | null
}

function extractCommand(args: Record<string, unknown>): string | null {
  return (args.command || args.cmd) as string | null
}

export default memo(function ToolCallInline({
  toolCall,
  onApprove,
  onReject,
  onFileClick
}: ToolCallInlineProps) {
  const [expanded, setExpanded] = useState(false)
  const { language } = useStore()
  
  const config = TOOL_CONFIG[toolCall.name] || { 
    icon: Terminal, 
    color: 'text-text-muted',
    label: toolCall.name 
  }
  const Icon = config.icon
  const isAwaiting = toolCall.status === 'awaiting_user'
  const isRunning = toolCall.status === 'running'
  const isSuccess = toolCall.status === 'success'
  const isError = toolCall.status === 'error'

  const filePath = extractFilePath(toolCall.arguments)
  const command = extractCommand(toolCall.arguments)
  const fileName = filePath ? getFileName(filePath) : null

  // 状态图标
  const StatusIcon = () => {
    if (isRunning) return <Loader2 className="w-3 h-3 animate-spin text-accent" />
    if (isSuccess) return <Check className="w-3 h-3 text-green-400" />
    if (isError) return <X className="w-3 h-3 text-red-400" />
    if (isAwaiting) return <AlertTriangle className="w-3 h-3 text-yellow-400" />
    return <div className="w-3 h-3 rounded-full bg-text-muted/30" />
  }

  const handleFileClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (filePath && onFileClick) {
      onFileClick(filePath)
    }
  }

  return (
    <div className="my-1">
      {/* 主行 - 紧凑单行显示 */}
      <div 
        className={`
          flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer select-none
          transition-colors text-xs
          ${isAwaiting ? 'bg-yellow-500/10' : 'hover:bg-surface-hover'}
          ${isError ? 'bg-red-500/5' : ''}
        `}
        onClick={() => setExpanded(!expanded)}
      >
        <StatusIcon />
        
        <Icon className={`w-3.5 h-3.5 ${config.color}`} />
        
        <span className="text-text-secondary">{config.label}</span>
        
        {fileName && (
          <>
            <span className="text-text-muted">·</span>
            <span 
              className="text-text-primary hover:text-accent hover:underline cursor-pointer truncate max-w-[150px]"
              onClick={handleFileClick}
              title={filePath || ''}
            >
              {fileName}
            </span>
          </>
        )}
        
        {command && (
          <code className="text-text-muted bg-surface-active px-1 py-0.5 rounded truncate max-w-[150px] font-mono text-[10px]">
            {command}
          </code>
        )}

        <ChevronDown className={`w-3 h-3 text-text-muted ml-auto transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </div>

      {/* 审批按钮 - 需要确认时显示 */}
      {isAwaiting && onApprove && onReject && (
        <div className="flex items-center gap-2 px-2 py-1.5 ml-5">
          <button
            onClick={(e) => { e.stopPropagation(); onReject() }}
            className="px-2 py-1 text-[10px] rounded bg-surface hover:bg-red-500/20 text-text-muted hover:text-red-400 transition-colors"
          >
            {t('reject', language)}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onApprove() }}
            className="px-2 py-1 text-[10px] rounded bg-accent/20 text-accent hover:bg-accent/30 transition-colors font-medium"
          >
            {t('allowExecute', language)}
          </button>
        </div>
      )}

      {/* 展开详情 */}
      {expanded && (
        <div className="ml-5 mt-1 p-2 bg-surface-active/50 rounded text-xs text-text-muted font-mono overflow-auto max-h-32">
          <pre className="whitespace-pre-wrap">
            {JSON.stringify(toolCall.arguments, null, 2)}
          </pre>
          {toolCall.result && (
            <div className="mt-2 pt-2 border-t border-border-subtle">
              <span className="text-text-secondary">Result: </span>
              <span className="text-green-400">{toolCall.result.slice(0, 200)}{toolCall.result.length > 200 ? '...' : ''}</span>
            </div>
          )}
          {toolCall.error && (
            <div className="mt-2 pt-2 border-t border-border-subtle">
              <span className="text-red-400">Error: {toolCall.error}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
})
