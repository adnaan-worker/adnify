/**
 * InlineDiffPreview - 内联 Diff 预览组件
 * 使用 diff 库（Myers 算法，Git 同款）计算精确的文件差异
 * 支持语法高亮、删除/新增行颜色区分
 * 
 * 优化：
 * 1. 异步 Diff 计算，避免阻塞 UI
 * 2. 大文件保护，避免计算耗时过长
 * 3. 限制渲染行数，避免 DOM 过多
 */

import React, { useMemo, useState, useEffect } from 'react'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import * as Diff from 'diff'

export interface DiffLine {
    type: 'add' | 'remove' | 'unchanged'
    content: string
    oldLineNumber?: number
    newLineNumber?: number
}

interface InlineDiffPreviewProps {
    oldContent: string
    newContent: string
    filePath: string
    isStreaming?: boolean
    maxLines?: number
}

// 超过此字符数则视为大文件，降级处理或截断
const MAX_FILE_SIZE_FOR_DIFF = 50000;
// Diff 计算超时时间 (ms)
const DIFF_TIMEOUT = 1000;

// 根据文件路径推断语言
function getLanguageFromPath(path: string): string {
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
}

// 异步计算 diff
function useAsyncDiff(oldContent: string, newContent: string, enabled: boolean) {
    const [diffLines, setDiffLines] = useState<DiffLine[] | null>(null)
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (!enabled) {
            setDiffLines(null)
            return
        }

        if (!oldContent && !newContent) {
            setDiffLines([])
            return
        }

        // 简单的输入检查
        if (oldContent.length + newContent.length > MAX_FILE_SIZE_FOR_DIFF * 2) {
             setError("File too large for inline diff. Open in editor to view changes.")
             setIsLoading(false)
             return
        }

        setIsLoading(true)
        setError(null)

        // 使用 setTimeout 将计算移出当前事件循环，让 UI 先响应展开动画
        const timerId = setTimeout(() => {
            try {
                // 再次检查长度，防止在 timeout 期间数据变得巨大
                if (oldContent.length + newContent.length > MAX_FILE_SIZE_FOR_DIFF * 2) {
                     throw new Error("File too large");
                }

                const changes = Diff.diffLines(oldContent, newContent)
                const result: DiffLine[] = []
                
                let oldLineNum = 1
                let newLineNum = 1
            
                for (const change of changes) {
                    const lines = change.value.split('\n')
                    // 移除最后一个空行（split 产生的）
                    if (lines[lines.length - 1] === '') {
                        lines.pop()
                    }
            
                    for (const line of lines) {
                        if (change.added) {
                            result.push({
                                type: 'add',
                                content: line,
                                newLineNumber: newLineNum++
                            })
                        } else if (change.removed) {
                            result.push({
                                type: 'remove',
                                content: line,
                                oldLineNumber: oldLineNum++
                            })
                        } else {
                            result.push({
                                type: 'unchanged',
                                content: line,
                                oldLineNumber: oldLineNum++,
                                newLineNumber: newLineNum++
                            })
                        }
                    }
                }
                setDiffLines(result)
            } catch (err) {
                console.error("Diff calculation failed:", err)
                setError("Diff calculation too complex or timed out.")
            } finally {
                setIsLoading(false)
            }
        }, 50) // 50ms 延迟，给 UI 足够的时间做动画

        return () => clearTimeout(timerId)
    }, [oldContent, newContent, enabled])

    return { diffLines, isLoading, error }
}

// 自定义 SyntaxHighlighter 样式
const customStyle = {
    ...oneDark,
    'pre[class*="language-"]': {
        ...oneDark['pre[class*="language-"]'],
        margin: 0,
        padding: 0,
        background: 'transparent',
        fontSize: '11px',
        lineHeight: '1.4',
    },
    'code[class*="language-"]': {
        ...oneDark['code[class*="language-"]'],
        background: 'transparent',
        fontSize: '11px',
    },
}

// 提取单个行组件并使用 React.memo 优化性能
const DiffLineItem = React.memo(({ line, language }: { line: DiffLine, language: string }) => {
    const bgClass = line.type === 'add'
        ? 'bg-green-500/15 border-l-2 border-green-500/50'
        : line.type === 'remove'
            ? 'bg-red-500/15 border-l-2 border-red-500/50'
            : 'border-l-2 border-transparent'

    const symbolClass = line.type === 'add'
        ? 'text-green-400'
        : line.type === 'remove'
            ? 'text-red-400'
            : 'text-text-muted/30'

    const symbol = line.type === 'add' ? '+' : line.type === 'remove' ? '-' : ' '
    const lineNum = line.type === 'remove' ? line.oldLineNumber : line.newLineNumber

    return (
        <div className={`flex ${bgClass} hover:brightness-110 transition-all`}>
            {/* 行号 */}
            <span className="w-8 shrink-0 text-right pr-2 text-text-muted/40 select-none text-[10px]">
                {lineNum || ''}
            </span>

            {/* 符号 */}
            <span className={`w-4 shrink-0 text-center select-none font-bold ${symbolClass}`}>
                {symbol}
            </span>

            {/* 代码内容 - 如果行超长，截断它以保护渲染性能 */}
            <div className="flex-1 overflow-hidden">
                {line.content.length > 500 ? (
                     <div className="whitespace-pre text-text-muted truncate">
                        {line.content.slice(0, 500)}... (line too long)
                     </div>
                ) : (
                    <SyntaxHighlighter
                        language={language}
                        style={customStyle}
                        customStyle={{
                            margin: 0,
                            padding: 0,
                            background: 'transparent',
                            whiteSpace: 'pre',
                            overflow: 'visible',
                        }}
                        wrapLines={false}
                        PreTag="span"
                        CodeTag="span"
                    >
                        {line.content || ' '}
                    </SyntaxHighlighter>
                )}
            </div>
        </div>
    )
})

