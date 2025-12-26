/**
 * 聊天输入组件
 * 新设计：悬浮式 Pill Bar 设计，更加现代和简洁
 */
import { useRef, useCallback, useMemo, useState } from 'react'
import {
  Sparkles,
  FileText,
  X,
  Code,
  GitBranch,
  Terminal,
  Database,
  Paperclip,
  ArrowUp,
  ClipboardList,
  Plus,
  Folder,
  Globe
} from 'lucide-react'
import { useStore } from '@store'
import { WorkMode } from '@/renderer/modes/types'
import { t } from '@renderer/i18n'
import { Button } from '../ui'

import { ContextItem, FileContext } from '@/renderer/agent/core/types'

export interface PendingImage {
  id: string
  file: File
  previewUrl: string
  base64?: string
}

interface ChatInputProps {
  input: string
  setInput: (value: string) => void
  images: PendingImage[]
  setImages: React.Dispatch<React.SetStateAction<PendingImage[]>>
  isStreaming: boolean
  hasApiKey: boolean
  hasPendingToolCall: boolean
  chatMode: WorkMode
  setChatMode: (mode: WorkMode) => void
  onSubmit: () => void
  onAbort: () => void
  onInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void
  onKeyDown: (e: React.KeyboardEvent) => void
  onPaste: (e: React.ClipboardEvent) => void
  textareaRef: React.RefObject<HTMLTextAreaElement>
  inputContainerRef: React.RefObject<HTMLDivElement>
  contextItems: ContextItem[]
  onRemoveContextItem: (item: ContextItem) => void
  activeFilePath?: string | null
  onAddFile?: (filePath: string) => void
}

