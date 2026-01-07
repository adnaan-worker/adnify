import { api } from '@/renderer/services/electronAPI'
import { logger } from '@utils/Logger'
import { useEffect, useState, useMemo } from 'react'
import {
  GitBranch,
  AlertCircle,
  XCircle,
  Database,
  Loader2,
  Cpu,
  Terminal,
  CheckCircle2,
  ScrollText,
  Coins,
  Minimize2,
  MessageSquare,
  Bug,
} from 'lucide-react'
import { useStore } from '@store'
import { t } from '@renderer/i18n'
import type { IndexStatus } from '@shared/types'
import { indexWorkerService, IndexProgress } from '@services/indexWorkerService'
import BottomBarPopover from '../ui/BottomBarPopover'
import ToolCallLogContent from '../panels/ToolCallLogContent'
import TokenStatsContent from '../panels/TokenStatsContent'
import CompactionStatsContent from '../panels/CompactionStatsContent'
import { PlanListPopover } from '../panels/PlanListContent'
import { useAgentStore, selectMessages, selectContextSummary, selectIsCompacting } from '@renderer/agent'
import { isAssistantMessage, TokenUsage } from '@renderer/agent/types'
import { useDiagnosticsStore, getFileStats } from '@services/diagnosticsStore'
import { AGENT_DEFAULTS } from '@shared/constants'
import LspStatusIndicator from './LspStatusIndicator'

