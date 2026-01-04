import { logger } from '@utils/Logger'
import { useEffect, useState, useCallback, lazy, Suspense, memo, useRef } from 'react'
import { useStore } from './store'
import TitleBar from './components/layout/TitleBar'
import { Sidebar } from '@components/sidebar'
import { ChatPanel } from './components/agent'
import ActivityBar from './components/layout/ActivityBar'
import StatusBar from './components/layout/StatusBar'
import { ToastProvider, useToast, setGlobalToast } from './components/common/ToastProvider'
import { GlobalConfirmDialog } from './components/common/ConfirmDialog'
import { ErrorBoundary } from './components/common/ErrorBoundary'
import { GlobalErrorHandler } from './components/common/GlobalErrorHandler'
import { initEditorConfig } from './config/editorConfig'
import { themeManager } from './config/themeConfig'
import { restoreWorkspaceState, initWorkspaceStateSync } from './services/workspaceStateService'
import { ThemeManager } from './components/editor/ThemeManager'
import { adnifyDir } from './services/adnifyDirService'
import { checkpointService } from '@renderer/agent/services/checkpointService'
import { useAgentStore, initializeAgentStore } from '@renderer/agent/store/AgentStore'
import { initDiagnosticsListener } from './services/diagnosticsStore'
import { keybindingService } from './services/keybindingService'
import { registerCoreCommands } from './config/commands'
import { LAYOUT_LIMITS } from '@shared/constants'
import { startupMetrics } from '@shared/utils/startupMetrics'
import { useWindowTitle } from './hooks/useWindowTitle'
import { removeFileFromTypeService } from './services/monacoTypeService'
import { mcpService } from './services/mcpService'

// 记录 App 模块加载时间
startupMetrics.mark('app-module-loaded')

// 懒加载大组件以优化首屏性能
const Editor = lazy(() => import('./components/editor/Editor'))
const TerminalPanel = lazy(() => import('./components/panels/TerminalPanel'))
const DebugPanel = lazy(() => import('./components/panels/DebugPanel'))
const ComposerPanel = lazy(() => import('./components/panels/ComposerPanel'))
const OnboardingWizard = lazy(() => import('./components/dialogs/OnboardingWizard'))
const SettingsModal = lazy(() => import('./components/settings/SettingsModal'))
const CommandPalette = lazy(() => import('./components/dialogs/CommandPalette'))
const KeyboardShortcuts = lazy(() => import('./components/dialogs/KeyboardShortcuts'))
const QuickOpen = lazy(() => import('./components/dialogs/QuickOpen'))
const AboutDialog = lazy(() => import('./components/dialogs/AboutDialog'))

  // 暴露 store 给插件系统
  ; (window as any).__ADNIFY_STORE__ = { getState: () => useStore.getState() }

// 编辑器骨架屏（懒加载时显示）
const EditorSkeleton = memo(() => (
  <div className="h-full flex flex-col bg-background">
    {/* Tab bar skeleton */}
    <div className="h-9 border-b border-border-subtle flex items-center px-2 gap-1">
      <div className="h-6 w-24 bg-surface rounded animate-pulse" />
      <div className="h-6 w-20 bg-surface/50 rounded animate-pulse" />
    </div>
    {/* Editor area skeleton */}
    <div className="flex-1 p-4 space-y-2">
      <div className="h-4 w-3/4 bg-surface/30 rounded animate-pulse" />
      <div className="h-4 w-1/2 bg-surface/30 rounded animate-pulse" />
      <div className="h-4 w-2/3 bg-surface/30 rounded animate-pulse" />
      <div className="h-4 w-1/3 bg-surface/30 rounded animate-pulse" />
    </div>
  </div>
))
EditorSkeleton.displayName = 'EditorSkeleton'

// 初始化全局 Toast 的组件
function ToastInitializer() {
  const toastContext = useToast()
  useEffect(() => {
    setGlobalToast(toastContext)
  }, [toastContext])
  return null
}

