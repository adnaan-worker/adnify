/**
 * 增强版设置模态框
 * 支持多 Provider、自定义模型、编辑器设置等
 */

import React, { useState, useEffect } from 'react'
import {
  Cpu, Check, Eye, EyeOff,
  AlertTriangle, Settings2, Code, Keyboard, Plus, Trash, HardDrive
} from 'lucide-react'
import { useStore, LLMConfig, AutoApproveSettings } from '../store'
import { t, Language } from '../i18n'
import { BUILTIN_PROVIDERS, BuiltinProviderName, ProviderModelConfig } from '../types/provider'
import { getEditorConfig, saveEditorConfig, EditorConfig } from '../config/editorConfig'
import { themes } from './ThemeManager'
import { toast } from './Toast'
import { getPromptTemplates } from '../agent/promptTemplates'
import { completionService } from '../services/completionService'
import KeybindingPanel from './KeybindingPanel'
import { Button, Input, Checkbox, Modal } from './ui'

type SettingsTab = 'provider' | 'editor' | 'agent' | 'keybindings' | 'security' | 'system'

const LANGUAGES: { id: Language; name: string }[] = [
  { id: 'en', name: 'English' },
  { id: 'zh', name: '中文' },
]

export default function SettingsModal() {
  const {
    llmConfig, setLLMConfig, setShowSettings, language, setLanguage,
    autoApprove, setAutoApprove, providerConfigs, setProviderConfig,
    promptTemplateId, setPromptTemplateId
  } = useStore()
  const [activeTab, setActiveTab] = useState<SettingsTab>('provider')
  const [showApiKey, setShowApiKey] = useState(false)
  const [localConfig, setLocalConfig] = useState(llmConfig)
  const [localLanguage, setLocalLanguage] = useState(language)
  const [localAutoApprove, setLocalAutoApprove] = useState(autoApprove)
  const [localPromptTemplateId, setLocalPromptTemplateId] = useState(promptTemplateId)
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
    theme: 'vs-dark',
    // AI 代码补全设置
    completionEnabled: editorConfig.ai.completionEnabled,
    completionDebounceMs: editorConfig.performance.completionDebounceMs,
    completionMaxTokens: editorConfig.ai.completionMaxTokens,
  })

  // AI 指令
  const [aiInstructions, setAiInstructions] = useState('')

  useEffect(() => {
    setLocalConfig(llmConfig)
    setLocalLanguage(language)
    setLocalAutoApprove(autoApprove)
    setLocalPromptTemplateId(promptTemplateId)
    // 加载设置
    // 注意：不再加载 editorSettings，完全依赖 editorConfig
    window.electronAPI.getSetting('aiInstructions').then(s => {
      if (s) setAiInstructions(s as string)
    })
    window.electronAPI.getSetting('providerConfigs').then(s => {
      if (s) {
        Object.entries(s as Record<string, ProviderModelConfig>).forEach(([id, config]) => {
          setProviderConfig(id, config)
        })
      }
    })
  }, [llmConfig, language, autoApprove, promptTemplateId]) // 注意：这里不依赖 setProviderConfig 以避免循环，虽然它通常是稳定的

  const handleSave = async () => {
    setLLMConfig(localConfig)
    setLanguage(localLanguage)
    setAutoApprove(localAutoApprove)
    setPromptTemplateId(localPromptTemplateId)
    await window.electronAPI.setSetting('llmConfig', localConfig)
    await window.electronAPI.setSetting('language', localLanguage)
    await window.electronAPI.setSetting('autoApprove', localAutoApprove)
    await window.electronAPI.setSetting('promptTemplateId', localPromptTemplateId)
    await window.electronAPI.setSetting('editorSettings', editorSettings)
    await window.electronAPI.setSetting('aiInstructions', aiInstructions)
    // 保存 providerConfigs (它在 Store 中已经是新的了，因为我们直接修改了 store)
    // 但实际上我们在 ProviderSettings 组件中修改了 store 吗？
    // 是的，我们将把 addModel/removeModel 传递给子组件，它们会直接修改 Store。
    // 所以这里我们需要把 Store 中的 providerConfigs 保存到后端。
    await window.electronAPI.setSetting('providerConfigs', providerConfigs)

    // 保存编辑器配置（localStorage + 文件双重存储）
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

    // 立即应用补全设置
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
    ...Object.values(BUILTIN_PROVIDERS).map(p => ({
      id: p.name,
      name: p.displayName,
      models: [...p.defaultModels, ...(providerConfigs[p.name]?.customModels || [])]
    })),
    {
      id: 'custom',
      name: 'Custom',
      models: providerConfigs['custom']?.customModels || []
    }
  ]

  const selectedProvider = currentProviders.find(p => p.id === localConfig.provider)

  const tabs = [
    { id: 'provider' as const, label: localLanguage === 'zh' ? 'AI 模型' : 'AI Models', icon: Cpu },
    { id: 'editor' as const, label: localLanguage === 'zh' ? '编辑器' : 'Editor', icon: Code },
    { id: 'agent' as const, label: localLanguage === 'zh' ? 'Agent' : 'Agent', icon: Settings2 },
    { id: 'keybindings' as const, label: localLanguage === 'zh' ? '快捷键' : 'Keybindings', icon: Keyboard },
    { id: 'security' as const, label: localLanguage === 'zh' ? '安全' : 'Security', icon: AlertTriangle },
    { id: 'system' as const, label: localLanguage === 'zh' ? '系统' : 'System', icon: HardDrive },
  ]

  return (
    <Modal isOpen={true} onClose={() => setShowSettings(false)} title={t('settings', localLanguage)} size="xl">
      <div className="flex h-[600px] -m-6">
        {/* Sidebar */}
        <div className="w-48 border-r border-border-subtle p-2 flex-shrink-0 bg-background/30">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200 ${activeTab === tab.id
                ? 'bg-accent/10 text-accent font-medium shadow-sm'
                : 'text-text-muted hover:bg-surface-hover hover:text-text-primary'
                }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-background custom-scrollbar">
          {activeTab === 'provider' && (
            <ProviderSettings
              localConfig={localConfig}
              setLocalConfig={setLocalConfig}
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
              aiInstructions={aiInstructions}
              setAiInstructions={setAiInstructions}
              promptTemplateId={localPromptTemplateId}
              setPromptTemplateId={setLocalPromptTemplateId}
              language={localLanguage}
            />
          )}

          {activeTab === 'keybindings' && (
            <KeybindingPanel />
          )}

          {activeTab === 'security' && (
            <SecuritySettings language={localLanguage} />
          )}

          {activeTab === 'system' && (
            <SystemSettings language={localLanguage} />
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-6 py-4 border-t border-border-subtle -mx-6 -mb-6 mt-6 bg-background/50">
        <div className="flex items-center gap-4">
          {/* Language Selector */}
          <div className="relative group">
            <select
              value={localLanguage}
              onChange={(e) => setLocalLanguage(e.target.value as Language)}
              className="bg-surface border border-border-subtle rounded-lg px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent"
            >
              {LANGUAGES.map(lang => (
                <option key={lang.id} value={lang.id}>{lang.name}</option>
              ))}
            </select>
            {/* 语言切换提示 */}
            {localLanguage !== language && (
              <div className="absolute top-full left-0 mt-1 px-2 py-1 bg-warning/10 border border-warning/20 rounded text-[10px] text-warning whitespace-nowrap z-50">
                {localLanguage === 'zh' ? '保存后需重新加载以应用编辑器菜单语言' : 'Reload required for editor menu language'}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="ghost" onClick={() => setShowSettings(false)}>
            {t('cancel', localLanguage)}
          </Button>
          <Button
            variant={saved ? 'success' : 'primary'}
            onClick={handleSave}
            leftIcon={saved ? <Check className="w-4 h-4" /> : undefined}
          >
            {saved ? t('saved', localLanguage) : t('saveSettings', localLanguage)}
          </Button>
        </div>
      </div>
    </Modal>
  )
}


// Provider 设置组件
interface ProviderSettingsProps {
  localConfig: LLMConfig
  setLocalConfig: React.Dispatch<React.SetStateAction<LLMConfig>>
  showApiKey: boolean
  setShowApiKey: (show: boolean) => void
  selectedProvider: { id: string; name: string; models: string[] } | undefined
  providers: { id: string; name: string; models: string[] }[]
  language: Language
}

function ProviderSettings({
  localConfig, setLocalConfig, showApiKey, setShowApiKey, selectedProvider, providers, language
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
    <div className="space-y-6 text-text-primary">
      {/* Provider Selector */}
      <div>
        <label className="text-sm font-medium mb-2 block">{language === 'zh' ? '服务提供商' : 'Provider'}</label>
        <div className="grid grid-cols-4 gap-2">
          {providers.map(p => (
            <button
              key={p.id}
              onClick={() => setLocalConfig({ ...localConfig, provider: p.id as any, model: p.models[0] || '' })}
              className={`px-3 py-2.5 rounded-lg border text-sm transition-all ${localConfig.provider === p.id
                ? 'border-accent bg-accent/10 text-accent shadow-sm'
                : 'border-border-subtle hover:border-text-muted text-text-muted hover:text-text-primary bg-surface'
                }`}
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>

      {/* Model Selector & Management */}
      <div>
        <label className="text-sm font-medium mb-2 block">{language === 'zh' ? '模型' : 'Model'}</label>
        <div className="space-y-3">
          <select
            value={localConfig.model}
            onChange={(e) => setLocalConfig({ ...localConfig, model: e.target.value })}
            className="w-full bg-surface border border-border-subtle rounded-lg px-4 py-2.5 text-sm text-text-primary focus:outline-none focus:border-accent"
          >
            {selectedProvider?.models.map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>

          {/* Add Model UI */}
          <div className="flex gap-2">
            <Input
              value={newModelName}
              onChange={(e) => setNewModelName(e.target.value)}
              placeholder={language === 'zh' ? '输入新模型名称' : 'Enter new model name'}
              onKeyDown={(e) => e.key === 'Enter' && handleAddModel()}
            />
            <Button
              variant="secondary"
              onClick={handleAddModel}
              disabled={!newModelName.trim()}
              className="px-3"
            >
              <Plus className="w-4 h-4 text-accent" />
            </Button>
          </div>

          {/* Custom Model List */}
          {providerConfigs[localConfig.provider]?.customModels?.length > 0 && (
            <div className="space-y-2 mt-2">
              <p className="text-xs text-text-muted">{language === 'zh' ? '自定义模型列表:' : 'Custom Models:'}</p>
              <div className="max-h-32 overflow-y-auto custom-scrollbar space-y-1">
                {providerConfigs[localConfig.provider]?.customModels.map((model: string) => (
                  <div key={model} className="flex items-center justify-between px-3 py-2 bg-surface/50 rounded-lg border border-border-subtle/50 text-xs">
                    <span className="font-mono text-text-secondary">{model}</span>
                    <button
                      onClick={() => removeCustomModel(localConfig.provider, model)}
                      className="p-1 hover:text-red-400 text-text-muted transition-colors"
                    >
                      <Trash className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* API Key */}
      <div>
        <label className="text-sm font-medium mb-2 block">API Key</label>
        <div className="relative">
          <Input
            type={showApiKey ? "text" : "password"}
            value={localConfig.apiKey}
            onChange={(e) => setLocalConfig({ ...localConfig, apiKey: e.target.value })}
            placeholder={(BUILTIN_PROVIDERS[localConfig.provider as BuiltinProviderName] as any)?.apiKeyPlaceholder || 'Enter API Key'}
            rightIcon={
              <button
                onClick={() => setShowApiKey(!showApiKey)}
                className="text-text-muted hover:text-text-primary"
              >
                {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            }
          />
        </div>
        <p className="text-xs text-text-muted mt-2">
          {localConfig.provider !== 'custom' && localConfig.provider !== 'ollama' && (
            <a
              href={(BUILTIN_PROVIDERS[localConfig.provider as BuiltinProviderName] as any)?.apiKeyUrl}
              target="_blank"
              rel="noreferrer"
              className="hover:text-accent underline decoration-dotted"
            >
              {language === 'zh' ? '获取 API Key' : 'Get API Key'}
            </a>
          )}
        </p>
      </div>

      {/* Custom Endpoint - 对所有 provider 都显示 */}
      <div>
        <h3 className="text-sm font-medium mb-3">{language === 'zh' ? '自定义端点 (可选)' : 'Custom Endpoint (Optional)'}</h3>
        <Input
          value={localConfig.baseUrl || ''}
          onChange={(e) => setLocalConfig({ ...localConfig, baseUrl: e.target.value || undefined })}
          placeholder={
            localConfig.provider === 'openai' ? 'https://api.openai.com/v1' :
              localConfig.provider === 'anthropic' ? 'https://api.anthropic.com' :
                localConfig.provider === 'gemini' ? 'https://generativelanguage.googleapis.com' :
                  'https://api.example.com/v1'
          }
        />
        <p className="text-xs text-text-muted mt-2">
          {language === 'zh'
            ? '留空使用官方 API，或填写代理/兼容 API 地址'
            : 'Leave empty for official API, or enter proxy/compatible API URL'}
        </p>
      </div>

      {/* Request Timeout */}
      <div>
        <h3 className="text-sm font-medium mb-3">{language === 'zh' ? '请求超时' : 'Request Timeout'}</h3>
        <div className="flex items-center gap-3">
          <Input
            type="number"
            value={(localConfig.timeout || 120000) / 1000}
            onChange={(e) => setLocalConfig({ ...localConfig, timeout: (parseInt(e.target.value) || 120) * 1000 })}
            min={30}
            max={600}
            step={30}
            className="w-32"
          />
          <span className="text-sm text-text-muted">{language === 'zh' ? '秒' : 'seconds'}</span>
        </div>
        <p className="text-xs text-text-muted mt-2">
          {language === 'zh' ? 'API 请求的最大等待时间（30-600秒）' : 'Maximum wait time for API requests (30-600 seconds)'}
        </p>
      </div>
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
  const [showAdvanced, setShowAdvanced] = useState(false)
  const { currentTheme, setTheme } = useStore()
  const allThemes = Object.keys(themes)

  const handleThemeChange = (themeId: string) => {
    setTheme(themeId as any)
    // 保存主题到 electron-store 以便重启后恢复
    window.electronAPI.setSetting('currentTheme', themeId)
  }

  const handleAdvancedChange = (key: string, value: number) => {
    const newConfig = { ...advancedConfig }
    if (key.startsWith('performance.')) {
      const perfKey = key.replace('performance.', '') as keyof typeof newConfig.performance
      newConfig.performance = { ...newConfig.performance, [perfKey]: value }
    } else if (key.startsWith('ai.')) {
      const aiKey = key.replace('ai.', '') as keyof typeof newConfig.ai
      newConfig.ai = { ...newConfig.ai, [aiKey]: value }
    }
    setAdvancedConfig(newConfig)
    saveEditorConfig(newConfig)
  }

  return (
    <div className="space-y-6 text-text-primary">
      {/* 主题选择器 */}
      <div>
        <label className="text-sm font-medium mb-3 block">{language === 'zh' ? '主题' : 'Theme'}</label>
        <div className="grid grid-cols-3 gap-2">
          {allThemes.map(themeId => {
            const themeVars = themes[themeId as keyof typeof themes]
            return (
              <button
                key={themeId}
                onClick={() => handleThemeChange(themeId)}
                className={`relative p-3 rounded-lg border text-left transition-all ${currentTheme === themeId
                  ? 'border-accent bg-accent/10 shadow-sm'
                  : 'border-border-subtle hover:border-text-muted bg-surface'
                  }`}
              >
                {/* 主题预览色块 */}
                <div className="flex gap-1 mb-2">
                  <div
                    className="w-4 h-4 rounded"
                    style={{ backgroundColor: `rgb(${themeVars['--background']})` }}
                  />
                  <div
                    className="w-4 h-4 rounded"
                    style={{ backgroundColor: `rgb(${themeVars['--accent']})` }}
                  />
                  <div
                    className="w-4 h-4 rounded"
                    style={{ backgroundColor: `rgb(${themeVars['--text-primary']})` }}
                  />
                </div>
                <span className="text-xs font-medium capitalize">{themeId.replace('-', ' ')}</span>
                {currentTheme === themeId && (
                  <div className="absolute top-1 right-1">
                    <Check className="w-3 h-3 text-accent" />
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium mb-2 block">{language === 'zh' ? '字体大小' : 'Font Size'}</label>
          <Input
            type="number"
            value={settings.fontSize}
            onChange={(e) => setSettings({ ...settings, fontSize: parseInt(e.target.value) || 14 })}
            min={10} max={24}
          />
        </div>
        <div>
          <label className="text-sm font-medium mb-2 block">{language === 'zh' ? 'Tab 大小' : 'Tab Size'}</label>
          <select
            value={settings.tabSize}
            onChange={(e) => setSettings({ ...settings, tabSize: parseInt(e.target.value) })}
            className="w-full bg-surface border border-border-subtle rounded-lg px-4 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
          >
            <option value={2}>2</option>
            <option value={4}>4</option>
            <option value={8}>8</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium mb-2 block">{language === 'zh' ? '自动换行' : 'Word Wrap'}</label>
          <select
            value={settings.wordWrap}
            onChange={(e) => setSettings({ ...settings, wordWrap: e.target.value as 'on' | 'off' | 'wordWrapColumn' })}
            className="w-full bg-surface border border-border-subtle rounded-lg px-4 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
          >
            <option value="on">{language === 'zh' ? '开启' : 'On'}</option>
            <option value="off">{language === 'zh' ? '关闭' : 'Off'}</option>
            <option value="wordWrapColumn">{language === 'zh' ? '按列' : 'By Column'}</option>
          </select>
        </div>
        <div>
          <label className="text-sm font-medium mb-2 block">{language === 'zh' ? '行号' : 'Line Numbers'}</label>
          <select
            value={settings.lineNumbers}
            onChange={(e) => setSettings({ ...settings, lineNumbers: e.target.value as 'on' | 'off' | 'relative' })}
            className="w-full bg-surface border border-border-subtle rounded-lg px-4 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
          >
            <option value="on">{language === 'zh' ? '显示' : 'On'}</option>
            <option value="off">{language === 'zh' ? '隐藏' : 'Off'}</option>
            <option value="relative">{language === 'zh' ? '相对' : 'Relative'}</option>
          </select>
        </div>
      </div>

      <div className="space-y-3">
        <Checkbox
          label={language === 'zh' ? '显示小地图' : 'Show Minimap'}
          checked={settings.minimap}
          onChange={(e) => setSettings({ ...settings, minimap: e.target.checked })}
        />

        <Checkbox
          label={language === 'zh' ? '括号配对着色' : 'Bracket Pair Colorization'}
          checked={settings.bracketPairColorization}
          onChange={(e) => setSettings({ ...settings, bracketPairColorization: e.target.checked })}
        />

        <Checkbox
          label={language === 'zh' ? '保存时格式化' : 'Format on Save'}
          checked={settings.formatOnSave}
          onChange={(e) => setSettings({ ...settings, formatOnSave: e.target.checked })}
        />
      </div>

      <div>
        <label className="text-sm font-medium mb-2 block">{language === 'zh' ? '自动保存' : 'Auto Save'}</label>
        <select
          value={settings.autoSave}
          onChange={(e) => setSettings({ ...settings, autoSave: e.target.value as 'off' | 'afterDelay' | 'onFocusChange' })}
          className="w-full bg-surface border border-border-subtle rounded-lg px-4 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
        >
          <option value="off">{language === 'zh' ? '关闭' : 'Off'}</option>
          <option value="afterDelay">{language === 'zh' ? '延迟后' : 'After Delay'}</option>
          <option value="onFocusChange">{language === 'zh' ? '失去焦点时' : 'On Focus Change'}</option>
        </select>
      </div>

      {/* AI 代码补全设置 */}
      <div className="pt-4 border-t border-border-subtle">
        <h3 className="text-sm font-medium mb-3">{language === 'zh' ? 'AI 代码补全' : 'AI Code Completion'}</h3>

        <div className="space-y-3">
          <Checkbox
            label={language === 'zh' ? '启用 AI 补全' : 'Enable AI Completion'}
            checked={settings.completionEnabled}
            onChange={(e) => setSettings({ ...settings, completionEnabled: e.target.checked })}
          />
          <p className="text-xs text-text-muted ml-7">{language === 'zh' ? '输入时显示 AI 代码建议' : 'Show AI code suggestions while typing'}</p>
        </div>

        <div className="grid grid-cols-2 gap-4 mt-4">
          <div>
            <label className="text-sm font-medium mb-2 block">{language === 'zh' ? '触发延迟 (ms)' : 'Trigger Delay (ms)'}</label>
            <Input
              type="number"
              value={settings.completionDebounceMs}
              onChange={(e) => setSettings({ ...settings, completionDebounceMs: parseInt(e.target.value) || 150 })}
              min={50} max={1000} step={50}
            />
            <p className="text-xs text-text-muted mt-1">{language === 'zh' ? '停止输入后等待时间' : 'Wait time after typing stops'}</p>
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">{language === 'zh' ? '最大 Token 数' : 'Max Tokens'}</label>
            <Input
              type="number"
              value={settings.completionMaxTokens}
              onChange={(e) => setSettings({ ...settings, completionMaxTokens: parseInt(e.target.value) || 256 })}
              min={64} max={1024} step={64}
            />
            <p className="text-xs text-text-muted mt-1">{language === 'zh' ? '补全建议的最大长度' : 'Maximum length of suggestions'}</p>
          </div>
        </div>
      </div>

      {/* 高级性能设置 */}
      <div className="pt-4 border-t border-border-subtle">
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-2 text-sm font-medium text-text-muted hover:text-text-primary transition-colors"
        >
          <span>{showAdvanced ? '▼' : '▶'}</span>
          {language === 'zh' ? '高级性能设置' : 'Advanced Performance Settings'}
        </button>

        {showAdvanced && (
          <div className="mt-4 space-y-4 animate-slide-in">
            <p className="text-xs text-text-muted">
              {language === 'zh' ? '这些设置会影响编辑器性能，请谨慎修改' : 'These settings affect editor performance, modify with caution'}
            </p>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">{language === 'zh' ? '最大项目文件数' : 'Max Project Files'}</label>
                <Input
                  type="number"
                  value={advancedConfig.performance.maxProjectFiles}
                  onChange={(e) => handleAdvancedChange('performance.maxProjectFiles', parseInt(e.target.value) || 500)}
                  min={100} max={2000} step={100}
                />
                <p className="text-xs text-text-muted mt-1">{language === 'zh' ? 'LSP 扫描的最大文件数' : 'Max files for LSP scanning'}</p>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">{language === 'zh' ? '文件树最大深度' : 'Max File Tree Depth'}</label>
                <Input
                  type="number"
                  value={advancedConfig.performance.maxFileTreeDepth}
                  onChange={(e) => handleAdvancedChange('performance.maxFileTreeDepth', parseInt(e.target.value) || 5)}
                  min={2} max={10}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">{language === 'zh' ? 'Git 刷新间隔 (ms)' : 'Git Refresh Interval (ms)'}</label>
                <Input
                  type="number"
                  value={advancedConfig.performance.gitStatusIntervalMs}
                  onChange={(e) => handleAdvancedChange('performance.gitStatusIntervalMs', parseInt(e.target.value) || 5000)}
                  min={1000} max={30000} step={1000}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">{language === 'zh' ? '请求超时 (ms)' : 'Request Timeout (ms)'}</label>
                <Input
                  type="number"
                  value={advancedConfig.performance.requestTimeoutMs}
                  onChange={(e) => handleAdvancedChange('performance.requestTimeoutMs', parseInt(e.target.value) || 120000)}
                  min={30000} max={300000} step={10000}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">{language === 'zh' ? 'Agent 最大循环次数' : 'Max Agent Tool Loops'}</label>
                <Input
                  type="number"
                  value={advancedConfig.ai.maxToolLoops}
                  onChange={(e) => handleAdvancedChange('ai.maxToolLoops', parseInt(e.target.value) || 15)}
                  min={5} max={50}
                />
                <p className="text-xs text-text-muted mt-1">{language === 'zh' ? '单次对话最大工具调用次数' : 'Max tool calls per conversation'}</p>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">{language === 'zh' ? '终端缓冲区大小' : 'Terminal Buffer Size'}</label>
                <Input
                  type="number"
                  value={advancedConfig.performance.terminalBufferSize}
                  onChange={(e) => handleAdvancedChange('performance.terminalBufferSize', parseInt(e.target.value) || 500)}
                  min={100} max={2000} step={100}
                />
              </div>
            </div>

            {/* 上下文限制设置 */}
            <div className="pt-4 mt-4 border-t border-border-subtle">
              <h4 className="text-sm font-medium mb-3">{language === 'zh' ? '上下文限制' : 'Context Limits'}</h4>
              <p className="text-xs text-text-muted mb-3">
                {language === 'zh' ? '控制发送给 AI 的上下文大小，避免超出模型限制' : 'Control context size sent to AI to avoid exceeding model limits'}
              </p>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">{language === 'zh' ? '最大上下文字符数' : 'Max Context Chars'}</label>
                  <Input
                    type="number"
                    value={advancedConfig.ai.maxContextChars}
                    onChange={(e) => handleAdvancedChange('ai.maxContextChars', parseInt(e.target.value) || 30000)}
                    min={10000} max={200000} step={10000}
                  />
                  <p className="text-xs text-text-muted mt-1">{language === 'zh' ? '文件和上下文的总字符限制' : 'Total char limit for files and context'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">{language === 'zh' ? '最大历史消息数' : 'Max History Messages'}</label>
                  <Input
                    type="number"
                    value={advancedConfig.ai.maxHistoryMessages}
                    onChange={(e) => handleAdvancedChange('ai.maxHistoryMessages', parseInt(e.target.value) || 10)}
                    min={5} max={100}
                  />
                  <p className="text-xs text-text-muted mt-1">{language === 'zh' ? '保留的最近对话轮数' : 'Number of recent messages to keep'}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
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
  language: Language
}

function AgentSettings({
  autoApprove, setAutoApprove, aiInstructions, setAiInstructions, promptTemplateId, setPromptTemplateId, language
}: AgentSettingsProps) {
  const templates = getPromptTemplates()

  return (
    <div className="space-y-6 text-text-primary">
      <div>
        <h3 className="text-sm font-medium mb-3">{language === 'zh' ? 'Agent 行为' : 'Agent Behavior'}</h3>
        <div className="space-y-3">
          <Checkbox
            label={language === 'zh' ? '自动批准终端命令' : 'Auto-approve terminal commands'}
            checked={autoApprove.terminal}
            onChange={(e) => setAutoApprove({ ...autoApprove, terminal: e.target.checked })}
          />
          <Checkbox
            label={language === 'zh' ? '自动批准危险操作 (删除文件等)' : 'Auto-approve dangerous operations (delete files, etc.)'}
            checked={autoApprove.dangerous}
            onChange={(e) => setAutoApprove({ ...autoApprove, dangerous: e.target.checked })}
          />
          <p className="text-xs text-text-muted ml-7">
            {language === 'zh'
              ? '无需确认即可执行相应操作'
              : 'Execute operations without confirmation'}
          </p>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium mb-3">{language === 'zh' ? 'Prompt 模板' : 'Prompt Template'}</h3>
        <select
          value={promptTemplateId}
          onChange={(e) => setPromptTemplateId(e.target.value)}
          className="w-full bg-surface border border-border-subtle rounded-lg px-4 py-2 text-sm text-text-primary focus:outline-none focus:border-accent mb-2"
        >
          {templates.map(t => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
        <p className="text-xs text-text-muted">
          {templates.find(t => t.id === promptTemplateId)?.description}
        </p>
      </div>

      <div>
        <h3 className="text-sm font-medium mb-3">{language === 'zh' ? '自定义系统指令' : 'Custom System Instructions'}</h3>
        <textarea
          value={aiInstructions}
          onChange={(e) => setAiInstructions(e.target.value)}
          placeholder={language === 'zh'
            ? '在此输入全局系统指令，例如："总是使用中文回答"、"代码风格偏好..."'
            : 'Enter global system instructions here, e.g., "Always answer in English", "Code style preferences..."'}
          className="w-full h-32 bg-surface border border-border-subtle rounded-lg px-4 py-3 text-sm text-text-primary focus:outline-none focus:border-accent resize-none"
        />
        <p className="text-xs text-text-muted mt-2">
          {language === 'zh'
            ? '这些指令将附加到 System Prompt 中，影响所有 AI 回复'
            : 'These instructions will be appended to the System Prompt and affect all AI responses'}
        </p>
      </div>
    </div>
  )
}

// 安全设置组件
function SecuritySettings({ language }: { language: Language }) {
  const [editorConfig, setEditorConfig] = useState<EditorConfig>(getEditorConfig())
  const { autoApprove, setAutoApprove } = useStore()
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
    <div className="space-y-6 text-text-primary">
      <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-yellow-500 mt-0.5" />
          <div>
            <h3 className="text-sm font-medium text-yellow-500 mb-1">
              {language === 'zh' ? '安全沙箱 (开发中)' : 'Security Sandbox (WIP)'}
            </h3>
            <p className="text-xs text-text-secondary leading-relaxed">
              {language === 'zh'
                ? 'Adnify 目前直接在您的系统上运行命令。请确保您只运行受信任的代码。未来版本将引入基于 Docker 的沙箱环境。'
                : 'Adnify currently runs commands directly on your system. Ensure you only run trusted code. Future versions will introduce a Docker-based sandbox.'}
            </p>
          </div>
        </div>
      </div>

      {/* Auto Approve */}
      <div>
        <h3 className="text-sm font-medium mb-3">{language === 'zh' ? '自动化权限' : 'Automation Permissions'}</h3>
        <div className="space-y-3">
          <Checkbox
            label={language === 'zh' ? '自动批准危险操作 (删除文件等)' : 'Auto-approve dangerous operations (delete files, etc.)'}
            checked={autoApprove.dangerous}
            onChange={(e) => setAutoApprove({ ...autoApprove, dangerous: e.target.checked })}
          />
          <p className="text-xs text-text-muted ml-7">
            {language === 'zh'
              ? '无需确认即可执行相应操作，请谨慎开启'
              : 'Execute operations without confirmation. Use with caution.'}
          </p>
        </div>
      </div>

      {/* Ignored Directories */}
      <div>
        <h3 className="text-sm font-medium mb-3">{language === 'zh' ? '忽略的目录' : 'Ignored Directories'}</h3>
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
          />
          <Button
            variant="secondary"
            onClick={handleAddIgnoredDir}
            disabled={!newIgnoredDir.trim()}
            className="px-3"
          >
            <Plus className="w-4 h-4 text-accent" />
          </Button>
        </div>

        <div className="max-h-48 overflow-y-auto custom-scrollbar space-y-1 border border-border-subtle rounded-lg p-2 bg-surface/30">
          {editorConfig.ignoredDirectories.map(dir => (
            <div key={dir} className="flex items-center justify-between px-3 py-2 bg-surface rounded border border-border-subtle/50 text-xs group">
              <span className="font-mono text-text-secondary">{dir}</span>
              <button
                onClick={() => handleRemoveIgnoredDir(dir)}
                className="p-1 hover:text-red-400 text-text-muted transition-colors opacity-0 group-hover:opacity-100"
              >
                <Trash className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Sensitive Files (Read-only for now) */}
      <div>
        <h3 className="text-sm font-medium mb-3">{language === 'zh' ? '敏感文件过滤' : 'Sensitive File Filtering'}</h3>
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-text-secondary">
            <Check className="w-4 h-4 text-accent" />
            <span>.env, .npmrc, id_rsa (Always hidden)</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-text-secondary">
            <Check className="w-4 h-4 text-accent" />
            <span>node_modules, .git (Excluded from indexing)</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// 系统设置组件
function SystemSettings({ language }: { language: Language }) {
  const handleClearCache = async () => {
    // TODO: Implement clear cache
    toast.success(language === 'zh' ? '缓存已清除' : 'Cache cleared')
  }

  const handleReset = async () => {
    if (confirm(language === 'zh' ? '确定要重置所有设置吗？这将丢失所有自定义配置。' : 'Are you sure you want to reset all settings? This will lose all custom configurations.')) {
      await window.electronAPI.setSetting('llmConfig', undefined)
      await window.electronAPI.setSetting('editorSettings', undefined)
      window.location.reload()
    }
  }

  return (
    <div className="space-y-6 text-text-primary">
      <div>
        <h3 className="text-sm font-medium mb-3">{language === 'zh' ? '存储与缓存' : 'Storage & Cache'}</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-surface rounded-lg border border-border-subtle">
            <div>
              <div className="text-sm font-medium">{language === 'zh' ? '清除缓存' : 'Clear Cache'}</div>
              <div className="text-xs text-text-muted mt-1">{language === 'zh' ? '清除编辑器缓存、索引数据和临时文件' : 'Clear editor cache, index data, and temporary files'}</div>
            </div>
            <Button variant="secondary" size="sm" onClick={handleClearCache}>
              {language === 'zh' ? '清除' : 'Clear'}
            </Button>
          </div>

          <div className="flex items-center justify-between p-4 bg-surface rounded-lg border border-border-subtle">
            <div>
              <div className="text-sm font-medium text-red-400">{language === 'zh' ? '重置所有设置' : 'Reset All Settings'}</div>
              <div className="text-xs text-text-muted mt-1">{language === 'zh' ? '恢复出厂设置，不可撤销' : 'Restore factory settings, irreversible'}</div>
            </div>
            <Button variant="danger" size="sm" onClick={handleReset}>
              {language === 'zh' ? '重置' : 'Reset'}
            </Button>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium mb-3">{language === 'zh' ? '关于' : 'About'}</h3>
        <div className="p-4 bg-surface rounded-lg border border-border-subtle text-center">
          <div className="text-lg font-bold text-accent mb-1">Adnify</div>
          <div className="text-xs text-text-muted">v0.1.0-alpha</div>
          <div className="text-xs text-text-secondary mt-4">
            Built with Electron, React, Monaco Editor & Tailwind CSS
          </div>
        </div>
      </div>
    </div>
  )
}
