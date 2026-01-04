/**
 * 调试面板组件
 * 类似 VSCode 的调试体验
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Play, Square, SkipForward, ArrowDownToLine, ArrowUpFromLine, Pause,
  X, ChevronUp, ChevronDown, ChevronRight, Bug, CircleDot,
  Variable, Layers, RefreshCw, Trash2, Circle, FileCode
} from 'lucide-react'
import { useStore } from '@store'
import { Button } from '../ui'
import { toast } from '@components/common/ToastProvider'
import type { DebugConfig, DebugEvent } from '@renderer/types/electron'

type DebugTab = 'variables' | 'callstack' | 'breakpoints' | 'console'

interface LaunchConfig extends DebugConfig {
  // launch.json 配置扩展
}

export default function DebugPanel() {
  const {
    debugVisible, setDebugVisible, workspacePath, language, activeFilePath,
    // Debug store
    breakpoints, sessions, activeSessionId, stackFrames, scopes, variables, consoleOutput,
    setSessions, setActiveSessionId, setStackFrames, setScopes, setVariables,
    addConsoleOutput, clearConsoleOutput, toggleBreakpoint, clearBreakpoints, toggleBreakpointEnabled
  } = useStore()

  // 面板状态
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [height, setHeight] = useState(280)
  const [isResizing, setIsResizing] = useState(false)
  const [activeTab, setActiveTab] = useState<DebugTab>('variables')
  const [expandedScopes, setExpandedScopes] = useState<Set<number>>(new Set())

  // 启动配置
  const [launchConfigs, setLaunchConfigs] = useState<LaunchConfig[]>([])
  const [selectedConfigIndex, setSelectedConfigIndex] = useState(0)

  const consoleRef = useRef<HTMLDivElement>(null)

  // 打开 launch.json 配置文件
  const openLaunchConfig = useCallback(async () => {
    if (!workspacePath) return
    
    const launchPath = `${workspacePath}/.adnify/launch.json`
    
    // 检查文件是否存在，不存在则创建默认配置
    let content = await window.electronAPI.readFile(launchPath)
    if (!content) {
      await window.electronAPI.ensureDir(`${workspacePath}/.adnify`)
      const defaultConfig = {
        version: '0.2.0',
        configurations: [
          {
            type: 'node',
            name: 'Launch Current File',
            request: 'launch',
            program: '${file}',
            cwd: '${workspaceFolder}'
          },
          {
            type: 'node',
            name: 'Launch Program',
            request: 'launch',
            program: '${workspaceFolder}/src/index.js',
            cwd: '${workspaceFolder}'
          }
        ]
      }
      content = JSON.stringify(defaultConfig, null, 2)
      await window.electronAPI.writeFile(launchPath, content)
    }
    
    // 打开文件
    useStore.getState().openFile(launchPath, content)
    useStore.getState().setActiveFile(launchPath)
  }, [workspacePath])

  // 加载 launch.json 配置（从 .adnify/launch.json）
  const loadLaunchConfigs = useCallback(async () => {
    if (!workspacePath) return
    
    try {
      const launchPath = `${workspacePath}/.adnify/launch.json`
      const content = await window.electronAPI.readFile(launchPath)
      if (content) {
        // 移除注释后解析
        const cleaned = content.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')
        const parsed = JSON.parse(cleaned)
        if (parsed.configurations && Array.isArray(parsed.configurations)) {
          setLaunchConfigs(parsed.configurations)
          return
        }
      }
    } catch {
      // 忽略读取错误
    }
    
    // 没有配置文件，使用默认配置
    setLaunchConfigs([{
      type: 'node',
      name: 'Launch Current File',
      request: 'launch',
      program: '${file}',
    }])
  }, [workspacePath])

  // 加载会话
  const loadSessions = useCallback(async () => {
    const result = await window.electronAPI.debugGetAllSessions()
    setSessions(result)
  }, [setSessions])

  useEffect(() => {
    if (debugVisible) {
      loadSessions()
      loadLaunchConfigs()
    }
  }, [debugVisible, loadSessions, loadLaunchConfigs])

  // 加载作用域
  const loadScopes = useCallback(async (sessionId: string, frameId: number) => {
    const result = await window.electronAPI.debugGetScopes(sessionId, frameId)
    if (result.success && result.scopes) {
      setScopes(result.scopes)
    }
  }, [setScopes])

  // 加载堆栈
  const loadStackTrace = useCallback(async (sessionId: string, threadId: number) => {
    const result = await window.electronAPI.debugGetStackTrace(sessionId, threadId)
    if (result.success && result.frames) {
      setStackFrames(result.frames)
      if (result.frames.length > 0) {
        loadScopes(sessionId, result.frames[0].id)
      }
    }
  }, [setStackFrames, loadScopes])

  const handleDebugEvent = useCallback((sessionId: string, event: DebugEvent) => {
    switch (event.type) {
      case 'stopped':
        loadStackTrace(sessionId, event.threadId || 0)
        addConsoleOutput(`⏸ Stopped: ${event.reason}`)
        break
      case 'continued':
        setStackFrames([])
        setScopes([])
        addConsoleOutput('▶ Continued')
        break
      case 'exited':
        addConsoleOutput(`✓ Process exited with code ${event.exitCode}`)
        loadSessions()
        break
      case 'terminated':
        addConsoleOutput('⏹ Debug session terminated')
        loadSessions()
        break
      case 'output':
        addConsoleOutput(`[${event.category}] ${event.output}`)
        break
      case 'error':
        addConsoleOutput(`❌ Error: ${event.message}`)
        toast.error('Debug Error', event.message)
        break
    }
  }, [loadSessions, addConsoleOutput, setStackFrames, setScopes, loadStackTrace])

  // 监听调试事件
  useEffect(() => {
    const unsubscribe = window.electronAPI.onDebugEvent(({ sessionId, event }) => {
      handleDebugEvent(sessionId, event)
    })
    return unsubscribe
  }, [handleDebugEvent])

  // 监听全局调试快捷键事件
  useEffect(() => {
    const handleDebugStartEvent = async () => {
      // 延迟执行，确保面板已打开
      setTimeout(() => {
        const startBtn = document.querySelector('[data-debug-start]') as HTMLButtonElement
        startBtn?.click()
      }, 100)
    }
    const handleToggleBreakpointEvent = () => {
      // 在当前文件当前行切换断点
      if (activeFilePath) {
        const { cursorPosition } = useStore.getState()
        toggleBreakpoint(activeFilePath, cursorPosition.line)
      }
    }

    window.addEventListener('debug:start', handleDebugStartEvent)
    window.addEventListener('debug:toggleBreakpoint', handleToggleBreakpointEvent)
    return () => {
      window.removeEventListener('debug:start', handleDebugStartEvent)
      window.removeEventListener('debug:toggleBreakpoint', handleToggleBreakpointEvent)
    }
  }, [activeFilePath, toggleBreakpoint])

  // 解析变量（如 ${file}）
  const resolveVariables = (value: string): string => {
    return value
      .replace(/\$\{file\}/g, activeFilePath || '')
      .replace(/\$\{workspaceFolder\}/g, workspacePath || '')
      .replace(/\$\{fileBasename\}/g, activeFilePath?.split(/[\\/]/).pop() || '')
      .replace(/\$\{fileDirname\}/g, activeFilePath?.split(/[\\/]/).slice(0, -1).join('/') || '')
  }

  // 启动调试 (F5)
  const handleStartDebug = async () => {
    const config = launchConfigs[selectedConfigIndex]
    if (!config) {
      toast.warning(tt('请先配置调试选项', 'Please configure debug options first'))
      return
    }

    // 解析变量
    const resolvedConfig: DebugConfig = {
      ...config,
      program: config.program ? resolveVariables(config.program) : undefined,
      cwd: config.cwd ? resolveVariables(config.cwd) : workspacePath || undefined,
    }

    // 检查程序路径
    if (resolvedConfig.request === 'launch' && !resolvedConfig.program) {
      toast.warning(tt('请指定要调试的程序', 'Please specify a program to debug'))
      return
    }

    try {
      // 创建会话
      const createResult = await window.electronAPI.debugCreateSession(resolvedConfig)
      if (!createResult.success || !createResult.sessionId) {
        toast.error('Failed to create session', createResult.error)
        return
      }

      const sessionId = createResult.sessionId
      setActiveSessionId(sessionId)
      addConsoleOutput(`✓ Session created: ${resolvedConfig.name}`)

      // 先同步断点（会被 adapter 缓存）
      await syncBreakpoints(sessionId)

      // 启动（启动后 adapter 会自动应用缓存的断点）
      const launchResult = await window.electronAPI.debugLaunch(sessionId)
      if (launchResult.success) {
        addConsoleOutput('▶ Launching...')
        loadSessions()
      } else {
        toast.error('Failed to launch', launchResult.error)
      }
    } catch (e) {
      toast.error('Debug Error', String(e))
    }
  }

  // 同步断点到调试器
  const syncBreakpoints = async (sessionId: string) => {
    // 按文件分组断点
    const fileBreakpoints = new Map<string, number[]>()
    for (const bp of breakpoints) {
      if (!bp.enabled) continue
      const lines = fileBreakpoints.get(bp.filePath) || []
      lines.push(bp.line)
      fileBreakpoints.set(bp.filePath, lines)
    }

    // 发送到调试器
    for (const [filePath, lines] of fileBreakpoints) {
      await window.electronAPI.debugSetBreakpoints(
        sessionId,
        filePath,
        lines.map(line => ({ line }))
      )
    }
  }

  // 调试控制
  const handleStop = async () => {
    if (!activeSessionId) return
    await window.electronAPI.debugStop(activeSessionId)
    setActiveSessionId(null)
    loadSessions()
  }

  const handleContinue = async () => {
    if (!activeSessionId) return
    await window.electronAPI.debugContinue(activeSessionId)
  }

  const handleStepOver = async () => {
    if (!activeSessionId) return
    await window.electronAPI.debugStepOver(activeSessionId)
  }

  const handleStepInto = async () => {
    if (!activeSessionId) return
    await window.electronAPI.debugStepInto(activeSessionId)
  }

  const handleStepOut = async () => {
    if (!activeSessionId) return
    await window.electronAPI.debugStepOut(activeSessionId)
  }

  const handlePause = async () => {
    if (!activeSessionId) return
    await window.electronAPI.debugPause(activeSessionId)
  }

  // 加载变量
  const loadVariables = async (variablesReference: number) => {
    if (!activeSessionId) return
    const result = await window.electronAPI.debugGetVariables(activeSessionId, variablesReference)
    if (result.success && result.variables) {
      setVariables(variablesReference, result.variables)
    }
  }

  // 切换作用域展开
  const toggleScope = (ref: number) => {
    setExpandedScopes(prev => {
      const next = new Set(prev)
      if (next.has(ref)) {
        next.delete(ref)
      } else {
        next.add(ref)
        loadVariables(ref)
      }
      return next
    })
  }

  // 跳转到断点位置
  const gotoBreakpoint = (filePath: string, line: number) => {
    // 打开文件并跳转
    window.dispatchEvent(new CustomEvent('open-file', { detail: { path: filePath } }))
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('editor:goto-line', { detail: { line, column: 1 } }))
    }, 100)
  }

  // 拖拽调整高度
  const startResizing = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizing(true)
  }, [])

  useEffect(() => {
    if (!isResizing) return
    const handleMouseMove = (e: MouseEvent) => {
      const newHeight = window.innerHeight - e.clientY - 24
      if (newHeight > 100 && newHeight < window.innerHeight - 100) {
        setHeight(newHeight)
      }
    }
    const stopResizing = () => setIsResizing(false)
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', stopResizing)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', stopResizing)
    }
  }, [isResizing])

  // 滚动控制台到底部
  useEffect(() => {
    consoleRef.current?.scrollTo({ top: consoleRef.current.scrollHeight })
  }, [consoleOutput])

  const activeSession = sessions.find(s => s.id === activeSessionId)
  const isPaused = activeSession?.state === 'paused'
  const isIdle = !activeSession || activeSession.state === 'idle' || activeSession.state === 'stopped'

  if (!debugVisible) return null

  const tt = (zh: string, en: string) => language === 'zh' ? zh : en

  return (
    <div className="bg-transparent flex flex-col transition-none relative z-10" style={{ height: isCollapsed ? 40 : height }}>
      {/* 拖拽区域 */}
      <div className="absolute top-0 left-0 right-0 h-1 cursor-row-resize z-50 hover:bg-accent/50 transition-colors" onMouseDown={startResizing} />

      {/* 标题栏 */}
      <div className="h-10 min-h-[40px] flex items-center justify-between border-b border-border-subtle bg-background/40 backdrop-blur-md select-none">
        {/* 左侧：图标和配置选择 */}
        <div className="flex items-center h-full">
          <div className="flex-shrink-0 flex items-center justify-center px-3 cursor-pointer hover:text-text-primary text-text-muted transition-colors h-full" onClick={() => setIsCollapsed(!isCollapsed)}>
            <Bug className="w-3.5 h-3.5" />
          </div>
          
          {/* 配置选择 */}
          <select
            value={selectedConfigIndex}
            onChange={e => setSelectedConfigIndex(Number(e.target.value))}
            className="h-7 text-xs bg-transparent border border-border-subtle rounded px-2 mr-2 min-w-[140px]"
          >
            {launchConfigs.map((config, i) => (
              <option key={i} value={i}>{config.name}</option>
            ))}
          </select>

          <Button variant="ghost" size="icon" onClick={openLaunchConfig} className="h-7 w-7" title={tt('编辑配置', 'Edit Configurations')}>
            <FileCode className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="icon" onClick={loadLaunchConfigs} className="h-7 w-7" title={tt('刷新配置', 'Reload')}>
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
        </div>

        {/* 中间：调试控制 */}
        <div className="flex items-center gap-1">
          {isIdle ? (
            <Button variant="ghost" size="icon" onClick={handleStartDebug} data-debug-start className="h-7 w-7" title="F5 - Start Debugging">
              <Play className="w-4 h-4 text-green-400" />
            </Button>
          ) : (
            <>
              <Button variant="ghost" size="icon" onClick={handleStop} className="h-7 w-7" title={tt('停止', 'Stop')}>
                <Square className="w-4 h-4 text-red-400" />
              </Button>
              {isPaused ? (
                <Button variant="ghost" size="icon" onClick={handleContinue} className="h-7 w-7" title="F5 - Continue">
                  <Play className="w-4 h-4 text-green-400" />
                </Button>
              ) : (
                <Button variant="ghost" size="icon" onClick={handlePause} className="h-7 w-7" title="F6 - Pause">
                  <Pause className="w-4 h-4 text-yellow-400" />
                </Button>
              )}
              <div className="w-px h-4 bg-border-subtle mx-1" />
              <Button variant="ghost" size="icon" onClick={handleStepOver} disabled={!isPaused} className="h-7 w-7" title="F10 - Step Over">
                <SkipForward className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={handleStepInto} disabled={!isPaused} className="h-7 w-7" title="F11 - Step Into">
                <ArrowDownToLine className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={handleStepOut} disabled={!isPaused} className="h-7 w-7" title="Shift+F11 - Step Out">
                <ArrowUpFromLine className="w-4 h-4" />
              </Button>
            </>
          )}
        </div>

        {/* 右侧：操作按钮 */}
        <div className="flex items-center gap-1 px-2">
          <Button variant="ghost" size="icon" onClick={loadSessions} className="h-7 w-7" title={tt('刷新', 'Refresh')}>
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setIsCollapsed(!isCollapsed)} className="h-7 w-7">
            {isCollapsed ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setDebugVisible(false)} className="h-7 w-7" title={tt('关闭', 'Close')}>
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* 内容区域 */}
      <div className={`flex-1 min-h-0 bg-surface/30 backdrop-blur-sm ${isCollapsed ? 'hidden' : 'flex'}`}>
        {/* 标签页 */}
        <div className="w-32 border-r border-border-subtle flex flex-col">
          {(['variables', 'callstack', 'breakpoints', 'console'] as DebugTab[]).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-2 text-xs text-left flex items-center gap-2 transition-colors ${
                activeTab === tab ? 'bg-accent/10 text-accent border-l-2 border-accent' : 'text-text-muted hover:bg-surface-hover'
              }`}
            >
              {tab === 'variables' && <Variable className="w-3.5 h-3.5" />}
              {tab === 'callstack' && <Layers className="w-3.5 h-3.5" />}
              {tab === 'breakpoints' && <CircleDot className="w-3.5 h-3.5" />}
              {tab === 'console' && <Bug className="w-3.5 h-3.5" />}
              {tab === 'variables' && tt('变量', 'Variables')}
              {tab === 'callstack' && tt('调用栈', 'Call Stack')}
              {tab === 'breakpoints' && `${tt('断点', 'Breakpoints')} (${breakpoints.length})`}
              {tab === 'console' && tt('控制台', 'Console')}
            </button>
          ))}
        </div>

        {/* 内容 */}
        <div className="flex-1 overflow-auto p-2">
          {/* Variables */}
          {activeTab === 'variables' && (
            <div className="text-xs">
              {scopes.length === 0 ? (
                <div className="text-text-muted text-center py-4">{tt('暂停时显示变量', 'Variables shown when paused')}</div>
              ) : (
                scopes.map(scope => (
                  <div key={scope.variablesReference}>
                    <div
                      onClick={() => toggleScope(scope.variablesReference)}
                      className="flex items-center gap-2 py-1 px-2 hover:bg-surface-hover cursor-pointer rounded"
                    >
                      {expandedScopes.has(scope.variablesReference) ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                      <span className="font-medium">{scope.name}</span>
                    </div>
                    {expandedScopes.has(scope.variablesReference) && (
                      <div className="pl-4">
                        {(variables.get(scope.variablesReference) || []).map(v => (
                          <div key={v.name} className="flex items-center gap-2 py-0.5 px-2">
                            <span className="text-purple-400">{v.name}</span>
                            <span className="text-text-muted">=</span>
                            <span className="text-green-400 truncate">{v.value}</span>
                            <span className="text-text-muted text-[10px]">({v.type})</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* Call Stack */}
          {activeTab === 'callstack' && (
            <div className="text-xs">
              {stackFrames.length === 0 ? (
                <div className="text-text-muted text-center py-4">{tt('暂停时显示调用栈', 'Call stack shown when paused')}</div>
              ) : (
                stackFrames.map((frame, i) => {
                  // 兼容新旧格式：source 可能是对象或字符串
                  const source = frame.source
                  const filePath = (typeof source === 'object' && source?.path) || frame.file || ''
                  const fileName = filePath.split(/[\\/]/).pop() || filePath
                  return (
                    <div
                      key={frame.id}
                      onClick={() => gotoBreakpoint(filePath, frame.line)}
                      className={`py-1 px-2 rounded cursor-pointer hover:bg-surface-hover ${i === 0 ? 'bg-accent/10' : ''}`}
                    >
                      <div className="font-medium">{frame.name}</div>
                      <div className="text-text-muted">{fileName}:{frame.line}</div>
                    </div>
                  )
                })
              )}
            </div>
          )}

          {/* Breakpoints */}
          {activeTab === 'breakpoints' && (
            <div className="text-xs">
              <div className="flex items-center justify-between px-2 py-1 mb-2">
                <span className="text-text-muted">{tt('点击编辑器行号添加断点', 'Click line numbers to add breakpoints')}</span>
                {breakpoints.length > 0 && (
                  <Button variant="ghost" size="icon" onClick={() => clearBreakpoints()} className="h-6 w-6" title={tt('清除所有断点', 'Clear all breakpoints')}>
                    <Trash2 className="w-3 h-3 text-red-400" />
                  </Button>
                )}
              </div>
              {breakpoints.length === 0 ? (
                <div className="text-text-muted text-center py-4">{tt('暂无断点', 'No breakpoints')}</div>
              ) : (
                // 按文件分组显示
                Object.entries(
                  breakpoints.reduce((acc, bp) => {
                    const file = bp.filePath.split(/[\\/]/).pop() || bp.filePath
                    if (!acc[file]) acc[file] = []
                    acc[file].push(bp)
                    return acc
                  }, {} as Record<string, typeof breakpoints>)
                ).map(([file, bps]) => (
                  <div key={file}>
                    <div className="text-text-muted font-medium py-1 px-2 bg-surface/50">{file}</div>
                    {bps.map(bp => (
                      <div
                        key={bp.id}
                        className="flex items-center gap-2 py-1 px-2 hover:bg-surface-hover group"
                      >
                        <button
                          onClick={() => toggleBreakpointEnabled(bp.id)}
                          className="flex-shrink-0"
                          title={bp.enabled ? tt('禁用断点', 'Disable breakpoint') : tt('启用断点', 'Enable breakpoint')}
                        >
                          {bp.enabled ? (
                            <CircleDot className="w-3 h-3 text-red-400" />
                          ) : (
                            <Circle className="w-3 h-3 text-gray-400" />
                          )}
                        </button>
                        <span
                          onClick={() => gotoBreakpoint(bp.filePath, bp.line)}
                          className={`cursor-pointer hover:text-accent ${!bp.enabled ? 'opacity-50' : ''}`}
                        >
                          {tt('行', 'Line')} {bp.line}
                        </span>
                        {bp.condition && (
                          <span className="text-yellow-400 text-[10px]">({bp.condition})</span>
                        )}
                        <X
                          className="w-3 h-3 ml-auto text-text-muted hover:text-red-400 cursor-pointer opacity-0 group-hover:opacity-100"
                          onClick={() => toggleBreakpoint(bp.filePath, bp.line)}
                        />
                      </div>
                    ))}
                  </div>
                ))
              )}
            </div>
          )}

          {/* Console */}
          {activeTab === 'console' && (
            <div className="h-full flex flex-col">
              <div ref={consoleRef} className="flex-1 text-xs font-mono space-y-0.5 overflow-auto">
                {consoleOutput.length === 0 ? (
                  <div className="text-text-muted text-center py-4">{tt('调试输出将显示在这里', 'Debug output will appear here')}</div>
                ) : (
                  consoleOutput.map((line, i) => (
                    <div key={i} className="text-text-secondary px-2 py-0.5 hover:bg-surface-hover whitespace-pre-wrap">{line}</div>
                  ))
                )}
              </div>
              <div className="flex items-center gap-2 pt-2 border-t border-border-subtle">
                <Button variant="ghost" size="sm" onClick={clearConsoleOutput} className="text-xs">
                  {tt('清除', 'Clear')}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
