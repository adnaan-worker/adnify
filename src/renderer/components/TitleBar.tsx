import { Minus, Square, X, Search, HelpCircle } from 'lucide-react'
import { useStore } from '../store'
import { Logo } from './Logo'
import { Button } from './ui'
import WorkspaceDropdown from './WorkspaceDropdown'

export default function TitleBar() {
  const { setShowQuickOpen, setShowAbout } = useStore()
  return (
    <div className="h-9 flex items-center justify-between px-3 drag-region select-none border-b border-border-subtle z-50 bg-background-secondary">

      {/* Left - Logo + Workspace Dropdown */}
      <div className="flex items-center gap-2 no-drag w-1/3">
        <div className="flex items-center gap-2 pl-2 opacity-80 hover:opacity-100 transition-opacity cursor-default">
          <Logo className="w-4 h-4 text-accent" glow />
          <span className="text-xs font-bold text-text-primary tracking-widest font-sans">ADNIFY</span>
        </div>
        <div className="h-4 w-[1px] bg-border-subtle mx-1" />
        <WorkspaceDropdown />
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
            <kbd className="hidden sm:inline-block font-mono bg-white/5 border border-white/10 rounded px-1.5 py-0.5 text-[10px] text-text-muted group-hover:text-text-secondary group-hover:border-white/20 transition-colors">Ctrl P</kbd>
          </div>
        </div>
      </div>

      {/* Right Controls - 仅保留帮助和窗口控制 */}
      <div className="flex items-center justify-end gap-1 no-drag w-1/3">
        <Button
          variant="icon"
          size="icon"
          onClick={() => setShowAbout(true)}
          className="mr-1 w-7 h-7"
          title="About Adnify"
        >
          <HelpCircle className="w-3.5 h-3.5" />
        </Button>

        <div className="h-4 w-[1px] bg-border-subtle mx-1" />

        <Button
          variant="icon"
          size="icon"
          onClick={() => window.electronAPI.minimize()}
          className="w-7 h-7"
        >
          <Minus className="w-3.5 h-3.5" />
        </Button>
        <Button
          variant="icon"
          size="icon"
          onClick={() => window.electronAPI.maximize()}
          className="w-7 h-7"
        >
          <Square className="w-3 h-3" />
        </Button>
        <Button
          variant="icon"
          size="icon"
          onClick={() => window.electronAPI.close()}
          className="w-7 h-7 hover:bg-status-error hover:text-white"
        >
          <X className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  )
}
