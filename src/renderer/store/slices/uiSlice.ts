/**
 * UI 相关状态切片
 */
import { StateCreator } from 'zustand'
import { GitStatus } from '@renderer/agent/services/gitService'

export type SidePanel = 'explorer' | 'search' | 'git' | 'problems' | 'outline' | 'history' | 'extensions' | null

export interface DiffView {
  original: string
  modified: string
  filePath: string
}

export interface UISlice {
  isInitialized: boolean
  activeSidePanel: SidePanel
  terminalVisible: boolean
  debugVisible: boolean
  chatVisible: boolean
  showSettings: boolean
  showCommandPalette: boolean
  showComposer: boolean
  showQuickOpen: boolean
  showAbout: boolean
  activeDiff: DiffView | null
  sidebarWidth: number
  chatWidth: number
  terminalLayout: 'tabs' | 'split'
  cursorPosition: { line: number; column: number }
  toast: ((message: string, type?: 'success' | 'error' | 'info' | 'warning') => void) | null
  selectedCode: string // 编辑器当前选中的代码
  gitStatus: GitStatus | null
  isGitRepo: boolean

  setIsInitialized: (initialized: boolean) => void
  setActiveSidePanel: (panel: SidePanel) => void
  setTerminalVisible: (visible: boolean) => void
  setDebugVisible: (visible: boolean) => void
  setChatVisible: (visible: boolean) => void
  setShowSettings: (show: boolean) => void
  setShowCommandPalette: (show: boolean) => void
  setShowComposer: (show: boolean) => void
  setShowQuickOpen: (show: boolean) => void
  setShowAbout: (show: boolean) => void
  setActiveDiff: (diff: DiffView | null) => void
  setSidebarWidth: (width: number) => void
  setChatWidth: (width: number) => void
  setTerminalLayout: (layout: 'tabs' | 'split') => void
  setCursorPosition: (pos: { line: number; column: number }) => void
  isLspReady: boolean
  setIsLspReady: (ready: boolean) => void
  setToast: (toast: ((message: string, type?: 'success' | 'error' | 'info' | 'warning') => void) | null) => void
  setSelectedCode: (code: string) => void
  setGitStatus: (status: GitStatus | null) => void
  setIsGitRepo: (isRepo: boolean) => void
}

export const createUISlice: StateCreator<UISlice, [], [], UISlice> = (set) => ({
  isInitialized: false,
  isLspReady: false,
  activeSidePanel: 'explorer',
  terminalVisible: false,
  debugVisible: false,
  chatVisible: true,
  showSettings: false,
  showCommandPalette: false,
  showComposer: false,
  showQuickOpen: false,
  showAbout: false,
  activeDiff: null,
  sidebarWidth: 260,
  chatWidth: 450,
  terminalLayout: 'tabs',
  cursorPosition: { line: 1, column: 1 },
  toast: null,
  selectedCode: '',
  gitStatus: null,
  isGitRepo: false,

  setIsInitialized: (initialized) => set({ isInitialized: initialized }),
  setIsLspReady: (ready) => set({ isLspReady: ready }),
  setActiveSidePanel: (panel) => set({ activeSidePanel: panel }),
  setTerminalVisible: (visible) => set({ terminalVisible: visible }),
  setDebugVisible: (visible) => set({ debugVisible: visible }),
  setChatVisible: (visible) => set({ chatVisible: visible }),
  setShowSettings: (show) => set({ showSettings: show }),
  setShowCommandPalette: (show) => set({ showCommandPalette: show }),
  setShowComposer: (show) => set({ showComposer: show }),
  setShowQuickOpen: (show) => set({ showQuickOpen: show }),
  setShowAbout: (show) => set({ showAbout: show }),
  setActiveDiff: (diff) => set({ activeDiff: diff }),
  setSidebarWidth: (width) => set({ sidebarWidth: width }),
  setChatWidth: (width) => set({ chatWidth: width }),
  setTerminalLayout: (layout) => set({ terminalLayout: layout }),
  setCursorPosition: (pos) => set({ cursorPosition: pos }),
  setToast: (toast) => set({ toast }),
  setSelectedCode: (code) => set({ selectedCode: code }),
  setGitStatus: (status) => set({ gitStatus: status }),
  setIsGitRepo: (isRepo) => set({ isGitRepo: isRepo }),
})
