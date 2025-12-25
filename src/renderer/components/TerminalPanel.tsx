import { useEffect, useRef, useState, useCallback } from 'react'
import { Terminal as XTerminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { WebglAddon } from '@xterm/addon-webgl'
import { X, Plus, Trash2, ChevronUp, ChevronDown, Terminal as TerminalIcon, Sparkles, Play, SplitSquareHorizontal, LayoutTemplate } from 'lucide-react'
import { useStore } from '@store'
import { getEditorConfig } from '@renderer/config/editorConfig'
import { themes } from './ThemeManager'
import { Button, Select } from './ui'

const XTERM_STYLE = `
.xterm { font-feature-settings: "liga" 0; position: relative; user-select: none; -ms-user-select: none; -webkit-user-select: none; padding: 4px; }
.xterm.focus, .xterm:focus { outline: none; }
.xterm .xterm-helpers { position: absolute; z-index: 5; }
.xterm .xterm-helper-textarea { padding: 0; border: 0; margin: 0; position: absolute; opacity: 0; left: -9999em; top: 0; width: 0; height: 0; z-index: -5; overflow: hidden; white-space: nowrap; }
.xterm .composition-view { background: #000; color: #FFF; display: none; position: absolute; white-space: pre; z-index: 1; }
.xterm .composition-view.active { display: block; }
.xterm .xterm-viewport { background-color: #18181b; overflow-y: scroll; cursor: default; position: absolute; right: 0; left: 0; top: 0; bottom: 0; }
.xterm .xterm-screen { position: relative; }
.xterm .xterm-screen canvas { position: absolute; left: 0; top: 0; }
.xterm .xterm-scroll-area { visibility: hidden; }
.xterm-char-measure-element { display: inline-block; visibility: hidden; position: absolute; left: -9999em; top: 0; }
.xterm.enable-mouse-events { cursor: default; }
.xterm.xterm-cursor-pointer { cursor: pointer; }
.xterm.xterm-cursor-crosshair { cursor: crosshair; }
.xterm .xterm-accessibility, .xterm .xterm-message-overlay { position: absolute; left: 0; top: 0; bottom: 0; right: 0; z-index: 10; color: transparent; }
.xterm-live-region { position: absolute; left: -9999px; width: 1px; height: 1px; overflow: hidden; }
.xterm-dim { opacity: 0.5; }
.xterm-underline { text-decoration: underline; }
.xterm-selection-layer { position: absolute; top: 0; left: 0; z-index: 1; pointer-events: none; }
.xterm-cursor-layer { position: absolute; top: 0; left: 0; z-index: 2; pointer-events: none; }
.xterm-link-layer { position: absolute; top: 0; left: 0; z-index: 11; pointer-events: none; }
.xterm-link-layer a { cursor: pointer; color: #3b82f6; text-decoration: underline; }
`

interface TerminalSession {
    id: string
    name: string
    shell: string
    cwd: string
}

export default function TerminalPanel() {
    const { terminalVisible, setTerminalVisible, workspace, setChatMode, setInputPrompt, currentTheme, terminalLayout, setTerminalLayout } = useStore()
    const [isCollapsed, setIsCollapsed] = useState(false)
    const [height, setHeight] = useState(280)
    const [isResizing, setIsResizing] = useState(false)

    const isSplitView = terminalLayout === 'split'
    const setIsSplitView = (value: boolean) => setTerminalLayout(value ? 'split' : 'tabs')

    const [terminals, setTerminals] = useState<TerminalSession[]>([])
    const [activeId, setActiveId] = useState<string | null>(null)
    const [availableShells, setAvailableShells] = useState<{ label: string, path: string }[]>([])
    const [showShellMenu, setShowShellMenu] = useState(false)
    const [selectedRoot, setSelectedRoot] = useState<string>('')

    const [scripts, setScripts] = useState<Record<string, string>>({})
    const [showScriptMenu, setShowScriptMenu] = useState(false)

    const shellMenuRef = useRef<HTMLDivElement>(null)
    const shellButtonRef = useRef<HTMLButtonElement>(null)
    const scriptMenuRef = useRef<HTMLDivElement>(null)
    const scriptButtonRef = useRef<HTMLButtonElement>(null)

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (showShellMenu &&
                shellMenuRef.current &&
                !shellMenuRef.current.contains(event.target as Node) &&
                shellButtonRef.current &&
                !shellButtonRef.current.contains(event.target as Node)) {
                setShowShellMenu(false)
            }
            if (showScriptMenu &&
                scriptMenuRef.current &&
                !scriptMenuRef.current.contains(event.target as Node) &&
                scriptButtonRef.current &&
                !scriptButtonRef.current.contains(event.target as Node)) {
                setShowScriptMenu(false)
            }
        }

        document.addEventListener('mousedown', handleClickOutside)
        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
        }
    }, [showShellMenu, showScriptMenu])

    const terminalRefs = useRef<Map<string, XTerminal>>(new Map())
    const addonRefs = useRef<Map<string, FitAddon>>(new Map())
    const containerRefs = useRef<Map<string, HTMLDivElement>>(new Map())
    const outputBuffers = useRef<Map<string, string[]>>(new Map())

    // Handle pending terminal commands from other components (e.g. Agent ToolCallCard)
    const { pendingTerminalCommand, setPendingTerminalCommand } = useStore()

    useEffect(() => {
        if (pendingTerminalCommand && terminalVisible) {
            // Ensure we have an active terminal
            if (!activeId && terminals.length === 0) {
                // Create a new terminal if none exists
                // We'll need to wait for it to be created, so we might need a more robust way
                // For now, let's just try to create one if we can access the create function
                // or just rely on the user having one open.
                // Ideally, we should trigger createTerminal here.
            }

            const targetId = activeId || (terminals.length > 0 ? terminals[0].id : null)

            if (targetId) {
                const term = terminalRefs.current.get(targetId)
                if (term) {
                    // If CWD is specified, we might want to cd into it first
                    // But for now, let's just paste the command
                    if (pendingTerminalCommand.command) {
                        term.input(pendingTerminalCommand.command)
                        // If autoRun is true, we could append \r, but let's let the user press enter for safety
                        // unless explicitly requested.
                        if (pendingTerminalCommand.autoRun) {
                            term.input('\r')
                        }
                    }

                    // Clear the pending command
                    setPendingTerminalCommand(null)

                    // Focus the terminal
                    term.focus()
                }
            }
        }
    }, [pendingTerminalCommand, terminalVisible, activeId, terminals, setPendingTerminalCommand])

    const startResizing = useCallback((e: React.MouseEvent) => {
        e.preventDefault()
        setIsResizing(true)
    }, [])

    useEffect(() => {
        if (!isResizing) return
        const handleMouseMove = (e: MouseEvent) => {
            const newHeight = window.innerHeight - e.clientY - 24
            if (newHeight > 100 && newHeight < window.innerHeight - 100) setHeight(newHeight)
        }
        const stopResizing = () => {
            setIsResizing(false)
            if (activeId) addonRefs.current.get(activeId)?.fit()
        }
        window.addEventListener('mousemove', handleMouseMove)
        window.addEventListener('mouseup', stopResizing)
        return () => {
            window.removeEventListener('mousemove', handleMouseMove)
            window.removeEventListener('mouseup', stopResizing)
        }
    }, [isResizing, activeId])

    useEffect(() => {
        const loadShells = async () => {
            try {
                const shells = await window.electronAPI.getAvailableShells()
                setAvailableShells(shells)
            } catch {
                setAvailableShells([{ label: 'Terminal', path: '' }])
            }
        }
        loadShells()
    }, [])

    useEffect(() => {
        if (workspace?.roots?.[0] && !selectedRoot) {
            setSelectedRoot(workspace.roots[0])
        }
    }, [workspace?.roots, selectedRoot])

    useEffect(() => {
        const loadScripts = async () => {
            if (!selectedRoot) return
            try {
                const content = await window.electronAPI.readFile(`${selectedRoot}/package.json`)
                if (content) {
                    const pkg = JSON.parse(content)
                    if (pkg.scripts) setScripts(pkg.scripts)
                }
            } catch (e) {
                setScripts({})
            }
        }
        loadScripts()
    }, [selectedRoot])

    useEffect(() => {
        if (terminalVisible && terminals.length === 0 && availableShells.length > 0) {
            createTerminal()
        }
    }, [terminalVisible, availableShells.length])

    useEffect(() => {
        if (!terminalVisible || isCollapsed || !activeId) return
        const handleResize = () => {
            const targets = isSplitView ? terminals : terminals.filter(t => t.id === activeId)
            targets.forEach(t => {
                const addon = addonRefs.current.get(t.id)
                if (addon) {
                    try {
                        addon.fit()
                        const dims = addon.proposeDimensions()
                        if (dims && dims.cols > 0 && dims.rows > 0) {
                            window.electronAPI.resizeTerminal(t.id, dims.cols, dims.rows)
                        }
                    } catch { }
                }
            })
        }
        window.addEventListener('resize', handleResize)
        setTimeout(handleResize, 100)
        return () => window.removeEventListener('resize', handleResize)
    }, [terminalVisible, isCollapsed, activeId, height, isSplitView, terminals.length])

    useEffect(() => {
        const unsubscribe = window.electronAPI.onTerminalData(({ id, data }: { id: string, data: string }) => {
            const targetId = id || activeId
            if (!targetId) return
            const term = terminalRefs.current.get(targetId)
            if (term) {
                term.write(data)
                if (!outputBuffers.current.has(targetId)) outputBuffers.current.set(targetId, [])
                const buffer = outputBuffers.current.get(targetId)!
                buffer.push(data)
                if (buffer.length > 1000) buffer.shift()
            }
        })
        return unsubscribe
    }, [activeId])

    const getTerminalTheme = (themeName: string) => {
        const themeVars = themes[themeName as keyof typeof themes] || themes['adnify-dark']
        const rgbToHex = (rgb: string) => {
            if (!rgb) return '#000000'
            const [r, g, b] = rgb.split(' ').map(Number)
            return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
        }
        return {
            background: rgbToHex(themeVars['--surface']),
            foreground: rgbToHex(themeVars['--text-primary']),
            cursor: rgbToHex(themeVars['--text-secondary']),
            selectionBackground: rgbToHex(themeVars['--accent']),
            selectionForeground: '#ffffff',
            black: rgbToHex(themeVars['--surface']),
            red: '#ef4444',
            green: '#22c55e',
            yellow: '#eab308',
            blue: rgbToHex(themeVars['--accent']),
            magenta: '#a855f7',
            cyan: '#06b6d4',
            white: rgbToHex(themeVars['--text-primary']),
        }
    }

    useEffect(() => {
        const newTheme = getTerminalTheme(currentTheme)
        terminalRefs.current.forEach(term => term.options.theme = newTheme)
    }, [currentTheme])

    const createTerminal = async (shellPath?: string, shellName?: string) => {
        const id = crypto.randomUUID()
        const name = shellName || availableShells[0]?.label || 'Terminal'
        const cwd = selectedRoot || workspace?.roots?.[0] || ''

        setTerminals(prev => [...prev, { id, name, shell: shellPath || '', cwd }])
        setActiveId(id)
        setShowShellMenu(false)

        setTimeout(async () => {
            const container = containerRefs.current.get(id)
            if (!container) return

            const termConfig = getEditorConfig().terminal
            const term = new XTerminal({
                cursorBlink: termConfig.cursorBlink,
                fontFamily: termConfig.fontFamily,
                fontSize: termConfig.fontSize,
                lineHeight: termConfig.lineHeight,
                scrollback: termConfig.scrollback,
                allowProposedApi: true,
                theme: getTerminalTheme(currentTheme)
            })

            const fitAddon = new FitAddon()
            term.loadAddon(fitAddon)
            term.loadAddon(new WebLinksAddon())
            term.open(container)

            try {
                const webglAddon = new WebglAddon()
                term.loadAddon(webglAddon)
                webglAddon.onContextLoss(() => webglAddon.dispose())
            } catch { }

            term.onData(data => window.electronAPI.writeTerminal(id, data))
            terminalRefs.current.set(id, term)
            addonRefs.current.set(id, fitAddon)

            try { fitAddon.fit() } catch { }
            await window.electronAPI.createTerminal({ id, cwd, shell: shellPath })
            const dims = fitAddon.proposeDimensions()
            if (dims && dims.cols > 0 && dims.rows > 0) window.electronAPI.resizeTerminal(id, dims.cols, dims.rows)

            term.registerLinkProvider({
                provideLinks(bufferLineNumber, callback) {
                    const line = term.buffer.active.getLine(bufferLineNumber - 1)
                    if (!line) return callback([])
                    const text = line.translateToString(true)
                    const regex = /(?:^|\s|")((?:[a-zA-Z]:[\\/]|[.\/])[\w\-.\\/ ]+\.[a-zA-Z0-9]+)(?::(\d+))?(?::(\d+))?/g
                    let match
                    const links = []
                    while ((match = regex.exec(text)) !== null) {
                        const [fullMatch, filePath, lineNum, colNum] = match
                        const startIndex = match.index + fullMatch.indexOf(filePath)
                        links.push({
                            range: { start: { x: startIndex + 1, y: bufferLineNumber }, end: { x: startIndex + filePath.length + 1, y: bufferLineNumber } },
                            text: fullMatch,
                            activate: async () => {
                                const fullPath = filePath.startsWith('.') ? `${cwd}/${filePath}`.replace(/\\/g, '/') : filePath
                                const content = await window.electronAPI.readFile(fullPath)
                                if (content !== null) {
                                    useStore.getState().openFile(fullPath, content)
                                    if (lineNum) setTimeout(() => window.dispatchEvent(new CustomEvent('editor:goto-line', { detail: { line: parseInt(lineNum), column: colNum ? parseInt(colNum) : 1 } })), 100)
                                }
                            }
                        })
                    }
                    callback(links)
                }
            })
        }, 50)
    }

    const closeTerminal = (id: string, e?: React.MouseEvent) => {
        e?.stopPropagation()
        terminalRefs.current.get(id)?.dispose()
        terminalRefs.current.delete(id)
        addonRefs.current.delete(id)
        containerRefs.current.delete(id)
        outputBuffers.current.delete(id)
        window.electronAPI.killTerminal(id)
        setTerminals(prev => {
            const next = prev.filter(t => t.id !== id)
            if (activeId === id) setActiveId(next.length > 0 ? next[next.length - 1].id : null)
            if (next.length <= 1) setIsSplitView(false)
            return next
        })
    }

    const handleFixWithAI = () => {
        if (!activeId) return
        const term = terminalRefs.current.get(activeId)
        if (!term) return
        const selectedText = term.getSelection()?.trim()
        const content = selectedText || (outputBuffers.current.get(activeId) || []).join('').replace(/\u001b\[[0-9;]*m/g, '').slice(-2000).trim()
        if (!content) return
        setChatMode('chat')
        setInputPrompt(`I'm getting this error in the terminal. Please analyze it and fix the code:\n\n\`\`\`\n${content}\n\`\`\``)
    }

    const runScript = async (name: string) => {
        setShowScriptMenu(false)
        if (!terminalVisible) setTerminalVisible(true)
        if (!activeId && terminals.length === 0) await createTerminal()
        const targetId = activeId || terminals[terminals.length - 1]?.id
        if (targetId) {
            terminalRefs.current.get(targetId)?.focus()
            window.electronAPI.writeTerminal(targetId, `npm run ${name}\r`)
        }
    }

    if (!terminalVisible) return null

    return (
        <>
            <style>{XTERM_STYLE}</style>
            <div className="bg-transparent flex flex-col transition-none relative z-10" style={{ height: isCollapsed ? 40 : height }}>
                <div className="absolute top-0 left-0 right-0 h-1 cursor-row-resize z-50 hover:bg-accent/50 transition-colors" onMouseDown={startResizing} />
                <div className="h-10 min-h-[40px] flex items-center justify-between border-b border-border-subtle bg-background/40 backdrop-blur-md select-none relative z-20">
                    {/* Left Section: Icon & Tabs */}
                    <div className="flex items-center flex-1 min-w-0 overflow-hidden h-full">
                        <div className="flex-shrink-0 flex items-center justify-center px-3 cursor-pointer hover:text-text-primary text-text-muted transition-colors h-full" onClick={() => setIsCollapsed(!isCollapsed)}>
                            <TerminalIcon className="w-3.5 h-3.5" />
                        </div>
                        <div className="flex items-center overflow-x-auto no-scrollbar flex-1 h-full pl-1">
                            {terminals.map(term => (
                                <div key={term.id} onClick={() => setActiveId(term.id)} className={`relative flex items-center gap-2 px-3 h-full my-auto text-xs cursor-pointer min-w-[120px] max-w-[200px] flex-shrink-0 group transition-all mr-1 border-r border-white/5 ${activeId === term.id ? 'bg-surface/50 text-text-primary' : 'text-text-muted hover:bg-surface-hover/50 hover:text-text-secondary'}`}>
                                    <span className="truncate flex-1">{term.name}</span>
                                    {activeId === term.id && <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-accent shadow-[0_0_8px_rgba(139,92,246,0.6)]" />}
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={(e) => closeTerminal(term.id, e)}
                                        className="h-4 w-4 opacity-0 group-hover:opacity-100 text-text-muted hover:text-red-400 hover:bg-white/10"
                                    >
                                        <X className="w-3 h-3" />
                                    </Button>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Middle Section: Root Selector & New Terminal */}
                    <div className="relative flex-shrink-0 h-full flex items-center px-1 gap-1 border-l border-white/5 mx-1">
                        {workspace && workspace.roots.length > 1 && (
                            <div className="w-[120px]">
                                <Select
                                    value={selectedRoot}
                                    onChange={setSelectedRoot}
                                    options={workspace.roots.map(root => ({ value: root, label: root.split(/[\\/]/).pop() || root }))}
                                    className="h-7 text-xs border-transparent bg-transparent hover:bg-white/5"
                                />
                            </div>
                        )}
                        <div className="relative">
                            <Button
                                ref={shellButtonRef}
                                variant="ghost"
                                size="icon"
                                onClick={() => setShowShellMenu(!showShellMenu)}
                                className="h-7 w-7"
                            >
                                <Plus className="w-3.5 h-3.5" />
                            </Button>
                            {showShellMenu && (
                                <div ref={shellMenuRef} className="absolute bottom-full left-0 mb-2 w-48 bg-surface border border-border-subtle rounded-lg shadow-xl py-1 flex flex-col max-h-64 overflow-y-auto z-[100] animate-scale-in">
                                    {availableShells.map(shell => (
                                        <button key={shell.label} onClick={() => createTerminal(shell.path, shell.label)} className="text-left px-3 py-2 text-xs text-text-primary hover:bg-surface-hover w-full transition-colors">
                                            {shell.label}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right Section: Actions */}
                    <div className="flex items-center gap-1 px-2 flex-shrink-0">
                        <div className="relative">
                            <Button
                                ref={scriptButtonRef}
                                variant="ghost"
                                size="sm"
                                onClick={() => setShowScriptMenu(!showScriptMenu)}
                                className="h-7 px-2 gap-1.5 text-xs font-normal"
                                title="Run Task"
                            >
                                <Play className="w-3.5 h-3.5" />
                                Run
                            </Button>
                            {showScriptMenu && (
                                <div ref={scriptMenuRef} className="absolute bottom-full right-0 mb-2 bg-surface border border-border-subtle rounded-lg shadow-xl py-1 flex flex-col max-h-64 overflow-y-auto z-[100] min-w-[180px] animate-scale-in">
                                    {Object.keys(scripts).length > 0 ? Object.entries(scripts).map(([name, cmd]) => (
                                        <button key={name} onClick={() => runScript(name)} className="text-left px-3 py-2 text-xs text-text-primary hover:bg-surface-hover flex flex-col gap-0.5 border-b border-border-subtle/50 last:border-0 w-full transition-colors">
                                            <span className="font-medium text-accent">{name}</span>
                                            <span className="text-[10px] text-text-muted truncate max-w-[200px] opacity-70 font-mono">{cmd}</span>
                                        </button>
                                    )) : <div className="px-3 py-2 text-xs text-text-muted italic">No scripts found</div>}
                                </div>
                            )}
                        </div>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleFixWithAI}
                            className="h-7 px-2 gap-1.5 text-xs font-normal mr-2"
                            title="Fix with AI"
                        >
                            <Sparkles className="w-3.5 h-3.5" />
                            Fix
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => { createTerminal(); setIsSplitView(true); }} className="h-7 w-7" title="Split Terminal"><SplitSquareHorizontal className="w-3.5 h-3.5" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => setIsSplitView(!isSplitView)} className={`h-7 w-7 ${isSplitView ? 'text-accent' : ''}`} title="Toggle Split View"><LayoutTemplate className="w-3.5 h-3.5" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => activeId && terminalRefs.current.get(activeId)?.clear()} className="h-7 w-7" title="Clear"><Trash2 className="w-3.5 h-3.5" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => setIsCollapsed(!isCollapsed)} className="h-7 w-7">{isCollapsed ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}</Button>
                        <Button variant="ghost" size="icon" onClick={() => setTerminalVisible(false)} className="h-7 w-7" title="Close"><X className="w-3.5 h-3.5" /></Button>
                    </div>
                </div>
                <div className={`flex-1 p-0 min-h-0 relative bg-surface/30 backdrop-blur-sm ${isCollapsed ? 'hidden' : 'block'}`}>
                    <div className={`h-full w-full ${isSplitView ? 'grid grid-cols-2 gap-1' : ''}`}>
                        {terminals.map(term => (
                            <div key={term.id} ref={el => { if (el) containerRefs.current.set(term.id, el) }} className={`h-full w-full pl-2 pt-1 relative group/term ${isSplitView ? 'border border-border-subtle' : (activeId === term.id ? 'block' : 'hidden')} ${isSplitView && activeId === term.id ? 'ring-1 ring-accent' : ''}`} onClick={() => setActiveId(term.id)}>
                                {isSplitView && (
                                    <div className="absolute top-0 right-0 p-1 z-10 opacity-0 group-hover/term:opacity-100 transition-opacity">
                                        <Button variant="ghost" size="icon" onClick={(e) => closeTerminal(term.id, e)} className="h-6 w-6 bg-background/80 hover:bg-red-500 hover:text-white"><X className="w-3 h-3" /></Button>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </>
    )
}