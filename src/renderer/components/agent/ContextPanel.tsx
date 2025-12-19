import { useState, useMemo } from 'react'
import {
    File,
    Code,
    Folder,
    Database,
    GitBranch,
    Terminal,
    X,
    Plus,
    ChevronDown,
    ChevronRight,
    Cpu
} from 'lucide-react'
import {
    ContextItem,
    FileContext,
} from '@/renderer/agent/core/types'

interface ContextPanelProps {
    contextItems: ContextItem[]
    activeFilePath: string | null
    onRemove: (index: number) => void
    onClear: () => void
    onAddCurrentFile: () => void
}

export default function ContextPanel({
    contextItems,
    activeFilePath,
    onRemove,
    onClear,
    onAddCurrentFile
}: ContextPanelProps) {
    const [isExpanded, setIsExpanded] = useState(true)

    // 简单的 Token 估算 (字符数 / 4)
    const estimatedTokens = useMemo(() => {
        return contextItems.length * 100 // 假设每个引用平均 100 tokens
    }, [contextItems])

    const getIconAndLabel = (item: ContextItem) => {
        switch (item.type) {
            case 'File': return { icon: <File className="w-3 h-3 text-accent" />, label: (item as FileContext).uri.split(/[\\/]/).pop() || 'File' }
            case 'CodeSelection': return { icon: <Code className="w-3 h-3 text-blue-400" />, label: 'Selection' }
            case 'Folder': return { icon: <Folder className="w-3 h-3 text-yellow-400" />, label: 'Folder' }
            case 'Codebase': return { icon: <Database className="w-3 h-3 text-purple-400" />, label: '@codebase' }
            case 'Git': return { icon: <GitBranch className="w-3 h-3 text-orange-400" />, label: '@git' }
            case 'Terminal': return { icon: <Terminal className="w-3 h-3 text-green-400" />, label: '@terminal' }
            case 'Symbols': return { icon: <Code className="w-3 h-3 text-blue-400" />, label: '@symbols' }
            default: return { icon: <File className="w-3 h-3" />, label: 'Unknown' }
        }
    }

    const isCurrentFileAdded = activeFilePath && contextItems.some(
        (s: ContextItem) => s.type === 'File' && (s as FileContext).uri === activeFilePath
    )

    if (contextItems.length === 0 && !activeFilePath) return null

    return (
        <div className="border-t border-white/5 bg-black/20 backdrop-blur-sm transition-all duration-300">
            {/* Header */}
            <div
                className="flex items-center justify-between px-4 py-2 cursor-pointer hover:bg-white/5"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="flex items-center gap-2 text-xs text-text-muted">
                    {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                    <span className="font-medium">Context</span>
                    <span className="bg-white/10 px-1.5 rounded-full text-[10px]">{contextItems.length}</span>
                    {contextItems.length > 0 && (
                        <span className="flex items-center gap-1 ml-2 opacity-60">
                            <Cpu className="w-3 h-3" />
                            <span>~{estimatedTokens} tokens (est.)</span>
                        </span>
                    )}
                </div>

                {contextItems.length > 0 && (
                    <button
                        onClick={(e) => { e.stopPropagation(); onClear() }}
                        className="text-[10px] text-text-muted hover:text-text-primary hover:underline"
                    >
                        Clear all
                    </button>
                )}
            </div>

            {/* Content */}
            {isExpanded && (
                <div className="px-4 pb-3 animate-in slide-in-from-top-2 duration-200">
                    <div className="flex items-center gap-2 flex-wrap">
                        {/* Quick Add Current File */}
                        {activeFilePath && !isCurrentFileAdded && (
                            <button
                                onClick={onAddCurrentFile}
                                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-accent/10 hover:bg-accent/20 rounded-full border border-accent/20 text-xs text-accent transition-all group"
                                title="Add active file to context"
                            >
                                <Plus className="w-3 h-3" />
                                <span className="truncate max-w-[120px] font-medium">{activeFilePath.split(/[\\/]/).pop()}</span>
                            </button>
                        )}

                        {/* Context Items */}
                        {contextItems.map((item: ContextItem, index: number) => {
                            const { icon, label } = getIconAndLabel(item)
                            return (
                                <div
                                    key={`${item.type}-${index}`}
                                    className="flex items-center gap-1.5 px-2.5 py-1.5 bg-surface/50 rounded-full border border-white/10 text-xs group hover:border-white/20 transition-colors"
                                >
                                    {icon}
                                    <span className="text-text-secondary truncate max-w-[150px] font-medium">{label}</span>
                                    <button
                                        onClick={() => onRemove(index)}
                                        className="p-0.5 rounded-full hover:bg-red-500/20 text-text-muted hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}
        </div>
    )
}
