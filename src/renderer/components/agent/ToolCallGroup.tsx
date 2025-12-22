/**
 * 工具调用组组件
 * 用于合并显示连续的工具调用，减少刷屏
 */

import { useState, useMemo } from 'react'
import { ChevronDown, ChevronRight, Eye } from 'lucide-react'
import { ToolCall } from '@/renderer/agent/core/types'
import ToolCallCard from './ToolCallCard'
import FileChangeCard from './FileChangeCard'
import { WRITE_TOOLS } from '@/renderer/agent/core/ToolExecutor'
import { useStore } from '../../store'

interface ToolCallGroupProps {
    toolCalls: ToolCall[]
    pendingToolId?: string
    onApproveTool?: () => void
    onRejectTool?: () => void
    onApproveAll?: () => void
    onOpenDiff?: (path: string, oldContent: string, newContent: string) => void
}

export default function ToolCallGroup({
    toolCalls,
    pendingToolId,
    onApproveTool,
    onRejectTool,
    onApproveAll,
    onOpenDiff,
}: ToolCallGroupProps) {
    const [isReadExpanded, setIsReadExpanded] = useState(false)
    const { language } = useStore()

    // 分离读写工具
    const { readCalls, writeCalls } = useMemo(() => {
        const read: ToolCall[] = []
        const write: ToolCall[] = []

        toolCalls.forEach(tc => {
            // 终端命令也视为"写"操作（重要操作）
            if (WRITE_TOOLS.includes(tc.name) || tc.name === 'run_command' || tc.name === 'delete_file_or_folder') {
                write.push(tc)
            } else {
                read.push(tc)
            }
        })
        return { readCalls: read, writeCalls: write }
    }, [toolCalls])

    // 渲染单个工具卡片
    const renderToolCard = (tc: ToolCall) => {
        const isFileOp = WRITE_TOOLS.includes(tc.name)
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
                onApproveAll={isPending ? onApproveAll : undefined}
            />
        )
    }

    // 如果工具数量很少（<= 3），且没有混合大量读操作，直接扁平展示
    if (toolCalls.length <= 3 && readCalls.length <= 1) {
        return (
            <div className="space-y-2 my-2">
                {toolCalls.map(renderToolCard)}
            </div>
        )
    }

    return (
        <div className="my-2 space-y-2">
            {/* 读操作分组 (如果有多个) */}
            {readCalls.length > 0 && (
                <div className="rounded-lg border border-white/5 bg-surface/20 overflow-hidden">
                    <div
                        className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-white/5 transition-colors select-none"
                        onClick={() => setIsReadExpanded(!isReadExpanded)}
                    >
                        <div className="p-1 rounded-md bg-white/5 text-text-muted">
                            <Eye className="w-3.5 h-3.5" />
                        </div>
                        <span className="text-xs font-medium text-text-secondary flex-1">
                            {language === 'zh'
                                ? `读取了 ${readCalls.length} 个文件/资源`
                                : `Read ${readCalls.length} files/resources`}
                        </span>
                        {isReadExpanded ? (
                            <ChevronDown className="w-3.5 h-3.5 text-text-muted" />
                        ) : (
                            <ChevronRight className="w-3.5 h-3.5 text-text-muted" />
                        )}
                    </div>
                    {isReadExpanded && (
                        <div className="border-t border-white/5 p-2 space-y-2 bg-black/10">
                            {readCalls.map(renderToolCard)}
                        </div>
                    )}
                </div>
            )}

            {/* 写操作直接展示 (重要操作不折叠) */}
            {writeCalls.length > 0 && (
                <div className="space-y-2">
                    {writeCalls.map(renderToolCard)}
                </div>
            )}
        </div>
    )
}
