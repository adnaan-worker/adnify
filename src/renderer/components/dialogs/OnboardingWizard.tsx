/**
 * 首次使用引导向导
 * 简化版 - 只包含基础设置
 */

import { api } from '@/renderer/services/electronAPI'
import React, { useState, useEffect } from 'react'
import {
  ChevronRight, ChevronLeft, Check, Sparkles, Palette,
  Globe, Cpu, FolderOpen, Rocket, Eye, EyeOff, Settings
} from 'lucide-react'
import { useStore, LLMConfig } from '@store'
import { Language } from '@renderer/i18n'
import { themeManager, Theme } from '@renderer/config/themeConfig'
import { PROVIDERS } from '@/shared/config/providers'
import { LLM_DEFAULTS } from '@/shared/constants'
import { Logo } from '../common/Logo'
import { workspaceManager } from '@services/WorkspaceManager'
import { Button, Input, Select } from '../ui'

interface OnboardingWizardProps {
  onComplete: () => void
}

type Step = 'welcome' | 'language' | 'theme' | 'provider' | 'workspace' | 'complete'

const STEPS: Step[] = ['welcome', 'language', 'theme', 'provider', 'workspace', 'complete']

const LANGUAGES: { id: Language; name: string; native: string }[] = [
  { id: 'en', name: 'English', native: 'English' },
  { id: 'zh', name: 'Chinese', native: '中文' },
]

