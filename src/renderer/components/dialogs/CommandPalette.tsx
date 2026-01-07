/**
 * 命令面板
 * 类似 Cursor/VS Code 的中央控制枢纽
 */

import { api } from '@/renderer/services/electronAPI'
import { useState, useEffect, useCallback, useRef, memo } from 'react'
import {
  Search, FolderOpen, Settings, Terminal,
  MessageSquare, History, Trash2, RefreshCw, Save,
  X, Zap, Keyboard, Sparkles, ArrowRight, Plus, FolderPlus
} from 'lucide-react'
import { useStore, useModeStore } from '@/renderer/store'
import { useAgentStore } from '@/renderer/agent'
import { useAgent } from '@/renderer/hooks/useAgent'
import { t } from '@/renderer/i18n'
import { keybindingService } from '@/renderer/services/keybindingService'
import { adnifyDir } from '@/renderer/services/adnifyDirService'
import { toast } from '@/renderer/components/common/ToastProvider'

interface Command {
  id: string
  label: string
  description?: string
  icon: typeof Search
  category: string
  action: () => void
  shortcut?: string
}

interface CommandPaletteProps {
  onClose: () => void
  onShowKeyboardShortcuts: () => void
}

const CommandItem = memo(function CommandItem({
  command,
  isSelected,
  onSelect,
}: {
  command: Command
  isSelected: boolean
  onSelect: () => void
}) {
  const Icon = command.icon

  return (
    <div
      onClick={onSelect}
      className={`
        flex items-center gap-3 px-3 py-3 mx-2 rounded-lg cursor-pointer transition-all duration-200 group relative overflow-hidden
        ${isSelected
          ? 'bg-accent/10 text-accent-foreground shadow-[inset_2px_0_0_0_rgba(var(--accent))]'
          : 'text-text-secondary hover:bg-white/5 hover:text-text-primary'}
      `}
    >
      {/* Active Glow Background */}
      {isSelected && (
        <div className="absolute inset-0 bg-gradient-to-r from-accent/10 to-transparent opacity-50 pointer-events-none" />
      )}

      <div className={`p-1.5 rounded-md transition-colors relative z-10 ${isSelected ? 'bg-accent/20 text-accent shadow-[0_0_10px_rgba(var(--accent)/0.3)]' : 'bg-surface text-text-muted group-hover:text-text-primary'}`}>
        <Icon className="w-4 h-4" />
      </div>

      <div className="flex-1 min-w-0 flex flex-col justify-center relative z-10">
        <div className={`text-sm font-medium transition-colors ${isSelected ? 'text-text-primary' : ''}`}>{command.label}</div>
        {command.description && (
          <div className={`text-xs truncate transition-opacity ${isSelected ? 'text-text-secondary opacity-90' : 'text-text-muted opacity-60'}`}>{command.description}</div>
        )}
      </div>

      {command.shortcut && (
        <kbd className={`
          px-2 py-0.5 text-[10px] font-mono rounded border relative z-10 transition-colors
          ${isSelected
            ? 'bg-background/50 border-accent/30 text-accent'
            : 'bg-surface border-white/10 text-text-muted'}
        `}>
          {command.shortcut}
        </kbd>
      )}

      {isSelected && <ArrowRight className="w-3 h-3 text-accent animate-pulse ml-2 relative z-10" />}
    </div>
  )
})

