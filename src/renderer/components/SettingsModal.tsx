/**
 * 增强版设置模态框
 * 支持多 Provider、自定义模型、编辑器设置等
 */

import { logger } from '@utils/Logger'
import React, { useState, useEffect } from 'react'
import {
  Cpu, Check, Eye, EyeOff,
  AlertTriangle, Settings2, Code, Keyboard, Plus, Trash, HardDrive,
  Monitor, Shield, Terminal, Sparkles, Layout, Type, Database,
  Search, Copy, ChevronRight, Sliders
} from 'lucide-react'
import { useStore, LLMConfig, AutoApproveSettings } from '@store'
import { t, Language } from '@renderer/i18n'
import { ProviderModelConfig } from '@app-types/provider'
import { PROVIDERS, getAdapterConfig } from '@/shared/config/providers'
import { LLM_DEFAULTS } from '@/shared/constants'
import { getEditorConfig, saveEditorConfig, EditorConfig } from '@renderer/config/editorConfig'
import { themes } from './ThemeManager'
import { toast } from './ToastProvider'
import { getPromptTemplates, getPromptTemplateById, getPromptTemplatePreview, getPromptTemplateSummary } from '@renderer/agent/promptTemplates'
import { completionService } from '@services/completionService'
import KeybindingPanel from './KeybindingPanel'
import LLMAdapterConfigEditor from './LLMAdapterConfigEditor'
import { Button, Input, Modal, Select, Switch } from './ui'

type SettingsTab = 'provider' | 'editor' | 'agent' | 'keybindings' | 'indexing' | 'security' | 'system'

const LANGUAGES: { id: Language; name: string }[] = [
  { id: 'en', name: 'English' },
  { id: 'zh', name: '中文' },
]

