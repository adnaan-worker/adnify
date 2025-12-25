/**
 * 聊天消息组件
 * Cursor 风格：完全扁平化，无气泡，沉浸式体验
 * 新设计：全宽布局，头像在顶部 Header
 */

import React, { useState, useCallback } from 'react'
import { User, Copy, Check, RefreshCw, Edit2, RotateCcw, Sparkles, ChevronDown } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import aiAvatar from '../../assets/icon/ai-avatar.gif'
import {
  ChatMessage as ChatMessageType,
  isUserMessage,
  isAssistantMessage,
  getMessageText,
  getMessageImages,
  AssistantPart,
  isTextPart,
  isToolCallPart,
} from '@renderer/agent/core/types'
import FileChangeCard from './FileChangeCard'
import ToolCallCard from './ToolCallCard'
import ToolCallGroup from './ToolCallGroup'
import { WRITE_TOOLS } from '@renderer/agent/core/ToolExecutor'
import { useStore } from '@store'

interface ChatMessageProps {
  message: ChatMessageType
  onEdit?: (messageId: string, newContent: string) => void
  onRegenerate?: (messageId: string) => void
  onRestore?: (messageId: string) => void
  onApproveTool?: () => void
  onRejectTool?: () => void
  onApproveAll?: () => void  // 批准全部
  onOpenDiff?: (path: string, oldContent: string, newContent: string) => void
  pendingToolId?: string
  hasCheckpoint?: boolean
}

