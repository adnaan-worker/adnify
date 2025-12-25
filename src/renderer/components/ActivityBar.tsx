import { Files, Search, GitBranch, Settings, Sparkles, AlertCircle, ListTree, History } from 'lucide-react'
import { Tooltip } from './ui/Tooltip'
import { useStore } from '@store'
import { t } from '@renderer/i18n'

export default function ActivityBar() {
  const { activeSidePanel, setActiveSidePanel, language, setShowSettings, setShowComposer } = useStore()

  const items = [
    { id: 'explorer', icon: Files, label: t('explorer', language) },
    { id: 'search', icon: Search, label: t('search', language) },
    { id: 'git', icon: GitBranch, label: 'Git' },
    { id: 'problems', icon: AlertCircle, label: language === 'zh' ? '问题' : 'Problems' },
    { id: 'outline', icon: ListTree, label: language === 'zh' ? '大纲' : 'Outline' },
    { id: 'history', icon: History, label: language === 'zh' ? '历史' : 'History' },
  ] as const

  return (
    <div className="w-[50px] bg-background-secondary flex flex-col items-center py-3 border-r border-white/5 z-30">
      {/* Top Actions */}
      <div className="flex-1 flex flex-col gap-4 w-full px-2">
        {items.map((item) => (
          <Tooltip key={item.id} content={item.label} side="right">
            <button
              onClick={() => setActiveSidePanel(activeSidePanel === item.id ? null : item.id)}
              className={`
                w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-300 group relative
                ${activeSidePanel === item.id
                  ? 'text-accent'
                  : 'text-text-muted hover:text-text-primary hover:bg-white/5'}
              `}
            >
              <div className={`absolute inset-0 rounded-xl bg-accent/10 transition-opacity duration-300 ${activeSidePanel === item.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-50'}`} />

              <item.icon
                className={`w-5 h-5 relative z-10 transition-transform duration-300 ${activeSidePanel === item.id ? 'scale-110 drop-shadow-[0_0_8px_rgba(var(--accent)/0.5)]' : 'group-hover:scale-110'}`}
                strokeWidth={1.5}
              />

              {/* Active Indicator - Glowing Bar */}
              <div className={`absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-accent rounded-r-full shadow-[0_0_10px_rgba(var(--accent)/0.8)] transition-all duration-300 ${activeSidePanel === item.id ? 'opacity-100 translate-x-[-4px]' : 'opacity-0 translate-x-[-8px]'}`} />
            </button>
          </Tooltip>
        ))}
      </div>

      {/* Bottom Actions */}
      <div className="flex flex-col gap-4 w-full px-2 mb-2">
        <Tooltip content={`${t('composer', language)} (Ctrl+Shift+I)`} side="right">
          <button
            onClick={() => setShowComposer(true)}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-white/5 transition-all duration-300 group relative"
          >
            <div className="absolute inset-0 rounded-xl bg-accent/5 opacity-0 group-hover:opacity-100 transition-opacity" />
            <Sparkles className="w-5 h-5 group-hover:text-accent transition-colors relative z-10 group-hover:drop-shadow-[0_0_8px_rgba(var(--accent)/0.5)]" strokeWidth={1.5} />
          </button>
        </Tooltip>
        <Tooltip content={t('settings', language)} side="right">
          <button
            onClick={() => setShowSettings(true)}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-white/5 transition-all duration-300 group relative"
          >
            <div className="absolute inset-0 rounded-xl bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity" />
            <Settings className="w-5 h-5 group-hover:rotate-45 transition-transform duration-500 relative z-10" strokeWidth={1.5} />
          </button>
        </Tooltip>
      </div>
    </div>
  )
}
