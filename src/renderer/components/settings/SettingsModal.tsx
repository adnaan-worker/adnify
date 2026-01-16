/**
 * 设置模态框主组件
 * 管理设置标签页切换和状态同步
 */

import { useState, useEffect } from 'react'
import { Cpu, Settings2, Code, Keyboard, Database, Shield, Monitor, Globe, Plug, Braces, Brain, FileCode, Check } from 'lucide-react'
import { useStore } from '@store'
import { PROVIDERS } from '@/shared/config/providers'
import { getEditorConfig, saveEditorConfig } from '@renderer/settings'
import KeybindingPanel from '@components/panels/KeybindingPanel'
import { Button, Modal, Select } from '@components/ui'
import { SettingsTab, EditorSettingsState, LANGUAGES } from './types'
import {
    ProviderSettings,
    EditorSettings,
    AgentSettings,
    RulesMemorySettings,
    SecuritySettings,
    IndexSettings,
    SystemSettings,
    McpSettings,
    LspSettings,
    SnippetSettings
} from './tabs'

export default function SettingsModal() {
    const {
        llmConfig, language, autoApprove, providerConfigs, promptTemplateId,
        agentConfig, aiInstructions, webSearchConfig, mcpConfig,
        set, setProvider, setShowSettings, save
    } = useStore()

    const [activeTab, setActiveTab] = useState<SettingsTab>('provider')
    const [showApiKey, setShowApiKey] = useState(false)
    const [localConfig, setLocalConfig] = useState(llmConfig)
    const [localLanguage, setLocalLanguage] = useState(language)
    const [localAutoApprove, setLocalAutoApprove] = useState(autoApprove)
    const [localPromptTemplateId, setLocalPromptTemplateId] = useState(promptTemplateId)
    const [localAgentConfig, setLocalAgentConfig] = useState(agentConfig)
    const [localProviderConfigs, setLocalProviderConfigs] = useState(providerConfigs)
    const [localAiInstructions, setLocalAiInstructions] = useState(aiInstructions)
    const [localWebSearchConfig, setLocalWebSearchConfig] = useState(webSearchConfig)
    const [localMcpConfig, setLocalMcpConfig] = useState(mcpConfig)
    const [saved, setSaved] = useState(false)

    const editorConfig = getEditorConfig()
    const [editorSettings, setEditorSettings] = useState<EditorSettingsState>({
        fontSize: editorConfig.fontSize,
        tabSize: editorConfig.tabSize,
        wordWrap: editorConfig.wordWrap,
        lineNumbers: editorConfig.lineNumbers,
        minimap: editorConfig.minimap,
        bracketPairColorization: editorConfig.bracketPairColorization,
        formatOnSave: editorConfig.formatOnSave,
        autoSave: editorConfig.autoSave,
        autoSaveDelay: editorConfig.autoSaveDelay,
        theme: 'adnify-dark',
        completionEnabled: editorConfig.ai.completionEnabled,
        completionDebounceMs: editorConfig.performance.completionDebounceMs,
        completionMaxTokens: editorConfig.ai.completionMaxTokens,
        completionTriggerChars: editorConfig.ai.completionTriggerChars,
        terminalScrollback: editorConfig.terminal.scrollback,
        terminalMaxOutputLines: editorConfig.terminal.maxOutputLines,
        lspTimeoutMs: editorConfig.lsp.timeoutMs,
        lspCompletionTimeoutMs: editorConfig.lsp.completionTimeoutMs,
        largeFileWarningThresholdMB: editorConfig.performance.largeFileWarningThresholdMB,
        largeFileLineCount: editorConfig.performance.largeFileLineCount,
        commandTimeoutMs: editorConfig.performance.commandTimeoutMs,
        workerTimeoutMs: editorConfig.performance.workerTimeoutMs,
        healthCheckTimeoutMs: editorConfig.performance.healthCheckTimeoutMs,
        maxProjectFiles: editorConfig.performance.maxProjectFiles,
        maxFileTreeDepth: editorConfig.performance.maxFileTreeDepth,
        maxSearchResults: editorConfig.performance.maxSearchResults,
        saveDebounceMs: editorConfig.performance.saveDebounceMs,
        flushIntervalMs: editorConfig.performance.flushIntervalMs,
    })

    useEffect(() => { setLocalConfig(llmConfig) }, [llmConfig])
    useEffect(() => { setLocalProviderConfigs(providerConfigs) }, [providerConfigs])
    useEffect(() => { setLocalLanguage(language) }, [language])
    useEffect(() => { setLocalAutoApprove(autoApprove) }, [autoApprove])
    useEffect(() => { setLocalAgentConfig(agentConfig) }, [agentConfig])
    useEffect(() => { setLocalAiInstructions(aiInstructions) }, [aiInstructions])
    useEffect(() => { setLocalWebSearchConfig(webSearchConfig) }, [webSearchConfig])
    useEffect(() => { setLocalMcpConfig(mcpConfig) }, [mcpConfig])

    const handleSave = async () => {
        // 合并当前 provider 的配置
        const currentProviderLocalConfig = localProviderConfigs[localConfig.provider] || {}
        const finalProviderConfigs = {
            ...localProviderConfigs,
            [localConfig.provider]: {
                ...currentProviderLocalConfig,
                apiKey: localConfig.apiKey,
                baseUrl: localConfig.baseUrl,
                timeout: localConfig.timeout,
                model: localConfig.model,
                adapterConfig: currentProviderLocalConfig.adapterConfig || localConfig.adapterConfig,
                advanced: currentProviderLocalConfig.advanced,
            }
        }

        // 更新 Store 状态
        set('llmConfig', localConfig)
        set('language', localLanguage)
        set('autoApprove', localAutoApprove)
        set('promptTemplateId', localPromptTemplateId)
        set('agentConfig', localAgentConfig)
        set('aiInstructions', localAiInstructions)
        set('webSearchConfig', localWebSearchConfig)
        set('mcpConfig', localMcpConfig)

        // 批量更新所有 provider configs
        for (const [providerId, config] of Object.entries(finalProviderConfigs)) {
            setProvider(providerId, config)
        }

        // 编辑器配置独立保存
        const newEditorConfig = {
            ...getEditorConfig(),
            fontSize: editorSettings.fontSize,
            tabSize: editorSettings.tabSize,
            wordWrap: editorSettings.wordWrap,
            lineNumbers: editorSettings.lineNumbers,
            minimap: editorSettings.minimap,
            bracketPairColorization: editorSettings.bracketPairColorization,
            formatOnSave: editorSettings.formatOnSave,
            autoSave: editorSettings.autoSave,
            autoSaveDelay: editorSettings.autoSaveDelay,
            ai: {
                ...getEditorConfig().ai,
                completionEnabled: editorSettings.completionEnabled,
                completionMaxTokens: editorSettings.completionMaxTokens,
                completionTriggerChars: editorSettings.completionTriggerChars,
            },
            terminal: {
                ...getEditorConfig().terminal,
                scrollback: editorSettings.terminalScrollback,
                maxOutputLines: editorSettings.terminalMaxOutputLines,
            },
            lsp: {
                ...getEditorConfig().lsp,
                timeoutMs: editorSettings.lspTimeoutMs,
                completionTimeoutMs: editorSettings.lspCompletionTimeoutMs,
            },
            performance: {
                ...getEditorConfig().performance,
                completionDebounceMs: editorSettings.completionDebounceMs,
                largeFileWarningThresholdMB: editorSettings.largeFileWarningThresholdMB,
                largeFileLineCount: editorSettings.largeFileLineCount,
                commandTimeoutMs: editorSettings.commandTimeoutMs,
                workerTimeoutMs: editorSettings.workerTimeoutMs,
                healthCheckTimeoutMs: editorSettings.healthCheckTimeoutMs,
                maxProjectFiles: editorSettings.maxProjectFiles,
                maxFileTreeDepth: editorSettings.maxFileTreeDepth,
                maxSearchResults: editorSettings.maxSearchResults,
                saveDebounceMs: editorSettings.saveDebounceMs,
                flushIntervalMs: editorSettings.flushIntervalMs,
            }
        }
        saveEditorConfig(newEditorConfig)

        // 保存到文件
        await save()

        // 应用网络搜索配置到主进程
        if (localWebSearchConfig.googleApiKey && localWebSearchConfig.googleCx) {
            window.electronAPI?.httpSetGoogleSearch?.(localWebSearchConfig.googleApiKey, localWebSearchConfig.googleCx)
        }

        // 同步 MCP 自动连接设置到主进程
        window.electronAPI?.mcpSetAutoConnect?.(localMcpConfig.autoConnect ?? true)

        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
    }

    const providers = Object.entries(PROVIDERS).map(([id, p]) => ({
        id,
        name: p.name,
        models: [...(p.models || []), ...(providerConfigs[id]?.customModels || [])]
    }))
    const selectedProvider = providers.find(p => p.id === localConfig.provider)

    const tabs: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
        { id: 'provider', label: language === 'zh' ? '模型提供商' : 'Providers', icon: <Cpu className="w-4 h-4" /> },
        { id: 'editor', label: language === 'zh' ? '编辑器' : 'Editor', icon: <Code className="w-4 h-4" /> },
        { id: 'snippets', label: language === 'zh' ? '代码片段' : 'Snippets', icon: <FileCode className="w-4 h-4" /> },
        { id: 'agent', label: language === 'zh' ? '智能体' : 'Agent', icon: <Settings2 className="w-4 h-4" /> },
        { id: 'rules', label: language === 'zh' ? '规则与记忆' : 'Rules & Memory', icon: <Brain className="w-4 h-4" /> },
        { id: 'mcp', label: 'MCP', icon: <Plug className="w-4 h-4" /> },
        { id: 'lsp', label: language === 'zh' ? '语言服务' : 'LSP', icon: <Braces className="w-4 h-4" /> },
        { id: 'keybindings', label: language === 'zh' ? '快捷键' : 'Keybindings', icon: <Keyboard className="w-4 h-4" /> },
        { id: 'indexing', label: language === 'zh' ? '代码索引' : 'Indexing', icon: <Database className="w-4 h-4" /> },
        { id: 'security', label: language === 'zh' ? '安全设置' : 'Security', icon: <Shield className="w-4 h-4" /> },
        { id: 'system', label: language === 'zh' ? '系统' : 'System', icon: <Monitor className="w-4 h-4" /> },
    ]

    return (
        <Modal isOpen={true} onClose={() => setShowSettings(false)} title="" size="5xl" noPadding className="overflow-hidden bg-background border border-border/50 shadow-2xl">
            <div className="flex h-[75vh] max-h-[800px]">
                {/* Sidebar */}
                <div className="w-64 bg-surface/5 backdrop-blur-xl border-r border-border flex flex-col pt-6 pb-4">
                    <div className="px-6 mb-6">
                        <h2 className="text-lg font-semibold text-text-primary tracking-tight flex items-center gap-2">
                            <Settings2 className="w-5 h-5 text-accent" />
                            {language === 'zh' ? '设置' : 'Settings'}
                        </h2>
                    </div>
                    
                    <nav className="flex-1 px-3 space-y-1 overflow-y-auto no-scrollbar">
                        {tabs.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 relative group ${
                                    activeTab === tab.id
                                    ? 'bg-accent/10 text-accent'
                                    : 'text-text-secondary hover:bg-surface/50 hover:text-text-primary'
                                }`}
                            >
                                {activeTab === tab.id && (
                                    <div className="absolute left-0 top-2 bottom-2 w-[3px] bg-accent rounded-r-full shadow-[0_0_8px_rgba(var(--accent),0.6)]" />
                                )}
                                <span className={`transition-colors duration-200 ${activeTab === tab.id ? 'text-accent' : 'text-text-muted group-hover:text-text-primary'}`}>
                                    {tab.icon}
                                </span>
                                <span>{tab.label}</span>
                            </button>
                        ))}
                    </nav>

                    <div className="mt-auto px-4 pt-4 border-t border-border/50 space-y-3">
                        <div className="flex items-center gap-2 px-1 text-text-muted">
                            <Globe className="w-3.5 h-3.5" />
                            <span className="text-xs font-medium uppercase tracking-wider">{language === 'zh' ? '语言' : 'Language'}</span>
                        </div>
                        <Select
                            value={localLanguage}
                            onChange={(value) => setLocalLanguage(value as 'en' | 'zh')}
                            options={LANGUAGES.map(l => ({ value: l.id, label: l.name }))}
                            className="w-full text-xs bg-surface border-border/50 hover:border-accent/50 transition-colors"
                        />
                    </div>
                </div>

                {/* Main Content */}
                <div className="flex-1 flex flex-col min-w-0 bg-background relative">
                    <div className="flex-1 overflow-y-auto px-8 py-8 custom-scrollbar scroll-smooth pb-24">
                        <div className="mb-8 pb-4 border-b border-border/50">
                            <h3 className="text-2xl font-bold text-text-primary">
                                {tabs.find(t => t.id === activeTab)?.label}
                            </h3>
                            <p className="text-sm text-text-muted mt-1">
                                {language === 'zh' ? '管理您的应用程序偏好设置' : 'Manage your application preferences and configurations'}
                            </p>
                        </div>

                        <div className="animate-fade-in">
                            {activeTab === 'provider' && (
                                <ProviderSettings
                                    localConfig={localConfig}
                                    setLocalConfig={setLocalConfig}
                                    localProviderConfigs={localProviderConfigs}
                                    setLocalProviderConfigs={setLocalProviderConfigs}
                                    showApiKey={showApiKey}
                                    setShowApiKey={setShowApiKey}
                                    selectedProvider={selectedProvider}
                                    providers={providers}
                                    language={language}
                                />
                            )}
                            {activeTab === 'editor' && (
                                <EditorSettings settings={editorSettings} setSettings={setEditorSettings} language={language} />
                            )}
                            {activeTab === 'snippets' && <SnippetSettings language={language} />}
                            {activeTab === 'agent' && (
                                <AgentSettings
                                    autoApprove={localAutoApprove}
                                    setAutoApprove={setLocalAutoApprove}
                                    aiInstructions={localAiInstructions}
                                    setAiInstructions={setLocalAiInstructions}
                                    promptTemplateId={localPromptTemplateId}
                                    setPromptTemplateId={setLocalPromptTemplateId}
                                    agentConfig={localAgentConfig}
                                    setAgentConfig={setLocalAgentConfig}
                                    webSearchConfig={localWebSearchConfig}
                                    setWebSearchConfig={setLocalWebSearchConfig}
                                    language={language}
                                />
                            )}
                            {activeTab === 'rules' && <RulesMemorySettings language={language} />}
                            {activeTab === 'keybindings' && <KeybindingPanel />}
                            {activeTab === 'mcp' && <McpSettings language={language} mcpConfig={localMcpConfig} setMcpConfig={setLocalMcpConfig} />}
                            {activeTab === 'lsp' && <LspSettings language={language} />}
                            {activeTab === 'indexing' && <IndexSettings language={language} />}
                            {activeTab === 'security' && <SecuritySettings language={language} />}
                            {activeTab === 'system' && <SystemSettings language={language} />}
                        </div>
                    </div>

                    <div className="absolute bottom-0 left-0 right-0 px-8 py-4 border-t border-border/50 bg-background/80 backdrop-blur-xl flex items-center justify-end gap-3 z-10">
                        <Button variant="ghost" onClick={() => setShowSettings(false)} className="hover:bg-surface text-text-secondary">
                            {language === 'zh' ? '取消' : 'Cancel'}
                        </Button>
                        <Button 
                            variant={saved ? 'success' : 'primary'} 
                            onClick={handleSave}
                            className={`min-w-[120px] shadow-lg transition-all duration-300 ${
                                saved 
                                ? 'bg-status-success hover:bg-status-success/90 text-white' 
                                : 'bg-accent hover:bg-accent-hover text-white shadow-accent/20'
                            }`}
                        >
                            {saved ? (
                                <span className="flex items-center gap-2 justify-center">
                                    <Check className="w-4 h-4" />
                                    {language === 'zh' ? '已保存' : 'Saved'}
                                </span>
                            ) : (language === 'zh' ? '保存更改' : 'Save Changes')}
                        </Button>
                    </div>
                </div>
            </div>
        </Modal>
    )
}