// 主应用内容
function AppContent() {
  const {
    showSettings, setLLMConfig, setLanguage, setAutoApprove, setPromptTemplateId, setShowSettings,
    setTerminalVisible, terminalVisible, setDebugVisible, debugVisible, setWorkspace, setFiles,
    activeSidePanel, showComposer, setShowComposer,
    sidebarWidth, setSidebarWidth, chatWidth, setChatWidth,
    showQuickOpen, setShowQuickOpen, showAbout, setShowAbout,
    showCommandPalette, setShowCommandPalette
  } = useStore()
  const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false)

  // 窗口标题管理
  useWindowTitle()

  // 引导状态
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [isInitialized, setIsInitialized] = useState(false)
  
  // 防止 StrictMode 下重复初始化
  const initRef = useRef(false)

  // Layout State
  const [isResizingSidebar, setIsResizingSidebar] = useState(false)
  const [isResizingChat, setIsResizingChat] = useState(false)

  // 更新 HTML loader 状态
  const updateLoaderStatus = useCallback((status: string) => {
    const statusEl = document.querySelector('#initial-loader .loader-status')
    if (statusEl) statusEl.textContent = status
  }, [])

  // 移除初始 HTML loader
  const removeInitialLoader = useCallback((_status?: string) => {
    const loader = document.getElementById('initial-loader')
    const root = document.getElementById('root')
    
    // 先显示 React 应用内容
    if (root) {
      root.classList.add('ready')
    }
    
    // 等待 root 显示后再移除 loader（避免空白闪烁）
    if (loader) {
      // 使用 requestAnimationFrame 确保 root 已经开始渲染
      requestAnimationFrame(() => {
        loader.classList.add('fade-out')
        setTimeout(() => loader.remove(), 300)
      })
    }
  }, [])

  useEffect(() => {
    // 防止 StrictMode 下重复初始化
    if (initRef.current) return
    initRef.current = true
    
    // Load saved settings & restore workspace
    const loadSettings = async () => {
      try {
        startupMetrics.start('init-total')
        
        // 第一阶段：并行初始化独立模块（不互相依赖）
        startupMetrics.start('init-parallel-1')
        updateLoaderStatus('Initializing...')
        
        // 同步注册命令（非常快，不需要 await）
        registerCoreCommands()
        
        // 并行执行：快捷键加载、AgentStore初始化、编辑器配置、主题
        const [, , ,] = await Promise.all([
          keybindingService.init(),
          initializeAgentStore(),
          initEditorConfig(),
          themeManager.init(),
        ])
        startupMetrics.end('init-parallel-1')

        // 第二阶段：加载设置
        updateLoaderStatus('Loading settings...')
        startupMetrics.start('load-settings')
        const params = new URLSearchParams(window.location.search)
        const isEmptyWindow = params.get('empty') === '1'

        // 并行加载 store settings 和主题
        const [, savedTheme] = await Promise.all([
          useStore.getState().loadSettings(isEmptyWindow),
          window.electronAPI.getSetting('currentTheme'),
        ])
        startupMetrics.end('load-settings')

        // 检查是否需要显示引导
        const { onboardingCompleted, hasExistingConfig } = useStore.getState()

        // 应用保存的主题
        if (savedTheme) {
          const { setTheme } = useStore.getState()
          setTheme(savedTheme as 'adnify-dark' | 'midnight' | 'dawn')
        }

        // 第三阶段：恢复工作区（仅非空窗口）
        if (!isEmptyWindow) {
          updateLoaderStatus('Restoring workspace...')
          startupMetrics.start('restore-workspace')
          const workspaceConfig = await window.electronAPI.restoreWorkspace()
          if (workspaceConfig && workspaceConfig.roots && workspaceConfig.roots.length > 0) {
            setWorkspace(workspaceConfig)

            // 并行初始化：.adnify 目录 + 读取文件列表
            updateLoaderStatus('Loading workspace...')
            const [, , items] = await Promise.all([
              Promise.all(workspaceConfig.roots.map(root => adnifyDir.initialize(root))),
              adnifyDir.setPrimaryRoot(workspaceConfig.roots[0]),
              window.electronAPI.readDir(workspaceConfig.roots[0]),
            ])
            
            setFiles(items)

            // 后台初始化（不阻塞 UI）
            Promise.all([
              checkpointService.init(),
              useAgentStore.persist.rehydrate(),
              mcpService.initialize(workspaceConfig.roots),
            ]).catch(console.error)

            // 初始化诊断监听器（同步，很快）
            initDiagnosticsListener()

            // 恢复工作区状态
            updateLoaderStatus('Restoring editor state...')
            await restoreWorkspaceState()
          }
          startupMetrics.end('restore-workspace')
        } else {
          // 空窗口也初始化 MCP（使用空工作区列表）
          mcpService.initialize([]).catch(console.error)
        }

        // 注册设置同步监听器（返回清理函数供 useEffect 使用）
        const unsubscribeSettings = window.electronAPI.onSettingsChanged(({ key, value }) => {
          logger.system.info(`[App] Setting changed in another window: ${key}`, value)
          if (key === 'llmConfig') setLLMConfig(value as any)
          if (key === 'language') setLanguage(value as any)
          if (key === 'autoApprove') setAutoApprove(value as any)
          if (key === 'promptTemplateId') setPromptTemplateId(value as any)
          if (key === 'currentTheme') {
            const { setTheme } = useStore.getState()
            setTheme(value as any)
          }
        })
        // 保存清理函数到 ref 或返回
        ;(window as any).__settingsUnsubscribe = unsubscribeSettings

        updateLoaderStatus('Ready!')
        startupMetrics.end('init-total')
        
        // 短暂延迟后移除 loader 并通知主进程显示窗口
        setTimeout(() => {
          removeInitialLoader()
          setIsInitialized(true)

          // 通知主进程：渲染完成
          window.electronAPI.appReady()
          
          // 打印启动性能报告（开发环境）
          if (process.env.NODE_ENV === 'development') {
            startupMetrics.mark('app-ready')
            startupMetrics.printReport()
          }

          const shouldShowOnboarding = onboardingCompleted === false ||
            (onboardingCompleted === undefined && !hasExistingConfig)
          if (shouldShowOnboarding) {
            setShowOnboarding(true)
          }
        }, 50)  // 减少延迟时间
      } catch (error) {
        logger.system.error('Failed to load settings:', error)
        // Even if loading fails, ensure keybindings are registered
        registerCoreCommands()
        removeInitialLoader()
        setIsInitialized(true)
        window.electronAPI.appReady()
      }
    }
    loadSettings()
    
    // 清理函数
    return () => {
      const unsubscribe = (window as any).__settingsUnsubscribe
      if (unsubscribe) {
        unsubscribe()
        delete (window as any).__settingsUnsubscribe
      }
    }
  }, [setLLMConfig, setLanguage, setAutoApprove, setWorkspace, setFiles, updateLoaderStatus, removeInitialLoader, setPromptTemplateId])

  // 初始化工作区状态同步（自动保存打开的文件等）
  useEffect(() => {
    const cleanup = initWorkspaceStateSync()
    return cleanup
  }, [])

  // 监听文件变化，自动刷新已打开的文件
  useEffect(() => {
    const unsubscribe = window.electronAPI.onFileChanged(async (event) => {
      // 处理文件删除事件 - 清理 Monaco extraLib
      if (event.event === 'delete') {
        removeFileFromTypeService(event.path)
        return
      }
      
      if (event.event !== 'update') return // 只处理文件修改事件

      const { openFiles, reloadFileFromDisk } = useStore.getState()
      const openFile = openFiles.find(f => f.path === event.path)

      if (!openFile) return // 文件未打开，忽略

      // 读取最新内容
      const newContent = await window.electronAPI.readFile(event.path)
      if (newContent === null) return

      // 如果内容相同，不需要任何操作（可能是自己保存的）
      if (newContent === openFile.content) return

      if (openFile.isDirty) {
        // 文件有未保存更改，显示冲突提示
        const shouldReload = confirm(
          `文件 "${event.path.split(/[\\/]/).pop()}" 已被外部修改。\n\n是否重新加载？（本地更改将丢失）`
        )
        if (shouldReload) {
          reloadFileFromDisk(event.path, newContent)
        }
      } else {
        // 文件无更改，直接刷新
        reloadFileFromDisk(event.path, newContent)
      }
    })

    return unsubscribe
  }, [])

  // Resize Logic - 使用共享常量
  useEffect(() => {
    if (!isResizingSidebar && !isResizingChat) return

    const handleMouseMove = (e: MouseEvent) => {
      if (isResizingSidebar) {
        const newWidth = e.clientX - LAYOUT_LIMITS.ACTIVITY_BAR_WIDTH
        if (newWidth > LAYOUT_LIMITS.SIDEBAR_MIN_WIDTH && newWidth < LAYOUT_LIMITS.SIDEBAR_MAX_WIDTH) {
          setSidebarWidth(newWidth)
        }
      }
      if (isResizingChat) {
        const newWidth = window.innerWidth - e.clientX
        if (newWidth > LAYOUT_LIMITS.CHAT_MIN_WIDTH && newWidth < LAYOUT_LIMITS.CHAT_MAX_WIDTH) {
          setChatWidth(newWidth)
        }
      }
    }

    const handleMouseUp = () => {
      setIsResizingSidebar(false)
      setIsResizingChat(false)
      document.body.style.cursor = 'default'
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)

    const overlay = document.createElement('div')
    overlay.style.position = 'fixed'
    overlay.style.top = '0'
    overlay.style.left = '0'
    overlay.style.right = '0'
    overlay.style.bottom = '0'
    overlay.style.zIndex = '9999'
    overlay.style.cursor = isResizingSidebar || isResizingChat ? 'col-resize' : 'default'
    document.body.appendChild(overlay)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
      document.body.removeChild(overlay)
    }
  }, [isResizingSidebar, isResizingChat, setSidebarWidth, setChatWidth])

  // 全局快捷键
  const handleGlobalKeyDown = useCallback((e: KeyboardEvent) => {
    // Fallback check for Ctrl+Shift+P or F1
    if (
      keybindingService.matches(e, 'workbench.action.showCommands') ||
      (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'p') ||
      e.key === 'F1'
    ) {
      e.preventDefault()
      setShowCommandPalette(true)
    }

    if (e.key === 'F12') {
      window.electronAPI.toggleDevTools()
    }
    else if (keybindingService.matches(e, 'workbench.action.quickOpen')) {
      e.preventDefault()
      setShowQuickOpen(true)
    }
    else if (keybindingService.matches(e, 'workbench.action.openSettings')) {
      e.preventDefault()
      setShowSettings(true)
    }
    else if (keybindingService.matches(e, 'view.toggleTerminal')) {
      e.preventDefault()
      setTerminalVisible(!terminalVisible)
    }
    else if (keybindingService.matches(e, 'view.toggleDebug')) {
      e.preventDefault()
      setDebugVisible(!debugVisible)
    }
    // Debug shortcuts - F5, F9, F10, F11
    else if (keybindingService.matches(e, 'debug.start') || e.key === 'F5') {
      e.preventDefault()
      // 打开调试面板并触发启动
      if (!debugVisible) setDebugVisible(true)
      window.dispatchEvent(new CustomEvent('debug:start'))
    }
    else if (keybindingService.matches(e, 'debug.toggleBreakpoint') || e.key === 'F9') {
      e.preventDefault()
      window.dispatchEvent(new CustomEvent('debug:toggleBreakpoint'))
    }
    else if (keybindingService.matches(e, 'workbench.action.showShortcuts')) {
      const target = e.target as HTMLElement
      if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
        e.preventDefault()
        setShowKeyboardShortcuts(true)
      }
    }
    else if (keybindingService.matches(e, 'workbench.action.toggleComposer')) {
      e.preventDefault()
      setShowComposer(true)
    }
    else if (keybindingService.matches(e, 'workbench.action.closePanel')) {
      if (showCommandPalette) setShowCommandPalette(false)
      if (showKeyboardShortcuts) setShowKeyboardShortcuts(false)
      if (showQuickOpen) setShowQuickOpen(false)
      if (showComposer) setShowComposer(false)
      if (showAbout) setShowAbout(false)
    }
    else if (keybindingService.matches(e, 'help.about')) {
      e.preventDefault()
      setShowAbout(true)
    }
  }, [setShowSettings, setTerminalVisible, terminalVisible, setDebugVisible, debugVisible, showCommandPalette, showKeyboardShortcuts, showQuickOpen, showComposer, showAbout, setShowQuickOpen, setShowAbout])

  useEffect(() => {
    window.addEventListener('keydown', handleGlobalKeyDown)

    // Listen for menu commands from main process
    const removeListener = window.electronAPI.onExecuteCommand((commandId) => {
      logger.system.info('[App] Received command from main:', commandId)
      if (commandId === 'workbench.action.showCommands') {
        logger.system.info('[App] Showing Command Palette')
        setShowCommandPalette(true)
      }
      if (commandId === 'workbench.action.toggleDevTools') {
        window.electronAPI.toggleDevTools()
      }
    })

    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown)
      removeListener()
    }
  }, [handleGlobalKeyDown])

  return (
    <div className="h-screen flex flex-col bg-transparent overflow-hidden text-text-primary selection:bg-accent/30 selection:text-white relative">
      {/* Background is handled by globals.css body style for better performance and consistency */}

      <div className="relative z-10 flex flex-col h-full">
        <TitleBar />

        <div className="flex-1 flex overflow-hidden">
          <ActivityBar />

          {activeSidePanel && (
            <div style={{ width: sidebarWidth }} className="flex-shrink-0 relative">
              <Sidebar />
              <div
                className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-accent/50 transition-colors z-50 translate-x-[2px]"
                onMouseDown={(e) => { e.preventDefault(); setIsResizingSidebar(true) }}
              />
            </div>
          )}

          <div className="flex-1 flex min-w-0 bg-background relative">
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
              <div className="flex-1 min-h-0 flex flex-col relative overflow-hidden">
                <ErrorBoundary>
                  <Suspense fallback={<EditorSkeleton />}>
                    <Editor />
                  </Suspense>
                </ErrorBoundary>
              </div>
              <ErrorBoundary>
                <Suspense fallback={null}>
                  <TerminalPanel />
                </Suspense>
              </ErrorBoundary>
              <ErrorBoundary>
                <Suspense fallback={null}>
                  <DebugPanel />
                </Suspense>
              </ErrorBoundary>
            </div>

            <div style={{ width: chatWidth }} className="flex-shrink-0 relative border-l border-border-subtle">
              <div
                className="absolute top-0 left-0 w-1 h-full cursor-col-resize hover:bg-accent/50 transition-colors z-50 -translate-x-[2px]"
                onMouseDown={(e) => { e.preventDefault(); setIsResizingChat(true) }}
              />
              <ErrorBoundary>
                <ChatPanel />
              </ErrorBoundary>
            </div>
          </div>
        </div>

        <StatusBar />
      </div>

      {showSettings && (
        <Suspense fallback={null}>
          <SettingsModal />
        </Suspense>
      )}
      {showCommandPalette && (
        <Suspense fallback={null}>
          <CommandPalette
            onClose={() => setShowCommandPalette(false)}
            onShowKeyboardShortcuts={() => {
              setShowCommandPalette(false)
              setShowKeyboardShortcuts(true)
            }}
          />
        </Suspense>
      )}
      {showKeyboardShortcuts && (
        <Suspense fallback={null}>
          <KeyboardShortcuts onClose={() => setShowKeyboardShortcuts(false)} />
        </Suspense>
      )}
      {showQuickOpen && (
        <Suspense fallback={null}>
          <QuickOpen onClose={() => setShowQuickOpen(false)} />
        </Suspense>
      )}
      {showComposer && (
        <Suspense fallback={null}>
          <ComposerPanel onClose={() => setShowComposer(false)} />
        </Suspense>
      )}
      {showOnboarding && isInitialized && (
        <Suspense fallback={null}>
          <OnboardingWizard onComplete={() => setShowOnboarding(false)} />
        </Suspense>
      )}
      {showAbout && (
        <Suspense fallback={null}>
          <AboutDialog onClose={() => setShowAbout(false)} />
        </Suspense>
      )}
      <GlobalConfirmDialog />
    </div >
  )
}

export default function App() {
  return (
    <ToastProvider>
      <ToastInitializer />
      <GlobalErrorHandler>
        <ThemeManager>
          <AppContent />
        </ThemeManager>
      </GlobalErrorHandler>
    </ToastProvider>
  )
}