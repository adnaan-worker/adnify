import { Play, RotateCcw, CheckCircle2, Circle, Clock, AlertCircle } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { Button } from '../ui'
import { useAgent } from '@/renderer/hooks/useAgent'
import { useStore } from '@/renderer/store'
import React from 'react'

interface PlanPreviewProps {
    content: string
    fontSize?: number
    filePath: string
}

function extractText(node: any): string {
    if (!node) return ''
    if (typeof node === 'string' || typeof node === 'number') return String(node)
    if (Array.isArray(node)) return node.map(extractText).join('')
    if (React.isValidElement(node)) {
        const props = node.props as any
        if (props.type === 'checkbox') {
            return props.checked ? '[x]' : '[ ]'
        }
        return extractText(props.children)
    }
    return ''
}

export function PlanPreview({ content, fontSize = 14 }: PlanPreviewProps) {
    const { sendMessage } = useAgent()
    const { language } = useStore()

    const handleExecuteStep = (title: string) => {
        const prompt = language === 'zh'
            ? `请执行计划步骤：${title}`
            : `Please execute plan step: ${title}`
        sendMessage(prompt)
    }

    return (
        <div
            className="absolute inset-0 overflow-y-auto p-8 bg-transparent custom-scrollbar"
            style={{ fontSize: `${fontSize}px` }}
        >
            <div className="max-w-3xl mx-auto prose prose-invert">
                <ReactMarkdown
                    components={{
                        code({ className, children, ...props }) {
                            const match = /language-(\w+)/.exec(className || '')
                            const codeContent = String(children)
                            const isInline = !match && !codeContent.includes('\n')

                            return isInline ? (
                                <code className="bg-white/10 px-1.5 py-0.5 rounded-md text-accent font-mono text-[0.9em] border border-white/5" {...props}>
                                    {children}
                                </code>
                            ) : (
                                <div className="relative group/code my-4 rounded-xl overflow-hidden border border-border shadow-sm">
                                    <div className="absolute top-0 right-0 px-3 py-1 text-[10px] font-mono text-text-muted bg-black/40 rounded-bl-lg border-l border-b border-border opacity-0 group-hover/code:opacity-100 transition-opacity">
                                        {match?.[1] || 'text'}
                                    </div>
                                    <SyntaxHighlighter
                                        style={vscDarkPlus}
                                        language={match?.[1] || 'text'}
                                        PreTag="div"
                                        className="!bg-black/40 !p-4 !m-0 custom-scrollbar"
                                        customStyle={{ fontSize: `${fontSize}px`, margin: 0 }}
                                    >
                                        {String(children).replace(/\n$/, '')}
                                    </SyntaxHighlighter>
                                </div>
                            )
                        },
                        li: ({ children }) => {
                            const text = extractText(children).trim()
                            const match = /^\[( |x|\/|!)\]\s*(?:✅|🔄|❌|⬜)?\s*(?:\[id: ([a-f0-9]+)\])?\s*(.*)/i.exec(text)

                            if (match) {
                                const [, checkbox, , title] = match
                                const isCompleted = checkbox.toLowerCase() === 'x'
                                const isInProgress = checkbox === '/'
                                const isFailed = checkbox === '!'

                                return (
                                    <li className="flex items-start gap-3 group py-2 px-3 -mx-3 rounded-lg hover:bg-white/5 transition-colors list-none">
                                        <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center mt-0.5">
                                            {isCompleted ? <CheckCircle2 className="w-4 h-4 text-green-400" /> :
                                                isInProgress ? <Clock className="w-4 h-4 text-blue-400 animate-spin-slow" /> :
                                                    isFailed ? <AlertCircle className="w-4 h-4 text-red-400" /> :
                                                        <Circle className="w-4 h-4 text-text-muted/50" />}
                                        </span>
                                        <div className="flex-1 flex flex-col gap-1 min-w-0">
                                            <span className={`leading-relaxed ${isCompleted ? 'text-text-muted line-through opacity-60' : 'text-text-primary'}`}>
                                                {title}
                                            </span>
                                        </div>
                                        {!isInProgress && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleExecuteStep(title)}
                                                className="h-7 px-3 opacity-0 group-hover:opacity-100 transition-all text-[10px] gap-1.5 bg-surface/50 border border-border hover:bg-accent/10 hover:text-accent hover:border-accent/30 rounded-lg scale-90 group-hover:scale-100"
                                            >
                                                {isCompleted ? (
                                                    <>
                                                        <RotateCcw className="w-3 h-3" />
                                                        {language === 'zh' ? '重试' : 'Retry'}
                                                    </>
                                                ) : (
                                                    <>
                                                        <Play className="w-3 h-3" />
                                                        {language === 'zh' ? '执行' : 'Run'}
                                                    </>
                                                )}
                                            </Button>
                                        )}
                                    </li>
                                )
                            }
                            return <li className="leading-relaxed mb-1">{children}</li>
                        },
                        h1: ({ children }) => <h1 className="text-3xl font-black mt-10 mb-6 text-text-primary tracking-tight">{children}</h1>,
                        h2: ({ children }) => <h2 className="text-2xl font-bold mt-8 mb-4 text-text-primary tracking-tight border-b border-border pb-2">{children}</h2>,
                        h3: ({ children }) => <h3 className="text-lg font-bold mt-6 mb-3 text-text-primary">{children}</h3>,
                        p: ({ children }) => <p className="mb-4 text-text-secondary leading-7">{children}</p>,
                        ul: ({ children }) => <ul className="list-disc pl-5 mb-4 space-y-1 text-text-secondary">{children}</ul>,
                        ol: ({ children }) => <ol className="list-decimal pl-5 mb-4 space-y-1 text-text-secondary">{children}</ol>,
                        blockquote: ({ children }) => (
                            <blockquote className="border-l-2 border-accent/50 pl-4 my-6 text-text-muted italic">
                                {children}
                            </blockquote>
                        ),
                        hr: () => <hr className="border-border my-8" />,
                    }}
                >
                    {content}
                </ReactMarkdown>
            </div>
        </div>
    )
}