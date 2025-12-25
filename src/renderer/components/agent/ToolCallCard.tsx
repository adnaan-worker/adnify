/**
 * 工具调用卡片 - Cursor 风格设计
 * 支持流式参数预览、状态指示、结果展示、代码高亮
 */

import { useState, useMemo, useEffect, memo } from 'react'
import {
  Check, X, ChevronDown, ChevronRight, Loader2,
  Terminal, Search, Copy, AlertTriangle
} from 'lucide-react'
import { useStore } from '@store'
import { t } from '@renderer/i18n'
import { ToolCall } from '@renderer/agent/core/types'
import { JsonHighlight } from '@utils/jsonHighlight'

interface ToolCallCardProps {
  toolCall: ToolCall
  isAwaitingApproval?: boolean
  onApprove?: () => void
  onReject?: () => void
  onApproveAll?: () => void
}



// 工具标签映射
const TOOL_LABELS: Record<string, string> = {
  run_command: 'Run Command',
  search_files: 'Search Files',
  list_directory: 'List Directory',
  read_file: 'Read File',
  write_file: 'Write File',
  create_file: 'Create File',
  edit_file: 'Edit File',
  delete_file_or_folder: 'Delete',
  web_search: 'Web Search',
  read_url: 'Read URL',
  ask_user: 'Ask User',
}

