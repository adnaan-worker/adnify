/**
 * 工具调用组组件
 * 用于合并显示连续的工具调用，减少刷屏
 * 新设计：统一的时间轴样式，运行中的工具单独显示
 */

import { useState, useMemo } from 'react'
import { ChevronDown, ChevronRight, Layers } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { ToolCall } from '@/renderer/agent/types'
import ToolCallCard from './ToolCallCard'
import FileChangeCard from './FileChangeCard'
import { isWriteTool } from '@/shared/config/tools'
import { useStore } from '@store'

interface ToolCallGroupProps {
    toolCalls: ToolCall[]
    pendingToolId?: string
    onApproveTool?: () => void
    onRejectTool?: () => void
    onOpenDiff?: (path: string, oldContent: string, newContent: string) => void
}

export default function ToolCallGroup({
    toolCalls,
    pendingToolId,
    onApproveTool,
    onRejectTool,
    onOpenDiff,
}: ToolCallGroupProps) {
    const [isExpanded, setIsExpanded] = useState(false)
    const { language } = useStore()

    // 分离：已完成/失败的工具 vs 正在运行/等待的工具
    const { completedCalls, activeCalls } = useMemo(() => {
        const completed: ToolCall[] = []
        const active: ToolCall[] = []

        toolCalls.forEach(tc => {
            const isRunning = tc.status === 'running' || tc.status === 'pending'
            // 如果是 pendingToolId 对应的工具，也视为 active
            if (isRunning || tc.id === pendingToolId) {
                active.push(tc)
            } else {
                completed.push(tc)
            }
        })
        return { completedCalls: completed, activeCalls: active }
    }, [toolCalls, pendingToolId])

    // 渲染单个工具卡片
    const renderToolCard = (tc: ToolCall) => {
        const isFileOp = isWriteTool(tc.name)
        const isPending = tc.id === pendingToolId

        if (isFileOp) {
            return (
                <FileChangeCard
                    key={tc.id}
                    toolCall={tc}
                    isAwaitingApproval={isPending}
                    onApprove={isPending ? onApproveTool : undefined}
                    onReject={isPending ? onRejectTool : undefined}
                    onOpenInEditor={onOpenDiff}
                />
            )
        }

        return (
            <ToolCallCard
                key={tc.id}
                toolCall={tc}
                isAwaitingApproval={isPending}
                onApprove={isPending ? onApproveTool : undefined}
                onReject={isPending ? onRejectTool : undefined}
            />
        )
    }

    return (
        <div className="my-2 space-y-2">
            {/* 1. 已完成的工具组 (如果数量 > 1，折叠显示) */}
            {completedCalls.length > 0 && (
                completedCalls.length === 1 ? (
                    // 只有一个已完成工具，直接显示
                    renderToolCard(completedCalls[0])
                ) : (
                    // 多个已完成工具，折叠显示
                    <motion.div 
                        layout
                        className="rounded-xl border border-white/5 bg-surface/30 backdrop-blur-sm overflow-hidden transition-colors hover:bg-surface/50"
                    >
                        <div
                            className="flex items-center gap-3 px-3 py-2.5 cursor-pointer select-none"
                            onClick={() => setIsExpanded(!isExpanded)}
                        >
                            <div className="p-1.5 rounded-md bg-white/5 text-text-muted border border-white/5">
                                <Layers className="w-3.5 h-3.5" />
                            </div>
                            <div className="flex-1 min-w-0 flex items-center gap-2">
                                <span className="text-xs font-medium text-text-secondary">
                                    {language === 'zh'
                                        ? `已执行 ${completedCalls.length} 个操作`
                                        : `Executed ${completedCalls.length} steps`}
                                </span>
                                <div className="h-px flex-1 bg-white/5 mx-2" />
                            </div>
                            <motion.div 
                                animate={{ rotate: isExpanded ? 180 : 0 }}
                                className="text-text-muted/50"
                            >
                                <ChevronDown className="w-3.5 h-3.5" />
                            </motion.div>
                        </div>

                        <AnimatePresence initial={false}>
                            {isExpanded && (
                                <motion.div
                                    layout
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.25, ease: "easeInOut" }}
                                >
                                    <div className="border-t border-white/5 p-2 space-y-2 bg-black/5">
                                        {completedCalls.map(renderToolCard)}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </motion.div>
                )
            )}

            {/* 2. 正在运行/等待的工具 (始终展开，直接显示) */}
            <AnimatePresence>
                {activeCalls.length > 0 && (
                    <motion.div 
                        className="space-y-2"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                    >
                        {activeCalls.map(renderToolCard)}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}
