/**
 * WorkspaceDropdown - IDEA风格工作区下拉菜单
 * 显示当前工作区并提供快速切换功能
 */
import { logger } from '@utils/Logger'
import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Plus, FolderOpen, History, Folder } from 'lucide-react'
import { useStore } from '@store'
import { adnifyDir } from '@services/adnifyDirService'

interface RecentWorkspace {
    path: string
    name: string
}

export default function WorkspaceDropdown() {
    const { workspace, setWorkspace, setFiles } = useStore()
    const [isOpen, setIsOpen] = useState(false)
    const [recentWorkspaces, setRecentWorkspaces] = useState<RecentWorkspace[]>([])
    const containerRef = useRef<HTMLDivElement>(null)

    // 获取当前工作区显示名称
    const currentWorkspaceName = workspace?.roots[0]
        ? workspace.roots[0].split(/[\\/]/).pop() || 'Workspace'
        : 'No Workspace'

    // 加载最近工作区列表
    useEffect(() => {
        async function loadRecent() {
            try {
                const recent = await window.electronAPI.getRecentWorkspaces()
                setRecentWorkspaces(
                    recent.map((path: string) => ({
                        path,
                        name: path.split(/[\\/]/).pop() || path,
                    }))
                )
            } catch (e) {
                logger.ui.error('[WorkspaceDropdown] Failed to load recent workspaces:', e)
            }
        }
        if (isOpen) {
            loadRecent()
        }
    }, [isOpen])

    // 点击外部关闭
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    // 打开文件夹
    const handleOpenFolder = async () => {
        setIsOpen(false)
        const result = await window.electronAPI.openFolder()
        if (result && typeof result === 'string') {
            // 正常打开文件夹
            await adnifyDir.setPrimaryRoot(result)
            setWorkspace({ configPath: null, roots: [result] })
            const items = await window.electronAPI.readDir(result)
            setFiles(items)
        }
        // 如果返回 { redirected: true }，说明已聚焦到其他窗口，无需处理
    }

    // 打开工作区
    const handleOpenWorkspace = async () => {
        setIsOpen(false)
        const result = await window.electronAPI.openWorkspace()
        if (result && !('redirected' in result)) {
            if (result.roots.length > 0) {
                await adnifyDir.setPrimaryRoot(result.roots[0])
            }
            setWorkspace(result)
            if (result.roots.length > 0) {
                const items = await window.electronAPI.readDir(result.roots[0])
                setFiles(items)
            }
        }
    }

    // 新建窗口
    const handleNewWindow = () => {
        setIsOpen(false)
        window.electronAPI.newWindow()
    }

    // 添加文件夹到工作区
    const handleAddFolder = async () => {
        setIsOpen(false)
        const path = await window.electronAPI.addFolderToWorkspace()
        if (path) {
            const { addRoot } = useStore.getState()
            addRoot(path)
            // 初始化新根目录的 .adnify
            await adnifyDir.initialize(path)
        }
    }

    const handleOpenRecent = async (path: string) => {
        setIsOpen(false)
        // 切换主根目录，确保状态保存到正确的 .adnify 目录
        await adnifyDir.setPrimaryRoot(path)
        // 通知主进程保存活动工作区并设置窗口映射
        await window.electronAPI.setActiveWorkspace([path])
        // 设置渲染进程状态
        setWorkspace({ configPath: null, roots: [path] })
        try {
            const items = await window.electronAPI.readDir(path)
            setFiles(items)
        } catch (e) {
            logger.ui.error('[WorkspaceDropdown] Failed to open recent workspace:', e)
        }
    }

    return (
        <div ref={containerRef} className="relative">
            {/* 触发按钮 */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-surface-hover transition-colors text-xs group"
            >
                <Folder className="w-3.5 h-3.5 text-accent" />
                <span className="text-text-primary font-medium max-w-32 truncate">
                    {currentWorkspaceName}
                </span>
                <ChevronDown
                    className={`w-3 h-3 text-text-muted transition-transform duration-200 ${isOpen ? 'rotate-180' : ''
                        }`}
                />
            </button>

            {/* 下拉菜单 */}
            {isOpen && (
                <div className="absolute top-full left-0 mt-1 w-64 py-1 bg-surface border border-border-subtle rounded-md shadow-xl z-50 animate-fade-in">
                    {/* 操作按钮 */}
                    <button
                        onClick={handleNewWindow}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-text-secondary hover:bg-surface-hover hover:text-text-primary transition-colors"
                    >
                        <Plus className="w-4 h-4" />
                        <span>新建窗口</span>
                    </button>

                    <button
                        onClick={handleOpenFolder}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-text-secondary hover:bg-surface-hover hover:text-text-primary transition-colors"
                    >
                        <FolderOpen className="w-4 h-4" />
                        <span>打开文件夹</span>
                    </button>

                    <button
                        onClick={handleOpenWorkspace}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-text-secondary hover:bg-surface-hover hover:text-text-primary transition-colors"
                    >
                        <Folder className="w-4 h-4" />
                        <span>打开工作区</span>
                    </button>

                    <button
                        onClick={handleAddFolder}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-text-secondary hover:bg-surface-hover hover:text-text-primary transition-colors"
                    >
                        <Plus className="w-4 h-4" />
                        <span>添加文件夹到工作区</span>
                    </button>

                    {/* 分隔线 */}
                    {recentWorkspaces.length > 0 && (
                        <>
                            <div className="h-px bg-border-subtle my-1" />

                            {/* 最近打开标题 */}
                            <div className="flex items-center gap-2 px-3 py-1.5 text-xs text-text-muted">
                                <History className="w-3 h-3" />
                                <span>最近打开</span>
                            </div>

                            {/* 最近工作区列表 */}
                            {recentWorkspaces
                                .filter((w) => w.path !== workspace?.roots[0]) // 排除当前工作区
                                .slice(0, 5) // 最多显示5个
                                .map((recent) => (
                                    <button
                                        key={recent.path}
                                        onClick={() => handleOpenRecent(recent.path)}
                                        className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-text-secondary hover:bg-surface-hover hover:text-text-primary transition-colors group"
                                        title={recent.path}
                                    >
                                        <Folder className="w-4 h-4 text-text-muted group-hover:text-accent" />
                                        <span className="truncate">{recent.name}</span>
                                    </button>
                                ))}
                        </>
                    )}
                </div>
            )}
        </div>
    )
}