export default function SettingsModal() {
  const {
    llmConfig, setLLMConfig, setShowSettings, language, setLanguage,
    autoApprove, setAutoApprove, providerConfigs, setProviderConfig,
    promptTemplateId, setPromptTemplateId, agentConfig, setAgentConfig,
    aiInstructions, setAiInstructions
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
  const [saved, setSaved] = useState(false)


  // 编辑器设置 - 使用集中配置
  const [editorConfig] = useState<EditorConfig>(getEditorConfig())

  // 兼容旧的 editorSettings 格式
  const [editorSettings, setEditorSettings] = useState({
    fontSize: editorConfig.fontSize,
    tabSize: editorConfig.tabSize,
    wordWrap: editorConfig.wordWrap,
    lineNumbers: 'on' as 'on' | 'off' | 'relative',
    minimap: editorConfig.minimap,
    bracketPairColorization: true,
    formatOnSave: true,
    autoSave: 'off' as 'off' | 'afterDelay' | 'onFocusChange',
    theme: 'adnify-dark',
    // AI 代码补全设置
    completionEnabled: editorConfig.ai.completionEnabled,
    completionDebounceMs: editorConfig.performance.completionDebounceMs,
    completionMaxTokens: editorConfig.ai.completionMaxTokens,
  })

  // 同步 Store 状态到本地状态（当 Store 更新时，确保本地状态也更新）
  useEffect(() => {
    setLocalConfig(llmConfig)
  }, [llmConfig])

  useEffect(() => {
    setLocalProviderConfigs(providerConfigs)
  }, [providerConfigs])

  useEffect(() => {
    setLocalLanguage(language)
  }, [language])

  useEffect(() => {
    setLocalAutoApprove(autoApprove)
  }, [autoApprove])

  useEffect(() => {
    setLocalAgentConfig(agentConfig)
  }, [agentConfig])

  useEffect(() => {
    setLocalAiInstructions(aiInstructions)
  }, [aiInstructions])


  const handleSave = async () => {
    // 使用统一的 settingsService 保存
    const { settingsService } = await import('../services/settingsService')

    // 1. 同步当前 Provider 配置到 providerConfigs
    const updatedProviderConfigs = {
      ...localProviderConfigs,
      [localConfig.provider]: {
        ...localProviderConfigs[localConfig.provider],
        apiKey: localConfig.apiKey,
        baseUrl: localConfig.baseUrl,
        timeout: localConfig.timeout,
        adapterId: localConfig.adapterId,
        adapterConfig: localConfig.adapterConfig,
        model: localConfig.model,
        customModels: localProviderConfigs[localConfig.provider]?.customModels || [],
      }
    }

    // 2. 更新 Store 状态
    setLLMConfig(localConfig)
    setLanguage(localLanguage)
    setAutoApprove(localAutoApprove)
    setPromptTemplateId(localPromptTemplateId)
    setAgentConfig(localAgentConfig)
    setAiInstructions(localAiInstructions)

    Object.entries(updatedProviderConfigs).forEach(([id, config]) => {
      setProviderConfig(id, config)
    })

    // 3. 使用 settingsService 统一保存（自动清理冗余数据）
    await settingsService.saveAll({
      llmConfig: localConfig as any,
      language: localLanguage,
      autoApprove: localAutoApprove,
      promptTemplateId: localPromptTemplateId,
      agentConfig: localAgentConfig as any,
      providerConfigs: updatedProviderConfigs as any,
      editorSettings: editorSettings as any,
      aiInstructions: localAiInstructions,
      onboardingCompleted: true,
    })

    // 4. 保存编辑器配置（localStorage + 文件双重存储）
    saveEditorConfig({
      fontSize: editorSettings.fontSize,
      tabSize: editorSettings.tabSize,
      wordWrap: editorSettings.wordWrap,
      minimap: editorSettings.minimap,
      performance: {
        ...editorConfig.performance,
        completionDebounceMs: editorSettings.completionDebounceMs,
      },
      ai: {
        ...editorConfig.ai,
        completionEnabled: editorSettings.completionEnabled,
        completionMaxTokens: editorSettings.completionMaxTokens,
      },
    })

    // 5. 立即应用补全设置
    completionService.configure({
      enabled: editorSettings.completionEnabled,
      debounceMs: editorSettings.completionDebounceMs,
      maxTokens: editorSettings.completionMaxTokens,
    })

    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  // 计算当前的 PROVIDERS 列表
  const currentProviders = [
    ...Object.values(PROVIDERS).map(p => ({
      id: p.id,
      name: p.displayName,
      models: [...p.models.default, ...(providerConfigs[p.id]?.customModels || [])]
    }))
  ]

  const selectedProvider = currentProviders.find(p => p.id === localConfig.provider)

  const tabs = [
    { id: 'provider' as const, label: localLanguage === 'zh' ? 'AI 模型' : 'AI Models', icon: Cpu, description: 'Configure LLM providers and models' },
    { id: 'editor' as const, label: localLanguage === 'zh' ? '编辑器' : 'Editor', icon: Code, description: 'Customize editor appearance and behavior' },
    { id: 'agent' as const, label: localLanguage === 'zh' ? 'Agent' : 'Agent', icon: Sparkles, description: 'Set up AI agent capabilities' },
    { id: 'keybindings' as const, label: localLanguage === 'zh' ? '快捷键' : 'Keybindings', icon: Keyboard, description: 'View and manage keyboard shortcuts' },
    { id: 'indexing' as const, label: localLanguage === 'zh' ? '索引' : 'Indexing', icon: Database, description: 'Configure codebase indexing' },
    { id: 'security' as const, label: localLanguage === 'zh' ? '安全' : 'Security', icon: Shield, description: 'Manage permissions and security settings' },
    { id: 'system' as const, label: localLanguage === 'zh' ? '系统' : 'System', icon: HardDrive, description: 'System preferences and storage' },
  ]

  return (
    <Modal isOpen={true} onClose={() => setShowSettings(false)} title="" size="4xl">
      <div className="flex h-[750px] -m-6 bg-background rounded-xl overflow-hidden border border-border-subtle shadow-2xl">
        {/* Sidebar */}
        <div className="w-64 bg-surface/50 backdrop-blur-md border-r border-border-subtle flex flex-col">
          {/* Header */}
          <div className="px-6 py-6 border-b border-border-subtle">
            <h2 className="text-xl font-bold text-text-primary tracking-tight">
              {localLanguage === 'zh' ? '设置' : 'Settings'}
            </h2>
            <p className="text-xs text-text-muted mt-1">
              Configure your environment
            </p>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-1 overflow-y-auto custom-scrollbar">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 group ${activeTab === tab.id
                  ? 'bg-accent/10 text-accent shadow-[0_0_20px_rgba(var(--accent),0.1)] border border-accent/20'
                  : 'text-text-secondary hover:bg-surface/20 hover:text-text-primary border border-transparent'
                  }`}
              >
                <tab.icon className={`w-4 h-4 transition-colors ${activeTab === tab.id ? 'text-accent' : 'text-text-muted group-hover:text-text-primary'}`} />
                <div className="flex flex-col items-start">
                  <span>{tab.label}</span>
                </div>
              </button>
            ))}
          </nav>

          {/* Footer: Language */}
          <div className="p-4 border-t border-border-subtle bg-surface/30">
            <div className="flex items-center gap-2 mb-2 px-1">
              <Monitor className="w-3.5 h-3.5 text-text-muted" />
              <label className="text-xs text-text-muted font-medium">
                {localLanguage === 'zh' ? '界面语言' : 'Interface Language'}
              </label>
            </div>
            <Select
              value={localLanguage}
              onChange={(value) => setLocalLanguage(value as Language)}
              options={LANGUAGES.map(lang => ({ value: lang.id, label: lang.name }))}
              className="w-full"
              dropdownPosition="top"
            />
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 flex flex-col bg-background/50 relative">
          {/* Content Header */}
          <div className="px-8 py-6 border-b border-border-subtle bg-surface/20 backdrop-blur-sm sticky top-0 z-10">
            <div className="flex items-center gap-3">
              {React.createElement(tabs.find(t => t.id === activeTab)?.icon || Settings2, {
                className: "w-6 h-6 text-accent"
              })}
              <div>
                <h3 className="text-lg font-semibold text-text-primary">
                  {tabs.find(t => t.id === activeTab)?.label}
                </h3>
                <p className="text-xs text-text-muted mt-0.5">
                  {tabs.find(t => t.id === activeTab)?.description}
                </p>
              </div>
            </div>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
            <div className="max-w-3xl mx-auto space-y-8">
              {activeTab === 'provider' && (
                <ProviderSettings
                  localConfig={localConfig}
                  setLocalConfig={setLocalConfig}
                  localProviderConfigs={localProviderConfigs}
                  setLocalProviderConfigs={setLocalProviderConfigs}
                  showApiKey={showApiKey}
                  setShowApiKey={setShowApiKey}
                  selectedProvider={selectedProvider}
                  providers={currentProviders}
                  language={localLanguage}
                />
              )}

              {activeTab === 'editor' && (
                <EditorSettings
                  settings={editorSettings}
                  setSettings={setEditorSettings}
                  language={localLanguage}
                />
              )}

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
                  language={localLanguage}
                />
              )}

              {activeTab === 'keybindings' && (
                <KeybindingPanel />
              )}

              {activeTab === 'indexing' && (
                <IndexSettings language={localLanguage} />
              )}

              {activeTab === 'security' && (
                <SecuritySettings language={localLanguage} />
              )}

              {activeTab === 'system' && (
                <SystemSettings language={localLanguage} />
              )}
            </div>
          </div>

          {/* Action Footer */}
          <div className="px-8 py-5 border-t border-border-subtle bg-surface/30 backdrop-blur-md flex items-center justify-end gap-3">
            <Button variant="ghost" onClick={() => setShowSettings(false)} className="hover:bg-surface/20">
              {t('cancel', localLanguage)}
            </Button>
            <Button
              variant={saved ? 'success' : 'primary'}
              onClick={handleSave}
              leftIcon={saved ? <Check className="w-4 h-4" /> : undefined}
              className="min-w-[100px] shadow-lg shadow-accent/20"
            >
              {saved ? t('saved', localLanguage) : t('saveSettings', localLanguage)}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  )
}


// 测试连接按钮组件
function TestConnectionButton({ localConfig, language }: { localConfig: LLMConfig, language: 'en' | 'zh' }) {
  const [testing, setTesting] = useState(false)
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  const handleTest = async () => {
    if (!localConfig.apiKey && localConfig.provider !== 'ollama') {
      setStatus('error')
      setErrorMsg(language === 'zh' ? '请先输入 API Key' : 'Please enter API Key first')
      return
    }

    setTesting(true)
    setStatus('idle')
    setErrorMsg('')

    try {
      // 使用健康检查服务
      const { checkProviderHealth } = await import('@/renderer/services/healthCheckService')
      const result = await checkProviderHealth(
        localConfig.provider,
        localConfig.apiKey,
        localConfig.baseUrl
      )

      if (result.status === 'healthy') {
        setStatus('success')
        toast.success(language === 'zh' ? `连接成功！延迟: ${result.latency}ms` : `Connected! Latency: ${result.latency}ms`)
      } else {
        setStatus('error')
        setErrorMsg(result.error || 'Connection failed')
      }
    } catch (err: any) {
      setStatus('error')
      setErrorMsg(err.message || 'Connection failed')
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="flex items-center gap-3">
      <Button
        variant="secondary"
        size="sm"
        onClick={handleTest}
        disabled={testing}
        className="h-8 px-3 text-xs"
      >
        {testing ? (
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
            {language === 'zh' ? '测试中...' : 'Testing...'}
          </span>
        ) : (
          language === 'zh' ? '测试连接' : 'Test Connection'
        )}
      </Button>
      {status === 'success' && (
        <span className="flex items-center gap-1 text-xs text-green-500">
          <Check className="w-3.5 h-3.5" />
          {language === 'zh' ? '连接正常' : 'Connected'}
        </span>
      )}
      {status === 'error' && (
        <span className="flex items-center gap-1 text-xs text-red-400" title={errorMsg}>
          <AlertTriangle className="w-3.5 h-3.5" />
          {errorMsg.length > 30 ? errorMsg.slice(0, 30) + '...' : errorMsg}
        </span>
      )}
    </div>
  )
}


// Provider 设置组件
interface ProviderSettingsProps {
  localConfig: LLMConfig
  setLocalConfig: React.Dispatch<React.SetStateAction<LLMConfig>>
  localProviderConfigs: Record<string, ProviderModelConfig>
  setLocalProviderConfigs: React.Dispatch<React.SetStateAction<Record<string, ProviderModelConfig>>>
  showApiKey: boolean
  setShowApiKey: (show: boolean) => void
  selectedProvider: { id: string; name: string; models: string[] } | undefined
  providers: { id: string; name: string; models: string[] }[]
  language: Language
}

function ProviderSettings({
  localConfig, setLocalConfig, localProviderConfigs, setLocalProviderConfigs, showApiKey, setShowApiKey, selectedProvider, providers, language
}: ProviderSettingsProps) {
  const { addCustomModel, removeCustomModel, providerConfigs } = useStore()
  const [newModelName, setNewModelName] = useState('')

  const handleAddModel = () => {
    if (newModelName.trim()) {
      addCustomModel(localConfig.provider, newModelName.trim())
      setNewModelName('')
    }
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Provider Selector */}
      <section>
        <h4 className="text-sm font-medium text-text-secondary mb-4 uppercase tracking-wider text-xs">
          {language === 'zh' ? '选择提供商' : 'Select Provider'}
        </h4>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {providers.map(p => (
            <button
              key={p.id}
              onClick={() => {
                // 1. 保存当前配置到本地 providerConfigs
                const updatedConfigs = {
                  ...localProviderConfigs,
                  [localConfig.provider]: {
                    ...localProviderConfigs[localConfig.provider],
                    apiKey: localConfig.apiKey,
                    baseUrl: localConfig.baseUrl,
                    timeout: localConfig.timeout,
                    adapterId: localConfig.adapterId,
                    adapterConfig: localConfig.adapterConfig,
                    model: localConfig.model,
                  }
                }
                setLocalProviderConfigs(updatedConfigs)

                // 2. 加载新 Provider 的配置
                const nextConfig = updatedConfigs[p.id] || {}
                const providerInfo = PROVIDERS[p.id]
                setLocalConfig({
                  ...localConfig,
                  provider: p.id as any,
                  apiKey: nextConfig.apiKey || '',
                  baseUrl: nextConfig.baseUrl || providerInfo?.endpoint.default || '',
                  timeout: nextConfig.timeout || providerInfo?.defaults.timeout || 120000,
                  adapterId: nextConfig.adapterId || p.id,
                  adapterConfig: nextConfig.adapterConfig || getAdapterConfig(p.id),
                  model: nextConfig.model || p.models[0] || '',
                })
              }}
              className={`
                relative flex flex-col items-center justify-center p-4 rounded-xl border transition-all duration-200
                ${localConfig.provider === p.id
                  ? 'border-accent bg-accent/10 text-accent shadow-[0_0_15px_rgba(var(--accent),0.15)]'
                  : 'border-border-subtle bg-surface/30 text-text-muted hover:bg-surface hover:border-border hover:text-text-primary'
                }
              `}
            >
              <span className="font-medium text-sm">{p.name}</span>
              {localConfig.provider === p.id && (
                <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-accent animate-pulse" />
              )}
            </button>
          ))}
        </div>
      </section>

      {/* Configuration */}
      <section className="space-y-6 p-6 bg-surface/30 rounded-xl border border-border-subtle">
        <h4 className="text-sm font-medium text-text-secondary uppercase tracking-wider text-xs mb-2">
          {language === 'zh' ? '配置' : 'Configuration'}
        </h4>

        {/* Model Selector */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-text-primary">
            {language === 'zh' ? '模型' : 'Model'}
          </label>
          <div className="flex gap-2">
            <Select
              value={localConfig.model}
              onChange={(value) => setLocalConfig({ ...localConfig, model: value })}
              options={selectedProvider?.models.map(m => ({ value: m, label: m })) || []}
              className="flex-1"
            />
          </div>

          {/* Custom Model Management */}
          <div className="mt-3 pt-3 border-t border-border-subtle">
            <div className="flex gap-2 items-center">
              <Input
                value={newModelName}
                onChange={(e) => setNewModelName(e.target.value)}
                placeholder={language === 'zh' ? '添加自定义模型...' : 'Add custom model...'}
                onKeyDown={(e) => e.key === 'Enter' && handleAddModel()}
                className="flex-1 h-9 text-sm"
              />
              <Button
                variant="secondary"
                size="sm"
                onClick={handleAddModel}
                disabled={!newModelName.trim()}
                className="h-9 px-3"
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>

            {providerConfigs[localConfig.provider]?.customModels?.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {providerConfigs[localConfig.provider]?.customModels.map((model: string) => (
                  <div key={model} className="flex items-center gap-1.5 px-2.5 py-1 bg-surface rounded-full border border-border-subtle text-xs text-text-secondary group hover:border-accent/30 transition-colors">
                    <span>{model}</span>
                    <button
                      onClick={() => removeCustomModel(localConfig.provider, model)}
                      className="text-text-muted hover:text-red-400 transition-colors"
                    >
                      <Trash className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* API Key */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-text-primary">API Key</label>
          <div className="relative">
            <Input
              type={showApiKey ? "text" : "password"}
              value={localConfig.apiKey}
              onChange={(e) => setLocalConfig({ ...localConfig, apiKey: e.target.value })}
              placeholder={PROVIDERS[localConfig.provider]?.auth.placeholder || 'Enter API Key'}
              rightIcon={
                <button
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="text-text-muted hover:text-text-primary transition-colors"
                >
                  {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              }
            />
          </div>
          {localConfig.provider !== 'custom' && localConfig.provider !== 'ollama' && PROVIDERS[localConfig.provider]?.auth.helpUrl && (
            <div className="flex justify-end">
              <a
                href={PROVIDERS[localConfig.provider]?.auth.helpUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-accent hover:text-accent-hover hover:underline"
              >
                {language === 'zh' ? '获取 API Key →' : 'Get API Key →'}
              </a>
            </div>
          )}
        </div>

        {/* Test Connection Button */}
        <TestConnectionButton localConfig={localConfig} language={language} />

        {/* Advanced Options Toggle */}
        <div className="pt-2">
          <details className="group">
            <summary className="flex items-center gap-2 text-xs font-medium text-text-muted cursor-pointer hover:text-text-primary transition-colors select-none">
              <span className="group-open:rotate-90 transition-transform">▶</span>
              {language === 'zh' ? '高级设置 (端点、超时、参数)' : 'Advanced Settings (Endpoint, Timeout, Parameters)'}
            </summary>
            <div className="mt-4 space-y-4 pl-4 border-l border-border-subtle">
              <div>
                <label className="text-xs text-text-secondary mb-1.5 block">{language === 'zh' ? '自定义端点' : 'Custom Endpoint'}</label>
                <Input
                  value={localConfig.baseUrl || ''}
                  onChange={(e) => setLocalConfig({ ...localConfig, baseUrl: e.target.value || undefined })}
                  placeholder="https://api.example.com/v1"
                  className="text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-text-secondary mb-1.5 block">{language === 'zh' ? '请求超时 (秒)' : 'Request Timeout (seconds)'}</label>
                <Input
                  type="number"
                  value={(localConfig.timeout || 120000) / 1000}
                  onChange={(e) => setLocalConfig({ ...localConfig, timeout: (parseInt(e.target.value) || 120) * 1000 })}
                  min={30}
                  max={600}
                  step={30}
                  className="w-32 text-sm"
                />
              </div>

              {/* LLM 参数配置 */}
              <div className="pt-3 border-t border-border-subtle">
                <div className="flex items-center gap-2 mb-3">
                  <Sliders className="w-4 h-4 text-accent" />
                  <span className="text-xs font-medium text-text-secondary">
                    {language === 'zh' ? 'LLM 参数' : 'LLM Parameters'}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-text-secondary mb-1.5 block">
                      {language === 'zh' ? '温度 (Temperature)' : 'Temperature'}
                    </label>
                    <Input
                      type="number"
                      value={localConfig.parameters?.temperature ?? LLM_DEFAULTS.TEMPERATURE}
                      onChange={(e) => setLocalConfig({
                        ...localConfig,
                        parameters: {
                          ...localConfig.parameters,
                          temperature: parseFloat(e.target.value) || LLM_DEFAULTS.TEMPERATURE,
                          topP: localConfig.parameters?.topP ?? LLM_DEFAULTS.TOP_P,
                          maxTokens: localConfig.parameters?.maxTokens ?? LLM_DEFAULTS.MAX_TOKENS,
                        }
                      })}
                      min={0}
                      max={2}
                      step={0.1}
                      className="w-full text-sm"
                    />
                    <p className="text-[10px] text-text-muted mt-1">
                      {language === 'zh' ? '控制输出随机性 (0-2)' : 'Controls randomness (0-2)'}
                    </p>
                  </div>
                  <div>
                    <label className="text-xs text-text-secondary mb-1.5 block">
                      Top P
                    </label>
                    <Input
                      type="number"
                      value={localConfig.parameters?.topP ?? LLM_DEFAULTS.TOP_P}
                      onChange={(e) => setLocalConfig({
                        ...localConfig,
                        parameters: {
                          ...localConfig.parameters,
                          temperature: localConfig.parameters?.temperature ?? LLM_DEFAULTS.TEMPERATURE,
                          topP: parseFloat(e.target.value) || LLM_DEFAULTS.TOP_P,
                          maxTokens: localConfig.parameters?.maxTokens ?? LLM_DEFAULTS.MAX_TOKENS,
                        }
                      })}
                      min={0}
                      max={1}
                      step={0.1}
                      className="w-full text-sm"
                    />
                    <p className="text-[10px] text-text-muted mt-1">
                      {language === 'zh' ? '核采样概率 (0-1)' : 'Nucleus sampling (0-1)'}
                    </p>
                  </div>
                  <div>
                    <label className="text-xs text-text-secondary mb-1.5 block">
                      {language === 'zh' ? '最大 Token' : 'Max Tokens'}
                    </label>
                    <Input
                      type="number"
                      value={localConfig.parameters?.maxTokens ?? LLM_DEFAULTS.MAX_TOKENS}
                      onChange={(e) => setLocalConfig({
                        ...localConfig,
                        parameters: {
                          ...localConfig.parameters,
                          temperature: localConfig.parameters?.temperature ?? LLM_DEFAULTS.TEMPERATURE,
                          topP: localConfig.parameters?.topP ?? LLM_DEFAULTS.TOP_P,
                          maxTokens: parseInt(e.target.value) || LLM_DEFAULTS.MAX_TOKENS,
                        }
                      })}
                      min={256}
                      max={32768}
                      step={256}
                      className="w-full text-sm"
                    />
                    <p className="text-[10px] text-text-muted mt-1">
                      {language === 'zh' ? '最大输出长度' : 'Max output length'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </details>
        </div>
      </section>

      {/* LLM 适配器配置（统一配置） */}
      <section className="space-y-4 p-6 bg-surface/30 rounded-xl border border-border-subtle">
        <h4 className="text-sm font-medium text-text-secondary uppercase tracking-wider text-xs mb-2">
          {language === 'zh' ? '🔌 适配器配置' : '🔌 Adapter Configuration'}
        </h4>
        <LLMAdapterConfigEditor
          adapterId={localConfig.adapterId || 'openai'}
          config={localConfig.adapterConfig}
          onChange={(id, config) => setLocalConfig({
            ...localConfig,
            adapterId: id,
            adapterConfig: config
          })}
          language={language}
          hasConfiguredAI={!!localConfig.apiKey}
        />
      </section>
    </div>
  )
}


// 编辑器设置组件
interface EditorSettingsState {
  fontSize: number
  tabSize: number
  wordWrap: 'on' | 'off' | 'wordWrapColumn'
  lineNumbers: 'on' | 'off' | 'relative'
  minimap: boolean
  bracketPairColorization: boolean
  formatOnSave: boolean
  autoSave: 'off' | 'afterDelay' | 'onFocusChange'
  theme: string
  // AI 代码补全设置
  completionEnabled: boolean
  completionDebounceMs: number
  completionMaxTokens: number
}

interface EditorSettingsProps {
  settings: EditorSettingsState
  setSettings: (settings: EditorSettingsState) => void
  language: Language
}

function EditorSettings({ settings, setSettings, language }: EditorSettingsProps) {
  // 获取完整配置用于显示高级选项
  const [advancedConfig, setAdvancedConfig] = useState(getEditorConfig())
  const { currentTheme, setTheme } = useStore()
  const allThemes = Object.keys(themes)

  const handleThemeChange = (themeId: string) => {
    setTheme(themeId as any)
    window.electronAPI.setSetting('currentTheme', themeId)
  }



  return (
    <div className="space-y-8 animate-fade-in">
      {/* Theme Section */}
      <section>
        <h4 className="flex items-center gap-2 text-sm font-medium text-text-secondary mb-4 uppercase tracking-wider text-xs">
          <Layout className="w-4 h-4" />
          {language === 'zh' ? '外观' : 'Appearance'}
        </h4>
        <div className="grid grid-cols-3 gap-3">
          {allThemes.map(themeId => {
            const themeVars = themes[themeId as keyof typeof themes]
            return (
              <button
                key={themeId}
                onClick={() => handleThemeChange(themeId)}
                className={`relative p-3 rounded-xl border text-left transition-all duration-200 group overflow-hidden ${currentTheme === themeId
                  ? 'border-accent bg-accent/10 shadow-md'
                  : 'border-border-subtle bg-surface/30 hover:border-border hover:bg-surface/50'
                  }`}
              >
                <div className="flex gap-1.5 mb-3">
                  <div className="w-5 h-5 rounded-full shadow-sm ring-1 ring-border-subtle" style={{ backgroundColor: `rgb(${themeVars['--background']})` }} />
                  <div className="w-5 h-5 rounded-full shadow-sm ring-1 ring-border-subtle" style={{ backgroundColor: `rgb(${themeVars['--accent']})` }} />
                  <div className="w-5 h-5 rounded-full shadow-sm ring-1 ring-border-subtle" style={{ backgroundColor: `rgb(${themeVars['--text-primary']})` }} />
                </div>
                <span className="text-xs font-medium capitalize block truncate">{themeId.replace('-', ' ')}</span>
                {currentTheme === themeId && (
                  <div className="absolute top-2 right-2">
                    <Check className="w-3.5 h-3.5 text-accent" />
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </section>

      {/* Typography & Layout */}
      <section className="space-y-4">
        <h4 className="flex items-center gap-2 text-sm font-medium text-text-secondary mb-4 uppercase tracking-wider text-xs">
          <Type className="w-4 h-4" />
          {language === 'zh' ? '排版与布局' : 'Typography & Layout'}
        </h4>
        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-text-primary">{language === 'zh' ? '字体大小' : 'Font Size'}</label>
            <Input
              type="number"
              value={settings.fontSize}
              onChange={(e) => setSettings({ ...settings, fontSize: parseInt(e.target.value) || 14 })}
              min={10} max={32}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-text-primary">{language === 'zh' ? 'Tab 大小' : 'Tab Size'}</label>
            <Select
              value={settings.tabSize.toString()}
              onChange={(value) => setSettings({ ...settings, tabSize: parseInt(value) })}
              options={[
                { value: '2', label: '2 Spaces' },
                { value: '4', label: '4 Spaces' },
                { value: '8', label: '8 Spaces' },
              ]}
              className="w-full"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-text-primary">{language === 'zh' ? '自动换行' : 'Word Wrap'}</label>
            <Select
              value={settings.wordWrap}
              onChange={(value) => setSettings({ ...settings, wordWrap: value as any })}
              options={[
                { value: 'on', label: 'On' },
                { value: 'off', label: 'Off' },
                { value: 'wordWrapColumn', label: 'Column' },
              ]}
              className="w-full"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-text-primary">{language === 'zh' ? '行号' : 'Line Numbers'}</label>
            <Select
              value={settings.lineNumbers}
              onChange={(value) => setSettings({ ...settings, lineNumbers: value as any })}
              options={[
                { value: 'on', label: 'On' },
                { value: 'off', label: 'Off' },
                { value: 'relative', label: 'Relative' },
              ]}
              className="w-full"
            />
          </div>
        </div>
      </section>

      {/* Features Switches */}
      <section className="space-y-4 p-5 bg-surface/30 rounded-xl border border-border-subtle">
        <h4 className="text-sm font-medium text-text-secondary uppercase tracking-wider text-xs mb-2">
          {language === 'zh' ? '功能特性' : 'Features'}
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
          <Switch
            label={language === 'zh' ? '显示小地图' : 'Show Minimap'}
            checked={settings.minimap}
            onChange={(e) => setSettings({ ...settings, minimap: e.target.checked })}
          />
          <Switch
            label={language === 'zh' ? '括号配对着色' : 'Bracket Pair Colorization'}
            checked={settings.bracketPairColorization}
            onChange={(e) => setSettings({ ...settings, bracketPairColorization: e.target.checked })}
          />
          <Switch
            label={language === 'zh' ? '保存时格式化' : 'Format on Save'}
            checked={settings.formatOnSave}
            onChange={(e) => setSettings({ ...settings, formatOnSave: e.target.checked })}
          />
        </div>
        <div className="pt-4 border-t border-border-subtle">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-text-primary">{language === 'zh' ? '自动保存' : 'Auto Save'}</label>
            <Select
              value={settings.autoSave}
              onChange={(value) => setSettings({ ...settings, autoSave: value as any })}
              options={[
                { value: 'off', label: 'Off' },
                { value: 'afterDelay', label: 'After Delay' },
                { value: 'onFocusChange', label: 'On Focus Change' },
              ]}
              className="w-48"
            />
          </div>
        </div>
      </section>

      {/* AI Completion */}
      <section className="space-y-4 p-5 bg-gradient-to-br from-accent/5 to-transparent rounded-xl border border-accent/10">
        <div className="flex items-center justify-between">
          <h4 className="flex items-center gap-2 text-sm font-medium text-accent uppercase tracking-wider text-xs">
            <Sparkles className="w-4 h-4" />
            {language === 'zh' ? 'AI 代码补全' : 'AI Code Completion'}
          </h4>
          <Switch
            checked={settings.completionEnabled}
            onChange={(e) => setSettings({ ...settings, completionEnabled: e.target.checked })}
          />
        </div>

        {settings.completionEnabled && (
          <div className="grid grid-cols-2 gap-6 pt-2 animate-fade-in">
            <div className="space-y-2">
              <label className="text-sm font-medium text-text-primary">{language === 'zh' ? '触发延迟 (ms)' : 'Trigger Delay (ms)'}</label>
              <Input
                type="number"
                value={settings.completionDebounceMs}
                onChange={(e) => setSettings({ ...settings, completionDebounceMs: parseInt(e.target.value) || 150 })}
                min={50} max={1000} step={50}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-text-primary">{language === 'zh' ? '最大 Token 数' : 'Max Tokens'}</label>
              <Input
                type="number"
                value={settings.completionMaxTokens}
                onChange={(e) => setSettings({ ...settings, completionMaxTokens: parseInt(e.target.value) || 256 })}
                min={64} max={1024} step={64}
              />
            </div>
          </div>
        )}
      </section>

      {/* Terminal Settings */}
      <section className="space-y-4">
        <h4 className="flex items-center gap-2 text-sm font-medium text-text-secondary mb-4 uppercase tracking-wider text-xs">
          <Terminal className="w-4 h-4" />
          {language === 'zh' ? '终端' : 'Terminal'}
        </h4>
        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-text-primary">{language === 'zh' ? '终端字体大小' : 'Terminal Font Size'}</label>
            <Input
              type="number"
              value={advancedConfig.terminal.fontSize}
              onChange={(e) => {
                const newConfig = { ...advancedConfig, terminal: { ...advancedConfig.terminal, fontSize: parseInt(e.target.value) || 13 } }
                setAdvancedConfig(newConfig)
                saveEditorConfig(newConfig)
              }}
              min={10} max={24}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-text-primary">{language === 'zh' ? '终端行高' : 'Terminal Line Height'}</label>
            <Input
              type="number"
              value={advancedConfig.terminal.lineHeight}
              onChange={(e) => {
                const newConfig = { ...advancedConfig, terminal: { ...advancedConfig.terminal, lineHeight: parseFloat(e.target.value) || 1.2 } }
                setAdvancedConfig(newConfig)
                saveEditorConfig(newConfig)
              }}
              min={1} max={2} step={0.1}
            />
          </div>
        </div>
        <div className="pt-2">
          <Switch
            label={language === 'zh' ? '光标闪烁' : 'Cursor Blink'}
            checked={advancedConfig.terminal.cursorBlink}
            onChange={(e) => {
              const newConfig = { ...advancedConfig, terminal: { ...advancedConfig.terminal, cursorBlink: e.target.checked } }
              setAdvancedConfig(newConfig)
              saveEditorConfig(newConfig)
            }}
          />
        </div>
      </section>
    </div>
  )
}

// Agent 设置组件
interface AgentSettingsProps {
  autoApprove: AutoApproveSettings
  setAutoApprove: (value: AutoApproveSettings) => void
  aiInstructions: string
  setAiInstructions: (value: string) => void
  promptTemplateId: string
  setPromptTemplateId: (value: string) => void
  agentConfig: import('../store/slices/settingsSlice').AgentConfig
  setAgentConfig: React.Dispatch<React.SetStateAction<import('../store/slices/settingsSlice').AgentConfig>>
  language: Language
}

function AgentSettings({
  autoApprove, setAutoApprove, aiInstructions, setAiInstructions, promptTemplateId, setPromptTemplateId, agentConfig, setAgentConfig, language
}: AgentSettingsProps) {
  const templates = getPromptTemplates()
  const [showPreview, setShowPreview] = useState(false)
  const [selectedTemplateForPreview, setSelectedTemplateForPreview] = useState<string | null>(null)

  const handlePreviewTemplate = (templateId: string) => {
    setSelectedTemplateForPreview(templateId)
    setShowPreview(true)
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <section className="space-y-4 p-5 bg-surface/30 rounded-xl border border-border-subtle">
        <h4 className="text-sm font-medium text-text-secondary uppercase tracking-wider text-xs mb-2">
          {language === 'zh' ? '自动化权限' : 'Automation Permissions'}
        </h4>
        <div className="space-y-4">
          <Switch
            label={language === 'zh' ? '自动批准终端命令' : 'Auto-approve terminal commands'}
            checked={autoApprove.terminal}
            onChange={(e) => setAutoApprove({ ...autoApprove, terminal: e.target.checked })}
          />
          <Switch
            label={language === 'zh' ? '自动批准危险操作 (删除文件等)' : 'Auto-approve dangerous operations'}
            checked={autoApprove.dangerous}
            onChange={(e) => setAutoApprove({ ...autoApprove, dangerous: e.target.checked })}
          />
          <Switch
            label={language === 'zh' ? '启用自动检查与修复' : 'Enable Auto-check & Fix'}
            checked={agentConfig.enableAutoFix}
            onChange={(e) => setAgentConfig({ ...agentConfig, enableAutoFix: e.target.checked })}
          />
          <p className="text-xs text-text-muted pl-1">
            {language === 'zh'
              ? '开启后，Agent 将无需确认直接执行相应操作。请谨慎使用。'
              : 'When enabled, the Agent will execute operations without confirmation. Use with caution.'}
          </p>
        </div>
      </section>

      {/* 注意：Thinking 模式配置现在通过 Provider 设置中的适配器编辑器进行 */}

      <section className="space-y-4">
        <h4 className="text-sm font-medium text-text-secondary uppercase tracking-wider text-xs mb-2">
          {language === 'zh' ? 'Prompt 模板' : 'Prompt Template'}
        </h4>
        <div className="space-y-3">
          <Select
            value={promptTemplateId}
            onChange={(value) => setPromptTemplateId(value)}
            options={templates.map(t => ({
              value: t.id,
              label: `${t.name} ${t.isDefault ? '(默认)' : ''} [P${t.priority}]`
            }))}
            className="w-full"
          />

          {/* 模板描述和预览按钮 */}
          <div className="bg-surface/30 p-4 rounded-lg border border-border-subtle space-y-2">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-text-primary">
                    {templates.find(t => t.id === promptTemplateId)?.name}
                  </span>
                  <span className="text-xs text-text-muted px-2 py-0.5 bg-surface rounded border border-border-subtle">
                    P{templates.find(t => t.id === promptTemplateId)?.priority}
                  </span>
                  {templates.find(t => t.id === promptTemplateId)?.tags?.map(tag => (
                    <span key={tag} className="text-xs text-accent px-1.5 py-0.5 bg-accent/10 rounded">
                      {tag}
                    </span>
                  ))}
                </div>
                <p className="text-sm text-text-secondary">
                  {language === 'zh'
                    ? templates.find(t => t.id === promptTemplateId)?.descriptionZh
                    : templates.find(t => t.id === promptTemplateId)?.description}
                </p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handlePreviewTemplate(promptTemplateId)}
                className="shrink-0"
              >
                {language === 'zh' ? '预览完整提示词' : 'Preview Full Prompt'}
              </Button>
            </div>
          </div>

          {/* 模板列表概览 */}
          <div className="mt-4">
            <details className="group">
              <summary className="flex items-center gap-2 text-xs font-medium text-text-muted cursor-pointer hover:text-text-primary transition-colors select-none">
                <span className="group-open:rotate-90 transition-transform">▶</span>
                {language === 'zh' ? '查看所有模板概览' : 'View All Templates Overview'}
              </summary>
              <div className="mt-3 space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
                {getPromptTemplateSummary().map(t => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between p-2 rounded hover:bg-surface/20 transition-colors border border-transparent hover:border-border-subtle"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <span className="font-medium text-sm text-text-primary w-24">{t.name}</span>
                      <span className="text-xs text-text-muted px-1.5 py-0.5 bg-surface rounded">P{t.priority}</span>
                      <span className="text-xs text-text-secondary flex-1">
                        {language === 'zh' ? t.descriptionZh : t.description}
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handlePreviewTemplate(t.id)}
                      className="text-xs px-2 py-1"
                    >
                      {language === 'zh' ? '预览' : 'Preview'}
                    </Button>
                  </div>
                ))}
              </div>
            </details>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h4 className="text-sm font-medium text-text-secondary uppercase tracking-wider text-xs mb-2">
          {language === 'zh' ? '自定义系统指令' : 'Custom System Instructions'}
        </h4>
        <textarea
          value={aiInstructions}
          onChange={(e) => setAiInstructions(e.target.value)}
          placeholder={language === 'zh'
            ? '在此输入全局系统指令，例如："总是使用中文回答"、"代码风格偏好..."'
            : 'Enter global system instructions here, e.g., "Always answer in English", "Code style preferences..."'}
          className="w-full h-40 p-4 bg-surface/50 rounded-xl border border-border-subtle focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-all resize-none text-sm font-mono custom-scrollbar"
        />
        <p className="text-xs text-text-muted">
          {language === 'zh'
            ? '这些指令将附加到 System Prompt 中，影响所有 AI 回复'
            : 'These instructions will be appended to the System Prompt and affect all AI responses'}
        </p>
      </section>

      <section className="space-y-4">
        <h4 className="text-sm font-medium text-text-secondary uppercase tracking-wider text-xs mb-2">
          {language === 'zh' ? '高级配置' : 'Advanced Configuration'}
        </h4>
        <div className="p-5 bg-surface/30 rounded-xl border border-border-subtle space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-text-primary block mb-2">
                {language === 'zh' ? '最大工具循环' : 'Max Tool Loops'}
              </label>
              <Input
                type="number"
                value={agentConfig.maxToolLoops}
                onChange={(e) => setAgentConfig({ ...agentConfig, maxToolLoops: parseInt(e.target.value) || 25 })}
                min={5}
                max={100}
                className="w-full"
              />
              <p className="text-xs text-text-muted mt-1">
                {language === 'zh' ? '单次对话最大工具调用次数 (5-100)' : 'Max tool calls per conversation (5-100)'}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-text-primary block mb-2">
                {language === 'zh' ? '最大历史消息' : 'Max History Messages'}
              </label>
              <Input
                type="number"
                value={agentConfig.maxHistoryMessages}
                onChange={(e) => setAgentConfig({ ...agentConfig, maxHistoryMessages: parseInt(e.target.value) || 50 })}
                min={10}
                max={200}
                className="w-full"
              />
              <p className="text-xs text-text-muted mt-1">
                {language === 'zh' ? '保留的历史消息数量 (10-200)' : 'Number of messages to retain (10-200)'}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-text-primary block mb-2">
                {language === 'zh' ? '工具结果字符限制' : 'Tool Result Char Limit'}
              </label>
              <Input
                type="number"
                value={agentConfig.maxToolResultChars}
                onChange={(e) => setAgentConfig({ ...agentConfig, maxToolResultChars: parseInt(e.target.value) || 50000 })}
                min={10000}
                max={200000}
                step={10000}
                className="w-full"
              />
              <p className="text-xs text-text-muted mt-1">
                {language === 'zh' ? '单个工具结果最大字符数' : 'Max chars per tool result'}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-text-primary block mb-2">
                {language === 'zh' ? '上下文字符限制' : 'Context Char Limit'}
              </label>
              <Input
                type="number"
                value={agentConfig.maxTotalContextChars}
                onChange={(e) => setAgentConfig({ ...agentConfig, maxTotalContextChars: parseInt(e.target.value) || 100000 })}
                min={50000}
                max={500000}
                step={10000}
                className="w-full"
              />
              <p className="text-xs text-text-muted mt-1">
                {language === 'zh' ? '总上下文最大字符数' : 'Max total context chars'}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 mt-4">
            <div>
              <label className="text-sm font-medium text-text-primary block mb-2">
                {language === 'zh' ? '最大上下文文件数' : 'Max Context Files'}
              </label>
              <Input
                type="number"
                value={agentConfig.maxContextFiles ?? 6}
                onChange={(e) => setAgentConfig({ ...agentConfig, maxContextFiles: parseInt(e.target.value) || 6 })}
                min={1}
                max={20}
                step={1}
                className="w-full"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-text-primary block mb-2">
                {language === 'zh' ? '语义搜索结果数' : 'Semantic Search Results'}
              </label>
              <Input
                type="number"
                value={agentConfig.maxSemanticResults ?? 5}
                onChange={(e) => setAgentConfig({ ...agentConfig, maxSemanticResults: parseInt(e.target.value) || 5 })}
                min={1}
                max={20}
                step={1}
                className="w-full"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 mt-4">
            <div>
              <label className="text-sm font-medium text-text-primary block mb-2">
                {language === 'zh' ? '终端输出字符限制' : 'Terminal Char Limit'}
              </label>
              <Input
                type="number"
                value={agentConfig.maxTerminalChars ?? 3000}
                onChange={(e) => setAgentConfig({ ...agentConfig, maxTerminalChars: parseInt(e.target.value) || 3000 })}
                min={1000}
                max={10000}
                step={500}
                className="w-full"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-text-primary block mb-2">
                {language === 'zh' ? '单文件字符限制' : 'Single File Char Limit'}
              </label>
              <Input
                type="number"
                value={agentConfig.maxSingleFileChars ?? 6000}
                onChange={(e) => setAgentConfig({ ...agentConfig, maxSingleFileChars: parseInt(e.target.value) || 6000 })}
                min={2000}
                max={30000}
                step={1000}
                className="w-full"
              />
            </div>
          </div>
        </div>
      </section>

      {/* 预览模态框 */}
      {showPreview && selectedTemplateForPreview && (
        <PromptPreviewModal
          templateId={selectedTemplateForPreview}
          language={language}
          onClose={() => setShowPreview(false)}
        />
      )}
    </div>
  )
}

// Prompt 预览模态框组件
interface PromptPreviewModalProps {
  templateId: string
  language: Language
  onClose: () => void
}

function PromptPreviewModal({ templateId, language, onClose }: PromptPreviewModalProps) {
  const template = getPromptTemplateById(templateId)
  const previewContent = template ? getPromptTemplatePreview(templateId) : ''
  const [searchQuery, setSearchQuery] = useState('')
  const [activeSection, setActiveSection] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  // 解析提示词章节
  const sections = React.useMemo(() => {
    if (!previewContent) return []
    const lines = previewContent.split('\n')
    const result: { id: string; title: string; startIndex: number }[] = []
    lines.forEach((line, index) => {
      if (line.startsWith('## ')) {
        const title = line.replace('## ', '').trim()
        result.push({ id: title.toLowerCase().replace(/\s+/g, '-'), title, startIndex: index })
      }
    })
    return result
  }, [previewContent])

  useEffect(() => {
    if (sections.length > 0 && !activeSection) {
      setActiveSection(sections[0].id)
    }
  }, [sections, activeSection])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(previewContent)
      setCopied(true)
      toast.success(language === 'zh' ? '已复制到剪贴板' : 'Copied to clipboard')
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      toast.error(language === 'zh' ? '复制失败' : 'Copy failed')
    }
  }

  const highlightText = (text: string, query: string) => {
    if (!query) return highlightVariables(text)
    const parts = text.split(new RegExp(`(${query})`, 'gi'))
    return (
      <>
        {parts.map((part, i) =>
          part.toLowerCase() === query.toLowerCase() ? (
            <mark key={i} className="bg-accent/30 text-accent-hover rounded-sm px-0.5">{part}</mark>
          ) : (
            highlightVariables(part)
          )
        )}
      </>
    )
  }

  const highlightVariables = (text: string) => {
    // 匹配 {{variable}} 或 [Variable]
    const parts = text.split(/(\{\{[^}]+\}\}|\[[^\]]+\])/g)
    return (
      <>
        {parts.map((part, i) => {
          if (part.startsWith('{{') && part.endsWith('}}')) {
            return <span key={i} className="text-accent font-bold">{part}</span>
          }
          if (part.startsWith('[') && part.endsWith(']')) {
            return <span key={i} className="text-purple-400 font-semibold">{part}</span>
          }
          return part
        })}
      </>
    )
  }

  if (!template) return null

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={language === 'zh' ? '完整提示词预览' : 'Full Prompt Preview'}
      size="5xl"
      noPadding
    >
      <div className="flex h-[700px] bg-background">
        {/* Sidebar Navigation */}
        <div className="w-64 border-r border-border-subtle bg-surface/30 flex flex-col">
          <div className="p-4 border-b border-border-subtle">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={language === 'zh' ? '搜索提示词...' : 'Search prompt...'}
                className="w-full bg-surface/50 border border-border-subtle rounded-lg pl-9 pr-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent/50 transition-all"
              />
            </div>
          </div>
          <nav className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
            {sections.map((section) => (
              <button
                key={section.id}
                onClick={() => {
                  setActiveSection(section.id)
                  const element = document.getElementById(`section-${section.id}`)
                  element?.scrollIntoView({ behavior: 'smooth' })
                }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all ${activeSection === section.id
                  ? 'bg-accent/10 text-accent border border-accent/20'
                  : 'text-text-secondary hover:bg-surface/20 hover:text-text-primary border border-transparent'
                  }`}
              >
                <span className="truncate">{section.title}</span>
                {activeSection === section.id && <ChevronRight className="w-3.5 h-3.5" />}
              </button>
            ))}
          </nav>
          <div className="p-4 border-t border-border-subtle bg-surface/20">
            <Button
              variant={copied ? 'success' : 'secondary'}
              size="sm"
              onClick={handleCopy}
              className="w-full"
              leftIcon={copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            >
              {copied ? (language === 'zh' ? '已复制' : 'Copied') : (language === 'zh' ? '复制全文' : 'Copy Full')}
            </Button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="px-6 py-3 bg-surface/20 border-b border-border-subtle flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-text-muted uppercase tracking-wider">Template:</span>
              <span className="text-xs font-bold text-accent px-2 py-0.5 bg-accent/10 rounded">{template.name}</span>
            </div>
            <div className="text-[10px] text-text-muted font-mono">
              {previewContent.length} chars | {previewContent.split(/\s+/).length} words
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-8 custom-scrollbar bg-gradient-to-b from-transparent to-surface/5">
            <div className="max-w-3xl mx-auto space-y-8">
              {previewContent.split('\n\n').map((block, blockIdx) => {
                const isHeader = block.startsWith('## ')
                if (isHeader) {
                  const title = block.replace('## ', '').trim()
                  const id = title.toLowerCase().replace(/\s+/g, '-')
                  return (
                    <div key={blockIdx} id={`section-${id}`} className="pt-4 first:pt-0">
                      <h2 className="text-xl font-bold text-text-primary flex items-center gap-3 group">
                        <span className="w-1.5 h-6 bg-accent rounded-full" />
                        {title}
                        <div className="flex-1 h-px bg-border-subtle group-hover:bg-border transition-colors" />
                      </h2>
                    </div>
                  )
                }

                return (
                  <div key={blockIdx} className="relative group">
                    <div className="absolute -left-4 top-0 bottom-0 w-0.5 bg-accent/0 group-hover:bg-accent/20 transition-all rounded-full" />
                    <div className="text-sm text-text-secondary leading-relaxed whitespace-pre-wrap font-mono">
                      {highlightText(block, searchQuery)}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
          <div className="px-8 py-4 border-t border-border-subtle bg-surface/30 flex items-center justify-between">
            <p className="text-xs text-text-muted italic">
              {language === 'zh'
                ? '提示词包含：核心身份、沟通风格、代码质量标准、工具定义、工作流规范和环境信息'
                : 'Prompt includes: Core identity, communication style, code quality standards, tool definitions, workflow guidelines, and environment info'}
            </p>
            <Button variant="ghost" size="sm" onClick={onClose} className="text-text-muted hover:text-text-primary">
              {language === 'zh' ? '关闭' : 'Close'}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  )
}

// 安全设置组件
function SecuritySettings({ language }: { language: Language }) {
  const [editorConfig, setEditorConfig] = useState<EditorConfig>(getEditorConfig())
  const { securitySettings, setSecuritySettings } = useStore()
  const [newIgnoredDir, setNewIgnoredDir] = useState('')

  const handleAddIgnoredDir = () => {
    if (newIgnoredDir.trim() && !editorConfig.ignoredDirectories.includes(newIgnoredDir.trim())) {
      const newDirs = [...editorConfig.ignoredDirectories, newIgnoredDir.trim()]
      const newConfig = { ...editorConfig, ignoredDirectories: newDirs }
      setEditorConfig(newConfig)
      saveEditorConfig(newConfig)
      setNewIgnoredDir('')
    }
  }

  const handleRemoveIgnoredDir = (dir: string) => {
    const newDirs = editorConfig.ignoredDirectories.filter(d => d !== dir)
    const newConfig = { ...editorConfig, ignoredDirectories: newDirs }
    setEditorConfig(newConfig)
    saveEditorConfig(newConfig)
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-yellow-500 mt-0.5 flex-shrink-0" />
        <div>
          <h3 className="text-sm font-medium text-yellow-500 mb-1">
            {language === 'zh' ? '安全沙箱 (开发中)' : 'Security Sandbox (WIP)'}
          </h3>
          <p className="text-xs text-text-secondary leading-relaxed opacity-80">
            {language === 'zh'
              ? 'Adnify 目前直接在您的系统上运行命令。请确保您只运行受信任的代码。未来版本将引入基于 Docker 的沙箱环境。'
              : 'Adnify currently runs commands directly on your system. Ensure you only run trusted code. Future versions will introduce a Docker-based sandbox.'}
          </p>
        </div>
      </div>

      <section className="space-y-4 p-5 bg-surface/30 rounded-xl border border-border-subtle">
        <h4 className="text-sm font-medium text-text-secondary uppercase tracking-wider text-xs mb-2">
          {language === 'zh' ? '安全选项' : 'Security Options'}
        </h4>
        <div className="space-y-4">
          <Switch
            label={language === 'zh' ? '启用操作确认' : 'Enable permission confirmation'}
            checked={securitySettings.enablePermissionConfirm}
            onChange={(e) => setSecuritySettings({ enablePermissionConfirm: e.target.checked })}
          />
          <Switch
            label={language === 'zh' ? '启用审计日志' : 'Enable audit log'}
            checked={securitySettings.enableAuditLog}
            onChange={(e) => setSecuritySettings({ enableAuditLog: e.target.checked })}
          />
          <Switch
            label={language === 'zh' ? '严格工作区模式' : 'Strict workspace mode'}
            checked={securitySettings.strictWorkspaceMode}
            onChange={(e) => setSecuritySettings({ strictWorkspaceMode: e.target.checked })}
          />
          <Switch
            label={language === 'zh' ? '显示安全警告' : 'Show security warnings'}
            checked={securitySettings.showSecurityWarnings}
            onChange={(e) => setSecuritySettings({ showSecurityWarnings: e.target.checked })}
          />
        </div>
      </section>

      <section className="space-y-4">
        <h4 className="text-sm font-medium text-text-secondary uppercase tracking-wider text-xs mb-2">
          {language === 'zh' ? '忽略的目录' : 'Ignored Directories'}
        </h4>
        <p className="text-xs text-text-muted mb-3">
          {language === 'zh'
            ? '这些目录将被文件索引和 AI 分析忽略'
            : 'These directories will be ignored by file indexing and AI analysis'}
        </p>

        <div className="flex gap-2 mb-3">
          <Input
            value={newIgnoredDir}
            onChange={(e) => setNewIgnoredDir(e.target.value)}
            placeholder={language === 'zh' ? '输入目录名称 (例如: node_modules)' : 'Enter directory name (e.g., node_modules)'}
            onKeyDown={(e) => e.key === 'Enter' && handleAddIgnoredDir()}
            className="flex-1"
          />
          <Button
            variant="secondary"
            onClick={handleAddIgnoredDir}
            disabled={!newIgnoredDir.trim()}
            className="px-3"
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex flex-wrap gap-2 p-4 bg-surface/30 rounded-xl border border-border-subtle min-h-[100px]">
          {editorConfig.ignoredDirectories.map(dir => (
            <div key={dir} className="flex items-center gap-1.5 px-3 py-1.5 bg-surface rounded-lg border border-border-subtle text-xs text-text-secondary group hover:border-red-500/30 transition-colors">
              <span className="font-mono">{dir}</span>
              <button
                onClick={() => handleRemoveIgnoredDir(dir)}
                className="text-text-muted hover:text-red-400 transition-colors"
              >
                <Trash className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

// 索引设置组件
function IndexSettings({ language }: { language: Language }) {
  const { workspacePath } = useStore()
  const [embeddingProvider, setEmbeddingProvider] = useState('jina')
  const [embeddingApiKey, setEmbeddingApiKey] = useState('')
  const [showApiKey, setShowApiKey] = useState(false)
  const [isIndexing, setIsIndexing] = useState(false)
  const [indexStatus, setIndexStatus] = useState<{ totalFiles: number; indexedFiles: number; isIndexing: boolean } | null>(null)

  const EMBEDDING_PROVIDERS = [
    { id: 'jina', name: 'Jina AI', description: language === 'zh' ? '免费 100万 tokens/月，专为代码优化' : 'Free 100M tokens/month, optimized for code' },
    { id: 'voyage', name: 'Voyage AI', description: language === 'zh' ? '免费 5000万 tokens，代码专用模型' : 'Free 50M tokens, code-specific model' },
    { id: 'cohere', name: 'Cohere', description: language === 'zh' ? '免费 100次/分钟' : 'Free 100 calls/min' },
    { id: 'huggingface', name: 'HuggingFace', description: language === 'zh' ? '免费，有速率限制' : 'Free with rate limits' },
    { id: 'ollama', name: 'Ollama', description: language === 'zh' ? '本地运行，完全免费' : 'Local, completely free' },
    { id: 'openai', name: 'OpenAI', description: language === 'zh' ? '付费，质量最高' : 'Paid, highest quality' },
  ]

  // 加载保存的配置
  useEffect(() => {
    window.electronAPI.getSetting('embeddingConfig').then(config => {
      if (config) {
        const cfg = config as { provider?: string; apiKey?: string }
        if (cfg.provider) setEmbeddingProvider(cfg.provider)
        if (cfg.apiKey) setEmbeddingApiKey(cfg.apiKey)
      }
    })
  }, [])

  // 检查索引状态
  useEffect(() => {
    if (workspacePath) {
      window.electronAPI.indexStatus?.(workspacePath).then(status => {
        setIndexStatus(status)
      }).catch(() => { })
    }
  }, [workspacePath])

  const handleSaveEmbeddingConfig = async () => {
    await window.electronAPI.setSetting('embeddingConfig', {
      provider: embeddingProvider,
      apiKey: embeddingApiKey,
    })

    // 更新后端配置
    if (workspacePath) {
      await window.electronAPI.indexUpdateEmbeddingConfig?.(workspacePath, {
        provider: embeddingProvider as 'jina' | 'voyage' | 'openai' | 'cohere' | 'huggingface' | 'ollama',
        apiKey: embeddingApiKey,
      })
    }

    toast.success(language === 'zh' ? '索引配置已保存' : 'Indexing configuration saved')
  }

  const handleStartIndexing = async () => {
    if (!workspacePath) {
      toast.error(language === 'zh' ? '请先打开一个工作区' : 'Please open a workspace first')
      return
    }

    setIsIndexing(true)
    try {
      // 先保存配置
      await handleSaveEmbeddingConfig()

      // 开始索引
      await window.electronAPI.indexStart(workspacePath)
      toast.success(language === 'zh' ? '索引已开始，后台运行中...' : 'Indexing started, running in background...')
    } catch (error) {
      logger.settings.error('[IndexSettings] Start indexing failed:', error)
      toast.error(language === 'zh' ? '启动索引失败' : 'Failed to start indexing')
    } finally {
      setIsIndexing(false)
    }
  }

  const handleClearIndex = async () => {
    if (!workspacePath) return

    try {
      await window.electronAPI.indexClear?.(workspacePath)
      toast.success(language === 'zh' ? '索引已清除' : 'Index cleared')
      setIndexStatus(null)
    } catch (error) {
      toast.error(language === 'zh' ? '清除索引失败' : 'Failed to clear index')
    }
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <section>
        <h4 className="text-sm font-medium text-text-secondary uppercase tracking-wider text-xs mb-4">
          {language === 'zh' ? 'Embedding 提供商' : 'Embedding Provider'}
        </h4>
        <div className="space-y-4">
          <div className="p-5 bg-surface/30 rounded-xl border border-border-subtle space-y-4">
            <div>
              <label className="text-sm font-medium text-text-primary block mb-2">
                {language === 'zh' ? '选择提供商' : 'Select Provider'}
              </label>
              <Select
                value={embeddingProvider}
                onChange={(value) => setEmbeddingProvider(value)}
                options={EMBEDDING_PROVIDERS.map(p => ({ value: p.id, label: `${p.name} - ${p.description}` }))}
              />
            </div>

            {embeddingProvider !== 'ollama' && (
              <div>
                <label className="text-sm font-medium text-text-primary block mb-2">
                  API Key
                </label>
                <div className="relative">
                  <Input
                    type={showApiKey ? 'text' : 'password'}
                    value={embeddingApiKey}
                    onChange={(e) => setEmbeddingApiKey(e.target.value)}
                    placeholder={language === 'zh' ? '输入 API Key' : 'Enter API Key'}
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
                  >
                    {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}

            <Button variant="secondary" size="sm" onClick={handleSaveEmbeddingConfig}>
              {language === 'zh' ? '保存配置' : 'Save Configuration'}
            </Button>
          </div>
        </div>
      </section>

      <section>
        <h4 className="text-sm font-medium text-text-secondary uppercase tracking-wider text-xs mb-4">
          {language === 'zh' ? '代码库索引' : 'Codebase Index'}
        </h4>
        <div className="space-y-4">
          {indexStatus && (
            <div className="p-4 bg-surface/30 rounded-xl border border-border-subtle">
              <div className="text-sm text-text-primary">
                {language === 'zh' ? '索引状态' : 'Index Status'}: {indexStatus.isIndexing
                  ? (language === 'zh' ? '索引中...' : 'Indexing...')
                  : (language === 'zh' ? '就绪' : 'Ready')}
              </div>
              <div className="text-xs text-text-muted mt-1">
                {language === 'zh' ? '已索引文件' : 'Indexed files'}: {indexStatus.indexedFiles} / {indexStatus.totalFiles}
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <Button
              variant="primary"
              onClick={handleStartIndexing}
              disabled={isIndexing || !workspacePath}
              leftIcon={<Database className="w-4 h-4" />}
            >
              {isIndexing
                ? (language === 'zh' ? '索引中...' : 'Indexing...')
                : (language === 'zh' ? '开始索引' : 'Start Indexing')}
            </Button>

            <Button variant="secondary" onClick={handleClearIndex} disabled={!workspacePath}>
              {language === 'zh' ? '清除索引' : 'Clear Index'}
            </Button>
          </div>

          {!workspacePath && (
            <div className="flex items-center gap-2 text-xs text-warning">
              <AlertTriangle className="w-4 h-4" />
              {language === 'zh' ? '请先打开一个工作区才能进行索引' : 'Please open a workspace first to start indexing'}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

function DataPathDisplay() {
  const [path, setPath] = useState('')
  useEffect(() => {
    // @ts-ignore
    window.electronAPI.getConfigPath?.().then(setPath)
  }, [])
  return <span>{path || '...'}</span>
}

// 系统设置组件
function SystemSettings({ language }: { language: Language }) {
  const [isClearing, setIsClearing] = useState(false)

  const handleClearCache = async () => {
    setIsClearing(true)
    try {
      const keysToRemove = [
        'adnify-editor-config',
        'adnify-workspace',
        'adnify-sessions',
        'adnify-threads',
      ]
      keysToRemove.forEach(key => localStorage.removeItem(key))

      try {
        // @ts-ignore
        await (window.electronAPI as any).clearIndex?.()
      } catch { }

      await window.electronAPI.setSetting('editorConfig', undefined)
      toast.success(language === 'zh' ? '缓存已清除' : 'Cache cleared')
    } catch (error) {
      logger.settings.error('Failed to clear cache:', error)
      toast.error(language === 'zh' ? '清除缓存失败' : 'Failed to clear cache')
    } finally {
      setIsClearing(false)
    }
  }

  const handleReset = async () => {
    if (confirm(language === 'zh' ? '确定要重置所有设置吗？这将丢失所有自定义配置。' : 'Are you sure you want to reset all settings? This will lose all custom configurations.')) {
      await window.electronAPI.setSetting('llmConfig', undefined)
      await window.electronAPI.setSetting('editorSettings', undefined)
      await window.electronAPI.setSetting('editorConfig', undefined)
      await window.electronAPI.setSetting('autoApprove', undefined)
      await window.electronAPI.setSetting('providerConfigs', undefined)
      await window.electronAPI.setSetting('promptTemplateId', undefined)
      await window.electronAPI.setSetting('aiInstructions', undefined)
      await window.electronAPI.setSetting('currentTheme', undefined)
      localStorage.clear()
      window.location.reload()
    }
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <section>
        <h4 className="text-sm font-medium text-text-secondary uppercase tracking-wider text-xs mb-4">
          {language === 'zh' ? '存储与缓存' : 'Storage & Cache'}
        </h4>
        <div className="space-y-4">
          {/* 数据存储路径 */}
          <div className="p-5 bg-surface/30 rounded-xl border border-border-subtle space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-text-primary">{language === 'zh' ? '配置存储路径' : 'Config Storage Path'}</div>
                <div className="text-xs text-text-muted mt-1">{language === 'zh' ? '仅更改配置文件的存储位置，不影响缓存' : 'Only changes where config files are stored, cache remains default'}</div>
              </div>
              <Button variant="secondary" size="sm" onClick={async () => {
                const newPath = await window.electronAPI.openFolder()
                if (newPath) {
                  // @ts-ignore
                  const success = await window.electronAPI.setConfigPath?.(newPath)
                  if (success) {
                    toast.success(language === 'zh' ? '路径已更新，重启后生效' : 'Path updated, restart required to take effect')
                  } else {
                    toast.error(language === 'zh' ? '更新路径失败' : 'Failed to update path')
                  }
                }
              }}>
                {language === 'zh' ? '更改路径' : 'Change Path'}
              </Button>
            </div>

            <div className="flex items-start gap-2 p-3 bg-background/50 rounded-lg border border-border-subtle">
              <HardDrive className="w-4 h-4 text-text-muted mt-0.5" />
              <div className="text-xs text-text-secondary font-mono break-all">
                {/* 这里我们需要一个方式获取当前路径，或者直接调用 electronAPI */}
                <DataPathDisplay />
              </div>
            </div>

            <div className="flex items-center gap-2 text-[10px] text-status-warning">
              <AlertTriangle className="w-3.5 h-3.5" />
              {language === 'zh' ? '更改路径后需要手动重启应用以应用所有变更' : 'Restart application manually after changing path to apply all changes'}
            </div>
          </div>

          <div className="flex items-center justify-between p-5 bg-surface/30 rounded-xl border border-border-subtle">
            <div>
              <div className="text-sm font-medium text-text-primary">{language === 'zh' ? '清除缓存' : 'Clear Cache'}</div>
              <div className="text-xs text-text-muted mt-1">{language === 'zh' ? '清除编辑器缓存、索引数据和临时文件' : 'Clear editor cache, index data, and temporary files'}</div>
            </div>
            <Button variant="secondary" size="sm" onClick={handleClearCache} disabled={isClearing}>
              {isClearing ? (language === 'zh' ? '清除中...' : 'Clearing...') : (language === 'zh' ? '清除' : 'Clear')}
            </Button>
          </div>

          <div className="flex items-center justify-between p-5 bg-red-500/5 rounded-xl border border-red-500/10">
            <div>
              <div className="text-sm font-medium text-red-400">{language === 'zh' ? '重置所有设置' : 'Reset All Settings'}</div>
              <div className="text-xs text-text-muted mt-1">{language === 'zh' ? '恢复出厂设置，不可撤销' : 'Restore factory settings, irreversible'}</div>
            </div>
            <Button variant="danger" size="sm" onClick={handleReset}>
              {language === 'zh' ? '重置' : 'Reset'}
            </Button>
          </div>
        </div>
      </section>

      <section>
        <h4 className="text-sm font-medium text-text-secondary uppercase tracking-wider text-xs mb-4">
          {language === 'zh' ? '关于' : 'About'}
        </h4>
        <div className="p-8 bg-surface/30 rounded-xl border border-white/5 text-center">
          <div className="w-12 h-12 bg-accent/20 rounded-xl flex items-center justify-center mx-auto mb-4">
            <Monitor className="w-6 h-6 text-accent" />
          </div>
          <div className="text-xl font-bold text-text-primary mb-1">Adnify</div>
          <div className="text-xs text-text-muted font-mono mb-6">v0.1.0-alpha</div>
          <div className="text-xs text-text-secondary">
            Built with Electron, React, Monaco Editor & Tailwind CSS
          </div>
        </div>
      </section>
    </div>
  )
}