export default function StatusBar() {
  const {
    activeFilePath, workspacePath, setShowSettings, language,
    terminalVisible, setTerminalVisible, debugVisible, setDebugVisible,
    cursorPosition, isGitRepo, gitStatus, setActiveSidePanel, agentConfig
  } = useStore()
  const [indexStatus, setIndexStatus] = useState<IndexStatus | null>(null)
  const [workerProgress, setWorkerProgress] = useState<IndexProgress | null>(null)
  
  const maxContextTokens = agentConfig.maxContextTokens ?? AGENT_DEFAULTS.MAX_CONTEXT_TOKENS
  const warnTokenThreshold = maxContextTokens * 0.8
  const mediumTokenThreshold = maxContextTokens * 0.5
  
  const diagnostics = useDiagnosticsStore(state => state.diagnostics)
  const version = useDiagnosticsStore(state => state.version)
  const totalErrorCount = useDiagnosticsStore(state => state.errorCount)
  const totalWarningCount = useDiagnosticsStore(state => state.warningCount)

  const currentFileStats = useMemo(() => {
    return getFileStats(diagnostics, activeFilePath)
  }, [activeFilePath, version, diagnostics])

  const messages = useAgentStore(selectMessages)
  const contextSummary = useAgentStore(selectContextSummary)
  const isCompacting = useAgentStore(selectIsCompacting)
  
  const tokenStats = useMemo(() => {
    let totalUsage: TokenUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 }
    let lastUsage: TokenUsage | undefined

    for (const msg of messages) {
      if (isAssistantMessage(msg) && msg.usage) {
        totalUsage.promptTokens += msg.usage.promptTokens
        totalUsage.completionTokens += msg.usage.completionTokens
        totalUsage.totalTokens += msg.usage.totalTokens
        lastUsage = msg.usage
      }
    }

    return { totalUsage, lastUsage }
  }, [messages])

  const messageCount = useMemo(() => {
    return messages.filter(m => m.role === 'user' || m.role === 'assistant').length
  }, [messages])

  useEffect(() => {
    indexWorkerService.initialize()
    const unsubProgress = indexWorkerService.onProgress(setWorkerProgress)
    const unsubError = indexWorkerService.onError((error) => {
      logger.ui.error('[StatusBar] Worker error:', error)
    })
    return () => {
      unsubProgress()
      unsubError()
    }
  }, [])

  useEffect(() => {
    if (!workspacePath) {
      setIndexStatus(null)
      return
    }
    api.index.status(workspacePath).then(setIndexStatus)
    const unsubscribe = api.index.onProgress(setIndexStatus)
    return unsubscribe
  }, [workspacePath])

  const handleIndexClick = () => setShowSettings(true)
  const handleDiagnosticsClick = () => setActiveSidePanel('problems')
  const toolCallLogs = useStore(state => state.toolCallLogs)

  return (
    <div className="h-7 bg-background border-t border-border flex items-center justify-between px-2 text-[10px] select-none text-text-muted z-50 font-medium">
      {/* Left Group */}
      <div className="flex items-center gap-4 pl-1">
        {isGitRepo && gitStatus && (
          <button className="flex items-center gap-1.5 px-2 py-0.5 rounded hover:bg-white/5 text-text-muted hover:text-text-primary transition-all group">
            <GitBranch className="w-3.5 h-3.5 text-accent opacity-80" />
            <span className="font-bold tracking-tight">{gitStatus.branch}</span>
          </button>
        )}

        <button 
          onClick={handleDiagnosticsClick}
          className="flex items-center gap-3 px-2 py-0.5 rounded hover:bg-white/5 transition-all text-text-muted hover:text-text-primary"
        >
          <div className={`flex items-center gap-1 ${currentFileStats.errors > 0 ? 'text-red-400' : ''}`}>
            <XCircle className="w-3.5 h-3.5" />
            <span className="font-bold">{currentFileStats.errors}</span>
          </div>
          <div className={`flex items-center gap-1 ${currentFileStats.warnings > 0 ? 'text-yellow-400' : ''}`}>
            <AlertCircle className="w-3.5 h-3.5" />
            <span className="font-bold">{currentFileStats.warnings}</span>
          </div>
        </button>

        {workerProgress && !workerProgress.isComplete && workerProgress.total > 0 && (
          <div className="flex items-center gap-1.5 text-accent animate-fade-in px-2">
            <Cpu className="w-3 h-3 animate-pulse" />
            <span>{Math.round((workerProgress.processed / workerProgress.total) * 100)}%</span>
          </div>
        )}

        {workspacePath && (
          <button
            onClick={handleIndexClick}
            className="flex items-center gap-1.5 px-2 py-0.5 rounded hover:bg-white/5 hover:text-text-primary transition-colors group"
          >
            {indexStatus?.isIndexing ? (
              <Loader2 className="w-3 h-3 animate-spin text-accent" />
            ) : indexStatus?.totalChunks ? (
              <CheckCircle2 className="w-3 h-3 text-green-400/70 group-hover:text-green-400" />
            ) : (
              <Database className="w-3 h-3 opacity-50" />
            )}
          </button>
        )}
      </div>

      <div className="flex-1" />

      {/* Right Group - Logical Separation */}
      <div className="flex items-center h-full">
        
        {/* Stats Group */}
        <div className="flex items-center gap-4 px-3 border-r border-border/50 h-4">
          {(isCompacting || contextSummary) && (
            <BottomBarPopover
              icon={
                <div className={`flex items-center gap-1.5 ${isCompacting ? 'text-yellow-400' : 'text-green-400'}`}>
                  {isCompacting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Minimize2 className="w-3 h-3" />}
                  <span className={`text-[10px] font-medium ${isCompacting ? 'text-yellow-400' : 'bg-gradient-to-r from-green-400 to-emerald-300 bg-clip-text text-transparent'}`}>
                    {isCompacting ? (language === 'zh' ? '压缩中...' : 'Compacting...') : (language === 'zh' ? '已压缩' : 'Compacted')}
                  </span>
                </div>
              }
              width={340} height={400} language={language as 'en' | 'zh'}
            >
              <CompactionStatsContent language={language as 'en' | 'zh'} />
            </BottomBarPopover>
          )}

          {messageCount > 0 && (
            <div className="flex items-center gap-1.5 px-1 cursor-default text-text-muted hover:text-text-primary transition-colors">
              <MessageSquare className="w-3.5 h-3.5" />
              <span className="font-bold">{messageCount}</span>
            </div>
          )}

          {tokenStats.totalUsage.totalTokens > 0 && (
            <BottomBarPopover
              icon={
                <div className={`flex items-center gap-1.5 ${tokenStats.totalUsage.totalTokens > warnTokenThreshold ? 'text-orange-400' : tokenStats.totalUsage.totalTokens > mediumTokenThreshold ? 'text-yellow-400' : ''}`}>
                  <Coins className={`w-3.5 h-3.5 ${tokenStats.totalUsage.totalTokens > warnTokenThreshold ? 'animate-pulse' : ''}`} />
                  <span className="font-mono text-[10px] font-bold">
                    {tokenStats.totalUsage.totalTokens >= 1000 ? `${(tokenStats.totalUsage.totalTokens / 1000).toFixed(1)}k` : tokenStats.totalUsage.totalTokens}
                  </span>
                </div>
              }
              width={320} height={380} language={language as 'en' | 'zh'}
            >
              <TokenStatsContent totalUsage={tokenStats.totalUsage} lastUsage={tokenStats.lastUsage} language={language as 'en' | 'zh'} />
            </BottomBarPopover>
          )}
        </div>

        {/* Tools Group */}
        <div className="flex items-center gap-2 px-3 border-r border-border/50 h-4">
          <BottomBarPopover
            icon={<ScrollText className="w-3.5 h-3.5" />}
            badge={toolCallLogs.length || undefined}
            width={380} height={280} language={language as 'en' | 'zh'}
          >
            <ToolCallLogContent language={language as 'en' | 'zh'} />
          </BottomBarPopover>

          <PlanListPopover language={language as 'en' | 'zh'} />
        </div>

        {/* Panel Toggles */}
        <div className="flex items-center h-full px-1 border-r border-border/50">
          <button
            onClick={() => setTerminalVisible(!terminalVisible)}
            className={`h-full px-2.5 transition-all ${terminalVisible ? 'text-accent bg-accent/5 shadow-[inset_0_-2px_0_rgba(var(--accent),0.8)]' : 'text-text-muted hover:text-text-primary hover:bg-white/5'}`}
          >
            <Terminal className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setDebugVisible(!debugVisible)}
            className={`h-full px-2.5 transition-all ${debugVisible ? 'text-accent bg-accent/5 shadow-[inset_0_-2px_0_rgba(var(--accent),0.8)]' : 'text-text-muted hover:text-text-primary hover:bg-white/5'}`}
          >
            <Bug className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Context Info */}
        <div className="flex items-center gap-3 pl-3 pr-2">
          <LspStatusIndicator />

          {activeFilePath && (
            <div className="text-[10px] font-black uppercase tracking-widest text-accent opacity-80 select-none">
              {activeFilePath.split('.').pop() || 'TXT'}
            </div>
          )}

          <div className="flex items-center gap-2 cursor-pointer hover:bg-white/5 px-2 py-0.5 rounded transition-colors font-mono opacity-60 hover:opacity-100">
            <span>Ln {cursorPosition?.line || 1}, Col {cursorPosition?.column || 1}</span>
          </div>
        </div>
      </div>
    </div>
  )
}