export default function ChatInput({
  input,
  images,
  setImages,
  isStreaming,
  hasApiKey,
  hasPendingToolCall,
  chatMode,
  setChatMode,
  onSubmit,
  onAbort,
  onInputChange,
  onKeyDown,
  onPaste,
  textareaRef,
  inputContainerRef,
  contextItems,
  onRemoveContextItem,
  activeFilePath,
  onAddFile,
}: ChatInputProps) {
  const { language, editorConfig } = useStore()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isFocused, setIsFocused] = useState(false)

  // 文件引用检测
  const fileRefs = useMemo(() => {
    const refs: string[] = []
    const regex = /@(?:file:)?([^\s@]+\.[a-zA-Z0-9]+)/g
    let match
    while ((match = regex.exec(input)) !== null) {
      if (match[1] !== 'codebase') {
        refs.push(match[1])
      }
    }
    return refs
  }, [input])

  // 特殊上下文引用检测
  const hasCodebaseRef = useMemo(() => /@codebase\b/i.test(input), [input])
  const hasSymbolsRef = useMemo(() => /@symbols\b/i.test(input), [input])
  const hasGitRef = useMemo(() => /@git\b/i.test(input), [input])
  const hasTerminalRef = useMemo(() => /@terminal\b/i.test(input), [input])
  const hasWebRef = useMemo(() => /@web\b/i.test(input), [input])

  // 添加图片
  const addImage = useCallback(async (file: File) => {
    const id = crypto.randomUUID()
    const previewUrl = URL.createObjectURL(file)

    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      const base64 = result.split(',')[1]
      setImages((prev) => prev.map((img) => (img.id === id ? { ...img, base64 } : img)))
    }
    reader.readAsDataURL(file)

    setImages((prev) => [...prev, { id, file, previewUrl }])
  }, [setImages])

  // 移除图片
  const removeImage = useCallback(
    (id: string) => {
      setImages((prev) => prev.filter((img) => img.id !== id))
    },
    [setImages]
  )

  return (
    <div ref={inputContainerRef} className="p-4 z-20 bg-transparent">
      <div
        className={`
            relative group rounded-[24px] border transition-all duration-300 ease-out
            ${isStreaming
            ? 'border-accent/30 bg-accent/5 shadow-[0_0_20px_rgba(var(--color-accent),0.1)]'
            : isFocused
              ? 'border-accent/40 bg-background shadow-2xl shadow-accent/5 ring-1 ring-accent/10'
              : 'border-white/10 bg-background/80 backdrop-blur-xl hover:border-white/20 shadow-xl'
          }
        `}
      >
        {/* Image Previews */}
        {images.length > 0 && (
          <div className="flex gap-2 px-4 pt-3 pb-0 overflow-x-auto custom-scrollbar">
            {images.map((img) => (
              <div
                key={img.id}
                className="relative group/img flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden border border-border-subtle shadow-sm"
              >
                <img src={img.previewUrl} alt="preview" className="w-full h-full object-cover" />
                <button
                  onClick={() => removeImage(img.id)}
                  className="absolute top-0.5 right-0.5 p-0.5 bg-black/50 backdrop-blur rounded-full text-white hover:bg-red-500 transition-colors opacity-0 group-hover/img:opacity-100"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Context Chips */}
        {(contextItems.length > 0 || fileRefs.length > 0 || hasCodebaseRef || hasSymbolsRef || hasGitRef || hasTerminalRef || (activeFilePath && onAddFile)) && (
          <div className="flex flex-wrap gap-1.5 px-4 pt-3 pb-0.5">
            {/* Active File Suggestion */}
            {activeFilePath && onAddFile && !contextItems.some(item => item.type === 'File' && (item as FileContext).uri === activeFilePath) && (
              <button
                onClick={() => onAddFile(activeFilePath)}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-accent/10 text-accent text-[10px] font-medium rounded-full border border-accent/20 animate-fade-in select-none hover:bg-accent/20 transition-colors"
              >
                <Plus className="w-2.5 h-2.5" />
                <span>{activeFilePath.split(/[\\/]/).pop()}</span>
              </button>
            )}
            {/* Context Items - 只显示文件/文件夹/代码选择（拖放添加的） */}
            {contextItems.filter(item => ['File', 'Folder', 'CodeSelection'].includes(item.type)).map((item, i) => {
              const getContextStyle = (type: string) => {
                switch (type) {
                  case 'File': return { bg: 'bg-white/5', text: 'text-text-secondary', border: 'border-white/10', Icon: FileText }
                  case 'CodeSelection': return { bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/20', Icon: Code }
                  case 'Folder': return { bg: 'bg-yellow-500/10', text: 'text-yellow-400', border: 'border-yellow-500/20', Icon: Folder }
                  default: return { bg: 'bg-white/5', text: 'text-text-muted', border: 'border-white/10', Icon: FileText }
                }
              }

              const getLabel = () => {
                switch (item.type) {
                  case 'File':
                  case 'Folder': {
                    const uri = (item as any).uri || ''
                    return uri.split(/[\\/]/).pop() || uri
                  }
                  case 'CodeSelection': {
                    const uri = (item as any).uri || ''
                    const range = (item as any).range as [number, number] | undefined
                    const name = uri.split(/[\\/]/).pop() || uri
                    return range ? `${name}:${range[0]}-${range[1]}` : name
                  }
                  default: return 'Context'
                }
              }

              const style = getContextStyle(item.type)
              const label = getLabel()
              const uri = (item as any).uri || ''

              return (
                <span
                  key={`ctx-${i}`}
                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 ${style.bg} ${style.text} text-[10px] font-medium rounded-full border ${style.border} animate-fade-in select-none group/chip`}
                  title={uri || item.type}
                >
                  <style.Icon className="w-2.5 h-2.5" />
                  <span className="max-w-[100px] truncate">{label}</span>
                  <button
                    onClick={() => onRemoveContextItem(item)}
                    className="ml-0.5 p-0.5 rounded-full hover:bg-white/10 text-current hover:text-status-error opacity-0 group-hover/chip:opacity-100 transition-opacity"
                  >
                    <X className="w-2 h-2" />
                  </button>
                </span>
              )
            })}

            {/* @xxx 引用 - 跟随输入文本，删除文本则消失 */}
            {hasCodebaseRef && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-green-500/10 text-green-400 text-[10px] font-medium rounded-full border border-green-500/20 animate-fade-in select-none">
                <Database className="w-2.5 h-2.5" />
                @codebase
              </span>
            )}
            {hasSymbolsRef && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-pink-500/10 text-pink-400 text-[10px] font-medium rounded-full border border-pink-500/20 animate-fade-in select-none">
                <Code className="w-2.5 h-2.5" />
                @symbols
              </span>
            )}
            {hasGitRef && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-orange-500/10 text-orange-400 text-[10px] font-medium rounded-full border border-orange-500/20 animate-fade-in select-none">
                <GitBranch className="w-2.5 h-2.5" />
                @git
              </span>
            )}
            {hasTerminalRef && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-cyan-500/10 text-cyan-400 text-[10px] font-medium rounded-full border border-cyan-500/20 animate-fade-in select-none">
                <Terminal className="w-2.5 h-2.5" />
                @terminal
              </span>
            )}
            {hasWebRef && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-blue-500/10 text-blue-400 text-[10px] font-medium rounded-full border border-blue-500/20 animate-fade-in select-none">
                <Globe className="w-2.5 h-2.5" />
                @web
              </span>
            )}
          </div>
        )}

        <div className="flex items-end gap-2 pl-4 pr-2 py-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={onInputChange}
            onKeyDown={onKeyDown}
            onPaste={onPaste}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder={hasApiKey ? t('pasteImagesHint', language) : t('configureApiKey', language)}
            disabled={!hasApiKey || hasPendingToolCall}
            className="flex-1 bg-transparent border-none p-0 py-2
                       text-sm text-text-primary placeholder-text-muted/60 resize-none
                       focus:ring-0 focus:outline-none leading-relaxed custom-scrollbar max-h-[200px] caret-accent"
            rows={1}
            style={{ minHeight: '40px', fontSize: `${editorConfig.fontSize}px` }}
          />

          <div className="flex items-center gap-1 pb-1">
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept="image/*"
              multiple
              onChange={(e) => {
                if (e.target.files) {
                  Array.from(e.target.files).forEach(addImage)
                }
                e.target.value = ''
              }}
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => fileInputRef.current?.click()}
              title={t('uploadImage', language)}
              className="rounded-full w-8 h-8 hover:bg-white/10 text-text-muted hover:text-text-primary transition-colors"
            >
              <Paperclip className="w-4 h-4" />
            </Button>

            <button
              onClick={isStreaming ? onAbort : onSubmit}
              disabled={
                !hasApiKey || ((!input.trim() && images.length === 0) && !isStreaming) || hasPendingToolCall
              }
              className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 ml-1
                  ${isStreaming
                  ? 'bg-transparent border border-status-error text-status-error hover:bg-status-error/10'
                  : input.trim() || images.length > 0
                    ? 'bg-accent text-white shadow-lg shadow-accent/20 hover:scale-105 hover:bg-accent-hover'
                    : 'bg-white/5 text-text-muted/30 cursor-not-allowed'
                }
                  `}
            >
              {isStreaming ? (
                <div className="w-2.5 h-2.5 bg-current rounded-[1px]" />
              ) : (
                <ArrowUp className="w-4 h-4 stroke-[3]" />
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between px-2">
        <div className="flex items-center gap-1">
          <ModeButton
            active={chatMode === 'chat'}
            onClick={() => setChatMode('chat')}
          >
            CHAT
          </ModeButton>
          <ModeButton
            active={chatMode === 'agent'}
            onClick={() => setChatMode('agent')}
            accent
          >
            <Sparkles className="w-3 h-3" />
            AGENT
          </ModeButton>
          <ModeButton
            active={chatMode === 'plan'}
            onClick={() => setChatMode('plan')}
            accent
          >
            <ClipboardList className="w-3 h-3" />
            PLAN
          </ModeButton>
        </div>
        <span className="text-[10px] text-text-muted opacity-40 font-mono">
          {t('returnToSend', language)}
        </span>
      </div>
    </div>
  )
}

// 模式按钮组件
function ModeButton({
  active,
  onClick,
  accent,
  children
}: {
  active: boolean
  onClick: () => void
  accent?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`h-6 px-3 gap-1.5 text-[10px] font-bold transition-all duration-200 rounded-full flex items-center
        ${active
          ? accent
            ? 'bg-accent/10 text-accent shadow-sm shadow-accent/5 ring-1 ring-accent/20'
            : 'bg-white/10 text-text-primary shadow-sm ring-1 ring-white/10'
          : 'text-text-muted hover:text-text-secondary hover:bg-white/5'
        }`}
    >
      {children}
    </button>
  )
}