export default function CommandPalette({ onClose, onShowKeyboardShortcuts }: CommandPaletteProps) {
  const {
    setShowSettings,
    setTerminalVisible,
    terminalVisible,
    workspacePath,
    activeFilePath,
    language,
    setShowQuickOpen,
    setShowComposer,
    setShowAbout,
  } = useStore()

  // 从 AgentStore 获取 setInputPrompt
  const setInputPrompt = useAgentStore(state => state.setInputPrompt)

  const { setMode } = useModeStore()

  const { clearMessages, clearCheckpoints } = useAgent()

  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // 定义所有命令
  const commands: Command[] = [
    // AI Actions (Priority)
    {
      id: 'ai-chat',
      label: 'Ask AI...',
      description: 'Start a new chat conversation',
      icon: Sparkles,
      category: 'AI',
      action: () => {
        setMode('chat')
        if (query) setInputPrompt(query)
      }
    },
    {
      id: 'ai-explain',
      label: 'Explain Current File',
      description: 'Ask AI to explain the active file',
      icon: MessageSquare,
      category: 'AI Helper',
      action: () => {
        if (activeFilePath) {
          setMode('chat')
          setInputPrompt(`Explain the file ${activeFilePath} in detail.`)
        }
      }
    },
    {
      id: 'ai-refactor',
      label: 'Refactor File',
      description: 'Ask AI to suggest refactoring improvements',
      icon: Zap,
      category: 'AI Helper',
      action: () => {
        if (activeFilePath) {
          setMode('chat')
          setInputPrompt(`Analyze ${activeFilePath} and suggest refactoring improvements for readability and performance.`)
        }
      }
    },
    {
      id: 'ai-fix',
      label: 'Fix Bugs',
      description: 'Ask AI to find and fix bugs in current file',
      icon: Zap,
      category: 'AI Helper',
      action: () => {
        if (activeFilePath) {
          setMode('chat')
          setInputPrompt(`Find potential bugs in ${activeFilePath} and provide fixes.`)
        }
      }
    },

    // File Operations
    {
      id: 'open-folder',
      label: 'Open Folder',
      description: 'Open a workspace folder',
      icon: FolderOpen,
      category: 'File',
      action: () => api.file.openFolder(),
      shortcut: 'Ctrl+O',
    },
    {
      id: 'new-window',
      label: 'New Window',
      description: 'Open a new application window',
      icon: Plus,
      category: 'Window',
      action: () => api.window.new(),
      shortcut: 'Ctrl+Shift+N',
    },
    {
      id: 'add-folder',
      label: 'Add Folder to Workspace...',
      description: 'Add a new root folder to the current workspace',
      icon: FolderPlus,
      category: 'Workspace',
      action: async () => {
        const path = await api.workspace.addFolder()
        if (path) {
          const { addRoot } = useStore.getState()
          addRoot(path)
          // 初始化新根目录的 .adnify
          await adnifyDir.initialize(path)
          toast.success(`Added ${path} to workspace`)
        }
      },
    },
    {
      id: 'save-workspace',
      label: 'Save Workspace As...',
      description: 'Save the current multi-root workspace configuration',
      icon: Save,
      category: 'Workspace',
      action: async () => {
        const { workspace } = useStore.getState()
        if (workspace) {
          const success = await api.workspace.save(workspace.configPath || '', workspace.roots)
          if (success) toast.success('Workspace saved')
        }
      },
    },
    {
      id: 'save-file',
      label: 'Save File',
      description: 'Save the current file',
      icon: Save,
      category: 'File',
      action: () => {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true }))
      },
      shortcut: 'Ctrl+S',
    },
    {
      id: 'refresh-files',
      label: 'Refresh File Explorer',
      description: 'Reload the file tree',
      icon: RefreshCw,
      category: 'File',
      action: async () => {
        if (workspacePath) {
          const files = await api.file.readDir(workspacePath)
          if (files) {
            useStore.getState().setFiles(files)
          }
        }
      },
    },

    // View & Settings
    {
      id: 'quick-open',
      label: 'Go to File...',
      description: 'Search and open files by name',
      icon: Search,
      category: 'File',
      action: () => setShowQuickOpen(true),
      shortcut: 'Ctrl+P',
    },
    {
      id: 'toggle-terminal',
      label: terminalVisible ? 'Hide Terminal' : 'Show Terminal',
      description: 'Toggle the terminal panel',
      icon: Terminal,
      category: 'View',
      action: () => setTerminalVisible(!terminalVisible),
      shortcut: 'Ctrl+`',
    },
    {
      id: 'open-composer',
      label: 'Open Composer',
      description: 'AI-powered multi-file editing',
      icon: Sparkles,
      category: 'AI Tools',
      action: () => setShowComposer(true),
      shortcut: 'Ctrl+Shift+I',
    },
    {
      id: 'settings',
      label: 'Open Settings',
      description: 'Configure API keys and preferences',
      icon: Settings,
      category: 'Preferences',
      action: () => setShowSettings(true),
      shortcut: 'Ctrl+,',
    },
    {
      id: 'keyboard-shortcuts',
      label: 'Keyboard Shortcuts',
      description: 'View all keyboard shortcuts',
      icon: Keyboard,
      category: 'Help',
      action: () => onShowKeyboardShortcuts(),
      shortcut: '?',
    },
    {
      id: 'about',
      label: 'About Adnify',
      description: 'View application information',
      icon: MessageSquare,
      category: 'Help',
      action: () => setShowAbout(true),
    },

    // AI Tools
    {
      id: 'clear-chat',
      label: 'Clear Chat History',
      description: 'Remove all messages from the chat',
      icon: Trash2,
      category: 'AI Tools',
      action: () => clearMessages(),
    },
    {
      id: 'clear-checkpoints',
      label: 'Clear All Checkpoints',
      description: 'Remove all saved checkpoints',
      icon: History,
      category: 'AI Tools',
      action: () => clearCheckpoints(),
    },
  ]

  // 过滤命令
  const filteredCommands = commands.filter(cmd => {
    if (!query) return true
    const searchStr = `${cmd.label} ${cmd.description || ''} ${cmd.category}`.toLowerCase()
    return searchStr.includes(query.toLowerCase())
  })

  // 按类别分组
  const groupedCommands = filteredCommands.reduce((acc, cmd) => {
    if (!acc[cmd.category]) {
      acc[cmd.category] = []
    }
    acc[cmd.category].push(cmd)
    return acc
  }, {} as Record<string, Command[]>)

  // 扁平化用于键盘导航
  const flatCommands = Object.values(groupedCommands).flat()

  // 键盘导航
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (keybindingService.matches(e, 'list.focusDown')) {
      e.preventDefault()
      setSelectedIndex(prev => Math.min(prev + 1, flatCommands.length - 1))
    } else if (keybindingService.matches(e, 'list.focusUp')) {
      e.preventDefault()
      setSelectedIndex(prev => Math.max(prev - 1, 0))
    } else if (keybindingService.matches(e, 'list.select')) {
      e.preventDefault()
      if (flatCommands[selectedIndex]) {
        flatCommands[selectedIndex].action()
        onClose()
      }
    } else if (keybindingService.matches(e, 'list.cancel')) {
      e.preventDefault()
      onClose()
    }
  }, [flatCommands, selectedIndex, onClose])

  // 自动聚焦输入框
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // 重置选中索引
  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  // 滚动到选中项
  useEffect(() => {
    if (listRef.current) {
      const selectedEl = listRef.current.querySelector(`[data-index="${selectedIndex}"]`)
      selectedEl?.scrollIntoView({ block: 'nearest' })
    }
  }, [selectedIndex])

  let commandIndex = 0

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-start justify-center pt-[15vh] z-[9999] animate-fade-in"
      onClick={onClose}
    >
      <div
        className="
            w-[640px] max-h-[60vh] flex flex-col
            bg-background/80 backdrop-blur-2xl 
            border border-border rounded-2xl shadow-2xl shadow-black/50
            overflow-hidden animate-scale-in ring-1 ring-white/5
        "
        onClick={e => e.stopPropagation()}
      >
        {/* Search Input */}
        <div className="flex items-center gap-4 px-6 py-5 border-b border-border bg-white/5 relative">
          <Search className="w-5 h-5 text-accent drop-shadow-[0_0_8px_rgba(var(--accent)/0.5)]" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('typeCommandOrSearch', language)}
            className="flex-1 bg-transparent text-lg text-text-primary placeholder-text-muted/50 focus:outline-none font-medium tracking-wide"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="p-1 rounded-full hover:bg-white/10 transition-colors"
            >
              <X className="w-4 h-4 text-text-muted" />
            </button>
          )}

          {/* Subtle glow line at bottom of header */}
          <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-accent/20 to-transparent" />
        </div>

        {/* Command List */}
        <div ref={listRef} className="flex-1 overflow-y-auto py-3 custom-scrollbar">
          {Object.entries(groupedCommands).map(([category, cmds]) => (
            <div key={category} className="mb-3">
              <div className="px-6 py-2 text-[10px] font-bold uppercase tracking-widest text-text-muted/50 sticky top-0 bg-background/90 backdrop-blur-md z-10 border-b border-white/5 mb-1">
                {category}
              </div>
              <div className="space-y-0.5 px-2">
                {cmds.map((cmd) => {
                  const idx = commandIndex++
                  return (
                    <div key={cmd.id} data-index={idx}>
                      <CommandItem
                        command={cmd}
                        isSelected={idx === selectedIndex}
                        onSelect={() => {
                          cmd.action()
                          onClose()
                        }}
                      />
                    </div>
                  )
                })}
              </div>
            </div>
          ))}

          {flatCommands.length === 0 && (
            <div className="px-4 py-16 text-center text-text-muted flex flex-col items-center gap-4 opacity-60">
              <div className="w-16 h-16 rounded-full bg-surface/50 flex items-center justify-center border border-white/5 shadow-inner">
                <Sparkles className="w-8 h-8 opacity-50 text-accent" />
              </div>
              <p className="text-sm font-medium">{t('noCommandsFound', language)}</p>
            </div>
          )}
        </div>

        {/* Footer Hint */}
        <div className="px-6 py-3 bg-background/40 border-t border-border text-[10px] text-text-muted flex justify-between items-center backdrop-blur-md">
          <div className="flex gap-4">
            <span className="flex items-center gap-1.5"><kbd className="font-mono bg-white/5 border border-white/10 px-1.5 py-0.5 rounded text-text-secondary shadow-sm">↑↓</kbd> to navigate</span>
            <span className="flex items-center gap-1.5"><kbd className="font-mono bg-white/5 border border-white/10 px-1.5 py-0.5 rounded text-text-secondary shadow-sm">Enter</kbd> to select</span>
          </div>
          <div className="flex items-center gap-2 opacity-50">
            <Sparkles className="w-3 h-3 text-accent" />
            <span className="font-medium tracking-wide">Adnify AI</span>
          </div>
        </div>
      </div>
    </div>
  )
}
