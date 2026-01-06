/**
 * MCP 添加服务器模态框
 * 支持从预设添加或自定义配置
 */

import { useState, useMemo } from 'react'
import {
  Search,
  Plus,
  ChevronRight,
  ExternalLink,
  Check,
  AlertCircle,
  Loader2,
  Eye,
  EyeOff,
  // 图标映射
  Search as SearchIcon,
  Database,
  FolderOpen,
  Github,
  GitBranch,
  Brain,
  ListOrdered,
  Cloud,
  Globe,
  Monitor,
  Clock,
  Boxes,
  Sparkles,
  Server,
} from 'lucide-react'
import { Button, Input, Modal } from '@components/ui'
import {
  MCP_PRESETS,
  MCP_CATEGORY_NAMES,
  searchPresets,
  type McpPreset,
  type McpPresetCategory,
  type McpEnvConfig,
} from '@shared/config/mcpPresets'

interface McpAddServerModalProps {
  isOpen: boolean
  onClose: () => void
  onAdd: (config: McpServerFormData) => Promise<boolean>
  language: 'en' | 'zh'
  existingServerIds: string[]
}

export interface McpServerFormData {
  type: 'local' | 'remote'
  id: string
  name: string
  // 本地服务器字段
  command?: string
  args?: string[]
  env?: Record<string, string>
  // 远程服务器字段
  url?: string
  headers?: Record<string, string>
  oauth?: { clientId?: string; clientSecret?: string; scope?: string } | false
  // 通用字段
  autoApprove?: string[]
  disabled?: boolean
  /** 来源预设 ID */
  presetId?: string
}

type ViewMode = 'presets' | 'custom' | 'configure'
type ServerType = 'local' | 'remote'

// 图标映射
const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Search: SearchIcon,
  Database,
  FolderOpen,
  Github,
  GitBranch,
  Brain,
  ListOrdered,
  Cloud,
  Globe,
  Monitor,
  Clock,
  Boxes,
  Sparkles,
  Server,
}

