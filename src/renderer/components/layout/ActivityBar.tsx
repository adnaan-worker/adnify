import { Files, Search, GitBranch, Settings, Sparkles, AlertCircle, ListTree, History } from 'lucide-react'
import { Tooltip } from '../ui/Tooltip'
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
    <div className="w-[50px] bg-background border-r border-border flex flex-col items-center py-2 z-30 select-none">
      {/* Top Actions */}
      <div className="flex-1 flex flex-col w-full">
        {items.map((item) => (
          <Tooltip key={item.id} content={item.label} side="right">
            <button
              onClick={() => setActiveSidePanel(activeSidePanel === item.id ? null : item.id)}
              className={`
                w-full h-12 flex items-center justify-center transition-all duration-200 group relative
                ${activeSidePanel === item.id
                  ? 'text-accent'
                  : 'text-text-muted hover:text-text-primary hover:bg-white/5'}
              `}
            >
              <item.icon
                className={`w-[22px] h-[22px] transition-transform duration-300 ${activeSidePanel === item.id ? 'scale-110 drop-shadow-[0_0_8px_rgba(var(--accent)/0.4)]' : 'group-hover:scale-110'}`}
                strokeWidth={1.5}
              />

              {/* Active Indicator */}
              {activeSidePanel === item.id && (
                <div className="absolute left-0 top-2 bottom-2 w-[3px] bg-accent rounded-r-full shadow-[0_0_10px_rgba(var(--accent)/0.6)]" />
              )}
            </button>
          </Tooltip>
        ))}
      </div>

      {/* Bottom Actions */}
      <div className="flex flex-col w-full pb-2">
        <Tooltip content={`${t('composer', language)} (Ctrl+Shift+I)`} side="right">
          <button
            onClick={() => setShowComposer(true)}
            className="w-full h-12 flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-white/5 transition-all duration-200 group"
          >
            <Sparkles className="w-5.5 h-5.5 group-hover:text-accent transition-colors group-hover:drop-shadow-[0_0_8px_rgba(var(--accent)/0.4)]" strokeWidth={1.5} />
          </button>
        </Tooltip>
        <Tooltip content={t('settings', language)} side="right">
          <button
            onClick={() => setShowSettings(true)}
            className="w-full h-12 flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-white/5 transition-all duration-200 group"
          >
            <Settings className="w-5.5 h-5.5 group-hover:rotate-45 transition-transform duration-500" strokeWidth={1.5} />
          </button>
        </Tooltip>
      </div>
    </div>
  )
}