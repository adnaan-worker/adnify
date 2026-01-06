/**
 * MCP (Model Context Protocol) 共享类型定义
 */

// ============================================
// 配置类型
// ============================================

/** MCP 服务器类型 */
export type McpServerType = 'local' | 'remote'

/** OAuth 配置 */
export interface McpOAuthConfig {
  /** OAuth 客户端 ID（可选，不提供则尝试动态注册） */
  clientId?: string
  /** OAuth 客户端密钥 */
  clientSecret?: string
  /** OAuth 作用域 */
  scope?: string
}

/** 本地 MCP 服务器配置 */
export interface McpLocalServerConfig {
  /** 服务器类型 */
  type: 'local'
  /** 服务器唯一标识 */
  id: string
  /** 显示名称 */
  name: string
  /** 启动命令 */
  command: string
  /** 命令参数 */
  args?: string[]
  /** 环境变量 */
  env?: Record<string, string>
  /** 是否禁用 */
  disabled?: boolean
  /** 自动批准的工具列表 */
  autoApprove?: string[]
  /** 工作目录 */
  cwd?: string
  /** 连接超时（毫秒） */
  timeout?: number
  /** 来源预设 ID（用于匹配预设获取使用示例等信息） */
  presetId?: string
}

/** 远程 MCP 服务器配置 */
export interface McpRemoteServerConfig {
  /** 服务器类型 */
  type: 'remote'
  /** 服务器唯一标识 */
  id: string
  /** 显示名称 */
  name: string
  /** 远程服务器 URL */
  url: string
  /** 自定义请求头 */
  headers?: Record<string, string>
  /** OAuth 配置（设为 false 禁用 OAuth） */
  oauth?: McpOAuthConfig | false
  /** 是否禁用 */
  disabled?: boolean
  /** 自动批准的工具列表 */
  autoApprove?: string[]
  /** 连接超时（毫秒） */
  timeout?: number
  /** 来源预设 ID（用于匹配预设获取使用示例等信息） */
  presetId?: string
}

/** MCP 服务器配置（联合类型） */
export type McpServerConfig = McpLocalServerConfig | McpRemoteServerConfig

/** 判断是否为远程配置 */
export function isRemoteConfig(config: McpServerConfig): config is McpRemoteServerConfig {
  return config.type === 'remote'
}

/** 判断是否为本地配置 */
export function isLocalConfig(config: McpServerConfig): config is McpLocalServerConfig {
  return config.type === 'local'
}

/** MCP 配置文件结构 */
export interface McpConfig {
  mcpServers: Record<string, Omit<McpServerConfig, 'id'>>
}

// ============================================
// 服务器状态
// ============================================

export type McpServerStatus = 
  | 'disconnected' 
  | 'connecting' 
  | 'connected' 
  | 'error'
  | 'needs_auth'           // 需要 OAuth 认证
  | 'needs_registration'   // 需要客户端注册

/** MCP 服务器运行时状态 */
export interface McpServerState {
  id: string
  config: McpServerConfig
  status: McpServerStatus
  error?: string
  tools: McpTool[]
  resources: McpResource[]
  prompts: McpPrompt[]
  lastConnected?: number
  /** OAuth 认证状态（仅远程服务器） */
  authStatus?: 'authenticated' | 'expired' | 'not_authenticated'
  /** OAuth 授权 URL（需要认证时） */
  authUrl?: string
}

// ============================================
// MCP 协议类型
// ============================================

/** MCP 工具定义 */
export interface McpTool {
  name: string
  description?: string
  inputSchema: {
    type: 'object'
    properties?: Record<string, McpToolProperty>
    required?: string[]
  }
}

export interface McpToolProperty {
  type: string
  description?: string
  enum?: string[]
  items?: McpToolProperty
  properties?: Record<string, McpToolProperty>
}

/** MCP 资源定义 */
export interface McpResource {
  uri: string
  name: string
  description?: string
  mimeType?: string
}

/** MCP 提示模板定义 */
export interface McpPrompt {
  name: string
  description?: string
  arguments?: McpPromptArgument[]
}

export interface McpPromptArgument {
  name: string
  description?: string
  required?: boolean
}

// ============================================
// 工具调用
// ============================================

/** MCP 工具调用请求 */
export interface McpToolCallRequest {
  serverId: string
  toolName: string
  arguments: Record<string, unknown>
}

/** MCP 工具调用结果 */
export interface McpToolCallResult {
  success: boolean
  content?: McpContent[]
  error?: string
  isError?: boolean
}

/** MCP 内容类型 */
export interface McpContent {
  type: 'text' | 'image' | 'resource'
  text?: string
  data?: string
  mimeType?: string
  uri?: string
}

// ============================================
// 资源操作
// ============================================

/** 资源读取请求 */
export interface McpResourceReadRequest {
  serverId: string
  uri: string
}

/** 资源读取结果 */
export interface McpResourceReadResult {
  success: boolean
  contents?: McpResourceContent[]
  error?: string
}

export interface McpResourceContent {
  uri: string
  mimeType?: string
  text?: string
  blob?: string
}

// ============================================
// 提示操作
// ============================================

/** 提示获取请求 */
export interface McpPromptGetRequest {
  serverId: string
  promptName: string
  arguments?: Record<string, string>
}

/** 提示获取结果 */
export interface McpPromptGetResult {
  success: boolean
  description?: string
  messages?: McpPromptMessage[]
  error?: string
}

export interface McpPromptMessage {
  role: 'user' | 'assistant'
  content: McpContent
}

// ============================================
// IPC 事件类型
// ============================================

export interface McpServerStatusEvent {
  serverId: string
  status: McpServerStatus
  error?: string
  authUrl?: string
}

export interface McpToolsUpdatedEvent {
  serverId: string
  tools: McpTool[]
}

export interface McpResourcesUpdatedEvent {
  serverId: string
  resources: McpResource[]
}

// ============================================
// OAuth 相关类型
// ============================================

/** OAuth 认证请求 */
export interface McpOAuthStartRequest {
  serverId: string
}

/** OAuth 认证结果 */
export interface McpOAuthStartResult {
  success: boolean
  authorizationUrl?: string
  error?: string
}

/** OAuth 完成请求 */
export interface McpOAuthFinishRequest {
  serverId: string
  authorizationCode: string
}

/** OAuth 完成结果 */
export interface McpOAuthFinishResult {
  success: boolean
  error?: string
}

/** OAuth Token 存储 */
export interface McpOAuthTokens {
  accessToken: string
  refreshToken?: string
  expiresAt?: number
  tokenType?: string
  scope?: string
}
