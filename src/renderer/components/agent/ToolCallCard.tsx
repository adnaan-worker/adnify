/**
 * 工具调用卡片 - Cursor 风格设计
 * 支持流式参数预览、状态指示、结果展示、代码高亮
 */

import { useStore } from '../../store'
import { t } from '../../i18n'
import { useState, useMemo, useEffect, memo } from 'react'
import {
  Check, X, ChevronDown, ChevronRight, Loader2,
  Terminal, Search, FolderOpen, FileText, Edit3,
  Trash2, Eye, Copy, ArrowRight, AlertTriangle,
  Globe, Link2, MessageCircle
} from 'lucide-react'
import { ToolCall } from '../../agent/core/types'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'

interface ToolCallCardProps {
  toolCall: ToolCall
  isAwaitingApproval?: boolean
  onApprove?: () => void
  onReject?: () => void
  onApproveAll?: () => void
}

// 工具图标映射
const TOOL_ICONS: Record<string, React.ReactNode> = {
  run_command: <Terminal className="w-3.5 h-3.5" />,
  search_files: <Search className="w-3.5 h-3.5" />,
  list_directory: <FolderOpen className="w-3.5 h-3.5" />,
  read_file: <Eye className="w-3.5 h-3.5" />,
  write_file: <Edit3 className="w-3.5 h-3.5" />,
  create_file: <FileText className="w-3.5 h-3.5" />,
  edit_file: <Edit3 className="w-3.5 h-3.5" />,
  delete_file_or_folder: <Trash2 className="w-3.5 h-3.5" />,
  web_search: <Globe className="w-3.5 h-3.5" />,
  read_url: <Link2 className="w-3.5 h-3.5" />,
  ask_user: <MessageCircle className="w-3.5 h-3.5" />,
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

// 工具颜色映射
const TOOL_COLORS: Record<string, string> = {
  run_command: 'text-green-400',
  search_files: 'text-blue-400',
  list_directory: 'text-yellow-400',
  read_file: 'text-cyan-400',
  write_file: 'text-purple-400',
  create_file: 'text-emerald-400',
  edit_file: 'text-orange-400',
  delete_file_or_folder: 'text-red-400',
  web_search: 'text-sky-400',
  read_url: 'text-indigo-400',
  ask_user: 'text-pink-400',
}

const ToolCallCard = memo(function ToolCallCard({
  toolCall,
  isAwaitingApproval,
  onApprove,
  onReject,
  onApproveAll,
}: ToolCallCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const { language, setTerminalVisible } = useStore()

  const args = toolCall.arguments as Record<string, unknown>
  const isStreaming = args._streaming === true
  const isRunning = toolCall.status === 'running' || toolCall.status === 'pending'
  const isSuccess = toolCall.status === 'success'
  const isError = toolCall.status === 'error'
  const isRejected = toolCall.status === 'rejected'

  // 自动展开 logic
  useEffect(() => {
    if ((isRunning || isStreaming || isSuccess) && (toolCall.name === 'edit_file' || toolCall.name === 'write_file' || toolCall.name === 'create_file')) {
      setIsExpanded(true)
    }
  }, [isRunning, isStreaming, isSuccess, toolCall.name])

  // 获取主要的代码内容参数
  const codeContent = useMemo(() => {
    if (!args) return null
    return (args.code || args.content || args.search_replace_blocks || args.replacement || args.source) as string
  }, [args])

  // 根据文件路径推断语言
  const codeLanguage = useMemo(() => {
    const path = args?.path as string
    if (!path) return 'text'
    const ext = path.split('.').pop()?.toLowerCase()
    const langMap: Record<string, string> = {
      ts: 'typescript', tsx: 'tsx', js: 'javascript', jsx: 'jsx',
      py: 'python', rs: 'rust', go: 'go', java: 'java',
      cpp: 'cpp', c: 'c', h: 'c', hpp: 'cpp',
      css: 'css', scss: 'scss', less: 'less',
      html: 'html', vue: 'vue', svelte: 'svelte',
      json: 'json', yaml: 'yaml', yml: 'yaml', toml: 'toml',
      md: 'markdown', sql: 'sql', sh: 'bash', bash: 'bash',
      xml: 'xml', graphql: 'graphql', prisma: 'prisma',
    }
    return langMap[ext || ''] || 'text'
  }, [args])

  // 获取简短描述
  const description = useMemo(() => {
    const name = toolCall.name
    if (name === 'run_command') {
      const cmd = args.command as string
      return cmd?.length > 60 ? cmd.slice(0, 60) + '...' : cmd
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
    if (name === 'delete_file_or_folder') {
      const path = args.path as string
      return path?.split(/[\\/]/).pop() || path
    }
    if (name === 'web_search') {
      const query = args.query as string
      return query ? `"${query}"` : ''
    }
    if (name === 'read_url') {
      const url = args.url as string
      return url?.length > 50 ? url.slice(0, 50) + '...' : url
    }
    if (name === 'ask_user') {
      const question = args.question as string
      return question?.length > 50 ? question.slice(0, 50) + '...' : question
    }
    return ''
  }, [toolCall.name, args])

  const handleCopyResult = () => {
    if (toolCall.result) {
      navigator.clipboard.writeText(toolCall.result)
    }
  }

  const StatusIndicator = () => {
    if (isStreaming) {
      return (
        <div className="flex items-center gap-1.5 px-1.5 py-0.5 bg-accent/10 rounded-full border border-accent/20">
          <div className="w-1.5 h-1.5 bg-accent rounded-full animate-pulse" />
          <span className="text-[9px] font-medium text-accent uppercase tracking-wider">{t('toolStreaming', language)}</span>
        </div>
      )
    }
    if (isRunning) {
      return (
        <div className="flex items-center gap-1.5 px-1.5 py-0.5 bg-accent/10 rounded-full border border-accent/20">
          <Loader2 className="w-2.5 h-2.5 text-accent animate-spin" />
          <span className="text-[9px] font-medium text-accent uppercase tracking-wider">Running</span>
        </div>
      )
    }
    if (isSuccess) {
      return <Check className="w-3.5 h-3.5 text-green-400" />
    }
    if (isError) {
      return <X className="w-3.5 h-3.5 text-red-400" />
    }
    if (isRejected) {
      return <X className="w-3.5 h-3.5 text-yellow-400" />
    }
    return null
  }

  return (
    <div className={`my-1.5 rounded-lg border overflow-hidden transition-all duration-300 ${isAwaitingApproval
      ? 'border-yellow-500/30 bg-yellow-500/5 shadow-[0_0_20px_-5px_rgba(234,179,8,0.15)] ring-1 ring-yellow-500/20'
      : isError
        ? 'border-red-500/20 bg-red-500/5'
        : 'border-white/5 bg-surface/20 hover:bg-surface/30' // Flatter design
      }`}>
      {/* 头部 */}
      <div
        className="flex items-center gap-3 px-3 py-2 cursor-pointer select-none group"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className={`p-1.5 rounded-md bg-white/5 border border-white/5 ${TOOL_COLORS[toolCall.name] || 'text-text-muted'} group-hover:bg-white/10 transition-colors shadow-inner`}>
          {TOOL_ICONS[toolCall.name] || <span className="text-[10px]">⚡</span>}
        </div>

        <div className="flex-1 min-w-0 flex items-center gap-2">
          <span className="text-xs font-medium text-text-secondary group-hover:text-text-primary transition-colors">
            {TOOL_LABELS[toolCall.name] || toolCall.name}
          </span>

          {description && (
            <div className="flex items-center gap-1.5 min-w-0">
              <ArrowRight className="w-3 h-3 text-text-muted/40" />
              <span className="text-[11px] text-text-muted truncate font-mono opacity-60 group-hover:opacity-90 transition-opacity">
                {description}
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Open Terminal Button */}
          {toolCall.name === 'run_command' && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                const args = toolCall.arguments as any
                const command = args.command || ''
                const cwd = (toolCall as any).meta?.cwd || args.cwd

                // Set pending command to be pasted into terminal
                useStore.getState().setPendingTerminalCommand({
                  command: command,
                  cwd: cwd,
                  autoRun: false // Don't auto-run, just paste it for the user
                })
                setTerminalVisible(true)
              }}
              className="p-1 hover:bg-white/10 rounded text-text-muted hover:text-accent transition-colors"
              title="Open Terminal with Command"
            >
              <Terminal className="w-3.5 h-3.5" />
            </button>
          )}

          <StatusIndicator />
          <button className="p-1 hover:bg-white/10 rounded-md transition-colors text-text-muted/70 hover:text-text-primary">
            {isExpanded ? (
              <ChevronDown className="w-3.5 h-3.5" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* 展开的详情 */}
      {isExpanded && (
        <div className="border-t border-white/5 bg-black/10 animate-slide-down">

          {/* 代码预览 (Streaming Args) - 带语法高亮 */}
          {codeContent && (
            <div className="border-b border-white/5">
              <div className="flex items-center justify-between px-3 py-1.5 bg-white/[0.02]">
                <span className="text-[10px] text-text-muted uppercase tracking-wider opacity-70 flex items-center gap-1.5 font-medium">
                  <Edit3 className="w-3 h-3" />
                  {isStreaming || isRunning ? 'Generating Code...' : 'Code Change'}
                  {codeLanguage !== 'text' && (
                    <span className="ml-1 px-1.5 py-0.5 bg-white/5 rounded text-[9px] border border-white/5">{codeLanguage}</span>
                  )}
                </span>
              </div>
              <div className="max-h-64 overflow-auto custom-scrollbar relative">
                <SyntaxHighlighter
                  language={codeLanguage}
                  style={oneDark}
                  customStyle={{
                    margin: 0,
                    padding: '12px 16px',
                    fontSize: '11px',
                    lineHeight: '1.5',
                    background: 'transparent',
                    borderLeft: '2px solid rgba(var(--accent-rgb), 0.3)',
                  }}
                  wrapLongLines
                >
                  {codeContent}
                </SyntaxHighlighter>
                {(isStreaming || isRunning) && (
                  <span className="absolute bottom-3 right-3 inline-block w-2 h-4 bg-accent animate-pulse rounded-sm" />
                )}
              </div>
            </div>
          )}

          {/* 其他参数预览 */}
          {Object.keys(args).filter(k => !k.startsWith('_') && k !== 'code' && k !== 'content' && k !== 'replacement' && k !== 'source').length > 0 && (
            <div className="px-3 py-2">
              <div className="text-[10px] text-text-muted uppercase tracking-wider mb-2 opacity-70 flex items-center gap-1.5 font-medium">
                <Terminal className="w-3 h-3" />
                {t('toolArguments', language)}
              </div>
              <div className="space-y-1.5 pl-2.5 border-l border-white/10">
                {Object.entries(args)
                  .filter(([key]) => !key.startsWith('_') && key !== 'code' && key !== 'content' && key !== 'replacement' && key !== 'source')
                  .map(([key, value]) => (
                    <div key={key} className="flex gap-3 text-[11px]">
                      <span className="text-text-muted shrink-0 w-20 text-right opacity-60">{key}:</span>
                      <span className="text-text-secondary font-mono break-all">
                        {typeof value === 'string'
                          ? value
                          : JSON.stringify(value)
                        }
                      </span>
                    </div>
                  ))
                }
              </div>
            </div>
          )}

          {/* 结果 */}
          {toolCall.result && (
            <div className="border-t border-white/5">
              <div className="flex items-center justify-between px-3 py-1.5 bg-white/[0.02]">
                <span className="text-[10px] text-text-muted uppercase tracking-wider opacity-70 flex items-center gap-1.5 font-medium">
                  <FileText className="w-3 h-3" />
                  {t('toolResult', language)}
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); handleCopyResult() }}
                  className="p-1 hover:bg-white/10 rounded text-text-muted hover:text-text-primary transition-colors"
                  title="Copy result"
                >
                  <Copy className="w-3 h-3" />
                </button>
              </div>
              <div className="max-h-48 overflow-auto custom-scrollbar px-3 pb-2 pt-1">
                <pre className="text-[11px] font-mono text-text-muted whitespace-pre-wrap break-all pl-2.5 border-l border-white/10 leading-relaxed">
                  {toolCall.result.slice(0, 800)}
                  {toolCall.result.length > 800 && '\n... (truncated)'}
                </pre>
              </div>
            </div>
          )}

          {/* 错误信息 */}
          {toolCall.error && (
            <div className="px-3 py-2 bg-red-500/5 border-t border-red-500/10">
              <div className="text-[10px] text-red-400 uppercase tracking-wider mb-1 flex items-center gap-1.5 font-medium">
                <AlertTriangle className="w-3 h-3" />
                {t('toolError', language)}
              </div>
              <p className="text-[11px] text-red-300 font-mono pl-2.5 border-l border-red-500/20">{toolCall.error}</p>
            </div>
          )}
        </div>
      )}

      {/* 审批按钮 */}
      {isAwaitingApproval && (
        <div className="flex items-center justify-between px-3 py-2 border-t border-yellow-500/20 bg-yellow-500/5">
          <span className="text-xs text-yellow-400 font-medium flex items-center gap-2">
            <Loader2 className="w-3 h-3 animate-spin" />
            {t('toolWaitingApproval', language)}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onReject}
              className="px-3 py-1 text-[11px] font-medium text-text-muted hover:text-red-400 hover:bg-red-500/10 rounded-md transition-colors"
            >
              {t('toolReject', language)}
            </button>
            {onApproveAll && (
              <button
                onClick={onApproveAll}
                className="px-3 py-1 text-[11px] font-medium text-text-muted hover:text-accent hover:bg-accent/10 rounded-md transition-colors"
                title="Approve all similar tools in this session"
              >
                {t('toolApproveAll', language)}
              </button>
            )}
            <button
              onClick={onApprove}
              className="px-3 py-1 text-[11px] font-medium bg-accent text-white hover:bg-accent-hover rounded-md transition-colors shadow-sm shadow-accent/20"
            >
              {t('toolApprove', language)}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}, (prevProps, nextProps) => {
  // 自定义比较函数：只在关键属性变化时重渲染
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
