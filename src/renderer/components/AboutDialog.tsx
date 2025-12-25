/**
 * About Dialog
 * 显示应用信息、版本、链接等
 */

import { logger } from '@utils/Logger'
import { useState, useEffect } from 'react'
import { X, Github, ExternalLink, Code2, Sparkles } from 'lucide-react'
import { Logo } from './Logo'
import { useStore } from '@store'
import { Modal } from './ui'


interface AboutDialogProps {
    onClose: () => void
}

export default function AboutDialog({ onClose }: AboutDialogProps) {
    const { language } = useStore()
    const [version, setVersion] = useState('1.0.0')

    useEffect(() => {
        const loadVersions = async () => {
            try {
                const appVersion = await window.electronAPI?.getAppVersion?.()
                if (appVersion) setVersion(appVersion)
            } catch (e) {
                logger.ui.error('Failed to get app version:', e)
            }
        }
        loadVersions()
    }, [])

    return (
        <Modal isOpen={true} onClose={onClose} noPadding size="3xl">
            <div className="relative overflow-hidden bg-background/40 backdrop-blur-3xl flex h-[520px]">
                {/* Background Decoration */}
                <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute top-[-20%] right-[-10%] w-[800px] h-[800px] bg-accent/10 rounded-full blur-[140px]" />
                    <div className="absolute bottom-[-10%] left-[-10%] w-[600px] h-[600px] bg-purple-500/5 rounded-full blur-[120px]" />
                </div>

                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-6 right-6 z-50 p-2 rounded-xl hover:bg-surface/20 text-text-muted hover:text-text-primary transition-all duration-300"
                >
                    <X className="w-5 h-5" />
                </button>

                {/* Left Column: Branding & Origin */}
                <div className="relative w-[40%] border-r border-border-subtle flex flex-col p-10 bg-gradient-to-b from-surface/5 to-transparent">
                    <div className="flex flex-col items-center text-center space-y-6 mt-4">
                        <div className="relative group">
                            <div className="absolute inset-0 bg-accent/20 blur-3xl rounded-full group-hover:bg-accent/30 transition-all duration-700" />
                            <div className="relative w-24 h-24 bg-surface/40 backdrop-blur-2xl rounded-[2rem] border border-border-subtle flex items-center justify-center shadow-2xl transform group-hover:scale-105 transition-transform duration-500">
                                <Logo className="w-14 h-14 text-accent" glow />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <h1 className="text-4xl font-black text-text-primary tracking-tighter">
                                ADNIFY
                            </h1>
                            <p className="text-xs font-bold text-accent/80 tracking-[0.2em] uppercase">
                                {language === 'zh' ? '下一代 AI 编辑器' : 'Next-Gen AI Editor'}
                            </p>
                        </div>
                    </div>

                    <div className="mt-auto space-y-4">
                        <h3 className="text-[10px] font-black text-text-primary flex items-center gap-2 uppercase tracking-[0.2em] opacity-40">
                            <Sparkles className="w-3 h-3 text-accent" />
                            {language === 'zh' ? '创造由来' : 'The Origin'}
                        </h3>
                        <p className="text-sm text-text-muted leading-relaxed font-medium opacity-80">
                            {language === 'zh'
                                ? 'Adnify 诞生于一个纯粹的想法：如果编辑器不再仅仅是一个写代码的工具，而是一个能够理解整个项目脉络的合作伙伴？adnaan 希望打造一个能够填补原生 AI 能力与极致开发者体验之间鸿沟的产品。'
                                : 'Adnify was born from a simple idea: what if an editor wasn\'t just a tool for writing code, but a partner that understands the entire project context? adnaan wanted to build something that bridges the gap between raw AI power and a seamless developer experience.'}
                        </p>
                    </div>
                </div>

                {/* Right Column: Comparison & Actions */}
                <div className="relative flex-1 flex flex-col p-10 overflow-y-auto custom-scrollbar">
                    <div className="space-y-8">
                        {/* Comparison */}
                        <section className="space-y-4">
                            <h3 className="text-[10px] font-black text-text-primary flex items-center gap-2 uppercase tracking-[0.2em] opacity-40">
                                <Code2 className="w-3 h-3 text-accent" />
                                {language === 'zh' ? '为什么选择 ADNIFY' : 'Why ADNIFY'}
                            </h3>
                            <div className="grid grid-cols-1 gap-3">
                                {[
                                    {
                                        name: 'VS Code',
                                        desc: language === 'zh' ? '拥有庞大的生态，但 AI 往往只是插件或事后补丁。Adnify 从底层开始就为 AI 而生。' : 'Great ecosystem, but AI is often an afterthought or a plugin. Adnify is built with AI at its core.'
                                    },
                                    {
                                        name: 'Cursor',
                                        desc: language === 'zh' ? '优秀的 AI 集成，但 Adnify 追求更极致的“深空”美学和更深度的 Agent 工作流集成。' : 'Excellent AI integration, but Adnify focuses on a more "Deep Space" aesthetic and a more integrated agentic workflow.'
                                    },
                                    {
                                        name: 'Windsurf',
                                        desc: language === 'zh' ? '功能强大，但 Adnify 致力于提供更轻量、更具视觉冲击力的交互体验。' : 'Powerful, but Adnify aims for a more lightweight and visually stunning experience.'
                                    }
                                ].map((item) => (
                                    <div key={item.name} className="group p-4 rounded-2xl bg-surface/10 border border-border-subtle hover:border-border transition-all duration-300 hover:bg-surface/20 flex items-start gap-4">
                                        <div className="shrink-0 px-2 py-1 rounded-lg bg-accent/10 text-[9px] text-accent font-black uppercase tracking-tighter border border-accent/20">VS</div>
                                        <div className="space-y-1">
                                            <span className="text-xs font-bold text-text-primary">{item.name}</span>
                                            <p className="text-[11px] text-text-muted leading-relaxed opacity-60 group-hover:opacity-80 transition-opacity">{item.desc}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>

                        {/* Author & Version */}
                        <div className="flex items-center justify-between pt-6 border-t border-border-subtle">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-accent/20 to-purple-500/20 border border-border-subtle flex items-center justify-center text-xs font-bold text-accent shadow-lg shadow-accent/10">
                                    AD
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-text-primary">adnaan</p>
                                    <p className="text-[10px] text-text-muted opacity-50 uppercase tracking-widest font-black">Creator & Lead</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-sm font-bold text-text-primary">v{version}</p>
                                <p className="text-[10px] text-text-muted opacity-50 uppercase tracking-widest font-black">Stable Release</p>
                            </div>
                        </div>

                        {/* Footer Actions */}
                        <div className="flex gap-3">
                            <a
                                href="https://github.com/AInfinityLikeYou/adnify"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-surface/40 hover:bg-surface/60 border border-border-subtle text-text-primary transition-all duration-300 group"
                            >
                                <Github className="w-4 h-4 group-hover:scale-110 transition-transform" />
                                <span className="text-sm font-bold">GitHub</span>
                            </a>
                            <a
                                href="https://adnify.dev"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-accent/10 hover:bg-accent/20 border border-accent/20 text-accent transition-all duration-300 group"
                            >
                                <ExternalLink className="w-4 h-4 group-hover:scale-110 transition-transform" />
                                <span className="text-sm font-bold">{language === 'zh' ? '访问官网' : 'Website'}</span>
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        </Modal>
    )
}
