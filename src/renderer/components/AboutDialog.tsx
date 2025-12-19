/**
 * About Dialog
 * 显示应用信息、版本、链接等
 */

import { useState, useEffect } from 'react'
import { X, Github, ExternalLink, Heart, Code2, Sparkles } from 'lucide-react'
import { Logo } from './Logo'
import { useStore } from '../store'
import { Modal } from './ui'


interface AboutDialogProps {
    onClose: () => void
}

export default function AboutDialog({ onClose }: AboutDialogProps) {
    const { language } = useStore()
    const [version, setVersion] = useState('1.0.0')
    const [electronVersion, setElectronVersion] = useState('')
    const [nodeVersion, setNodeVersion] = useState('')
    const [chromeVersion, setChromeVersion] = useState('')

    useEffect(() => {
        // 获取版本信息
        const loadVersions = async () => {
            try {
                const appVersion = await window.electronAPI?.getAppVersion?.()
                if (appVersion) setVersion(appVersion)
            } catch (e) {
                console.error('Failed to get app version:', e)
            }

            // Electron 进程版本
            if (typeof process !== 'undefined' && process.versions) {
                setElectronVersion(process.versions.electron || '')
                setNodeVersion(process.versions.node || '')
                setChromeVersion(process.versions.chrome || '')
            }
        }
        loadVersions()
    }, [])

    return (
        <Modal isOpen={true} onClose={onClose} noPadding size="sm">
            {/* Header */}
            <div className="relative px-6 pt-8 pb-6 bg-gradient-to-br from-accent/10 to-transparent">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-2 rounded-lg hover:bg-surface-hover text-text-muted hover:text-text-primary transition-colors"
                >
                    <X className="w-5 h-5" />
                </button>

                <div className="flex flex-col items-center gap-4">
                    <div className="w-20 h-20 bg-gradient-to-br from-accent to-accent/60 rounded-2xl flex items-center justify-center shadow-lg shadow-accent/20">
                        <Logo className="w-12 h-12 text-white" />
                    </div>
                    <div className="text-center">
                        <h1 className="text-2xl font-bold text-text-primary">Adnify</h1>
                        <p className="text-sm text-text-muted mt-1">
                            {language === 'zh' ? 'AI 驱动的代码编辑器' : 'AI-Powered Code Editor'}
                        </p>
                    </div>
                </div>
            </div>

            {/* Version Info */}
            <div className="px-6 py-4 border-t border-border-subtle">
                <div className="flex items-center justify-between py-2">
                    <span className="text-sm text-text-muted">Version</span>
                    <span className="text-sm font-medium text-text-primary">{version}</span>
                </div>
                {electronVersion && (
                    <div className="flex items-center justify-between py-2">
                        <span className="text-sm text-text-muted">Electron</span>
                        <span className="text-sm text-text-secondary">{electronVersion}</span>
                    </div>
                )}
                {nodeVersion && (
                    <div className="flex items-center justify-between py-2">
                        <span className="text-sm text-text-muted">Node.js</span>
                        <span className="text-sm text-text-secondary">{nodeVersion}</span>
                    </div>
                )}
                {chromeVersion && (
                    <div className="flex items-center justify-between py-2">
                        <span className="text-sm text-text-muted">Chrome</span>
                        <span className="text-sm text-text-secondary">{chromeVersion}</span>
                    </div>
                )}
            </div>

            {/* Features */}
            <div className="px-6 py-4 border-t border-border-subtle">
                <div className="grid grid-cols-3 gap-3">
                    <div className="flex flex-col items-center gap-2 p-3 rounded-lg bg-surface-hover/50">
                        <Sparkles className="w-5 h-5 text-accent" />
                        <span className="text-xs text-text-muted text-center">AI Agent</span>
                    </div>
                    <div className="flex flex-col items-center gap-2 p-3 rounded-lg bg-surface-hover/50">
                        <Code2 className="w-5 h-5 text-green-400" />
                        <span className="text-xs text-text-muted text-center">
                            {language === 'zh' ? '代码补全' : 'Completion'}
                        </span>
                    </div>
                    <div className="flex flex-col items-center gap-2 p-3 rounded-lg bg-surface-hover/50">
                        <Heart className="w-5 h-5 text-red-400" />
                        <span className="text-xs text-text-muted text-center">
                            {language === 'zh' ? '开源' : 'Open Source'}
                        </span>
                    </div>
                </div>
            </div>

            {/* Links */}
            <div className="px-6 py-4 border-t border-border-subtle">
                <div className="flex gap-3">
                    <a
                        href="https://github.com/AInfinityLikeYou/adnify"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-surface-hover hover:bg-surface-active text-text-primary transition-colors"
                    >
                        <Github className="w-4 h-4" />
                        <span className="text-sm">GitHub</span>
                    </a>
                    <a
                        href="https://adnify.dev"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-surface-hover hover:bg-surface-active text-text-primary transition-colors"
                    >
                        <ExternalLink className="w-4 h-4" />
                        <span className="text-sm">{language === 'zh' ? '官网' : 'Website'}</span>
                    </a>
                </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-border-subtle text-center">
                <p className="text-xs text-text-muted">
                    © {new Date().getFullYear()} Adnify. {language === 'zh' ? '保留所有权利' : 'All rights reserved'}.
                </p>
            </div>
        </Modal>
    )
}