// 代码块组件 - 更加精致的玻璃质感
const CodeBlock = React.memo(({ language, children, fontSize }: { language: string | undefined; children: React.ReactNode; fontSize: number }) => {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(() => {
    const text = String(children).replace(/\n$/, '')
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [children])

  return (
    <div className="relative group/code my-3 rounded-lg overflow-hidden border border-white/5 bg-black/30 backdrop-blur-sm shadow-sm">
      <div className="flex items-center justify-between px-3 py-1.5 bg-white/5 border-b border-white/5">
        <span className="text-[10px] text-text-muted font-mono uppercase tracking-wider opacity-70">
          {language || 'text'}
        </span>
        <button
          onClick={handleCopy}
          className="p-1 rounded-md hover:bg-white/10 text-text-muted hover:text-text-primary transition-colors"
          title="Copy code"
        >
          {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
        </button>
      </div>
      <SyntaxHighlighter
        style={vscDarkPlus}
        language={language}
        PreTag="div"
        className="!bg-transparent !p-3 !m-0 custom-scrollbar leading-relaxed font-mono"
        customStyle={{ background: 'transparent', margin: 0, fontSize: `${fontSize}px` }}
        wrapLines
        wrapLongLines
      >
        {String(children).replace(/\n$/, '')}
      </SyntaxHighlighter>
    </div>
  )
})

CodeBlock.displayName = 'CodeBlock'

// 辅助函数：清理流式输出中的 XML 工具调用标签
const cleanStreamingContent = (text: string): string => {
  if (!text) return ''
  // 匹配完整的 <tool_call>...</tool_call> 和 <function>...</function> 块并移除
  let cleaned = text.replace(/<tool_call>[\s\S]*?<\/tool_call>/gi, '')
  cleaned = cleaned.replace(/<function[\s\S]*?<\/function>/gi, '')
  // 匹配以 <tool_call> 或 <function> 开头但未闭合的块（在字符串末尾）并移除
  cleaned = cleaned.replace(/<tool_call>[\s\S]*$/gi, '')
  cleaned = cleaned.replace(/<function[\s\S]*$/gi, '')
  return cleaned.trim()
}

// 提取 thinking 内容
const extractThinkingBlocks = (text: string): { thinkingBlocks: { content: string, startTime?: number, isClosed: boolean }[], mainContent: string } => {
  if (!text) return { thinkingBlocks: [], mainContent: '' }

  const thinkingBlocks: { content: string, startTime?: number, isClosed: boolean }[] = []

  // 1. 匹配已闭合的块
  let currentText = text
  const closedRegex = /<thinking(?: startTime="(\d+)")?>([\s\S]*?)<\/thinking>/gi
  currentText = currentText.replace(closedRegex, (_, startTime, content) => {
    thinkingBlocks.push({
      content: content.trim(),
      startTime: startTime ? parseInt(startTime) : undefined,
      isClosed: true
    })
    return ''
  })

  // 2. 匹配未闭合的块（在末尾）
  const openRegex = /<thinking(?: startTime="(\d+)")?>([\s\S]*)$/gi
  const openMatch = openRegex.exec(currentText)
  if (openMatch) {
    const startTime = openMatch[1] ? parseInt(openMatch[1]) : undefined
    const content = openMatch[2].trim()
    thinkingBlocks.push({
      content,
      startTime,
      isClosed: false
    })
    currentText = currentText.replace(openRegex, '')
  }

  return { thinkingBlocks, mainContent: currentText.trim() }
}

// ThinkingBlock 组件 - 高级折叠样式
const ThinkingBlock = React.memo(({ content, startTime, isClosed, fontSize }: { content: string; startTime?: number; isClosed: boolean; fontSize: number }) => {
  const [isExpanded, setIsExpanded] = useState(!isClosed) // 初始状态
  const [elapsed, setElapsed] = useState<number>(0)
  const lastElapsed = React.useRef<number>(0)

  // 当 isClosed 状态改变时（例如流结束），自动同步折叠状态
  React.useEffect(() => {
    setIsExpanded(!isClosed)
  }, [isClosed])

  // 计时器逻辑
  React.useEffect(() => {
    if (!startTime || isClosed) {
      return
    }

    const timer = setInterval(() => {
      const current = Math.floor((Date.now() - startTime) / 1000)
      setElapsed(current)
      lastElapsed.current = current
    }, 1000)

    return () => clearInterval(timer)
  }, [startTime, isClosed])

  // 格式化时长
  const durationText = isClosed
    ? (lastElapsed.current > 0 ? `Thought for ${lastElapsed.current}s` : 'Thought')
    : `Thinking for ${elapsed}s...`

  return (
    <div className="my-4 group/think">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 text-text-muted/80 hover:text-text-secondary transition-colors select-none"
      >
        <div className={`transition-transform duration-200 ${isExpanded ? 'rotate-0' : '-rotate-90'}`}>
          <ChevronDown className="w-3.5 h-3.5" />
        </div>
        <span className="text-sm font-medium tracking-tight">
          {durationText}
        </span>
      </button>

      {isExpanded && (
        <div className="mt-2 pl-5 border-l border-white/5 space-y-2">
          {content ? (
            <div
              style={{ fontSize: `${fontSize - 1}px` }}
              className="text-text-muted/70 leading-relaxed whitespace-pre-wrap font-sans italic"
            >
              {content}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-text-muted/30 italic text-xs py-1">
              <RefreshCw className="w-3 h-3 animate-spin" />
              <span>Analyzing...</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
})
ThinkingBlock.displayName = 'ThinkingBlock'

// Markdown 渲染组件 - 优化排版
const MarkdownContent = React.memo(({ content, fontSize, isStreaming }: { content: string; fontSize: number; isStreaming?: boolean }) => {
  const cleanedContent = isStreaming ? cleanStreamingContent(content) : content
  const { thinkingBlocks, mainContent } = extractThinkingBlocks(cleanedContent)

  return (
    <>
      {/* 显示思考过程（如果有） */}
      {thinkingBlocks.map((thinking, idx) => (
        <ThinkingBlock
          key={idx}
          content={thinking.content}
          startTime={thinking.startTime}
          isClosed={thinking.isClosed}
          fontSize={fontSize}
        />
      ))}

      {/* 显示主要内容 */}
      {mainContent && (
        <div style={{ fontSize: `${fontSize}px` }} className="text-text-primary/90 leading-8 tracking-wide">
          <ReactMarkdown
            className="prose prose-invert max-w-none"
            components={{
              code({ className, children, node, ...props }) {
                const match = /language-(\w+)/.exec(className || '')
                const codeContent = String(children)
                const isCodeBlock = match || node?.position?.start?.line !== node?.position?.end?.line
                const isInline = !isCodeBlock && !codeContent.includes('\n')

                return isInline ? (
                  <code className="bg-white/10 px-1.5 py-0.5 rounded text-accent-light font-mono text-[0.9em]" {...props}>
                    {children}
                  </code>
                ) : (
                  <CodeBlock language={match?.[1]} fontSize={fontSize}>{children}</CodeBlock>
                )
              },
              p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
              ul: ({ children }) => <ul className="list-disc pl-4 mb-2 space-y-1">{children}</ul>,
              ol: ({ children }) => <ol className="list-decimal pl-4 mb-2 space-y-1">{children}</ol>,
              li: ({ children }) => <li className="">{children}</li>,
              a: ({ href, children }) => (
                <a href={href} target="_blank" className="text-accent hover:underline decoration-accent/50 underline-offset-2">{children}</a>
              ),
              blockquote: ({ children }) => (
                <blockquote className="border-l-2 border-accent/40 pl-4 my-2 text-text-muted italic bg-white/5 py-1 rounded-r">{children}</blockquote>
              ),
              h1: ({ children }) => <h1 className="text-lg font-bold mb-2 mt-4 first:mt-0 text-text-primary">{children}</h1>,
              h2: ({ children }) => <h2 className="text-base font-bold mb-2 mt-3 first:mt-0 text-text-primary">{children}</h2>,
              h3: ({ children }) => <h3 className="text-sm font-semibold mb-1 mt-2 first:mt-0 text-text-primary">{children}</h3>,
            }}
          >
            {mainContent}
          </ReactMarkdown>
        </div>
      )}
    </>
  )
})
MarkdownContent.displayName = 'MarkdownContent'

// 渲染单个 Part
const RenderPart = React.memo(({
  part,
  index,
  pendingToolId,
  onApproveTool,
  onRejectTool,
  onOpenDiff,
  fontSize,
  isStreaming,
}: {
  part: AssistantPart
  index: number
  pendingToolId?: string
  onApproveTool?: () => void
  onRejectTool?: () => void
  onOpenDiff?: (path: string, oldContent: string, newContent: string) => void
  fontSize: number
  isStreaming?: boolean
}) => {
  if (isTextPart(part)) {
    if (!part.content.trim()) return null
    return <MarkdownContent key={`text-${index}`} content={part.content} fontSize={fontSize} isStreaming={isStreaming} />
  }

  if (isToolCallPart(part)) {
    const tc = part.toolCall
    const isFileOp = WRITE_TOOLS.includes(tc.name)
    const isPending = tc.id === pendingToolId

    if (isFileOp) {
      return (
        <div className="my-2">
          <FileChangeCard
            key={`tool-${tc.id}-${index}`}
            toolCall={tc}
            isAwaitingApproval={isPending}
            onApprove={isPending ? onApproveTool : undefined}
            onReject={isPending ? onRejectTool : undefined}
            onOpenInEditor={onOpenDiff}
          />
        </div>
      )
    }

    return (
      <div className="my-2">
        <ToolCallCard
          key={`tool-${tc.id}-${index}`}
          toolCall={tc}
          isAwaitingApproval={isPending}
          onApprove={isPending ? onApproveTool : undefined}
          onReject={isPending ? onRejectTool : undefined}
        />
      </div>
    )
  }

  return null
})

RenderPart.displayName = 'RenderPart'

const ChatMessage = React.memo(({
  message,
  onEdit,
  onRegenerate,
  onRestore,
  onApproveTool,
  onRejectTool,
  onApproveAll,
  onOpenDiff,
  pendingToolId,
  hasCheckpoint,
}: ChatMessageProps) => {
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState('')
  const [copied, setCopied] = useState(false)
  const { editorConfig } = useStore()
  const fontSize = editorConfig.fontSize

  if (!isUserMessage(message) && !isAssistantMessage(message)) {
    return null
  }

  const isUser = isUserMessage(message)
  const textContent = getMessageText(message.content)
  const images = isUser ? getMessageImages(message.content) : []

  const handleStartEdit = () => {
    setEditContent(textContent)
    setIsEditing(true)
  }

  const handleSaveEdit = () => {
    if (onEdit && editContent.trim()) {
      onEdit(message.id, editContent.trim())
    }
    setIsEditing(false)
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(textContent)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className={`w-full py-6 group transition-colors duration-200 border-b border-white/5 last:border-0 animate-fade-in`}>
      <div className="max-w-3xl mx-auto px-4">
        {/* Header Row: Avatar + Name + Time/Actions */}
        <div className="flex items-center gap-3 mb-3 select-none">
          <div className="flex-shrink-0">
            {isUser ? (
              <div className="w-6 h-6 rounded-full bg-surface-active/50 border border-white/10 flex items-center justify-center shadow-sm">
                <User className="w-3.5 h-3.5 text-text-secondary" />
              </div>
            ) : (
              <div className={`w-6 h-6 rounded-full overflow-hidden border border-accent/20 shadow-sm shadow-accent/10 bg-black transition-all duration-500 ${isAssistantMessage(message) && message.isStreaming ? 'ring-2 ring-accent/30 shadow-[0_0_10px_rgba(var(--accent)/0.3)]' : ''}`}>
                <img src={aiAvatar} alt="AI" className="w-full h-full object-cover opacity-90" />
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0 flex items-center gap-2">
            <span className="text-sm font-semibold text-text-primary">
              {isUser ? 'You' : 'Adnify'}
            </span>
            {!isUser && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-accent/10 text-accent border border-accent/20 flex items-center gap-1">
                <Sparkles className="w-2.5 h-2.5" />
                AI
              </span>
            )}
          </div>

          {/* Actions (Visible on Hover) */}
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            {isUser && onEdit && (
              <button onClick={handleStartEdit} className="p-1.5 text-text-muted hover:text-text-primary rounded hover:bg-white/5 transition-colors" title="Edit">
                <Edit2 className="w-3.5 h-3.5" />
              </button>
            )}
            {!isUser && onRegenerate && (
              <button onClick={() => onRegenerate(message.id)} className="p-1.5 text-text-muted hover:text-text-primary rounded hover:bg-white/5 transition-colors" title="Regenerate">
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            )}
            {isUser && hasCheckpoint && onRestore && (
              <button onClick={() => onRestore(message.id)} className="p-1.5 text-text-muted hover:text-amber-400 rounded hover:bg-white/5 transition-colors" title="Restore">
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
            <button onClick={handleCopy} className="p-1.5 text-text-muted hover:text-text-primary rounded hover:bg-white/5 transition-colors" title="Copy">
              {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div >

        {/* Content Row: Full Width */}
        < div className="pl-0" >
          {/* Images */}
          {
            images.length > 0 && (
              <div className="flex flex-wrap gap-3 mb-3">
                {images.map((img, i) => (
                  <div key={i} className="rounded-lg overflow-hidden border border-white/10 shadow-sm max-w-[200px]">
                    <img
                      src={`data:${img.source.media_type};base64,${img.source.data}`}
                      alt="User upload"
                      className="max-w-full h-auto"
                    />
                  </div>
                ))}
              </div>
            )
          }

          {/* Editing */}
          {
            isEditing ? (
              <div className="space-y-3 bg-surface/40 p-3 rounded-xl border border-white/10 backdrop-blur-sm">
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="w-full bg-black/20 border border-white/5 rounded-lg px-3 py-2 text-sm text-text-primary resize-none focus:outline-none focus:border-accent/50 transition-colors"
                  rows={4}
                  autoFocus
                  style={{ fontSize: `${fontSize}px` }}
                />
                <div className="flex items-center gap-2 justify-end">
                  <button
                    onClick={() => setIsEditing(false)}
                    className="px-3 py-1.5 text-xs text-text-muted hover:text-text-primary rounded-md transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveEdit}
                    className="px-3 py-1.5 bg-accent text-white text-xs font-medium rounded-md hover:bg-accent-hover transition-colors shadow-sm shadow-accent/20"
                  >
                    Save & Resend
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-1">
                {/* User message */}
                {isUser && <MarkdownContent content={textContent} fontSize={fontSize} />}

                {/* Assistant message */}
                {isAssistantMessage(message) && message.parts && message.parts.length > 0 && (
                  <>
                    {(() => {
                      // Group consecutive tool calls
                      const groups: Array<
                        | { type: 'part'; part: AssistantPart; index: number }
                        | { type: 'tool_group'; toolCalls: import('../../agent/core/types').ToolCall[]; startIndex: number }
                      > = []

                      let currentToolCalls: import('../../agent/core/types').ToolCall[] = []
                      let startIndex = -1

                      message.parts.forEach((part, index) => {
                        if (isToolCallPart(part)) {
                          if (currentToolCalls.length === 0) startIndex = index
                          currentToolCalls.push(part.toolCall)
                        } else {
                          if (currentToolCalls.length > 0) {
                            groups.push({ type: 'tool_group', toolCalls: currentToolCalls, startIndex })
                            currentToolCalls = []
                          }
                          groups.push({ type: 'part', part, index })
                        }
                      })

                      if (currentToolCalls.length > 0) {
                        groups.push({ type: 'tool_group', toolCalls: currentToolCalls, startIndex })
                      }

                      return groups.map((group) => {
                        if (group.type === 'part') {
                          return (
                            <RenderPart
                              key={`part-${group.index}`}
                              part={group.part}
                              index={group.index}
                              pendingToolId={pendingToolId}
                              onApproveTool={onApproveTool}
                              onRejectTool={onRejectTool}
                              onOpenDiff={onOpenDiff}
                              fontSize={fontSize}
                              isStreaming={message.isStreaming}
                            />
                          )
                        } else {
                          // If only 1 tool call, render individually
                          if (group.toolCalls.length === 1) {
                            return (
                              <RenderPart
                                key={`part-${group.startIndex}`}
                                part={message.parts![group.startIndex]}
                                index={group.startIndex}
                                pendingToolId={pendingToolId}
                                onApproveTool={onApproveTool}
                                onRejectTool={onRejectTool}
                                onOpenDiff={onOpenDiff}
                                fontSize={fontSize}
                                isStreaming={message.isStreaming}
                              />
                            )
                          }

                          return (
                            <ToolCallGroup
                              key={`group-${group.startIndex}`}
                              toolCalls={group.toolCalls}
                              pendingToolId={pendingToolId}
                              onApproveTool={onApproveTool}
                              onRejectTool={onRejectTool}
                              onApproveAll={onApproveAll}
                              onOpenDiff={onOpenDiff}
                            />
                          )
                        }
                      })
                    })()}
                  </>
                )}

                {/* Legacy compatibility */}
                {isAssistantMessage(message) && (!message.parts || message.parts.length === 0) && (
                  <>
                    {textContent && <MarkdownContent content={textContent} fontSize={fontSize} />}
                    {message.toolCalls && message.toolCalls.length > 0 && (
                      <div className="mt-3">
                        {/* 如果有多个工具调用，使用分组显示 */}
                        {message.toolCalls.length > 1 ? (
                          <ToolCallGroup
                            toolCalls={message.toolCalls}
                            pendingToolId={pendingToolId}
                            onApproveTool={onApproveTool}
                            onRejectTool={onRejectTool}
                            onOpenDiff={onOpenDiff}
                          />
                        ) : (
                          // 单个工具调用直接显示
                          message.toolCalls.map((tc, index) => {
                            const isFileOp = WRITE_TOOLS.includes(tc.name)
                            const isPending = tc.id === pendingToolId

                            if (isFileOp) {
                              return (
                                <FileChangeCard
                                  key={`tool-${tc.id}-${index}`}
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
                                key={`tool-${tc.id}-${index}`}
                                toolCall={tc}
                                isAwaitingApproval={isPending}
                                onApprove={isPending ? onApproveTool : undefined}
                                onReject={isPending ? onRejectTool : undefined}
                              />
                            )
                          })
                        )}
                      </div>
                    )}
                  </>
                )}

                {/* Streaming cursor */}
                {isAssistantMessage(message) && message.isStreaming && (
                  <span className="inline-block w-2 h-4 bg-accent/80 ml-0.5 animate-pulse align-sub rounded-[1px] shadow-[0_0_5px_rgba(var(--accent)/0.5)]" />
                )}
              </div>
            )
          }
        </div >
      </div >
    </div >
  )
})

ChatMessage.displayName = 'ChatMessage'

export default ChatMessage