const ToolCallCard = memo(function ToolCallCard({
  toolCall,
  isAwaitingApproval,
  onApprove,
  onReject,
  onApproveAll,
}: ToolCallCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const { language, setTerminalVisible, setPendingTerminalCommand } = useStore()

  const args = toolCall.arguments as Record<string, unknown>
  const isStreaming = args._streaming === true
  const isRunning = toolCall.status === 'running' || toolCall.status === 'pending'
  const isSuccess = toolCall.status === 'success'
  const isError = toolCall.status === 'error'
  const isRejected = toolCall.status === 'rejected'

  // 自动展开 logic
  useEffect(() => {
    // 只有在运行中或者是特定类型的工具才自动展开
    if (isRunning || isStreaming) {
      setIsExpanded(true)
    }
  }, [isRunning, isStreaming])

  // 获取简短描述
  const description = useMemo(() => {
    const name = toolCall.name
    if (name === 'run_command') {
      const cmd = args.command as string
      return cmd
    }
    if (name === 'read_file' || name === 'write_file' || name === 'create_file' || name === 'edit_file') {
      const path = args.path as string
      return path?.split(/[\\/]/).pop() || path
    }
    if (name === 'search_files') {
      const pattern = (args.pattern || args.query) as string
      return pattern ? `"${pattern}"` : ''
    }
    if (name === 'list_directory') {
      const path = args.path as string
      return path?.split(/[\\/]/).pop() || path || '.'
    }
    if (name === 'web_search') {
      const query = args.query as string
      return query ? `"${query}"` : ''
    }
    return ''
  }, [toolCall.name, args])

  const handleCopyResult = () => {
    if (toolCall.result) {
      navigator.clipboard.writeText(toolCall.result)
    }
  }

  // 渲染不同类型的预览内容
  const renderPreview = () => {
    const name = toolCall.name

    // 1. 终端命令预览
    if (name === 'run_command') {
      const cmd = args.command as string
      return (
        <div className="bg-black/40 rounded-md border border-white/5 overflow-hidden font-mono text-xs">
          <div className="flex items-center justify-between px-3 py-1.5 bg-white/5 border-b border-white/5">
            <span className="text-text-muted flex items-center gap-2">
              <Terminal className="w-3 h-3" />
              Terminal
            </span>
            {isSuccess && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  const cwd = (toolCall as any).meta?.cwd || args.cwd
                  setPendingTerminalCommand({
                    command: cmd,
                    cwd: cwd,
                    autoRun: false
                  })
                  setTerminalVisible(true)
                }}
                className="text-[10px] px-1.5 py-0.5 bg-white/5 hover:bg-white/10 rounded text-text-muted hover:text-accent transition-colors"
              >
                Open
              </button>
            )}
          </div>
          <div className="p-3 text-text-secondary overflow-x-auto custom-scrollbar">
            <div className="flex gap-2">
              <span className="text-accent select-none">$</span>
              <span className="text-green-400">{cmd}</span>
            </div>
            {toolCall.result && (
              <div className="mt-2 text-text-muted opacity-80 whitespace-pre-wrap break-all border-t border-white/5 pt-2">
                {toolCall.result.slice(0, 500)}
                {toolCall.result.length > 500 && <span className="opacity-50">... (truncated)</span>}
              </div>
            )}
          </div>
        </div>
      )
    }

    // 2. 文件搜索预览
    if (name === 'search_files' || name === 'web_search') {
      return (
        <div className="bg-black/20 rounded-md border border-white/5 overflow-hidden">
          <div className="px-3 py-2 border-b border-white/5 flex items-center gap-2 text-xs text-text-muted">
            <Search className="w-3 h-3" />
            <span>Query: <span className="text-text-primary font-medium">{(args.pattern || args.query) as string}</span></span>
          </div>
          {toolCall.result && (
            <div className="max-h-48 overflow-y-auto custom-scrollbar p-1">
              <JsonHighlight
                data={toolCall.result}
                className="p-2"
                maxHeight="max-h-48"
              />
            </div>
          )}
        </div>
      )
    }

    // 3. 默认通用预览
    return (
      <div className="space-y-2">
        {/* 参数 */}
        {Object.keys(args).filter(k => !k.startsWith('_')).length > 0 && (
          <div className="bg-black/20 rounded-md border border-white/5 p-2">
            <JsonHighlight
              data={Object.fromEntries(Object.entries(args).filter(([k]) => !k.startsWith('_')))}
              maxHeight="max-h-32"
            />
          </div>
        )}

        {/* 结果 */}
        {toolCall.result && (
          <div className="bg-black/20 rounded-md border border-white/5 overflow-hidden">
            <div className="flex items-center justify-between px-3 py-1.5 bg-white/5 border-b border-white/5">
              <span className="text-[10px] text-text-muted uppercase tracking-wider font-medium">Result</span>
              <button
                onClick={(e) => { e.stopPropagation(); handleCopyResult() }}
                className="p-1 hover:bg-white/10 rounded text-text-muted hover:text-text-primary transition-colors"
              >
                <Copy className="w-3 h-3" />
              </button>
            </div>
            <div className="max-h-48 overflow-auto custom-scrollbar p-2">
              <JsonHighlight
                data={toolCall.result}
                maxHeight="max-h-48"
              />
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div
      className={`
        group my-1.5 rounded-lg border transition-all duration-300 ease-out animate-slide-in
        ${isStreaming ? 'animate-pulse-subtle border-accent/30 bg-accent/5' : ''}
        ${isAwaitingApproval
          ? 'border-yellow-500/30 bg-yellow-500/5'
          : isError
            ? 'border-red-500/20 bg-red-500/5'
            : 'border-white/5 bg-transparent hover:border-white/10'
        }
      `}
    >
      {/* Header */}
      <div
        className="flex items-center gap-3 px-3 py-2 cursor-pointer select-none"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {/* Status Icon */}
        <div className="shrink-0">
          {isStreaming || isRunning ? (
            <Loader2 className="w-3.5 h-3.5 text-accent animate-spin" />
          ) : isSuccess ? (
            <Check className="w-3.5 h-3.5 text-green-400" />
          ) : isError ? (
            <X className="w-3.5 h-3.5 text-red-400" />
          ) : isRejected ? (
            <X className="w-3.5 h-3.5 text-yellow-400" />
          ) : (
            <div className="w-3.5 h-3.5 rounded-full border border-text-muted/30" />
          )}
        </div>

        {/* Title & Description */}
        <div className="flex-1 min-w-0 flex items-center gap-2 overflow-hidden">
          <span className="text-xs font-medium text-text-secondary group-hover:text-text-primary transition-colors whitespace-nowrap">
            {TOOL_LABELS[toolCall.name] || toolCall.name}
          </span>

          {description && (
            <>
              <span className="text-text-muted/20">|</span>
              <span className="text-[11px] text-text-muted truncate font-mono opacity-70">
                {description}
              </span>
            </>
          )}
        </div>

        {/* Expand Toggle */}
        <div className="shrink-0 text-text-muted/50 group-hover:text-text-muted transition-colors">
          {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="px-3 pb-3 pt-0 animate-slide-down">
          <div className="pl-6.5"> {/* Indent to align with text start */}
            {renderPreview()}

            {/* Error Message */}
            {toolCall.error && (
              <div className="mt-2 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-md">
                <div className="flex items-center gap-2 text-red-400 text-xs font-medium mb-1">
                  <AlertTriangle className="w-3 h-3" />
                  Error
                </div>
                <p className="text-[11px] text-red-300 font-mono break-all">{toolCall.error}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Approval Actions */}
      {isAwaitingApproval && (
        <div className="flex items-center justify-end gap-2 px-3 py-2 border-t border-yellow-500/10 bg-yellow-500/5">
          <button
            onClick={onReject}
            className="px-3 py-1 text-[11px] font-medium text-text-muted hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
          >
            {t('toolReject', language)}
          </button>
          {onApproveAll && (
            <button
              onClick={onApproveAll}
              className="px-3 py-1 text-[11px] font-medium text-text-muted hover:text-accent hover:bg-accent/10 rounded transition-colors"
            >
              {t('toolApproveAll', language)}
            </button>
          )}
          <button
            onClick={onApprove}
            className="px-3 py-1 text-[11px] font-medium bg-accent text-white hover:bg-accent-hover rounded transition-colors shadow-sm shadow-accent/20"
          >
            {t('toolApprove', language)}
          </button>
        </div>
      )}
    </div>
  )
}, (prevProps, nextProps) => {
  return (
    prevProps.toolCall.id === nextProps.toolCall.id &&
    prevProps.toolCall.status === nextProps.toolCall.status &&
    prevProps.toolCall.name === nextProps.toolCall.name &&
    prevProps.isAwaitingApproval === nextProps.isAwaitingApproval &&
    JSON.stringify(prevProps.toolCall.arguments) === JSON.stringify(nextProps.toolCall.arguments) &&
    prevProps.toolCall.result === nextProps.toolCall.result
  )
})

export default ToolCallCard
