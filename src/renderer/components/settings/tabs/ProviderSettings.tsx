/**
 * Provider 设置组件
 * 
 * 重构后版本：移除 CustomProviderEditor 和 AdapterOverridesEditor 依赖
 * 使用内联表单添加自定义厂商，使用 AI SDK 原生配置
 */

import { useState, useMemo, useEffect } from 'react'
import { Plus, Trash, Eye, EyeOff, Check, AlertTriangle, X, Server, Sliders, Box } from 'lucide-react'
import { useStore } from '@store'
import { PROVIDERS } from '@/shared/config/providers'
import { toast } from '@components/common/ToastProvider'
import { Button, Input, Select } from '@components/ui'
import { ProviderSettingsProps } from '../types'
import { isCustomProvider } from '@renderer/types/provider'

// 内置厂商 ID
const BUILTIN_PROVIDER_IDS = ['openai', 'anthropic', 'gemini', 'deepseek', 'groq']

// 协议类型选项
const PROTOCOL_OPTIONS = [
  { value: 'openai', label: 'OpenAI Compatible' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'google', label: 'Google (Gemini)' },
  { value: 'custom', label: 'Custom' },
]

function TestConnectionButton({ localConfig, language }: { localConfig: any; language: 'en' | 'zh' }) {
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
      const { checkProviderHealth } = await import('@/renderer/services/healthCheckService')
      const result = await checkProviderHealth(localConfig.provider, localConfig.apiKey, localConfig.baseUrl)
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
    <div className="flex items-center gap-3 mt-2">
      <Button variant="secondary" size="sm" onClick={handleTest} disabled={testing} className="h-9 px-4 text-xs font-medium">
        {testing ? (
          <span className="flex items-center gap-2">
            <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
            {language === 'zh' ? '测试中...' : 'Testing...'}
          </span>
        ) : (
          language === 'zh' ? '测试连接' : 'Test Connection'
        )}
      </Button>
      {status === 'success' && (
        <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded-full border border-emerald-400/20">
          <Check className="w-3 h-3" />
          {language === 'zh' ? '连接成功' : 'Connected'}
        </span>
      )}
      {status === 'error' && (
        <span className="flex items-center gap-1.5 text-xs font-medium text-red-400 bg-red-400/10 px-2 py-1 rounded-full border border-red-400/20" title={errorMsg}>
          <AlertTriangle className="w-3 h-3" />
          {errorMsg.length > 30 ? errorMsg.slice(0, 30) + '...' : errorMsg}
        </span>
      )}
    </div>
  )
}

// 内联的添加自定义 Provider 表单
function InlineCustomProviderForm({
  language,
  onSave,
  onCancel
}: {
  language: 'en' | 'zh'
  onSave: (config: { displayName: string; baseUrl: string; apiKey: string; protocol: string; model: string }) => void
  onCancel: () => void
}) {
  const [displayName, setDisplayName] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [protocol, setProtocol] = useState('openai')
  const [model, setModel] = useState('')

  const handleSubmit = () => {
    if (!displayName.trim() || !baseUrl.trim()) {
      toast.error(language === 'zh' ? '请填写名称和 API 端点' : 'Please enter name and API endpoint')
      return
    }
    onSave({ displayName: displayName.trim(), baseUrl: baseUrl.trim(), apiKey, protocol, model: model.trim() })
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-text-secondary">
            {language === 'zh' ? '显示名称' : 'Display Name'}
          </label>
          <Input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder={language === 'zh' ? '例如: 智谱 GLM' : 'e.g. My Provider'}
            className="bg-background/50 border-border text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-text-secondary">
            {language === 'zh' ? '协议类型' : 'Protocol'}
          </label>
          <Select
            value={protocol}
            onChange={setProtocol}
            options={PROTOCOL_OPTIONS}
            className="bg-background/50 border-border"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-text-secondary">
          {language === 'zh' ? 'API 端点' : 'API Endpoint'}
        </label>
        <Input
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
          placeholder="https://api.example.com/v1"
          className="bg-background/50 border-border font-mono text-xs"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-text-secondary">API Key</label>
          <Input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-..."
            className="bg-background/50 border-border font-mono text-xs"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-text-secondary">
            {language === 'zh' ? '默认模型' : 'Default Model'}
          </label>
          <Input
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder={language === 'zh' ? '例如: gpt-4' : 'e.g. gpt-4'}
            className="bg-background/50 border-border text-xs"
          />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          {language === 'zh' ? '取消' : 'Cancel'}
        </Button>
        <Button variant="primary" size="sm" onClick={handleSubmit}>
          {language === 'zh' ? '添加' : 'Add'}
        </Button>
      </div>
    </div>
  )
}