export default function McpAddServerModal({
  isOpen,
  onClose,
  onAdd,
  language,
  existingServerIds,
}: McpAddServerModalProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('presets')
  const [serverType, setServerType] = useState<ServerType>('local')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<McpPresetCategory | 'all'>('all')
  const [selectedPreset, setSelectedPreset] = useState<McpPreset | null>(null)
  const [formData, setFormData] = useState<McpServerFormData>({
    type: 'local',
    id: '',
    name: '',
    command: '',
    args: [],
    env: {},
    autoApprove: [],
    disabled: false,
  })
  const [envValues, setEnvValues] = useState<Record<string, string>>({})
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({})
  const [argsInput, setArgsInput] = useState('')
  const [autoApproveInput, setAutoApproveInput] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // 远程服务器字段
  const [remoteUrl, setRemoteUrl] = useState('')
  const [oauthClientId, setOauthClientId] = useState('')
  const [oauthClientSecret, setOauthClientSecret] = useState('')
  const [oauthScope, setOauthScope] = useState('')
  const [enableOAuth, setEnableOAuth] = useState(true)

  // 过滤预设
  const filteredPresets = useMemo(() => {
    let presets = searchQuery ? searchPresets(searchQuery) : MCP_PRESETS
    if (selectedCategory !== 'all') {
      presets = presets.filter(p => p.category === selectedCategory)
    }
    // 过滤已存在的服务器
    return presets.filter(p => !existingServerIds.includes(p.id))
  }, [searchQuery, selectedCategory, existingServerIds])

  // 分类列表
  const categories: Array<{ id: McpPresetCategory | 'all'; name: string }> = [
    { id: 'all', name: language === 'zh' ? '全部' : 'All' },
    ...Object.entries(MCP_CATEGORY_NAMES).map(([id, names]) => ({
      id: id as McpPresetCategory,
      name: language === 'zh' ? names.zh : names.en,
    })),
  ]

  // 选择预设
  const handleSelectPreset = (preset: McpPreset) => {
    setSelectedPreset(preset)
    setEnvValues({})
    setShowSecrets({})
    
    // 如果不需要配置，直接进入配置页面
    if (!preset.requiresConfig) {
      setViewMode('configure')
    } else {
      setViewMode('configure')
    }
  }

  // 切换到自定义模式
  const handleCustomMode = () => {
    setSelectedPreset(null)
    setServerType('local')
    setFormData({
      type: 'local',
      id: '',
      name: '',
      command: '',
      args: [],
      env: {},
      autoApprove: [],
      disabled: false,
    })
    setArgsInput('')
    setAutoApproveInput('')
    setRemoteUrl('')
    setOauthClientId('')
    setOauthClientSecret('')
    setOauthScope('')
    setEnableOAuth(true)
    setViewMode('custom')
  }

  // 返回预设列表
  const handleBack = () => {
    setSelectedPreset(null)
    setError(null)
    setViewMode('presets')
  }

  // 提交表单
  const handleSubmit = async () => {
    setError(null)
    setIsSubmitting(true)

    try {
      let config: McpServerFormData

      if (selectedPreset) {
        // 从预设创建（本地服务器）
        const env: Record<string, string> = {}
        
        // 处理环境变量
        for (const envConfig of selectedPreset.envConfig || []) {
          const value = envValues[envConfig.key]
          if (envConfig.required && !value) {
            throw new Error(
              language === 'zh'
                ? `请填写 ${envConfig.labelZh}`
                : `Please fill in ${envConfig.label}`
            )
          }
          if (value) {
            env[envConfig.key] = value
          } else if (envConfig.defaultValue) {
            env[envConfig.key] = envConfig.defaultValue
          }
        }

        // 处理 args 中的变量替换
        const args = (selectedPreset.args || []).map(arg => {
          // 替换 ${VAR_NAME} 格式的变量
          return arg.replace(/\$\{(\w+)\}/g, (_, varName) => {
            return envValues[varName] || env[varName] || ''
          })
        }).filter(arg => arg !== '')

        config = {
          type: 'local',
          id: selectedPreset.id,
          name: selectedPreset.name,
          command: selectedPreset.command,
          args,
          env,
          autoApprove: selectedPreset.defaultAutoApprove || [],
          disabled: false,
          presetId: selectedPreset.id,
        }
      } else if (serverType === 'remote') {
        // 远程服务器配置
        if (!formData.id.trim()) {
          throw new Error(language === 'zh' ? '请填写服务器 ID' : 'Please fill in server ID')
        }
        if (!formData.name.trim()) {
          throw new Error(language === 'zh' ? '请填写服务器名称' : 'Please fill in server name')
        }
        if (!remoteUrl.trim()) {
          throw new Error(language === 'zh' ? '请填写服务器 URL' : 'Please fill in server URL')
        }
        if (existingServerIds.includes(formData.id)) {
          throw new Error(language === 'zh' ? '服务器 ID 已存在' : 'Server ID already exists')
        }

        config = {
          type: 'remote',
          id: formData.id,
          name: formData.name,
          url: remoteUrl,
          oauth: enableOAuth
            ? {
                clientId: oauthClientId || undefined,
                clientSecret: oauthClientSecret || undefined,
                scope: oauthScope || undefined,
              }
            : false,
          autoApprove: autoApproveInput.split(/[,\s]+/).filter(Boolean),
          disabled: false,
        }
      } else {
        // 本地服务器自定义配置
        if (!formData.id.trim()) {
          throw new Error(language === 'zh' ? '请填写服务器 ID' : 'Please fill in server ID')
        }
        if (!formData.name.trim()) {
          throw new Error(language === 'zh' ? '请填写服务器名称' : 'Please fill in server name')
        }
        if (!formData.command?.trim()) {
          throw new Error(language === 'zh' ? '请填写启动命令' : 'Please fill in command')
        }
        if (existingServerIds.includes(formData.id)) {
          throw new Error(language === 'zh' ? '服务器 ID 已存在' : 'Server ID already exists')
        }

        config = {
          type: 'local',
          id: formData.id,
          name: formData.name,
          command: formData.command,
          args: argsInput.split(/\s+/).filter(Boolean),
          env: formData.env,
          autoApprove: autoApproveInput.split(/[,\s]+/).filter(Boolean),
          disabled: false,
        }
      }

      const success = await onAdd(config)
      if (success) {
        onClose()
        resetForm()
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  // 重置表单
  const resetForm = () => {
    setViewMode('presets')
    setServerType('local')
    setSearchQuery('')
    setSelectedCategory('all')
    setSelectedPreset(null)
    setFormData({
      type: 'local',
      id: '',
      name: '',
      command: '',
      args: [],
      env: {},
      autoApprove: [],
      disabled: false,
    })
    setEnvValues({})
    setShowSecrets({})
    setArgsInput('')
    setAutoApproveInput('')
    setRemoteUrl('')
    setOauthClientId('')
    setOauthClientSecret('')
    setOauthScope('')
    setEnableOAuth(true)
    setError(null)
  }

  // 渲染图标
  const renderIcon = (iconName: string, className?: string) => {
    const IconComponent = ICON_MAP[iconName] || Server
    return <IconComponent className={className} />
  }

  // 渲染预设卡片
  const renderPresetCard = (preset: McpPreset) => {
    const isAdded = existingServerIds.includes(preset.id)
    
    return (
      <div
        key={preset.id}
        className={`p-4 rounded-lg border transition-all cursor-pointer ${
          isAdded
            ? 'bg-surface/30 border-white/5 opacity-50 cursor-not-allowed'
            : 'bg-surface/50 border-white/10 hover:border-accent/50 hover:bg-surface/70'
        }`}
        onClick={() => !isAdded && handleSelectPreset(preset)}
      >
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-accent/10 text-accent">
            {renderIcon(preset.icon, 'w-5 h-5')}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h4 className="font-medium text-text-primary">{preset.name}</h4>
              {preset.official && (
                <span className="px-1.5 py-0.5 text-[10px] bg-accent/20 text-accent rounded">
                  Official
                </span>
              )}
              {isAdded && (
                <span className="px-1.5 py-0.5 text-[10px] bg-green-500/20 text-green-400 rounded flex items-center gap-1">
                  <Check className="w-3 h-3" />
                  {language === 'zh' ? '已添加' : 'Added'}
                </span>
              )}
            </div>
            <p className="text-sm text-text-muted mt-1 line-clamp-2">
              {language === 'zh' ? preset.descriptionZh : preset.description}
            </p>
            {preset.tags && (
              <div className="flex flex-wrap gap-1 mt-2">
                {preset.tags.slice(0, 3).map(tag => (
                  <span key={tag} className="px-1.5 py-0.5 text-[10px] bg-white/5 text-text-muted rounded">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
          {!isAdded && <ChevronRight className="w-4 h-4 text-text-muted" />}
        </div>
      </div>
    )
  }

  // 渲染环境变量配置
  const renderEnvConfig = (envConfig: McpEnvConfig) => {
    const isSecret = envConfig.secret
    const showSecret = showSecrets[envConfig.key]

    return (
      <div key={envConfig.key} className="space-y-1.5">
        <label className="flex items-center gap-2 text-sm font-medium text-text-secondary">
          {language === 'zh' ? envConfig.labelZh : envConfig.label}
          {envConfig.required && <span className="text-red-400">*</span>}
        </label>
        {envConfig.description && (
          <p className="text-xs text-text-muted">
            {language === 'zh' ? envConfig.descriptionZh : envConfig.description}
          </p>
        )}
        <div className="relative">
          <Input
            type={isSecret && !showSecret ? 'password' : 'text'}
            value={envValues[envConfig.key] || ''}
            onChange={(e) => setEnvValues(prev => ({ ...prev, [envConfig.key]: e.target.value }))}
            placeholder={envConfig.placeholder || envConfig.defaultValue}
            className="pr-10"
          />
          {isSecret && (
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-text-muted hover:text-text-primary"
              onClick={() => setShowSecrets(prev => ({ ...prev, [envConfig.key]: !prev[envConfig.key] }))}
            >
              {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => { onClose(); resetForm(); }}
      title={
        viewMode === 'presets'
          ? (language === 'zh' ? '添加 MCP 服务器' : 'Add MCP Server')
          : viewMode === 'custom'
          ? (language === 'zh' ? '自定义服务器' : 'Custom Server')
          : selectedPreset
          ? (language === 'zh' ? `配置 ${selectedPreset.name}` : `Configure ${selectedPreset.name}`)
          : ''
      }
      size="2xl"
    >
      <div className="space-y-4">
        {/* 预设列表视图 */}
        {viewMode === 'presets' && (
          <>
            {/* 搜索和分类 */}
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={language === 'zh' ? '搜索服务器...' : 'Search servers...'}
                  className="pl-9"
                />
              </div>
              <Button variant="secondary" onClick={handleCustomMode}>
                <Plus className="w-4 h-4 mr-2" />
                {language === 'zh' ? '自定义' : 'Custom'}
              </Button>
            </div>

            {/* 分类标签 */}
            <div className="flex flex-wrap gap-2">
              {categories.map(cat => (
                <button
                  key={cat.id}
                  className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                    selectedCategory === cat.id
                      ? 'bg-accent text-white'
                      : 'bg-surface/50 text-text-secondary hover:bg-surface/70'
                  }`}
                  onClick={() => setSelectedCategory(cat.id)}
                >
                  {cat.name}
                </button>
              ))}
            </div>

            {/* 预设列表 */}
            <div className="grid grid-cols-1 gap-3 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
              {filteredPresets.length === 0 ? (
                <div className="text-center py-8 text-text-muted">
                  <Server className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>{language === 'zh' ? '没有找到匹配的服务器' : 'No matching servers found'}</p>
                </div>
              ) : (
                filteredPresets.map(renderPresetCard)
              )}
            </div>
          </>
        )}

        {/* 配置视图（预设） */}
        {viewMode === 'configure' && selectedPreset && (
          <>
            {/* 预设信息 */}
            <div className="flex items-start gap-4 p-4 bg-surface/30 rounded-lg">
              <div className="p-3 rounded-lg bg-accent/10 text-accent">
                {renderIcon(selectedPreset.icon, 'w-6 h-6')}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-text-primary">{selectedPreset.name}</h3>
                  {selectedPreset.official && (
                    <span className="px-1.5 py-0.5 text-[10px] bg-accent/20 text-accent rounded">
                      Official
                    </span>
                  )}
                </div>
                <p className="text-sm text-text-muted mt-1">
                  {language === 'zh' ? selectedPreset.descriptionZh : selectedPreset.description}
                </p>
                {selectedPreset.docsUrl && (
                  <a
                    href={selectedPreset.docsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-accent hover:underline mt-2"
                  >
                    {language === 'zh' ? '查看文档' : 'View Documentation'}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            </div>

            {/* 安装说明 */}
            {selectedPreset.setupCommand && (
              <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg space-y-2">
                <div className="flex items-center gap-2 text-yellow-400 text-sm font-medium">
                  <AlertCircle className="w-4 h-4" />
                  {language === 'zh' ? '首次使用需要安装' : 'Setup Required'}
                </div>
                <p className="text-sm text-text-muted">
                  {language === 'zh' ? selectedPreset.setupNoteZh : selectedPreset.setupNote}
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 px-3 py-2 bg-black/30 rounded font-mono text-xs text-text-primary">
                    {selectedPreset.setupCommand}
                  </code>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => navigator.clipboard.writeText(selectedPreset.setupCommand!)}
                  >
                    {language === 'zh' ? '复制' : 'Copy'}
                  </Button>
                </div>
              </div>
            )}

            {/* 环境变量配置 */}
            {selectedPreset.envConfig && selectedPreset.envConfig.length > 0 && (
              <div className="space-y-4">
                <h4 className="text-sm font-medium text-text-secondary">
                  {language === 'zh' ? '配置' : 'Configuration'}
                </h4>
                {selectedPreset.envConfig.map(renderEnvConfig)}
              </div>
            )}

            {/* 自动批准工具 */}
            {selectedPreset.defaultAutoApprove && selectedPreset.defaultAutoApprove.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-text-secondary">
                  {language === 'zh' ? '自动批准的工具' : 'Auto-approved Tools'}
                </h4>
                <div className="flex flex-wrap gap-1">
                  {selectedPreset.defaultAutoApprove.map(tool => (
                    <span key={tool} className="px-2 py-1 text-xs bg-accent/10 text-accent rounded">
                      {tool}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* 命令预览 */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-text-secondary">
                {language === 'zh' ? '启动命令' : 'Command'}
              </h4>
              <div className="p-3 bg-black/30 rounded font-mono text-xs text-text-muted">
                {selectedPreset.command} {(selectedPreset.args || []).join(' ')}
              </div>
            </div>
          </>
        )}

        {/* 自定义配置视图 */}
        {viewMode === 'custom' && (
          <div className="space-y-4">
            {/* 服务器类型选择 */}
            <div className="flex gap-2 p-1 bg-surface/30 rounded-lg">
              <button
                className={`flex-1 px-4 py-2 text-sm rounded-md transition-colors ${
                  serverType === 'local'
                    ? 'bg-accent text-white'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
                onClick={() => setServerType('local')}
              >
                {language === 'zh' ? '本地服务器' : 'Local Server'}
              </button>
              <button
                className={`flex-1 px-4 py-2 text-sm rounded-md transition-colors ${
                  serverType === 'remote'
                    ? 'bg-accent text-white'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
                onClick={() => setServerType('remote')}
              >
                {language === 'zh' ? '远程服务器' : 'Remote Server'}
              </button>
            </div>

            {/* 通用字段 */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-text-secondary">
                  {language === 'zh' ? '服务器 ID' : 'Server ID'} <span className="text-red-400">*</span>
                </label>
                <Input
                  value={formData.id}
                  onChange={(e) => setFormData(prev => ({ ...prev, id: e.target.value }))}
                  placeholder="my-server"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-text-secondary">
                  {language === 'zh' ? '显示名称' : 'Display Name'} <span className="text-red-400">*</span>
                </label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="My Server"
                />
              </div>
            </div>

            {/* 本地服务器字段 */}
            {serverType === 'local' && (
              <>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-text-secondary">
                    {language === 'zh' ? '启动命令' : 'Command'} <span className="text-red-400">*</span>
                  </label>
                  <Input
                    value={formData.command || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, command: e.target.value }))}
                    placeholder="npx, uvx, node, python..."
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-text-secondary">
                    {language === 'zh' ? '命令参数' : 'Arguments'}
                  </label>
                  <Input
                    value={argsInput}
                    onChange={(e) => setArgsInput(e.target.value)}
                    placeholder="-y @modelcontextprotocol/server-xxx"
                  />
                  <p className="text-xs text-text-muted">
                    {language === 'zh' ? '用空格分隔多个参数' : 'Separate multiple arguments with spaces'}
                  </p>
                </div>
              </>
            )}

            {/* 远程服务器字段 */}
            {serverType === 'remote' && (
              <>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-text-secondary">
                    {language === 'zh' ? '服务器 URL' : 'Server URL'} <span className="text-red-400">*</span>
                  </label>
                  <Input
                    value={remoteUrl}
                    onChange={(e) => setRemoteUrl(e.target.value)}
                    placeholder="https://mcp.example.com/api"
                  />
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-text-secondary">
                      {language === 'zh' ? 'OAuth 认证' : 'OAuth Authentication'}
                    </label>
                    <button
                      className={`relative w-10 h-5 rounded-full transition-colors ${
                        enableOAuth ? 'bg-accent' : 'bg-white/10'
                      }`}
                      onClick={() => setEnableOAuth(!enableOAuth)}
                    >
                      <span
                        className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                          enableOAuth ? 'left-5' : 'left-0.5'
                        }`}
                      />
                    </button>
                  </div>

                  {enableOAuth && (
                    <div className="space-y-3 p-3 bg-surface/30 rounded-lg">
                      <div className="space-y-1.5">
                        <label className="text-sm text-text-muted">
                          {language === 'zh' ? '客户端 ID（可选）' : 'Client ID (optional)'}
                        </label>
                        <Input
                          value={oauthClientId}
                          onChange={(e) => setOauthClientId(e.target.value)}
                          placeholder={language === 'zh' ? '留空则尝试动态注册' : 'Leave empty for dynamic registration'}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-sm text-text-muted">
                          {language === 'zh' ? '客户端密钥' : 'Client Secret'}
                        </label>
                        <Input
                          type="password"
                          value={oauthClientSecret}
                          onChange={(e) => setOauthClientSecret(e.target.value)}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-sm text-text-muted">
                          {language === 'zh' ? '作用域' : 'Scope'}
                        </label>
                        <Input
                          value={oauthScope}
                          onChange={(e) => setOauthScope(e.target.value)}
                          placeholder="read write"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-secondary">
                {language === 'zh' ? '自动批准的工具' : 'Auto-approve Tools'}
              </label>
              <Input
                value={autoApproveInput}
                onChange={(e) => setAutoApproveInput(e.target.value)}
                placeholder="tool1, tool2, tool3"
              />
              <p className="text-xs text-text-muted">
                {language === 'zh' ? '用逗号分隔多个工具名' : 'Separate tool names with commas'}
              </p>
            </div>
          </div>
        )}

        {/* 错误提示 */}
        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-500/10 rounded-lg text-red-400 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* 底部按钮 */}
        <div className="flex justify-between pt-4 border-t border-white/5">
          {viewMode !== 'presets' ? (
            <Button variant="ghost" onClick={handleBack}>
              {language === 'zh' ? '返回' : 'Back'}
            </Button>
          ) : (
            <div />
          )}
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => { onClose(); resetForm(); }}>
              {language === 'zh' ? '取消' : 'Cancel'}
            </Button>
            {viewMode !== 'presets' && (
              <Button variant="primary" onClick={handleSubmit} disabled={isSubmitting}>
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Plus className="w-4 h-4 mr-2" />
                )}
                {language === 'zh' ? '添加服务器' : 'Add Server'}
              </Button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  )
}
