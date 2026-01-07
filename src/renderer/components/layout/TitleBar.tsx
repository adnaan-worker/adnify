import { api } from '@/renderer/services/electronAPI'
import { Minus, Square, X, Search, HelpCircle } from 'lucide-react'
import { useStore } from '@store'
import { Logo } from '../common/Logo'
import WorkspaceDropdown from './WorkspaceDropdown'

export default function TitleBar() {
  const { setShowQuickOpen, setShowAbout } = useStore()
  return (
    <div className="h-10 flex items-center justify-between px-0 drag-region select-none border-b border-border bg-background z-50">

      {/* Left - Branding */}
      <div className="flex items-center gap-2 pl-3 min-w-[200px] w-1/3">
        <div className="flex items-center gap-2.5 opacity-90 hover:opacity-100 transition-all cursor-default group no-drag">
          <Logo className="w-5 h-5 transition-transform group-hover:scale-110" glow />
          <span className="text-[11px] font-black text-text-primary tracking-[0.2em] font-sans uppercase">ADNIFY</span>
        </div>
        <div className="h-4 w-[1px] bg-border mx-2" />
        <div className="no-drag">
          <WorkspaceDropdown />
        </div>
      </div>

      {/* Center - Command Palette */}
      <div className="flex-1 flex justify-center min-w-0 px-4">
        <div
          onClick={() => setShowQuickOpen(true)}
          className="no-drag flex items-center justify-center gap-2 px-4 h-7 w-full max-w-[480px] rounded-lg bg-surface/20 border border-border hover:border-accent/30 hover:bg-surface/40 transition-all cursor-pointer group text-xs backdrop-blur-sm shadow-sm"
        >
          <Search className="w-3.5 h-3.5 text-text-muted group-hover:text-accent transition-colors" />
          <span className="text-text-muted group-hover:text-text-primary transition-colors font-medium truncate">Search files...</span>
          <div className="flex items-center gap-1 ml-auto shrink-0">
            <kbd className="hidden sm:inline-block font-mono bg-white/5 border border-white/10 rounded px-1.5 py-0.5 text-[10px] text-text-muted group-hover:text-text-secondary transition-colors">Ctrl P</kbd>
          </div>
        </div>
      </div>

      {/* Right - Window Controls (Refined) */}
      <div className="flex items-center justify-end min-w-[160px] w-1/3 h-full pr-2">
        <div className="no-drag flex items-center gap-1 h-full">
          {/* About Button */}
          <button
            onClick={() => setShowAbout(true)}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-white/5 transition-colors"
            title="About Adnify"
          >
            <HelpCircle className="w-4 h-4" />
          </button>

          <div className="w-px h-3 bg-border mx-1 opacity-50" />

          {/* Windows Control Buttons Group */}
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => api.window.minimize()}
              className="w-9 h-8 rounded-lg flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-white/10 transition-colors"
            >
              <Minus className="w-4 h-4" />
            </button>
            <button
              onClick={() => api.window.maximize()}
              className="w-9 h-8 rounded-lg flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-white/10 transition-colors"
            >
              <Square className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => api.window.close()}
              className="w-9 h-8 rounded-lg flex items-center justify-center text-text-muted hover:text-white hover:bg-red-500/90 transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}