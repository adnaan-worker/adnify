import { Minus, Square, X, Search, Plus, HelpCircle } from 'lucide-react'
import { useStore } from '../store'
import { Logo } from './Logo'

export default function TitleBar() {
  const { setShowQuickOpen, setShowAbout } = useStore()
  return (
    <div className="h-9 flex items-center justify-between px-3 drag-region select-none border-b border-border-subtle z-50 bg-background/40 backdrop-blur-md">

      {/* Left Spacer / Logo */}
      <div className="flex items-center gap-3 no-drag w-1/3 pl-2 opacity-80 hover:opacity-100 transition-opacity cursor-default">
        <Logo className="w-4 h-4 text-accent" glow />
        <span className="text-xs font-bold text-text-primary tracking-widest font-sans">ADNIFY</span>
      </div>

      {/* Center - Command Palette Trigger */}
      <div className="flex-1 flex justify-center no-drag">
        <div
          onClick={() => setShowQuickOpen(true)}
          className="flex items-center justify-center gap-2 px-3 py-1 rounded-md bg-surface/50 border border-white/5 hover:border-accent/30 hover:bg-surface hover:shadow-glow-sm transition-all cursor-pointer group w-96 text-xs backdrop-blur-sm"
        >
          <Search className="w-3 h-3 text-text-muted group-hover:text-accent transition-colors" />
          <span className="text-text-muted group-hover:text-text-primary transition-colors">Search files...</span>
          <div className="flex items-center gap-1 ml-auto">
            <kbd className="hidden sm:inline-block font-mono bg-white/5 border border-white/10 rounded px-1 text-[10px] text-text-muted">Ctrl P</kbd>
          </div>
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center justify-end gap-1 no-drag w-1/3">
        <button
          onClick={() => setShowAbout(true)}
          className="p-1.5 rounded-md hover:bg-surface-hover transition-colors text-text-muted hover:text-text-primary mr-1"
          title="About Adnify"
        >
          <HelpCircle className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => window.electronAPI.newWindow()}
          className="p-1.5 rounded-md hover:bg-surface-hover transition-colors text-text-muted hover:text-text-primary mr-1"
          title="New Window (Ctrl+Shift+N)"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>

        <div className="h-4 w-[1px] bg-border-subtle mx-1" />

        <button
          onClick={() => window.electronAPI.minimize()}
          className="p-1.5 rounded-md hover:bg-surface-hover transition-colors text-text-muted hover:text-text-primary"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => window.electronAPI.maximize()}
          className="p-1.5 rounded-md hover:bg-surface-hover transition-colors text-text-muted hover:text-text-primary"
        >
          <Square className="w-3 h-3" />
        </button>
        <button
          onClick={() => window.electronAPI.close()}
          className="p-1.5 rounded-md hover:bg-status-error hover:text-white transition-colors text-text-muted"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}