DiffLineItem.displayName = 'DiffLineItem'

export default function InlineDiffPreview({
    oldContent,
    newContent,
    filePath,
    isStreaming = false,
    maxLines = 100,
}: InlineDiffPreviewProps) {
    const language = useMemo(() => getLanguageFromPath(filePath), [filePath])
    
    // 只有在组件挂载后才计算，不需要额外的 enabled 标志，useEffect 会自动处理
    const { diffLines, isLoading, error } = useAsyncDiff(oldContent, newContent, true)

    // 智能过滤：只显示变更行及其上下文
    const displayLines = useMemo(() => {
        if (!diffLines) return []

        // 1. 如果总行数在限制内，直接显示全部
        if (diffLines.length <= maxLines) {
            return diffLines
        }

        // 2. 如果是纯新增/纯删除文件（或几乎全是变更），直接截断显示前 N 行
        // 这里的逻辑是：如果变更行数非常多（接近总行数），说明可能是新文件或重写，
        // 这种情况下计算上下文没有意义，直接截断最有效率且符合直觉。
        const changedCount = diffLines.filter(l => l.type !== 'unchanged').length
        if (changedCount > maxLines * 0.8) { // 阈值：80% 以上是变更
             const truncated = diffLines.slice(0, maxLines)
             // 必须手动添加 ellipsis 类型，注意类型断言
             return [...truncated, { type: 'ellipsis', count: diffLines.length - maxLines }] as (DiffLine | { type: 'ellipsis'; count: number })[]
        }

        // 3. 常规 Diff：计算上下文
        const contextSize = 3 
        const changedIndices = new Set<number>()

        // 标记所有变更行及其上下文
        diffLines.forEach((line, idx) => {
            if (line.type === 'add' || line.type === 'remove') {
                for (let i = Math.max(0, idx - contextSize); i <= Math.min(diffLines.length - 1, idx + contextSize); i++) {
                    changedIndices.add(i)
                }
            }
        })

        // 构建显示结果，添加省略号
        const result: (DiffLine | { type: 'ellipsis'; count: number })[] = []
        let lastIdx = -1
        const sortedIndices = Array.from(changedIndices).sort((a, b) => a - b)

        for (const idx of sortedIndices) {
            if (lastIdx >= 0 && idx - lastIdx > 1) {
                result.push({ type: 'ellipsis', count: idx - lastIdx - 1 })
            }
            result.push(diffLines[idx])
            lastIdx = idx
            
            // 安全保护：如果上下文展开后依然太多，强制截断
            if (result.length >= maxLines) {
                result.push({ type: 'ellipsis', count: diffLines.length - idx - 1 })
                return result
            }
        }

        if (lastIdx < diffLines.length - 1) {
            result.push({ type: 'ellipsis', count: diffLines.length - lastIdx - 1 })
        }

        return result
    }, [diffLines, maxLines])

    if (isLoading) {
        return (
             <div className="flex flex-col items-center justify-center py-8 text-text-muted gap-2">
                 <div className="w-5 h-5 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
                 <span className="text-xs">Computing diff...</span>
             </div>
        )
    }

    if (error) {
        return (
            <div className="px-4 py-3 text-xs text-text-muted bg-white/5 italic text-center">
                {error}
            </div>
        )
    }

    if (!diffLines || displayLines.length === 0) {
        return (
            <div className="text-[10px] text-text-muted italic px-2 py-1">
                No changes
            </div>
        )
    }

    return (
        <div className="font-mono text-[11px] leading-relaxed">
            {displayLines.map((line, idx) => {
                if ('count' in line && line.type === 'ellipsis') {
                    return (
                        <div key={`ellipsis-${idx}`} className="text-text-muted/40 text-center py-1 text-[10px] bg-white/5">
                            ··· {line.count} unchanged lines ···
                        </div>
                    )
                }

                return (
                    <DiffLineItem
                        key={`${(line as DiffLine).type}-${idx}-${(line as DiffLine).oldLineNumber || (line as DiffLine).newLineNumber}`}
                        line={line as DiffLine}
                        language={language}
                    />
                )
            })}
        </div>
    )
}

// 导出统计工具函数 - 使用 diff 库计算准确的统计 (同步版，用于卡片头部快速显示)
// 注意：如果文件过大，这个函数仍然可能慢。但在 header 中我们通常优先使用 meta 数据。
export function getDiffStats(oldContent: string, newContent: string): { added: number; removed: number } {
    // 快速检查
    if (oldContent.length + newContent.length > MAX_FILE_SIZE_FOR_DIFF * 2) {
        return { added: 0, removed: 0 } // 太大就不算了
    }

    try {
        const changes = Diff.diffLines(oldContent, newContent)
        
        let added = 0
        let removed = 0
        
        for (const change of changes) {
            const lineCount = change.value.split('\n').filter(l => l !== '' || change.value === '\n').length
            const actualLines = change.value.endsWith('\n') ? lineCount : lineCount
            
            if (change.added) {
                added += actualLines
            } else if (change.removed) {
                removed += actualLines
            }
        }
    
        return { added, removed }
    } catch {
        return { added: 0, removed: 0 }
    }
}
