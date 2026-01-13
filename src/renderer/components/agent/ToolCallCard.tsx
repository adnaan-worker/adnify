/**
 * 工具调用卡片 - 简化版
 * 支持流式参数预览、状态指示、结果展示
 */

import { useState, useMemo, useEffect, memo } from 'react'
import {
    Check,
    X,
    ChevronDown,
    Loader2,
    Terminal,
    Search,
    Copy,
    AlertTriangle,
    FileCode,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from '@store'
import { t } from '@renderer/i18n'
import { ToolCall } from '@renderer/agent/types'
import { JsonHighlight } from '@utils/jsonHighlight'
import { terminalManager } from '@/renderer/services/TerminalManager'
import { RichContentRenderer } from './RichContentRenderer'
import InlineDiffPreview from './InlineDiffPreview'
import { getFileName } from '@shared/utils/pathUtils'
import { CodeSkeleton } from '../ui/Loading'

interface ToolCallCardProps {
    toolCall: ToolCall
    isAwaitingApproval?: boolean
    onApprove?: () => void
    onReject?: () => void
    /** 默认展开状态 */
    defaultExpanded?: boolean
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
    defaultExpanded = false,
}: ToolCallCardProps) {
    const [isExpanded, setIsExpanded] = useState(defaultExpanded)
    const { language, setTerminalVisible } = useStore()

    const args = toolCall.arguments as Record<string, unknown>
    const isStreaming = args._streaming === true
    const isRunning = toolCall.status === 'running' || toolCall.status === 'pending'
    const isSuccess = toolCall.status === 'success'
    const isError = toolCall.status === 'error'
    const isRejected = toolCall.status === 'rejected'

    // 运行中自动展开
    useEffect(() => {
        if (isRunning || isStreaming) {
            setIsExpanded(true)
        }
    }, [isRunning, isStreaming])

    // 获取简短描述
    const description = useMemo(() => {
        const name = toolCall.name
        if (name === 'run_command') {
            return args.command as string
        }
        if (['read_file', 'write_file', 'create_file', 'edit_file'].includes(name)) {
            const path = args.path as string
            return path ? getFileName(path) : path
        }
        if (name === 'search_files') {
            const pattern = (args.pattern || args.query) as string
            return pattern ? `"${pattern}"` : ''
        }
        if (name === 'list_directory') {
            const path = args.path as string
            return path ? getFileName(path) : '.'
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

    // 渲染预览内容
    const renderPreview = () => {
        const name = toolCall.name

        // 运行中显示骨架屏
        if (isRunning && !toolCall.result && Object.keys(args).filter(k => !k.startsWith('_')).length === 0) {
            return (
                <div className="bg-black/20 rounded-md border border-border overflow-hidden">
                    <div className="min-h-[100px] opacity-60">
                        <CodeSkeleton lines={3} />
                    </div>
                </div>
            )
        }

        // 终端命令
        if (name === 'run_command') {
            const cmd = args.command as string
            return (
                <div className="bg-black/40 rounded-md border border-border overflow-hidden font-mono text-xs">
                    <div className="flex items-center justify-between px-3 py-1.5 bg-white/5 border-b border-border">
                        <span className="text-text-muted flex items-center gap-2">
                            <Terminal className="w-3 h-3" />
                            Terminal
                        </span>
                        {isSuccess && (
                            <button
                                onClick={async e => {
                                    e.stopPropagation()
                                    const cwd = (toolCall as any).meta?.cwd || (args.cwd as string) || ''
                                    setTerminalVisible(true)
                                    const state = terminalManager.getState()
                                    let terminalId = state.activeId
                                    if (!terminalId) {
                                        terminalId = await terminalManager.createTerminal({ cwd, name: 'Terminal' })
                                    }
                                    terminalManager.writeToTerminal(terminalId, cmd)
                                    terminalManager.focusTerminal(terminalId)
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
                            <div className="mt-2 text-text-muted opacity-80 whitespace-pre-wrap break-all border-t border-border pt-2">
                                {toolCall.result.slice(0, 500)}
                                {toolCall.result.length > 500 && <span className="opacity-50">... (truncated)</span>}
                            </div>
                        )}
                    </div>
                </div>
            )
        }

        // 搜索
        if (name === 'search_files' || name === 'web_search') {
            return (
                <div className="bg-black/20 rounded-md border border-border overflow-hidden">
                    <div className="px-3 py-2 border-b border-border flex items-center gap-2 text-xs text-text-muted">
                        <Search className="w-3 h-3" />
                        <span>
                            Query: <span className="text-text-primary font-medium">{(args.pattern || args.query) as string}</span>
                        </span>
                    </div>
                    {toolCall.result && (
                        <div className="max-h-48 overflow-y-auto custom-scrollbar p-1">
                            <JsonHighlight data={toolCall.result} className="p-2" maxHeight="max-h-48" maxLength={3000} />
                        </div>
                    )}
                </div>
            )
        }

        // 文件编辑
        if (['edit_file', 'write_file', 'create_file', 'replace_file_content'].includes(name)) {
            const filePath = (args.path as string) || ''
            const MAX_CHARS = 5000
            const rawNew = ((args.content || args.new_string || '') as string)
            const rawOld = ((args.old_string || '') as string)
            const newContent = rawNew.slice(0, MAX_CHARS)
            const oldContent = rawOld.slice(0, MAX_CHARS)
            const isTruncated = rawNew.length > MAX_CHARS || rawOld.length > MAX_CHARS

            if (newContent || isStreaming) {
                return (
                    <div className="bg-black/20 rounded-md border border-border overflow-hidden">
                        <div className="flex items-center justify-between px-3 py-1.5 bg-white/5 border-b border-border">
                            <span className="text-text-muted flex items-center gap-2 text-xs">
                                <FileCode className="w-3 h-3" />
                                <span className="font-medium text-text-primary">{getFileName(filePath)}</span>
                                {isStreaming && (
                                    <span className="text-accent text-[10px] flex items-center gap-1">
                                        <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                                        Writing...
                                    </span>
                                )}
                                {isTruncated && !isStreaming && <span className="text-yellow-500 text-[10px]">(truncated)</span>}
                            </span>
                        </div>
                        <div className="max-h-64 overflow-auto custom-scrollbar">
                            <InlineDiffPreview
                                oldContent={oldContent}
                                newContent={newContent}
                                filePath={filePath}
                                isStreaming={isStreaming}
                                maxLines={30}
                            />
                        </div>
                        {toolCall.result && !isStreaming && (
                            <div className="px-3 py-2 border-t border-border text-xs text-text-muted">{toolCall.result.slice(0, 200)}</div>
                        )}
                    </div>
                )
            }
        }

        // 默认：显示参数和结果
        const hasArgs = Object.keys(args).filter(k => !k.startsWith('_')).length > 0
        return (
            <div className="space-y-2">
                {hasArgs && (
                    <div className="bg-black/20 rounded-md border border-border p-2">
                        <JsonHighlight
                            data={Object.fromEntries(Object.entries(args).filter(([k]) => !k.startsWith('_')))}
                            maxHeight="max-h-32"
                            maxLength={1500}
                        />
                    </div>
                )}
                {toolCall.richContent && toolCall.richContent.length > 0 && (
                    <RichContentRenderer content={toolCall.richContent} maxHeight="max-h-64" />
                )}
                {toolCall.result && (!toolCall.richContent || toolCall.richContent.length === 0) && (
                    <div className="bg-black/20 rounded-md border border-border overflow-hidden">
                        <div className="flex items-center justify-between px-3 py-1.5 bg-white/5 border-b border-border">
                            <span className="text-[10px] text-text-muted uppercase tracking-wider font-medium">Result</span>
                            <button
                                onClick={e => {
                                    e.stopPropagation()
                                    handleCopyResult()
                                }}
                                className="p-1 hover:bg-white/10 rounded text-text-muted hover:text-text-primary transition-colors"
                            >
                                <Copy className="w-3 h-3" />
                            </button>
                        </div>
                        <div className="max-h-48 overflow-auto custom-scrollbar p-2">
                            <JsonHighlight data={toolCall.result} maxHeight="max-h-48" maxLength={3000} />
                        </div>
                    </div>
                )}
            </div>
        )
    }

    // 卡片样式
    const cardStyle = useMemo(() => {
        if (isAwaitingApproval) return 'border-yellow-500/30 bg-yellow-500/5'
        if (isError) return 'border-red-500/20 bg-red-500/5'
        if (isStreaming || isRunning) return 'border-accent/30 bg-accent/5'
        return 'border-border bg-surface/30 hover:bg-surface/50'
    }, [isAwaitingApproval, isError, isStreaming, isRunning])

    return (
        <div className={`group my-1 rounded-xl border transition-colors duration-200 overflow-hidden ${cardStyle}`}>
            {/* Header */}
            <div className="flex items-center gap-3 px-3 py-2 cursor-pointer select-none" onClick={() => setIsExpanded(!isExpanded)}>
                {/* Status Icon */}
                <div className="shrink-0">
                    {isStreaming || isRunning ? (
                        <Loader2 className="w-4 h-4 text-accent animate-spin" />
                    ) : isSuccess ? (
                        <div className="w-4 h-4 rounded-full bg-green-500/20 flex items-center justify-center">
                            <Check className="w-2.5 h-2.5 text-green-400" />
                        </div>
                    ) : isError ? (
                        <div className="w-4 h-4 rounded-full bg-red-500/20 flex items-center justify-center">
                            <X className="w-2.5 h-2.5 text-red-400" />
                        </div>
                    ) : isRejected ? (
                        <div className="w-4 h-4 rounded-full bg-yellow-500/20 flex items-center justify-center">
                            <X className="w-2.5 h-2.5 text-yellow-400" />
                        </div>
                    ) : (
                        <div className="w-4 h-4 rounded-full border border-text-muted/30" />
                    )}
                </div>

                {/* Title & Description */}
                <div className="flex-1 min-w-0 flex items-center gap-2 overflow-hidden">
                    <span
                        className={`text-sm font-medium whitespace-nowrap ${isStreaming || isRunning ? 'text-accent' : 'text-text-secondary'}`}
                    >
                        {TOOL_LABELS[toolCall.name] || toolCall.name}
                    </span>
                    {description && (
                        <>
                            <span className="text-text-muted/30">|</span>
                            <span className="text-xs truncate font-mono text-text-muted">{description}</span>
                        </>
                    )}
                </div>

                {/* Expand Toggle */}
                <motion.div animate={{ rotate: isExpanded ? 180 : 0 }} transition={{ duration: 0.15 }} className="shrink-0 text-text-muted/50">
                    <ChevronDown className="w-4 h-4" />
                </motion.div>
            </div>

            {/* Expanded Content */}
            <AnimatePresence initial={false}>
                {isExpanded && (
                    <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: 'auto' }}
                        exit={{ height: 0 }}
                        transition={{ duration: 0.15, ease: 'easeInOut' }}
                        className="overflow-hidden"
                    >
                        <div className="px-3 pb-3">
                            {renderPreview()}
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
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Approval Actions */}
            {isAwaitingApproval && (
                <div className="flex items-center justify-end gap-2 px-3 py-2 border-t border-yellow-500/10 bg-yellow-500/5">
                    <button
                        onClick={onReject}
                        className="px-3 py-1.5 text-xs font-medium text-text-muted hover:text-red-400 hover:bg-red-500/10 rounded-md transition-all"
                    >
                        {t('toolReject', language)}
                    </button>
                    <button
                        onClick={onApprove}
                        className="px-3 py-1.5 text-xs font-medium bg-accent text-white hover:bg-accent-hover rounded-md transition-all"
                    >
                        {t('toolApprove', language)}
                    </button>
                </div>
            )}
        </div>
    )
},
(prevProps, nextProps) => {
    const prevStreaming = (prevProps.toolCall.arguments as Record<string, unknown>)?._streaming
    const nextStreaming = (nextProps.toolCall.arguments as Record<string, unknown>)?._streaming
    if (prevStreaming || nextStreaming) {
        return prevProps.toolCall.id === nextProps.toolCall.id && prevStreaming === nextStreaming
    }
    return (
        prevProps.toolCall.id === nextProps.toolCall.id &&
        prevProps.toolCall.status === nextProps.toolCall.status &&
        prevProps.isAwaitingApproval === nextProps.isAwaitingApproval &&
        prevProps.toolCall.result === nextProps.toolCall.result &&
        prevProps.defaultExpanded === nextProps.defaultExpanded
    )
})

export default ToolCallCard