export function ProviderSettings({
  localConfig,
  setLocalConfig,
  localProviderConfigs,
  setLocalProviderConfigs,
  showApiKey,
  setShowApiKey,
  selectedProvider,
  providers,
  language,
}: ProviderSettingsProps) {
  const { addModel, removeModel, providerConfigs, removeProvider, setProvider } = useStore()
  const [newModelName, setNewModelName] = useState('')
  const [isAddingCustom, setIsAddingCustom] = useState(false)
  const [logitBiasString, setLogitBiasString] = useState('')

  // Sync logitBiasString with localConfig
  useEffect(() => {
    setLogitBiasString(localConfig.logitBias ? JSON.stringify(localConfig.logitBias, null, 2) : '')
  }, [localConfig.logitBias])

  // 从 providerConfigs 获取自定义厂商列表
  const customProviders = useMemo(() => {
    return Object.entries(providerConfigs)
      .filter(([id]) => isCustomProvider(id))
      .map(([id, config]) => ({ id, config }))
  }, [providerConfigs])

  // 当前选中的是自定义 Provider 吗？
  const isCustomSelected = isCustomProvider(localConfig.provider)
  const selectedCustomConfig = isCustomSelected ? providerConfigs[localConfig.provider] : null

  const handleAddModel = () => {
    if (newModelName.trim()) {
      addModel(localConfig.provider, newModelName.trim())
      setNewModelName('')
    }
  }

  // 选择内置 Provider
  const handleSelectBuiltinProvider = (providerId: string) => {
    // 保存当前配置
    const updatedConfigs = {
      ...localProviderConfigs,
      [localConfig.provider]: {
        ...localProviderConfigs[localConfig.provider],
        apiKey: localConfig.apiKey,
        baseUrl: localConfig.baseUrl,
        timeout: localConfig.timeout,
        model: localConfig.model,
      },
    }
    setLocalProviderConfigs(updatedConfigs)

    // 加载新 Provider 配置
    const nextConfig = updatedConfigs[providerId] || {}
    const providerInfo = PROVIDERS[providerId]
    setLocalConfig({
      ...localConfig,
      provider: providerId as any,
      apiKey: nextConfig.apiKey || '',
      baseUrl: nextConfig.baseUrl || providerInfo?.endpoint.default || '',
      timeout: nextConfig.timeout || providerInfo?.defaults.timeout || 120000,
      model: nextConfig.model || providerInfo?.models[0] || '',
    })
    setIsAddingCustom(false)
  }

  // 选择自定义 Provider
  const handleSelectCustomProvider = (id: string) => {
    // 保存当前配置
    const updatedConfigs = {
      ...localProviderConfigs,
      [localConfig.provider]: {
        ...localProviderConfigs[localConfig.provider],
        apiKey: localConfig.apiKey,
        baseUrl: localConfig.baseUrl,
        timeout: localConfig.timeout,
        model: localConfig.model,
      },
    }
    setLocalProviderConfigs(updatedConfigs)

    // 获取自定义厂商配置
    const customConfig = providerConfigs[id] || {}
    const models = customConfig.customModels || []

    setLocalConfig({
      ...localConfig,
      provider: id as any,
      apiKey: customConfig.apiKey || '',
      baseUrl: customConfig.baseUrl || '',
      timeout: customConfig.timeout || 120000,
      model: customConfig.model || models[0] || '',
    })
    setIsAddingCustom(false)
  }

  // 添加自定义 Provider
  const handleAddCustomProvider = (config: { displayName: string; baseUrl: string; apiKey: string; protocol: string; model: string }) => {
    const id = `custom-${Date.now()}`
    const newConfig = {
      displayName: config.displayName,
      baseUrl: config.baseUrl,
      apiKey: config.apiKey,
      protocol: config.protocol as 'openai' | 'anthropic' | 'gemini' | 'custom',
      model: config.model,
      customModels: config.model ? [config.model] : [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    setProvider(id, newConfig)
    toast.success(language === 'zh' ? `已添加 ${config.displayName}` : `Added ${config.displayName}`)
    setIsAddingCustom(false)
    // 自动选择新添加的 Provider
    handleSelectCustomProvider(id)
  }

  // 删除自定义 Provider
  const handleDeleteCustomProvider = async (e: React.MouseEvent, id: string, name: string) => {
    e.stopPropagation()
    const { globalConfirm } = await import('@components/common/ConfirmDialog')
    const confirmed = await globalConfirm({
      title: language === 'zh' ? '删除提供商' : 'Delete Provider',
      message: language === 'zh' ? `删除 ${name}？` : `Delete ${name}?`,
      variant: 'danger',
    })
    if (confirmed) {
      removeProvider(id)
      if (localConfig.provider === id) {
        handleSelectBuiltinProvider('openai')
      }
    }
  }

  const builtinProviders = providers.filter((p) => BUILTIN_PROVIDER_IDS.includes(p.id))

  return (
    <div className="space-y-8 animate-fade-in pb-10">
      {/* Provider 选择器 */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Box className="w-4 h-4 text-accent" />
          <h4 className="text-sm font-semibold text-text-primary uppercase tracking-wide">
            {language === 'zh' ? '选择提供商' : 'Select Provider'}
          </h4>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {/* 内置厂商 */}
          {builtinProviders.map((p) => (
            <button
              key={p.id}
              onClick={() => handleSelectBuiltinProvider(p.id)}
              className={`group relative flex flex-col items-center justify-center p-5 rounded-2xl border transition-all duration-300 ${localConfig.provider === p.id
                ? 'border-accent bg-accent/5 text-accent shadow-xl shadow-accent/5 ring-1 ring-accent/20'
                : 'border-border bg-surface/30 text-text-secondary hover:bg-surface/50 hover:border-accent/30 hover:text-text-primary'
                }`}
            >
              <span className={`font-bold text-sm ${localConfig.provider === p.id ? 'text-text-primary' : ''}`}>{p.name}</span>
              {localConfig.provider === p.id && (
                <div className="absolute top-3 right-3 bg-accent rounded-full p-0.5 shadow-lg shadow-accent/20">
                  <Check className="w-3 h-3 text-white" strokeWidth={3} />
                </div>
              )}
            </button>
          ))}

          {/* 自定义 Provider */}
          {customProviders.map(({ id, config }) => {
            const displayName = config.displayName || id
            return (
              <div
                key={id}
                onClick={() => handleSelectCustomProvider(id)}
                className={`group relative flex flex-col items-center justify-center p-5 rounded-2xl border transition-all duration-300 cursor-pointer ${localConfig.provider === id
                  ? 'border-accent bg-accent/5 text-accent shadow-xl shadow-accent/5 ring-1 ring-accent/20'
                  : 'border-border bg-surface/30 text-text-secondary hover:bg-surface/50 hover:border-accent/30 hover:text-text-primary'
                  }`}
              >
                <span className={`font-bold text-sm truncate w-full text-center ${localConfig.provider === id ? 'text-text-primary' : ''}`}>{displayName}</span>
                {localConfig.provider === id && (
                  <div className="absolute top-3 right-3 bg-accent rounded-full p-0.5 shadow-lg shadow-accent/20">
                    <Check className="w-3 h-3 text-white" strokeWidth={3} />
                  </div>
                )}
                <button
                  onClick={(e) => handleDeleteCustomProvider(e, id, displayName)}
                  className="absolute -top-2 -right-2 w-6 h-6 flex items-center justify-center rounded-full bg-background border border-border text-text-muted shadow-xl opacity-0 group-hover:opacity-100 hover:text-red-500 hover:border-red-500/30 transition-all scale-90 hover:scale-100 z-10"
                  title={language === 'zh' ? '删除' : 'Delete'}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )
          })}

          {/* 添加按钮 */}
          <button
            onClick={() => setIsAddingCustom(true)}
            className={`flex flex-col items-center justify-center p-5 rounded-2xl border-2 border-dashed transition-all duration-300 ${isAddingCustom
              ? 'border-accent bg-accent/5 text-accent shadow-inner'
              : 'border-border bg-white/5 text-text-muted hover:border-accent/50 hover:text-accent hover:bg-accent/5'
              }`}
          >
            <Plus className="w-6 h-6 mb-1" />
            <span className="text-xs font-bold uppercase tracking-tighter">{language === 'zh' ? '添加自定义' : 'Add Custom'}</span>
          </button>
        </div>

        {/* 添加新 Provider 表单 */}
        {isAddingCustom && (
          <div className="mt-6 p-6 rounded-2xl bg-surface/30 border border-border animate-slide-down">
            <div className="flex justify-between items-center mb-4">
              <h5 className="text-sm font-medium text-text-primary">
                {language === 'zh' ? '添加新提供商' : 'Add New Provider'}
              </h5>
              <Button variant="ghost" size="sm" onClick={() => setIsAddingCustom(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            <InlineCustomProviderForm
              language={language}
              onSave={handleAddCustomProvider}
              onCancel={() => setIsAddingCustom(false)}
            />
          </div>
        )}
      </section>

      {/* 配置区域（非添加模式时显示） */}
      {!isAddingCustom && (
        <div className="space-y-6">
          {/* 上方两列：模型配置 + 生成参数 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 左列：模型配置 */}
            <section className="p-5 bg-surface/30 rounded-xl border border-border space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <Box className="w-4 h-4 text-accent" />
                <h5 className="text-sm font-medium text-text-primary">
                  {language === 'zh' ? '模型配置' : 'Model Configuration'}
                </h5>
              </div>

              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-text-secondary">
                    {language === 'zh' ? '选择模型' : 'Select Model'}
                  </label>
                  <Select
                    value={localConfig.model}
                    onChange={(value) => setLocalConfig({ ...localConfig, model: value })}
                    options={(() => {
                      const modelsSet = new Set<string>()
                      if (isCustomSelected && selectedCustomConfig) {
                        (selectedCustomConfig.customModels || []).forEach((m) => modelsSet.add(m))
                      } else if (selectedProvider) {
                        selectedProvider.models.forEach((m) => modelsSet.add(m))
                      }
                      const customModels = providerConfigs[localConfig.provider]?.customModels || []
                      customModels.forEach((m) => modelsSet.add(m))
                      return Array.from(modelsSet).map((m) => ({ value: m, label: m }))
                    })()}
                    className="w-full bg-background/50 border-border"
                  />
                </div>

                {/* 添加自定义模型 */}
                <div className="pt-2">
                  <div className="flex gap-2">
                    <Input
                      value={newModelName}
                      onChange={(e) => setNewModelName(e.target.value)}
                      placeholder={language === 'zh' ? '输入新模型名称...' : 'Enter new model name...'}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddModel()}
                      className="flex-1 h-9 text-xs bg-background/50 border-border"
                    />
                    <Button variant="secondary" size="sm" onClick={handleAddModel} disabled={!newModelName.trim()} className="h-9 px-3">
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>

                  {(providerConfigs[localConfig.provider]?.customModels?.length ?? 0) > 0 && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {providerConfigs[localConfig.provider]?.customModels?.map((model: string) => (
                        <div
                          key={model}
                          className="group flex items-center gap-1.5 px-2 py-1 bg-surface/50 rounded-md border border-border text-xs text-text-secondary hover:border-border"
                        >
                          <span>{model}</span>
                          <button
                            onClick={() => removeModel(localConfig.provider, model)}
                            className="text-text-muted hover:text-red-400 opacity-50 group-hover:opacity-100 transition-opacity"
                          >
                            <Trash className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* 右列：生成参数 */}
            <section className="p-5 bg-surface/30 rounded-xl border border-border space-y-5">
              <div className="flex items-center gap-2 mb-1">
                <Sliders className="w-4 h-4 text-accent" />
                <h5 className="text-sm font-medium text-text-primary">
                  {language === 'zh' ? '生成参数' : 'Generation Parameters'}
                </h5>
              </div>

              {/* Max Tokens */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs text-text-secondary">{language === 'zh' ? '最大 Token' : 'Max Tokens'}</label>
                  <span className="text-xs font-mono bg-background/50 px-1.5 py-0.5 rounded text-accent">
                    {localConfig.maxTokens || 8192}
                  </span>
                </div>
                <input
                  type="range"
                  min={1024}
                  max={32768}
                  step={1024}
                  value={localConfig.maxTokens || 8192}
                  onChange={(e) => setLocalConfig({
                    ...localConfig,
                    maxTokens: parseInt(e.target.value)
                  })}
                  className="w-full h-1.5 bg-surface-active rounded-full appearance-none cursor-pointer accent-accent hover:accent-accent-hover"
                />
              </div>

              {/* Temperature */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs text-text-secondary">
                    {language === 'zh' ? '随机性 (Temperature)' : 'Temperature'}
                  </label>
                  <span className="text-xs font-mono bg-background/50 px-1.5 py-0.5 rounded text-accent">
                    {(localConfig.temperature || 0.7).toFixed(1)}
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={2}
                  step={0.1}
                  value={localConfig.temperature || 0.7}
                  onChange={(e) => setLocalConfig({
                    ...localConfig,
                    temperature: parseFloat(e.target.value)
                  })}
                  className="w-full h-1.5 bg-surface-active rounded-full appearance-none cursor-pointer accent-accent hover:accent-accent-hover"
                />
                <div className="flex justify-between text-[10px] text-text-muted px-1">
                  <span>{language === 'zh' ? '精确' : 'Precise'}</span>
                  <span>{language === 'zh' ? '创意' : 'Creative'}</span>
                </div>
              </div>

              {/* Top P */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <label className="text-xs text-text-secondary">Top P</label>
                    <p className="text-[10px] text-text-muted">
                      {language === 'zh'
                        ? '核采样：仅考虑累积概率达到 P 的 Token 集合'
                        : 'Nucleus sampling: considers tokens with top_p probability mass'}
                    </p>
                  </div>
                  <span className="text-xs font-mono bg-background/50 px-1.5 py-0.5 rounded text-accent">
                    {(localConfig.topP || 1).toFixed(2)}
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={localConfig.topP || 1}
                  onChange={(e) => setLocalConfig({
                    ...localConfig,
                    topP: parseFloat(e.target.value)
                  })}
                  className="w-full h-1.5 bg-surface-active rounded-full appearance-none cursor-pointer accent-accent hover:accent-accent-hover"
                />
              </div>

              {/* Top K */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <label className="text-xs text-text-secondary">Top K</label>
                    <p className="text-[10px] text-text-muted">
                      {language === 'zh'
                        ? '仅从概率最高的 K 个 Token 中采样'
                        : 'Limits selection to the top K tokens'}
                    </p>
                  </div>
                  <span className="text-xs font-mono bg-background/50 px-1.5 py-0.5 rounded text-accent">
                    {localConfig.topK ?? 'Default'}
                  </span>
                </div>
                <input
                  type="number"
                  min={0}
                  value={localConfig.topK ?? ''}
                  onChange={(e) => setLocalConfig({
                    ...localConfig,
                    topK: e.target.value ? parseInt(e.target.value) : undefined
                  })}
                  placeholder="Default"
                  className="w-full bg-surface-active rounded-lg px-3 py-1.5 text-xs border border-border focus:border-accent focus:ring-1 focus:ring-accent/50 outline-none transition-all"
                />
              </div>

              {/* 深度思考模式 */}
              <div className="flex items-center justify-between pt-3 border-t border-border/50">
                <div className="space-y-0.5">
                  <label className="text-xs font-medium text-text-secondary">
                    {language === 'zh' ? '深度思考模式' : 'Extended Thinking'}
                  </label>
                  <p className="text-[10px] text-text-muted">
                    {language === 'zh'
                      ? '启用后，模型会进行更深入的推理（如 Claude extended thinking）'
                      : 'Enable deeper reasoning (e.g., Claude extended thinking)'}
                  </p>
                </div>
                <button
                  onClick={() => setLocalConfig({ ...localConfig, enableThinking: !localConfig.enableThinking })}
                  className={`relative w-10 h-5 rounded-full transition-colors duration-200 ${localConfig.enableThinking ? 'bg-accent' : 'bg-surface-active'
                    }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${localConfig.enableThinking ? 'translate-x-5' : 'translate-x-0'
                      }`}
                  />
                </button>
              </div>

              {/* Frequency Penalty */}
              <div className="space-y-3 pt-3 border-t border-border/50">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <label className="text-xs text-text-secondary">Frequency Penalty</label>
                    <p className="text-[10px] text-text-muted">
                      {language === 'zh'
                        ? '根据 Token 出现频率降低其重复概率'
                        : 'Penalizes tokens based on their frequency in the text'}
                    </p>
                  </div>
                  <span className="text-xs font-mono bg-background/50 px-1.5 py-0.5 rounded text-accent">
                    {(localConfig.frequencyPenalty || 0).toFixed(1)}
                  </span>
                </div>
                <input
                  type="range"
                  min={-2}
                  max={2}
                  step={0.1}
                  value={localConfig.frequencyPenalty || 0}
                  onChange={(e) => setLocalConfig({
                    ...localConfig,
                    frequencyPenalty: parseFloat(e.target.value)
                  })}
                  className="w-full h-1.5 bg-surface-active rounded-full appearance-none cursor-pointer accent-accent hover:accent-accent-hover"
                />
              </div>

              {/* Presence Penalty */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <label className="text-xs text-text-secondary">Presence Penalty</label>
                    <p className="text-[10px] text-text-muted">
                      {language === 'zh'
                        ? '根据 Token 是否出现过降低其重复概率'
                        : 'Penalizes tokens based on their presence in the text'}
                    </p>
                  </div>
                  <span className="text-xs font-mono bg-background/50 px-1.5 py-0.5 rounded text-accent">
                    {(localConfig.presencePenalty || 0).toFixed(1)}
                  </span>
                </div>
                <input
                  type="range"
                  min={-2}
                  max={2}
                  step={0.1}
                  value={localConfig.presencePenalty || 0}
                  onChange={(e) => setLocalConfig({
                    ...localConfig,
                    presencePenalty: parseFloat(e.target.value)
                  })}
                  className="w-full h-1.5 bg-surface-active rounded-full appearance-none cursor-pointer accent-accent hover:accent-accent-hover"
                />
              </div>

              {/* Seed */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <label className="text-xs text-text-secondary">Seed</label>
                    <p className="text-[10px] text-text-muted">
                      {language === 'zh'
                        ? '固定随机种子以获得可重现的结果'
                        : 'Fixed seed for reproducible outputs'}
                    </p>
                  </div>
                  <span className="text-xs font-mono bg-background/50 px-1.5 py-0.5 rounded text-accent">
                    {localConfig.seed ?? 'Random'}
                  </span>
                </div>
                <input
                  type="number"
                  value={localConfig.seed ?? ''}
                  onChange={(e) => setLocalConfig({
                    ...localConfig,
                    seed: e.target.value ? parseInt(e.target.value) : undefined
                  })}
                  placeholder="Random"
                  className="w-full bg-surface-active rounded-lg px-3 py-1.5 text-xs border border-border focus:border-accent focus:ring-1 focus:ring-accent/50 outline-none transition-all"
                />
              </div>

              {/* Stop Sequences */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <label className="text-xs text-text-secondary">Stop Sequences</label>
                    <p className="text-[10px] text-text-muted">
                      {language === 'zh'
                        ? '遇到这些字符时停止生成'
                        : 'Stop generation when these sequences are encountered'}
                    </p>
                  </div>
                  <span className="text-[10px] text-text-muted bg-background/50 px-1.5 py-0.5 rounded">
                    Comma separated
                  </span>
                </div>
                <input
                  type="text"
                  value={localConfig.stopSequences?.join(', ') || ''}
                  onChange={(e) => {
                    const val = e.target.value
                    setLocalConfig({
                      ...localConfig,
                      stopSequences: val ? val.split(',').map(s => s.trim()).filter(Boolean) : undefined
                    })
                  }}
                  placeholder="e.g. \n, User:"
                  className="w-full bg-surface-active rounded-lg px-3 py-1.5 text-xs border border-border focus:border-accent focus:ring-1 focus:ring-accent/50 outline-none transition-all"
                />
              </div>

              {/* Logit Bias */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <label className="text-xs text-text-secondary">Logit Bias (JSON)</label>
                    <p className="text-[10px] text-text-muted">
                      {language === 'zh'
                        ? '调整特定 Token 出现的概率 (-100 到 100)'
                        : 'Modify likelihood of specific tokens (-100 to 100)'}
                    </p>
                  </div>
                  <span className="text-[10px] text-text-muted bg-background/50 px-1.5 py-0.5 rounded">
                    Token ID: Bias
                  </span>
                </div>
                <textarea
                  value={logitBiasString}
                  onChange={(e) => setLogitBiasString(e.target.value)}
                  onBlur={() => {
                    try {
                      if (!logitBiasString.trim()) {
                        setLocalConfig({ ...localConfig, logitBias: undefined })
                        return
                      }
                      const parsed = JSON.parse(logitBiasString)
                      if (typeof parsed === 'object' && parsed !== null) {
                        setLocalConfig({ ...localConfig, logitBias: parsed })
                      }
                    } catch {
                      // Invalid JSON
                    }
                  }}
                  placeholder='{"50256": -100}'
                  className="w-full h-20 bg-surface-active rounded-lg px-3 py-1.5 text-xs border border-border focus:border-accent focus:ring-1 focus:ring-accent/50 outline-none transition-all font-mono"
                />
              </div>
            </section>
          </div>

          {/* 下方全宽：认证 & 网络配置 */}
          <section className="p-6 bg-surface/30 rounded-xl border border-border">
            <div className="flex items-center gap-2 mb-5">
              <Server className="w-4 h-4 text-accent" />
              <h5 className="text-sm font-medium text-text-primary">
                {language === 'zh' ? '认证 & 网络配置' : 'Authentication & Network'}
              </h5>
            </div>

            {/* 基础配置：三列布局 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-4">
              {/* API Key */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-text-secondary">
                  API Key
                </label>
                <Input
                  type={showApiKey ? 'text' : 'password'}
                  value={localConfig.apiKey}
                  onChange={(e) => setLocalConfig({ ...localConfig, apiKey: e.target.value })}
                  placeholder={PROVIDERS[localConfig.provider]?.auth.placeholder || 'sk-...'}
                  className="bg-background/50 border-border font-mono text-xs"
                  rightIcon={
                    <button onClick={() => setShowApiKey(!showApiKey)} className="text-text-muted hover:text-text-primary">
                      {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  }
                />
              </div>

              {/* API 端点 */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-text-secondary">
                  {language === 'zh' ? 'API 端点' : 'API Endpoint'}
                </label>
                <Input
                  value={localConfig.baseUrl || ''}
                  onChange={(e) => setLocalConfig({ ...localConfig, baseUrl: e.target.value || undefined })}
                  placeholder="https://api.example.com/v1"
                  className="bg-background/50 border-border text-xs font-mono"
                />
              </div>

              {/* 超时时间 */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-text-secondary">
                  {language === 'zh' ? '超时时间 (秒)' : 'Timeout (seconds)'}
                </label>
                <Input
                  type="number"
                  value={(localConfig.timeout || 120000) / 1000}
                  onChange={(e) => setLocalConfig({ ...localConfig, timeout: (parseInt(e.target.value) || 120) * 1000 })}
                  min={10}
                  max={600}
                  className="bg-background/50 border-border text-xs"
                />
              </div>
            </div>

            {/* 操作按钮行 */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <TestConnectionButton localConfig={localConfig} language={language} />
                {!isCustomSelected && PROVIDERS[localConfig.provider]?.auth.helpUrl && (
                  <a
                    href={PROVIDERS[localConfig.provider]?.auth.helpUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-text-muted hover:text-accent hover:underline flex items-center gap-1"
                  >
                    {language === 'zh' ? '获取 Key' : 'Get Key'} <span className="opacity-50">↗</span>
                  </a>
                )}
              </div>
              <p className="text-[10px] text-text-muted">
                {language === 'zh' ? '留空端点使用默认值，超时建议 60-300 秒' : 'Leave endpoint empty for default, timeout recommended 60-300s'}
              </p>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
