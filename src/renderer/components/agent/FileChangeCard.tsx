/**
 * 文件变更卡片 - 带 Diff 预览的设计
 * 显示删除/新增行的 unified diff 视图，支持语法高亮
 */

import { useState, useEffect, useMemo } from 'react'
import { Check, X, ChevronDown, ChevronRight, ExternalLink, Loader2 } from 'lucide-react'
import { ToolCall } from '../../agent/core/types'
import InlineDiffPreview, { getDiffStats } from './InlineDiffPreview'

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

    const isStreaming = args._streaming === true
    const isRunning = toolCall.status === 'running' || toolCall.status === 'pending'
    const isSuccess = toolCall.status === 'success'
    const isError = toolCall.status === 'error'

    // 获取新旧内容用于 diff
    const oldContent = useMemo(() => {
        return (meta?.oldContent as string) || ''
    }, [meta])

    const newContent = useMemo(() => {
        if (meta?.newContent) return meta.newContent as string
        // Fallback: 从 args 中获取
        return (args.content || args.code || args.search_replace_blocks || args.replacement || args.source) as string || ''
    }, [args, meta])

    // 计算行数变化
    const diffStats = useMemo(() => {
        if (!newContent) return { added: 0, removed: 0 }
        try {
            return getDiffStats(oldContent, newContent)
        } catch {
            return { added: 0, removed: 0 }
        }
    }, [oldContent, newContent])

    // 自动展开 logic
    useEffect(() => {
        if (isRunning || isStreaming || isSuccess) {
            setIsExpanded(true)
        }
    }, [isRunning, isStreaming, isSuccess])

    // 判断是否是新建文件
    const isNewFile = !oldContent && !!newContent

    return (
        <div className={`my-1 rounded-lg border overflow-hidden transition-all duration-200 ${isAwaitingApproval
            ? 'border-yellow-500/30 bg-yellow-500/5'
            : isError
                ? 'border-red-500/20 bg-red-500/5'
                : 'border-white/5 bg-surface/20 hover:bg-surface/30' // Flatter design
            }`}>
            {/* 头部 - 文件名 + 状态 */}
            <div
                className="flex items-center gap-2 px-2.5 py-1.5 cursor-pointer select-none"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                {isExpanded ? (
                    <ChevronDown className="w-3 h-3 text-text-muted" />
                ) : (
                    <ChevronRight className="w-3 h-3 text-text-muted" />
                )}

                <span className="text-accent text-xs opacity-80">{'<>'}</span>
                <span className="text-[11px] text-text-primary flex-1 truncate font-medium">{fileName}</span>

                {/* 行数变化统计 */}
                {(isSuccess || newContent) && (
                    <span className="text-[10px] font-mono opacity-80 flex items-center gap-1">
                        {diffStats.added > 0 && (
                            <span className="text-green-400">+{diffStats.added}</span>
                        )}
                        {diffStats.removed > 0 && (
                            <span className="text-red-400">-{diffStats.removed}</span>
                        )}
                        {isNewFile && diffStats.added === 0 && (
                            <span className="text-blue-400">new</span>
                        )}
                    </span>
                )}

                {/* 状态指示 */}
                {isStreaming && (
                    <div className="flex items-center gap-1.5 px-1.5 py-0.5 bg-accent/10 rounded-full border border-accent/20">
                        <div className="w-1.5 h-1.5 bg-accent rounded-full animate-pulse" />
                        <span className="text-[9px] font-medium text-accent uppercase tracking-wider">Generating...</span>
                    </div>
                )}
                {isRunning && !isStreaming && <Loader2 className="w-3 h-3 text-accent animate-spin" />}
                {isSuccess && <span className="px-1 py-0.5 text-[9px] bg-green-500/10 text-green-400 rounded border border-green-500/20">Applied</span>}
                {isError && <span className="px-1 py-0.5 text-[9px] bg-red-500/10 text-red-400 rounded border border-red-500/20">Failed</span>}

                {/* 打开按钮 */}
                {isSuccess && onOpenInEditor && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation()
                            onOpenInEditor(filePath, oldContent, newContent)
                        }}
                        className="p-0.5 text-text-muted hover:text-accent rounded transition-colors"
                    >
                        <ExternalLink className="w-3 h-3" />
                    </button>
                )}
            </div>

            {/* 展开的 Diff 预览 - 使用 InlineDiffPreview 组件 */}
            {isExpanded && newContent && (
                <div className="border-t border-white/5 max-h-48 overflow-auto custom-scrollbar bg-black/10">
                    <InlineDiffPreview
                        oldContent={oldContent}
                        newContent={newContent}
                        filePath={filePath}
                        isStreaming={isStreaming || isRunning}
                        maxLines={50}
                    />
                </div>
            )}

            {/* 错误信息 */}
            {toolCall.error && (
                <div className="px-2.5 py-1.5 bg-red-500/5 border-t border-red-500/10 text-[10px] text-red-300 font-mono">
                    {toolCall.error}
                </div>
            )}

            {/* 审批按钮 */}
            {isAwaitingApproval && (
                <div className="flex items-center justify-end gap-2 px-2.5 py-1.5 border-t border-white/5 bg-white/[0.02]">
                    <button
                        onClick={onReject}
                        className="flex items-center gap-1 px-2 py-0.5 text-[10px] text-text-muted hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                    >
                        <X className="w-3 h-3" />
                        Reject
                    </button>
                    <button
                        onClick={onApprove}
                        className="flex items-center gap-1 px-2 py-0.5 text-[10px] text-white bg-green-500/80 hover:bg-green-500 rounded transition-colors shadow-sm shadow-green-500/20"
                    >
                        <Check className="w-3 h-3" />
                        Accept
                    </button>
                </div>
            )}
        </div>
    )
}
