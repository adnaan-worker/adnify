/**
 * 上下文压缩状态指示器
 * 升级版：磨砂玻璃面板，胶囊设计
 */

import { useState, useCallback, useMemo } from 'react'
import { Minimize2, ChevronDown, ChevronUp, Trash2, RefreshCw, Sparkles, Clock } from 'lucide-react'
import { useAgentStore, selectContextSummary, selectMessages, contextCompactionService } from '@/renderer/agent'
import { Button } from '../ui'
import { motion, AnimatePresence } from 'framer-motion'

interface ContextCompactionIndicatorProps {
  language?: 'zh' | 'en'
}

export default function ContextCompactionIndicator({
  language = 'en',
}: ContextCompactionIndicatorProps) {
  const contextSummary = useAgentStore(selectContextSummary)
  const setContextSummary = useAgentStore(state => state.setContextSummary)
  const messages = useAgentStore(selectMessages)
  
  const [isExpanded, setIsExpanded] = useState(false)
  const [isCompacting, setIsCompacting] = useState(false)

  const stats = useMemo(() => contextCompactionService.getStats(), [contextSummary])

  const handleForceCompact = useCallback(async () => {
    setIsCompacting(true)
    try {
      const summary = await contextCompactionService.forceCompaction(messages)
      if (summary) {
        setContextSummary(summary)
      }
    } finally {
      setIsCompacting(false)
    }
  }, [messages, setContextSummary])

  const handleClearSummary = useCallback(() => {
    contextCompactionService.clearSummary()
    setContextSummary(null)
  }, [setContextSummary])

  if (!contextSummary) {
    return (
      <button
        onClick={handleForceCompact}
        disabled={isCompacting || messages.length < 10}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold text-text-muted hover:text-text-primary hover:bg-white/5 transition-all disabled:opacity-30 active:scale-95"
        title={language === 'zh' ? '手动压缩上下文' : 'Manually compress context'}
      >
        <Minimize2 className={`w-3.5 h-3.5 ${isCompacting ? 'animate-pulse text-accent' : ''}`} />
        <span>{isCompacting ? (language === 'zh' ? '压缩中...' : 'Compacting...') : (language === 'zh' ? '压缩上下文' : 'Compact')}</span>
      </button>
    )
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[11px] font-bold text-emerald-400 hover:bg-emerald-500/20 transition-all shadow-lg shadow-emerald-500/5 active:scale-95"
      >
        <Sparkles className="w-3 h-3 animate-pulse" />
        <span>{language === 'zh' ? '已压缩' : 'Compacted'}</span>
        <ChevronDown className={`w-3 h-3 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="absolute top-full left-0 mt-2 w-80 p-5 rounded-2xl bg-background/90 backdrop-blur-2xl border border-border shadow-2xl z-50 flex flex-col gap-4"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-accent/10 text-accent">
                  <Minimize2 className="w-4 h-4" />
                </div>
                <h4 className="text-sm font-bold text-text-primary tracking-tight">
                  {language === 'zh' ? '对话摘要' : 'Conversation Summary'}
                </h4>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={handleForceCompact}
                  disabled={isCompacting}
                  className="p-1.5 rounded-lg hover:bg-white/5 text-text-muted transition-colors"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isCompacting ? 'animate-spin' : ''}`} />
                </button>
                <button
                  onClick={handleClearSummary}
                  className="p-1.5 rounded-lg hover:bg-red-500/10 text-text-muted hover:text-red-400 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="bg-black/20 p-4 rounded-xl border border-border shadow-inner max-h-48 overflow-y-auto custom-scrollbar">
              <p className="text-xs text-text-secondary leading-relaxed whitespace-pre-wrap font-medium">
                {contextSummary}
              </p>
            </div>

            {stats.lastCompactedAt && (
              <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-text-muted opacity-50 px-1">
                <span className="flex items-center gap-1.5">
                  <Clock className="w-3 h-3" />
                  {language === 'zh' 
                    ? `已压缩 ${stats.compactedMessageCount} 条消息`
                    : `${stats.compactedMessageCount} messages`}
                </span>
                <span>
                  {new Date(stats.lastCompactedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export function CompactionProgressBar({
  language = 'en',
}: {
  language?: 'zh' | 'en'
}) {
  const isCompacting = useAgentStore(state => state.isCompacting)

  if (!isCompacting) return null

  return (
    <div className="px-4 py-2.5 bg-accent/5 border-b border-border flex items-center justify-center animate-fade-in">
      <div className="flex items-center gap-3 bg-background/50 px-4 py-1.5 rounded-full border border-accent/20 shadow-sm">
        <div className="w-3.5 h-3.5 relative">
          <div className="absolute inset-0 border-2 border-accent/20 rounded-full" />
          <div className="absolute inset-0 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
        <span className="text-[11px] font-bold text-accent uppercase tracking-widest">
          {language === 'zh' ? '正在智能整理对话...' : 'Compacting Context...'}
        </span>
      </div>
    </div>
  )
}