export default function OnboardingWizard({ onComplete }: OnboardingWizardProps) {
  const { setLLMConfig, setLanguage, language, workspacePath } = useStore()

  const [currentStep, setCurrentStep] = useState<Step>('welcome')
  const [selectedLanguage, setSelectedLanguage] = useState<Language>(language)
  const [selectedTheme, setSelectedTheme] = useState(themeManager.getCurrentTheme().id)
  const [providerConfig, setProviderConfig] = useState<LLMConfig>({
    provider: 'openai',
    model: 'gpt-4o',
    apiKey: '',
    parameters: {
      temperature: LLM_DEFAULTS.TEMPERATURE,
      topP: LLM_DEFAULTS.TOP_P,
      maxTokens: LLM_DEFAULTS.MAX_TOKENS,
    },
  })
  const [showApiKey, setShowApiKey] = useState(false)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [isExiting, setIsExiting] = useState(false) // 退出动画状态

  const allThemes = themeManager.getAllThemes()
  const currentStepIndex = STEPS.indexOf(currentStep)
  const isZh = selectedLanguage === 'zh'

  useEffect(() => {
    themeManager.setTheme(selectedTheme)
  }, [selectedTheme])

  const goNext = () => {
    if (currentStepIndex < STEPS.length - 1) {
      setIsTransitioning(true)
      setTimeout(() => {
        setCurrentStep(STEPS[currentStepIndex + 1])
        setIsTransitioning(false)
      }, 200)
    }
  }

  const goPrev = () => {
    if (currentStepIndex > 0) {
      setIsTransitioning(true)
      setTimeout(() => {
        setCurrentStep(STEPS[currentStepIndex - 1])
        setIsTransitioning(false)
      }, 200)
    }
  }

  const handleComplete = async () => {
    const { settingsService, defaultAgentConfig, defaultAutoApprove } = await import('@services/settingsService')

    setLanguage(selectedLanguage)
    setLLMConfig(providerConfig)

    if (providerConfig.apiKey) {
      useStore.getState().setHasExistingConfig(true)
    }

    await settingsService.saveAll({
      llmConfig: providerConfig as any,
      language: selectedLanguage,
      autoApprove: defaultAutoApprove,
      agentConfig: defaultAgentConfig,
      providerConfigs: {},
      aiInstructions: '',
      onboardingCompleted: true,
    })

    // 淡出动画后关闭引导
    setIsExiting(true)
    setTimeout(onComplete, 300)
  }

  const handleOpenFolder = async () => {
    const result = await api.file.openFolder()
    if (result && typeof result === 'string') {
      await workspaceManager.openFolder(result)
    }
  }

  return (
    <div className={`fixed inset-0 bg-background flex items-center justify-center z-[9999] transition-opacity duration-300 ${isExiting ? 'opacity-0' : 'opacity-100'}`}>
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-accent/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl" />
      </div>

      <div className={`relative w-full max-w-2xl mx-4 transition-all duration-300 ${isExiting ? 'scale-95 opacity-0' : 'scale-100 opacity-100'}`}>
        {/* 进度指示器 */}
        <div className="flex justify-center mb-8">
          <div className="flex items-center gap-2">
            {STEPS.slice(0, -1).map((step, index) => (
              <React.Fragment key={step}>
                <div
                  className={`w-2 h-2 rounded-full transition-all duration-300 ${
                    index < currentStepIndex
                      ? 'bg-accent'
                      : index === currentStepIndex
                        ? 'bg-accent scale-125 shadow-[0_0_10px_rgb(var(--accent))]'
                        : 'bg-surface-active'
                  }`}
                />
                {index < STEPS.length - 2 && (
                  <div className={`w-6 h-px transition-all duration-300 ${index < currentStepIndex ? 'bg-accent' : 'bg-border-subtle'}`} />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* 内容卡片 */}
        <div className={`bg-background-secondary/80 backdrop-blur-xl border border-border-subtle rounded-2xl shadow-2xl overflow-hidden transition-all duration-300 ${
          isTransitioning ? 'opacity-0 translate-y-4 scale-95' : 'opacity-100 translate-y-0 scale-100'
        }`}>
          <div className="min-h-[420px] flex flex-col">
            <div className="flex-1 overflow-y-auto">
              {currentStep === 'welcome' && <WelcomeStep isZh={isZh} />}
              {currentStep === 'language' && (
                <LanguageStep isZh={isZh} selectedLanguage={selectedLanguage} onSelect={setSelectedLanguage} />
              )}
              {currentStep === 'theme' && (
                <ThemeStep isZh={isZh} themes={allThemes} selectedTheme={selectedTheme} onSelect={setSelectedTheme} />
              )}
              {currentStep === 'provider' && (
                <ProviderStep
                  isZh={isZh}
                  config={providerConfig}
                  setConfig={setProviderConfig}
                  showApiKey={showApiKey}
                  setShowApiKey={setShowApiKey}
                />
              )}
              {currentStep === 'workspace' && (
                <WorkspaceStep isZh={isZh} workspacePath={workspacePath} onOpenFolder={handleOpenFolder} />
              )}
              {currentStep === 'complete' && <CompleteStep isZh={isZh} />}
            </div>

            {/* 底部导航 */}
            <div className="flex items-center justify-between px-8 py-5 border-t border-border-subtle bg-background/30">
              <button
                onClick={goPrev}
                disabled={currentStepIndex === 0}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  currentStepIndex === 0
                    ? 'opacity-0 pointer-events-none'
                    : 'text-text-muted hover:text-text-primary hover:bg-surface-hover'
                }`}
              >
                <ChevronLeft className="w-4 h-4" />
                {isZh ? '上一步' : 'Back'}
              </button>

              {currentStep === 'complete' ? (
                <Button
                  onClick={handleComplete}
                  className="flex items-center gap-2 px-8 py-2.5 bg-accent hover:bg-accent-hover text-white rounded-lg text-sm font-semibold transition-all shadow-glow"
                >
                  <Rocket className="w-4 h-4" />
                  {isZh ? '开始使用' : 'Get Started'}
                </Button>
              ) : (
                <Button
                  onClick={goNext}
                  className="flex items-center gap-2 px-8 py-2.5 bg-accent hover:bg-accent-hover text-white rounded-lg text-sm font-semibold transition-all shadow-glow"
                >
                  {isZh ? '下一步' : 'Next'}
                  <ChevronRight className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* 跳过按钮 */}
        {currentStep !== 'complete' && (
          <button
            onClick={handleComplete}
            className="absolute -bottom-12 left-1/2 -translate-x-1/2 text-sm text-text-muted hover:text-text-primary transition-colors flex items-center gap-1.5"
          >
            <span>{isZh ? '跳过引导' : 'Skip setup'}</span>
            <ChevronRight className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  )
}


// ============ Step Components ============

function WelcomeStep({ isZh }: { isZh: boolean }) {
  return (
    <div className="px-8 py-12 text-center">
      <div className="mb-8 flex justify-center">
        <div className="relative">
          <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-surface to-surface-active border border-border-subtle flex items-center justify-center shadow-2xl">
            <Logo className="w-14 h-14" glow />
          </div>
          <div className="absolute -inset-4 bg-accent/10 rounded-3xl blur-xl -z-10" />
        </div>
      </div>

      <h1 className="text-3xl font-bold text-text-primary mb-3 tracking-tight">
        {isZh ? '欢迎使用 Adnify' : 'Welcome to Adnify'}
      </h1>
      <p className="text-text-muted max-w-md mx-auto leading-relaxed text-lg">
        {isZh ? 'AI 驱动的下一代智能代码编辑器' : 'Next-gen AI-powered intelligent code editor'}
      </p>
      <p className="text-text-muted/60 max-w-sm mx-auto mt-2 text-sm">
        {isZh
          ? '让我们快速完成几个基础设置，即可开始编程。'
          : 'Let\'s quickly set up the basics and start coding.'}
      </p>

      <div className="mt-12 flex justify-center gap-8 text-sm text-text-muted">
        <div className="flex flex-col items-center gap-2">
          <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-accent" />
          </div>
          <span>{isZh ? 'AI 辅助' : 'AI-Assisted'}</span>
        </div>
        <div className="flex flex-col items-center gap-2">
          <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center">
            <Cpu className="w-5 h-5 text-purple-400" />
          </div>
          <span>{isZh ? '多模型' : 'Multi-Model'}</span>
        </div>
        <div className="flex flex-col items-center gap-2">
          <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
            <Settings className="w-5 h-5 text-blue-400" />
          </div>
          <span>{isZh ? '可定制' : 'Customizable'}</span>
        </div>
      </div>
    </div>
  )
}


function LanguageStep({
  isZh,
  selectedLanguage,
  onSelect
}: {
  isZh: boolean
  selectedLanguage: Language
  onSelect: (lang: Language) => void
}) {
  return (
    <div className="px-8 py-10">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
          <Globe className="w-5 h-5 text-accent" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-text-primary">
            {isZh ? '语言偏好' : 'Language Preference'}
          </h2>
          <p className="text-sm text-text-muted">
            {isZh ? '选择界面语言' : 'Choose your interface language'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mt-8">
        {LANGUAGES.map(lang => (
          <button
            key={lang.id}
            onClick={() => onSelect(lang.id)}
            className={`relative p-6 rounded-2xl border-2 text-left transition-all duration-300 group ${
              selectedLanguage === lang.id
                ? 'border-accent bg-accent/5 shadow-glow-sm'
                : 'border-border-subtle hover:border-accent/30 bg-surface/30'
            }`}
          >
            <div className="text-3xl mb-3 group-hover:scale-110 transition-transform duration-300">
              {lang.id === 'zh' ? '🇨🇳' : '🇺🇸'}
            </div>
            <div className="font-bold text-text-primary text-lg">{lang.native}</div>
            <div className="text-sm text-text-muted">{lang.name}</div>
            {selectedLanguage === lang.id && (
              <div className="absolute top-4 right-4 w-6 h-6 rounded-full bg-accent flex items-center justify-center">
                <Check className="w-4 h-4 text-white" />
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}


function ThemeStep({
  isZh,
  themes,
  selectedTheme,
  onSelect
}: {
  isZh: boolean
  themes: Theme[]
  selectedTheme: string
  onSelect: (id: string) => void
}) {
  return (
    <div className="px-8 py-10">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
          <Palette className="w-5 h-5 text-accent" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-text-primary">
            {isZh ? '选择主题' : 'Choose Theme'}
          </h2>
          <p className="text-sm text-text-muted">
            {isZh ? '选择一个符合你审美的外观' : 'Pick a look that matches your style'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mt-8">
        {themes.map(theme => (
          <button
            key={theme.id}
            onClick={() => onSelect(theme.id)}
            className={`relative p-4 rounded-2xl border-2 text-left transition-all duration-300 ${
              selectedTheme === theme.id
                ? 'border-accent bg-accent/5 shadow-glow-sm'
                : 'border-border-subtle hover:border-accent/30 bg-surface/30'
            }`}
          >
            <div
              className="h-20 rounded-xl mb-4 border border-white/5 overflow-hidden shadow-inner flex flex-col"
              style={{ backgroundColor: `rgb(${theme.colors.background})` }}
            >
              <div
                className="h-4 w-full border-b border-white/5"
                style={{ backgroundColor: `rgb(${theme.colors.backgroundSecondary})` }}
              />
              <div className="flex-1 p-2 flex flex-col gap-2">
                <div className="flex gap-1.5">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: `rgb(${theme.colors.accent})` }} />
                  <div className="flex-1 h-2 rounded-full bg-white/5" />
                </div>
                <div className="w-2/3 h-2 rounded-full bg-white/5" />
              </div>
            </div>
            <div className="font-bold text-sm text-text-primary mb-0.5">{theme.name}</div>
            <div className="text-xs text-text-muted capitalize">{theme.type} Mode</div>
            {selectedTheme === theme.id && (
              <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-accent flex items-center justify-center">
                <Check className="w-3 h-3 text-white" />
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}


function ProviderStep({
  isZh,
  config,
  setConfig,
  showApiKey,
  setShowApiKey
}: {
  isZh: boolean
  config: LLMConfig
  setConfig: (config: LLMConfig) => void
  showApiKey: boolean
  setShowApiKey: (show: boolean) => void
}) {
  const providers = Object.values(PROVIDERS).filter(p => p.id !== 'custom')
  const selectedProvider = PROVIDERS[config.provider]

  return (
    <div className="px-8 py-10">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
          <Cpu className="w-5 h-5 text-accent" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-text-primary">
            {isZh ? '配置 AI 模型' : 'Configure AI Model'}
          </h2>
          <p className="text-sm text-text-muted">
            {isZh ? '连接你的 AI 服务' : 'Connect your AI service'}
          </p>
        </div>
      </div>

      <div className="mt-8 space-y-6">
        <div>
          <label className="text-xs font-bold text-text-muted uppercase tracking-wider mb-3 block">
            {isZh ? '服务提供商' : 'Provider'}
          </label>
          <div className="grid grid-cols-4 gap-2">
            {providers.map(p => (
              <button
                key={p.id}
                onClick={() => setConfig({
                  ...config,
                  provider: p.id as any,
                  model: p.models[0],
                  baseUrl: undefined
                })}
                className={`px-3 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                  config.provider === p.id
                    ? 'border-accent bg-accent/10 text-accent shadow-glow-sm'
                    : 'border-border-subtle hover:border-text-muted text-text-muted bg-surface/30'
                }`}
              >
                {p.displayName}
              </button>
            ))}
          </div>
        </div>

        {selectedProvider && (
          <div>
            <label className="text-xs font-bold text-text-muted uppercase tracking-wider mb-3 block">
              {isZh ? '默认模型' : 'Default Model'}
            </label>
            <Select
              value={config.model}
              onChange={(value) => setConfig({ ...config, model: value })}
              options={selectedProvider.models.map(m => ({ value: m, label: m }))}
              className="w-full"
            />
          </div>
        )}

        <div>
          <label className="text-xs font-bold text-text-muted uppercase tracking-wider mb-3 block flex items-center justify-between">
            <span>API Key</span>
            <span className="text-[10px] font-normal normal-case opacity-60">
              {isZh ? '(可稍后在设置中配置)' : '(Can be set later in Settings)'}
            </span>
          </label>
          <div className="relative">
            <Input
              type={showApiKey ? 'text' : 'password'}
              value={config.apiKey}
              onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
              placeholder={selectedProvider?.auth.placeholder || 'sk-...'}
              className="w-full pr-10"
            />
            <button
              type="button"
              onClick={() => setShowApiKey(!showApiKey)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary transition-colors"
            >
              {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {selectedProvider?.auth.helpUrl && (
            <a
              href={selectedProvider.auth.helpUrl}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-accent hover:underline mt-2.5 inline-flex items-center gap-1"
            >
              <span>{isZh ? '获取 API Key' : 'Get API Key'}</span>
              <ChevronRight className="w-3 h-3" />
            </a>
          )}
        </div>
      </div>
    </div>
  )
}


function WorkspaceStep({
  isZh,
  workspacePath,
  onOpenFolder
}: {
  isZh: boolean
  workspacePath: string | null
  onOpenFolder: () => void
}) {
  return (
    <div className="px-8 py-10">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
          <FolderOpen className="w-5 h-5 text-accent" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-text-primary">
            {isZh ? '打开项目' : 'Open Project'}
          </h2>
          <p className="text-sm text-text-muted">
            {isZh ? '选择一个文件夹开始编程' : 'Select a folder to start coding'}
          </p>
        </div>
      </div>

      <div className="mt-10 flex flex-col items-center">
        {workspacePath ? (
          <div className="text-center animate-in fade-in zoom-in duration-500">
            <div className="w-20 h-20 rounded-3xl bg-status-success/10 flex items-center justify-center mb-6 mx-auto shadow-glow-sm shadow-status-success/20">
              <Check className="w-10 h-10 text-status-success" />
            </div>
            <p className="text-text-primary font-bold text-lg mb-2">{isZh ? '项目已就绪' : 'Project Ready'}</p>
            <div className="text-xs text-text-muted font-mono bg-surface/50 px-4 py-2 rounded-xl border border-border-subtle max-w-md truncate">
              {workspacePath}
            </div>
            <button
              onClick={onOpenFolder}
              className="mt-6 text-sm text-accent hover:text-accent-hover font-medium transition-colors flex items-center gap-1 mx-auto"
            >
              <span>{isZh ? '更换项目' : 'Change project'}</span>
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <div className="text-center">
            <button
              onClick={onOpenFolder}
              className="w-40 h-40 rounded-3xl border-2 border-dashed border-border-subtle hover:border-accent hover:bg-accent/5 transition-all duration-300 flex flex-col items-center justify-center gap-4 group shadow-sm hover:shadow-glow-sm"
            >
              <div className="w-16 h-16 rounded-2xl bg-surface/50 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                <FolderOpen className="w-8 h-8 text-text-muted group-hover:text-accent transition-colors" />
              </div>
              <span className="text-sm font-bold text-text-muted group-hover:text-text-primary transition-colors">
                {isZh ? '选择文件夹' : 'Select Folder'}
              </span>
            </button>
            <p className="text-xs text-text-muted mt-6 max-w-xs mx-auto leading-relaxed">
              {isZh ? '可跳过此步骤，稍后通过菜单打开项目' : 'You can skip this and open a project later'}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}


function CompleteStep({ isZh }: { isZh: boolean }) {
  return (
    <div className="px-8 py-10 text-center">
      <div className="mb-6 flex justify-center">
        <div className="relative">
          <div className="w-20 h-20 rounded-full bg-status-success/10 flex items-center justify-center">
            <Check className="w-10 h-10 text-status-success" />
          </div>
          <div className="absolute -inset-4 bg-status-success/10 rounded-full blur-2xl -z-10 animate-pulse" />
        </div>
      </div>

      <h2 className="text-2xl font-bold text-text-primary mb-2">
        {isZh ? '设置完成！' : 'Setup Complete!'}
      </h2>
      <p className="text-text-muted max-w-md mx-auto text-sm mb-8">
        {isZh
          ? '基础设置已完成，你可以开始使用了。'
          : 'Basic setup is done. You can start using the editor now.'}
      </p>

      {/* 高级配置提示 */}
      <div className="bg-surface/30 backdrop-blur-sm rounded-2xl p-5 max-w-md mx-auto text-left border border-border-subtle">
        <div className="flex items-center gap-2 mb-3">
          <Settings className="w-4 h-4 text-accent" />
          <span className="text-xs font-bold text-text-muted uppercase tracking-wider">
            {isZh ? '高级配置' : 'Advanced Settings'}
          </span>
        </div>
        <p className="text-xs text-text-muted leading-relaxed mb-4">
          {isZh
            ? '更多高级功能可在设置中配置：'
            : 'More advanced features can be configured in Settings:'}
        </p>
        <div className="space-y-2 text-xs">
          <div className="flex items-center gap-2 text-text-secondary">
            <span className="w-1.5 h-1.5 rounded-full bg-accent" />
            <span>{isZh ? 'Agent 设置 - 自动化权限、上下文限制' : 'Agent - Automation, context limits'}</span>
          </div>
          <div className="flex items-center gap-2 text-text-secondary">
            <span className="w-1.5 h-1.5 rounded-full bg-accent" />
            <span>{isZh ? '安全设置 - 工作区模式、审计日志' : 'Security - Workspace mode, audit log'}</span>
          </div>
          <div className="flex items-center gap-2 text-text-secondary">
            <span className="w-1.5 h-1.5 rounded-full bg-accent" />
            <span>{isZh ? '编辑器设置 - 字体、性能、AI 补全' : 'Editor - Font, performance, AI completion'}</span>
          </div>
          <div className="flex items-center gap-2 text-text-secondary">
            <span className="w-1.5 h-1.5 rounded-full bg-accent" />
            <span>{isZh ? '索引设置 - 向量搜索、Embedding 配置' : 'Index - Vector search, embedding config'}</span>
          </div>
        </div>
        <div className="mt-4 pt-3 border-t border-border-subtle flex items-center justify-between text-xs">
          <span className="text-text-muted">{isZh ? '快捷键打开设置' : 'Open Settings'}</span>
          <kbd className="px-2 py-1 bg-background rounded border border-border-subtle font-mono text-text-muted">Ctrl+,</kbd>
        </div>
      </div>
    </div>
  )
}
