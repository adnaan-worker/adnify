/**
 * 终端管理服务
 * 
 * 职责：
 * - 管理用户交互式终端的生命周期（创建、销毁）
 * - 管理 xterm 实例和 PTY 进程
 * - 提供统一 API 给 UI 层
 * 
 * 注意：Agent 命令执行使用 shell:executeBackground，不经过此服务
 */

import { Terminal as XTerminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { WebglAddon } from '@xterm/addon-webgl'
import { getEditorConfig } from '@renderer/config/editorConfig'

// ===== 类型定义 =====

export interface TerminalInstance {
  id: string
  name: string
  cwd: string
  shell: string
  createdAt: number
}

export interface TerminalManagerState {
  terminals: TerminalInstance[]
  activeId: string | null
}

interface XTermInstance {
  terminal: XTerminal
  fitAddon: FitAddon
  container: HTMLDivElement | null
}

type StateListener = (state: TerminalManagerState) => void

// ===== 终端管理器 =====

class TerminalManagerClass {
  private state: TerminalManagerState = {
    terminals: [],
    activeId: null,
  }

  // xterm 实例管理
  private xtermInstances = new Map<string, XTermInstance>()
  private outputBuffers = new Map<string, string[]>()
  
  // PTY 状态
  private ptyReady = new Map<string, boolean>()
  private pendingPtyCreation = new Map<string, Promise<boolean>>()

  // 监听器
  private stateListeners = new Set<StateListener>()
  
  // 主题配置
  private currentTheme: Record<string, string> = {}

  // IPC 监听器清理函数
  private ipcCleanup: (() => void) | null = null

  constructor() {
    this.setupIpcListeners()
  }

  private setupIpcListeners() {
    this.ipcCleanup = window.electronAPI.onTerminalData(({ id, data }) => {
      const xterm = this.xtermInstances.get(id)
      if (xterm?.terminal) {
        xterm.terminal.write(data)
      }
      
      // 缓存输出
      if (!this.outputBuffers.has(id)) {
        this.outputBuffers.set(id, [])
      }
      const buffer = this.outputBuffers.get(id)!
      buffer.push(data)
      if (buffer.length > 1000) buffer.shift()
    })
  }

  // ===== 状态订阅 =====

  subscribe(listener: StateListener): () => void {
    this.stateListeners.add(listener)
    listener(this.getState())
    return () => this.stateListeners.delete(listener)
  }

  private notify() {
    const state = this.getState()
    this.stateListeners.forEach(listener => listener(state))
  }

  getState(): TerminalManagerState {
    return {
      terminals: [...this.state.terminals],
      activeId: this.state.activeId,
    }
  }

  // ===== 主题管理 =====

  setTheme(theme: Record<string, string>) {
    this.currentTheme = theme
    this.xtermInstances.forEach(({ terminal }) => {
      terminal.options.theme = theme
    })
  }

  // ===== 终端生命周期 =====

  async createTerminal(options: {
    name?: string
    cwd: string
    shell?: string
  }): Promise<string> {
    const id = crypto.randomUUID()
    
    const instance: TerminalInstance = {
      id,
      name: options.name || 'Terminal',
      cwd: options.cwd,
      shell: options.shell || '',
      createdAt: Date.now(),
    }

    this.state.terminals.push(instance)
    this.state.activeId = id
    this.notify()

    // 创建 PTY
    const ptyPromise = this.createPty(id, options.cwd, options.shell)
    this.pendingPtyCreation.set(id, ptyPromise)

    try {
      await ptyPromise
      this.ptyReady.set(id, true)
    } catch {
      this.ptyReady.set(id, false)
    } finally {
      this.pendingPtyCreation.delete(id)
    }

    return id
  }

  private async createPty(id: string, cwd: string, shell?: string): Promise<boolean> {
    try {
      const result = await window.electronAPI.createTerminal({ id, cwd, shell })
      return !!result
    } catch {
      return false
    }
  }

  mountTerminal(id: string, container: HTMLDivElement): boolean {
    if (this.xtermInstances.has(id)) {
      const existing = this.xtermInstances.get(id)!
      if (existing.container !== container) {
        existing.terminal.open(container)
        existing.container = container
        try { existing.fitAddon.fit() } catch {}
      }
      return true
    }

    const termConfig = getEditorConfig().terminal
    const terminal = new XTerminal({
      cursorBlink: termConfig.cursorBlink,
      fontFamily: termConfig.fontFamily,
      fontSize: termConfig.fontSize,
      lineHeight: termConfig.lineHeight,
      scrollback: termConfig.scrollback,
      allowProposedApi: true,
      theme: this.currentTheme,
    })

    const fitAddon = new FitAddon()
    terminal.loadAddon(fitAddon)
    terminal.loadAddon(new WebLinksAddon())
    terminal.open(container)

    try {
      const webglAddon = new WebglAddon()
      terminal.loadAddon(webglAddon)
      webglAddon.onContextLoss(() => webglAddon.dispose())
    } catch {}

    terminal.onData(data => {
      window.electronAPI.writeTerminal(id, data)
    })

    this.xtermInstances.set(id, { terminal, fitAddon, container })

    try { fitAddon.fit() } catch {}

    const dims = fitAddon.proposeDimensions()
    if (dims && dims.cols > 0 && dims.rows > 0) {
      window.electronAPI.resizeTerminal(id, dims.cols, dims.rows)
    }

    return true
  }

  fitTerminal(id: string) {
    const instance = this.xtermInstances.get(id)
    if (!instance) return

    try {
      instance.fitAddon.fit()
      const dims = instance.fitAddon.proposeDimensions()
      if (dims && dims.cols > 0 && dims.rows > 0) {
        window.electronAPI.resizeTerminal(id, dims.cols, dims.rows)
      }
    } catch {}
  }

  closeTerminal(id: string) {
    const xterm = this.xtermInstances.get(id)
    if (xterm) {
      xterm.terminal.dispose()
      this.xtermInstances.delete(id)
    }

    this.outputBuffers.delete(id)
    this.ptyReady.delete(id)
    window.electronAPI.killTerminal(id)

    const index = this.state.terminals.findIndex(t => t.id === id)
    if (index !== -1) {
      this.state.terminals.splice(index, 1)
    }

    if (this.state.activeId === id) {
      this.state.activeId = this.state.terminals[0]?.id || null
    }

    this.notify()
  }

  setActiveTerminal(id: string | null) {
    if (this.state.activeId !== id) {
      this.state.activeId = id
      this.notify()
    }
  }

  // ===== 工具方法 =====

  writeToTerminal(id: string, data: string) {
    window.electronAPI.writeTerminal(id, data)
  }

  getOutputBuffer(id: string): string[] {
    return this.outputBuffers.get(id) || []
  }

  getXterm(id: string): XTerminal | null {
    return this.xtermInstances.get(id)?.terminal || null
  }

  focusTerminal(id: string) {
    const xterm = this.xtermInstances.get(id)
    if (xterm) {
      xterm.terminal.focus()
    }
  }

  cleanup() {
    if (this.ipcCleanup) {
      this.ipcCleanup()
      this.ipcCleanup = null
    }

    for (const terminal of this.state.terminals) {
      this.closeTerminal(terminal.id)
    }

    this.state = {
      terminals: [],
      activeId: null,
    }
    this.notify()
  }
}

export const terminalManager = new TerminalManagerClass()
