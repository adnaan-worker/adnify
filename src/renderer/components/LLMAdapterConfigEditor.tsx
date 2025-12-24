/**
 * LLM Adapter Config Editor
 * 全可视化的 LLM 适配器配置编辑器
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
    Code2, Sparkles, RotateCcw,
    ChevronDown, ChevronRight, AlertTriangle, HelpCircle,
    FileJson, Zap
} from 'lucide-react'
import { Switch, Input } from './ui'
import {
    type LLMAdapterConfig,
    getBuiltinAdapter,
    getBuiltinAdapters,
    getAdapterConfig,
} from '@/shared/config/providers'

interface LLMAdapterConfigEditorProps {
    adapterId: string
    config?: LLMAdapterConfig
    onChange: (id: string, config: LLMAdapterConfig) => void
    language: 'en' | 'zh'
    // 是否有已配置的 AI（用于判断是否启用 AI 推理）
    hasConfiguredAI?: boolean
}

export default function LLMAdapterConfigEditor({
    adapterId,
    config,
    onChange,
    language,
    hasConfiguredAI = false,
}: LLMAdapterConfigEditorProps) {
    // 获取所有内置适配器（memoized）
    const builtinAdapters = useMemo(() => getBuiltinAdapters(), [])

    // 确保总是有有效的配置
    const defaultAdapter = getAdapterConfig('openai')
    const [localConfig, setLocalConfig] = useState<LLMAdapterConfig>(
        () => config || getBuiltinAdapter(adapterId) || defaultAdapter
    )
    const [showRequestDetails, setShowRequestDetails] = useState(false)
    const [showResponseDetails, setShowResponseDetails] = useState(false)
    const [bodyJsonText, setBodyJsonText] = useState('')
    const [jsonError, setJsonError] = useState<string | null>(null)

    // 当 adapterId 或外部 config 变化时同步状态
    useEffect(() => {
        // 如果外部传入了配置，且 ID 匹配，则优先使用外部配置
        if (config && config.id === adapterId) {
            setLocalConfig(config)
            setBodyJsonText(JSON.stringify(config.request?.bodyTemplate || {}, null, 2))
            return
        }

        // 否则，如果本地配置的 ID 与当前 adapterId 不符，才加载预设
        if (localConfig.id !== adapterId) {
            const preset = getBuiltinAdapter(adapterId)
            if (preset) {
                setLocalConfig(preset)
                setBodyJsonText(JSON.stringify(preset.request?.bodyTemplate || {}, null, 2))
            }
        }
    }, [adapterId, config])

    // 更新请求配置
    const updateRequest = useCallback((updates: Partial<LLMAdapterConfig['request']>) => {
        const currentRequest = localConfig.request || defaultAdapter.request
        const newConfig: LLMAdapterConfig = {
            ...localConfig,
            request: { ...currentRequest, ...updates },
            isBuiltin: false,
        }
        setLocalConfig(newConfig)
        onChange(newConfig.id, newConfig)
    }, [localConfig, onChange, defaultAdapter])

    // 更新响应配置
    const updateResponse = useCallback((updates: Partial<LLMAdapterConfig['response']>) => {
        const currentResponse = localConfig.response || defaultAdapter.response
        const newConfig: LLMAdapterConfig = {
            ...localConfig,
            response: { ...currentResponse, ...updates },
            isBuiltin: false,
        }
        setLocalConfig(newConfig)
        onChange(newConfig.id, newConfig)
    }, [localConfig, onChange, defaultAdapter])

    // 处理请求体 JSON 变更
    const handleBodyJsonChange = useCallback((text: string) => {
        setBodyJsonText(text)
        try {
            const parsed = JSON.parse(text)
            setJsonError(null)
            updateRequest({ bodyTemplate: parsed })
        } catch (e: any) {
            setJsonError(e.message)
        }
    }, [updateRequest])

    // 重置为预设
    const handleReset = useCallback(() => {
        const preset = getBuiltinAdapter(adapterId) || defaultAdapter
        setLocalConfig(preset)
        setBodyJsonText(JSON.stringify(preset.request.bodyTemplate, null, 2))
        setJsonError(null)
        onChange(preset.id, preset)
    }, [adapterId, onChange, defaultAdapter])

    // 选择预设
    const handlePresetSelect = useCallback((presetId: string) => {
        const preset = getBuiltinAdapter(presetId)
        if (preset) {
            setLocalConfig(preset)
            setBodyJsonText(JSON.stringify(preset.request.bodyTemplate, null, 2))
            setJsonError(null)
            onChange(presetId, preset)
        }
    }, [onChange])

    return (
        <div className="space-y-4">
            {/* 预设选择 */}
            <div className="space-y-2">
                <label className="flex items-center gap-2 text-xs font-medium text-text-secondary">
                    <Zap className="w-3.5 h-3.5 text-accent" />
                    {language === 'zh' ? '适配器预设' : 'Adapter Preset'}
                </label>
                <div className="grid grid-cols-4 gap-2">
                    {builtinAdapters.map((adapter) => (
                        <button
                            key={adapter.id}
                            onClick={() => handlePresetSelect(adapter.id)}
                            className={`
                relative flex flex-col items-center justify-center p-2.5 rounded-lg border text-center transition-all duration-200
                ${adapterId === adapter.id
                                    ? 'border-accent bg-accent/10 text-accent shadow-sm'
                                    : 'border-border-subtle bg-surface/30 text-text-muted hover:bg-surface hover:border-border hover:text-text-primary'
                                }
              `}
                        >
                            <span className="text-xs font-medium">{adapter.name}</span>
                            <span className="text-[9px] text-text-muted mt-0.5 truncate w-full">{adapter.description}</span>
                            {adapterId === adapter.id && (
                                <div className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-accent" />
                            )}
                        </button>
                    ))}
                </div>
            </div>

            {/* AI 智能配置提示（无 AI 时显示引导） */}
            {!hasConfiguredAI && (
                <div className="p-3 bg-surface/30 rounded-lg border border-border-subtle">
                    <div className="flex items-start gap-2">
                        <HelpCircle className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
                        <div className="text-xs text-text-muted space-y-1">
                            <p className="font-medium text-text-secondary">
                                {language === 'zh' ? '如何配置自定义适配器？' : 'How to configure custom adapter?'}
                            </p>
                            <ol className="list-decimal pl-4 space-y-0.5">
                                <li>{language === 'zh' ? '选择最接近的预设作为基础' : 'Select the closest preset as base'}</li>
                                <li>{language === 'zh' ? '展开"请求配置"修改 API 端点和请求体' : 'Expand "Request Config" to modify endpoint and body'}</li>
                                <li>{language === 'zh' ? '展开"响应解析"配置字段路径' : 'Expand "Response Parsing" to configure field paths'}</li>
                            </ol>
                            <p className="text-accent/80">
                                {language === 'zh'
                                    ? '💡 配置好 API 后，可使用 AI 自动分析 API 文档生成配置'
                                    : '💡 After configuring API, use AI to auto-analyze API docs'}
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* 请求配置 */}
            <div className="border border-border-subtle rounded-lg overflow-hidden">
                <button
                    onClick={() => setShowRequestDetails(!showRequestDetails)}
                    className="w-full flex items-center gap-2 px-4 py-3 bg-surface/30 hover:bg-surface/50 transition-colors"
                >
                    {showRequestDetails ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    <Code2 className="w-4 h-4 text-accent" />
                    <span className="text-sm font-medium text-text-primary">
                        {language === 'zh' ? '📝 请求配置' : '📝 Request Config'}
                    </span>
                    <span className="ml-auto text-xs text-text-muted">
                        {localConfig.request?.endpoint || '/chat/completions'}
                    </span>
                </button>

                {showRequestDetails && (
                    <div className="p-4 space-y-4 border-t border-border-subtle bg-background/50">
                        {/* 端点 */}
                        <div className="space-y-1.5">
                            <label className="text-xs text-text-secondary">
                                {language === 'zh' ? 'API 端点 (相对路径)' : 'API Endpoint (relative path)'}
                            </label>
                            <Input
                                value={localConfig.request?.endpoint || ''}
                                onChange={(e) => updateRequest({ endpoint: e.target.value })}
                                placeholder="/chat/completions"
                                className="font-mono text-sm"
                            />
                        </div>

                        {/* 请求体 */}
                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                                <label className="text-xs text-text-secondary">
                                    {language === 'zh' ? '请求体模板 (JSON)' : 'Request Body Template (JSON)'}
                                </label>
                                <button
                                    onClick={handleReset}
                                    className="flex items-center gap-1 text-[10px] text-text-muted hover:text-text-primary"
                                >
                                    <RotateCcw className="w-3 h-3" />
                                    {language === 'zh' ? '重置' : 'Reset'}
                                </button>
                            </div>
                            <div className="relative">
                                <textarea
                                    value={bodyJsonText}
                                    onChange={(e) => handleBodyJsonChange(e.target.value)}
                                    className={`
                    w-full px-3 py-2 text-xs font-mono leading-5
                    bg-surface/50 border rounded-lg text-text-primary 
                    focus:outline-none resize-none
                    ${jsonError ? 'border-red-500/50' : 'border-border-subtle focus:border-accent'}
                  `}
                                    rows={8}
                                    spellCheck={false}
                                />
                                {jsonError && (
                                    <div className="absolute bottom-2 left-2 right-2 flex items-center gap-1.5 px-2 py-1 text-[10px] text-red-400 bg-red-500/10 rounded">
                                        <AlertTriangle className="w-3 h-3" />
                                        <span className="truncate">JSON Error: {jsonError}</span>
                                    </div>
                                )}
                            </div>
                            <p className="text-[10px] text-text-muted">
                                {language === 'zh'
                                    ? '使用 {{model}}, {{messages}}, {{tools}} 作为占位符'
                                    : 'Use {{model}}, {{messages}}, {{tools}} as placeholders'}
                            </p>
                        </div>
                    </div>
                )}
            </div>

            {/* 响应解析配置 */}
            <div className="border border-border-subtle rounded-lg overflow-hidden">
                <button
                    onClick={() => setShowResponseDetails(!showResponseDetails)}
                    className="w-full flex items-center gap-2 px-4 py-3 bg-surface/30 hover:bg-surface/50 transition-colors"
                >
                    {showResponseDetails ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    <FileJson className="w-4 h-4 text-purple-400" />
                    <span className="text-sm font-medium text-text-primary">
                        {language === 'zh' ? '📤 响应解析配置' : '📤 Response Parsing'}
                    </span>
                    {localConfig.response?.reasoningField && (
                        <span className="ml-auto text-xs text-purple-400">
                            ✨ Thinking
                        </span>
                    )}
                </button>

                {showResponseDetails && (
                    <div className="p-4 space-y-4 border-t border-border-subtle bg-background/50">
                        {/* 内容字段 */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-xs text-text-secondary">
                                    {language === 'zh' ? '内容字段' : 'Content Field'}
                                </label>
                                <Input
                                    value={localConfig.response?.contentField || ''}
                                    onChange={(e) => updateResponse({ contentField: e.target.value })}
                                    placeholder="delta.content"
                                    className="font-mono text-xs"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="flex items-center gap-1 text-xs text-purple-400">
                                    <Sparkles className="w-3 h-3" />
                                    {language === 'zh' ? '思考字段 (Thinking)' : 'Reasoning Field'}
                                </label>
                                <Input
                                    value={localConfig.response?.reasoningField || ''}
                                    onChange={(e) => updateResponse({ reasoningField: e.target.value || undefined })}
                                    placeholder="delta.reasoning"
                                    className="font-mono text-xs"
                                />
                            </div>
                        </div>

                        {/* 工具调用配置 */}
                        <div className="space-y-3 p-3 bg-surface/20 rounded-lg">
                            <label className="text-xs text-text-secondary font-medium">
                                {language === 'zh' ? '工具调用解析' : 'Tool Call Parsing'}
                            </label>
                            <div className="grid grid-cols-3 gap-3">
                                <div className="space-y-1">
                                    <label className="text-[10px] text-text-muted">
                                        {language === 'zh' ? '工具调用路径' : 'Tool Call Path'}
                                    </label>
                                    <Input
                                        value={localConfig.response?.toolCallField || ''}
                                        onChange={(e) => updateResponse({ toolCallField: e.target.value })}
                                        placeholder="delta.tool_calls"
                                        className="font-mono text-[10px]"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] text-text-muted">
                                        {language === 'zh' ? '工具名路径' : 'Tool Name Path'}
                                    </label>
                                    <Input
                                        value={localConfig.response?.toolNamePath || ''}
                                        onChange={(e) => updateResponse({ toolNamePath: e.target.value })}
                                        placeholder="function.name"
                                        className="font-mono text-[10px]"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] text-text-muted">
                                        {language === 'zh' ? '参数路径' : 'Args Path'}
                                    </label>
                                    <Input
                                        value={localConfig.response?.toolArgsPath || ''}
                                        onChange={(e) => updateResponse({ toolArgsPath: e.target.value })}
                                        placeholder="function.arguments"
                                        className="font-mono text-[10px]"
                                    />
                                </div>
                            </div>
                            <div className="flex items-center gap-4">
                                <Switch
                                    label={language === 'zh' ? '参数已是对象' : 'Args is object'}
                                    checked={localConfig.response?.argsIsObject || false}
                                    onChange={(e) => updateResponse({ argsIsObject: e.target.checked })}
                                />
                            </div>
                        </div>

                        {/* 结束标记 */}
                        <div className="space-y-1.5">
                            <label className="text-xs text-text-secondary">
                                {language === 'zh' ? '流结束标记' : 'Stream Done Marker'}
                            </label>
                            <Input
                                value={localConfig.response?.doneMarker || ''}
                                onChange={(e) => updateResponse({ doneMarker: e.target.value })}
                                placeholder="[DONE]"
                                className="font-mono text-xs w-40"
                            />
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
