import { useEffect, useState } from 'react'
import { GitBranch, AlertCircle, XCircle, Database, Loader2, Cpu, Terminal, CheckCircle2 } from 'lucide-react'
import { useStore } from '../store'
import { t } from '../i18n'
import { IndexStatus } from '../types/electron'
import { indexWorkerService, IndexProgress } from '../services/indexWorkerService'

export default function StatusBar() {
  const { activeFilePath, isStreaming, workspacePath, setShowSettings, language, terminalVisible, setTerminalVisible, cursorPosition } = useStore()
  const [indexStatus, setIndexStatus] = useState<IndexStatus | null>(null)
  const [workerProgress, setWorkerProgress] = useState<IndexProgress | null>(null)

  // 初始化 Worker 并监听进度
  useEffect(() => {
    indexWorkerService.initialize()

    const unsubProgress = indexWorkerService.onProgress(setWorkerProgress)
    const unsubError = indexWorkerService.onError((error) => {
      console.error('[StatusBar] Worker error:', error)
    })

    return () => {
      unsubProgress()
      unsubError()
    }
  }, [])

  // 监听索引状态
  useEffect(() => {
    if (!workspacePath) {
      setIndexStatus(null)
      return
    }

    // 获取初始状态
    window.electronAPI.indexStatus(workspacePath).then(setIndexStatus)

    // 监听进度更新
    const unsubscribe = window.electronAPI.onIndexProgress(setIndexStatus)
    return unsubscribe
  }, [workspacePath])

  const handleIndexClick = () => {
    setShowSettings(true)
  }

  return (
    <div className="h-6 bg-background/40 border-t border-white/5 flex items-center justify-between px-3 text-[10px] select-none text-text-muted backdrop-blur-xl z-50 font-medium">
      <div className="flex items-center gap-4">
        <button className="flex items-center gap-1.5 hover:text-text-primary transition-colors group">
          <GitBranch className="w-3 h-3 text-accent group-hover:drop-shadow-[0_0_5px_rgba(var(--accent)/0.5)] transition-all" />
          <span className="group-hover:text-accent transition-colors">main</span>
        </button>

        {/* Diagnostics */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 hover:text-text-primary transition-colors cursor-pointer group">
            <XCircle className="w-3 h-3 group-hover:text-red-400 transition-colors" />
            <span>0</span>
          </div>
          <div className="flex items-center gap-1 hover:text-text-primary transition-colors cursor-pointer group">
            <AlertCircle className="w-3 h-3 group-hover:text-yellow-400 transition-colors" />
            <span>0</span>
          </div>
        </div>

        {/* Worker 状态 */}
        {workerProgress && !workerProgress.isComplete && (
          <div className="flex items-center gap-1.5 text-accent animate-fade-in">
            <Cpu className="w-3 h-3 animate-pulse" />
            <span>
              {Math.round((workerProgress.processed / workerProgress.total) * 100)}%
            </span>
          </div>
        )}

        {/* 索引状态 */}
        {workspacePath && (
          <button
            onClick={handleIndexClick}
            className="flex items-center gap-1.5 hover:text-text-primary transition-colors group"
            title={t('codebaseIndex', language)}
          >
            {indexStatus?.isIndexing ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin text-accent" />
                <span className="text-accent hidden sm:inline">Indexing...</span>
              </>
            ) : indexStatus?.totalChunks ? (
              <CheckCircle2 className="w-3 h-3 text-green-400/70 group-hover:text-green-400 transition-colors" />
            ) : (
              <Database className="w-3 h-3 opacity-50 group-hover:opacity-80" />
            )}
          </button>
        )}
      </div>

      <div className="flex items-center gap-4">
        {isStreaming && (
          <div className="flex items-center gap-2 text-accent animate-pulse-glow px-2 py-0.5 rounded-full bg-accent/5 border border-accent/10">
            <div className="w-1 h-1 rounded-full bg-accent animate-pulse" />
            <span className="font-medium">AI Processing</span>
          </div>
        )}

        <div className="flex items-center gap-4">
          {/* 终端切换按钮 */}
          <button
            onClick={() => setTerminalVisible(!terminalVisible)}
            className={`flex items-center gap-1.5 transition-colors ${terminalVisible ? 'text-text-primary' : 'hover:text-text-primary'}`}
            title={`${t('terminal', language)} (Ctrl+\`)`}
          >
            <Terminal className={`w-3 h-3 ${terminalVisible ? 'text-accent drop-shadow-[0_0_5px_rgba(var(--accent)/0.5)]' : ''}`} />
          </button>

          {activeFilePath && (
            <span className="font-medium text-accent/80">{activeFilePath.split('.').pop()?.toUpperCase() || 'TXT'}</span>
          )}

          <div className="flex items-center gap-2 cursor-pointer hover:text-text-primary font-mono opacity-60 hover:opacity-100 transition-opacity">
            <span>Ln {cursorPosition?.line || 1}, Col {cursorPosition?.column || 1}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
