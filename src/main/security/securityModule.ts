/**
 * 安全审计和权限管理模块
 * 统一管理所有敏感操作的权限校验和审计日志
 */

import { logger } from '@shared/utils/Logger'
import Store from 'electron-store'
import * as path from 'path'
import { SECURITY_DEFAULTS } from '../../shared/constants'

// 敏感操作类型
export enum OperationType {
  // 文件系统
  FILE_READ = 'file:read',
  FILE_WRITE = 'file:write',
  FILE_DELETE = 'file:delete',
  FILE_RENAME = 'file:rename',

  // 终端/命令
  SHELL_EXECUTE = 'shell:execute',
  TERMINAL_INTERACTIVE = 'terminal:interactive',

  // Git
  GIT_EXEC = 'git:exec',

  // 系统
  SYSTEM_SHELL = 'system:shell',
}

// 审计日志接口
export interface AuditLog {
  timestamp: string
  operation: OperationType
  target: string
  success: boolean
  detail?: string
}

// 安全配置接口
export interface SecurityConfig {
  enablePermissionConfirm: boolean
  enableAuditLog: boolean
  strictWorkspaceMode: boolean
  allowedShellCommands?: string[]
  showSecurityWarnings?: boolean
}

// 安全存储（独立于主配置）
const securityStore = new Store({ name: 'security' })

// 审计日志存储
const auditStore = new Store({ name: 'audit' })

// 权限等级
export enum PermissionLevel {
  ALLOWED = 'allowed',      // 允许，无需确认
  ASK = 'ask',              // 每次需要用户确认
  DENIED = 'denied'         // 永远拒绝
}

interface PermissionConfig {
  [key: string]: PermissionLevel
}

// 来自 settingsSlice.ts 的定义
export interface SecuritySettings {
  enablePermissionConfirm: boolean
  enableAuditLog: boolean
  strictWorkspaceMode: boolean
  allowedShellCommands?: string[]
  showSecurityWarnings?: boolean
}

interface SecurityModule {
  // 权限管理（主进程底线检查，不弹窗）
  checkPermission: (operation: OperationType, target: string) => Promise<boolean>
  setPermission: (operation: OperationType, level: PermissionLevel) => void

  // 审计日志
  logOperation: (operation: OperationType, target: string, success: boolean, detail?: any) => void
  getAuditLogs: (limit?: number) => any[]
  clearAuditLogs: () => void

  // 工作区安全边界
  validateWorkspacePath: (filePath: string, workspace: string | string[]) => boolean
  isSensitivePath: (filePath: string) => boolean

  // 白名单管理
  isAllowedCommand: (command: string, type: 'shell' | 'git') => boolean

  // 配置更新
  updateConfig: (config: Partial<SecuritySettings>) => void
}

// 默认权限配置
const DEFAULT_PERMISSIONS: PermissionConfig = {
  [OperationType.FILE_READ]: PermissionLevel.ALLOWED,
  [OperationType.FILE_WRITE]: PermissionLevel.ALLOWED,
  [OperationType.FILE_RENAME]: PermissionLevel.ALLOWED,
  [OperationType.FILE_DELETE]: PermissionLevel.ASK,
  [OperationType.SHELL_EXECUTE]: PermissionLevel.ALLOWED,
  [OperationType.TERMINAL_INTERACTIVE]: PermissionLevel.ALLOWED,
  [OperationType.GIT_EXEC]: PermissionLevel.ALLOWED,
  [OperationType.SYSTEM_SHELL]: PermissionLevel.DENIED,
}

// 敏感路径模式
const SENSITIVE_PATHS = [
  /^C:\\Windows\\/i,
  /^C:\\Program Files\\/i,
  /^C:\\Program Files \(x86\)\\/i,
  /^\/etc\//i,
  /^\/usr\/bin\//i,
  /^\/root\//i,
  /\/\.ssh\//i,
  /\/\.env$/i,
  /\/password|secret|credential/i,
]

// 命令白名单（已统一到 constants.ts）
const ALLOWED_SHELL_COMMANDS = new Set(SECURITY_DEFAULTS.SHELL_COMMANDS.map(cmd => cmd.toLowerCase()))

const ALLOWED_GIT_SUBCOMMANDS = new Set(SECURITY_DEFAULTS.GIT_SUBCOMMANDS.map(cmd => cmd.toLowerCase()))

class SecurityManager implements SecurityModule {
  private sessionStorage: Map<string, boolean> = new Map()
  private config: Partial<SecuritySettings> = {}

  setMainWindow(_window: any) {
    // 暂时保留方法签名以兼容 main.ts，但不再存储 window 引用以消除 lint 警告
  }

  /**
   * 更新安全配置
   */
  updateConfig(config: Partial<SecuritySettings>) {
    this.config = { ...this.config, ...config }
    logger.security.info('[Security] Configuration updated:', this.config)
  }

  /**
   * 检查权限
   */
  async checkPermission(operation: OperationType, target: string): Promise<boolean> {
    const sessionKey = `${operation}:${target}`
    if (this.sessionStorage.has(sessionKey)) {
      return this.sessionStorage.get(sessionKey)!
    }

    const config = this.getPermissionConfig(operation)

    if (config === PermissionLevel.DENIED) {
      this.logOperation(operation, target, false, { reason: 'Permission denied by policy' })
      return false
    }

    if (config === PermissionLevel.ASK) {
      if (this.config.enablePermissionConfirm === false) {
        return true
      }
      return true
    }

    return true
  }

  /**
   * 设置权限
   */
  setPermission(operation: OperationType, level: PermissionLevel): void {
    const permissions = securityStore.get('permissions', {}) as PermissionConfig
    permissions[operation] = level
    securityStore.set('permissions', permissions)
  }

  /**
   * 获取权限配置
   */
  private getPermissionConfig(operation: OperationType): PermissionLevel {
    const permissions = securityStore.get('permissions', {}) as PermissionConfig
    if (permissions[operation]) {
      return permissions[operation]
    }
    return DEFAULT_PERMISSIONS[operation] || PermissionLevel.ASK
  }

  /**
   * 记录日志
   */
  logOperation(operation: OperationType, target: string, success: boolean, detail?: any): void {
    const logs = auditStore.get('logs', []) as any[]
    const timestamp = new Date().toISOString()

    const logEntry = {
      timestamp,
      operation,
      target,
      success,
      detail: detail ? JSON.stringify(detail) : undefined,
    }

    logs.unshift(logEntry)
    if (logs.length > 1000) logs.splice(1000)
    auditStore.set('logs', logs)

    const status = success ? '✅' : '❌'
    logger.security.info(`[Security Audit] ${status} ${operation} - ${target}`)
  }

  /**
   * 获取日志
   */
  getAuditLogs(limit = 100): any[] {
    const logs = auditStore.get('logs', []) as any[]
    return logs.slice(0, limit)
  }

  /**
   * 清空日志
   */
  clearAuditLogs(): void {
    auditStore.set('logs', [])
  }

  /**
   * 验证工作区边界
   */
  validateWorkspacePath(filePath: string, workspace: string | string[]): boolean {
    if (!workspace) return false
    const workspaces = Array.isArray(workspace) ? workspace : [workspace]

    try {
      const resolvedPath = path.resolve(filePath)

      const isInside = workspaces.some(ws => {
        if (typeof ws !== 'string') return false
        const resolvedWorkspace = path.resolve(ws)
        return resolvedPath.startsWith(resolvedWorkspace + path.sep) ||
          resolvedPath === resolvedWorkspace
      })

      const isSensitive = typeof resolvedPath === 'string' && this.isSensitivePath(resolvedPath)

      return isInside && !isSensitive
    } catch (error) {
      logger.security.error('[Security] Path validation error:', error)
      return false
    }
  }

  /**
   * 检查敏感路径
   */
  isSensitivePath(filePath: string): boolean {
    if (typeof filePath !== 'string') return true
    const normalized = filePath.replace(/\\/g, '/')
    return SENSITIVE_PATHS.some(pattern => pattern.test(normalized))
  }

  /**
   * 检查允许的命令
   */
  isAllowedCommand(command: string, type: 'shell' | 'git'): boolean {
    const parts = command.trim().split(/\s+/)
    const baseCommand = parts[0]?.toLowerCase()

    if (type === 'git') {
      const subCommand = parts[1]?.toLowerCase()
      return ALLOWED_GIT_SUBCOMMANDS.has(subCommand)
    }

    if (type === 'shell') {
      if (this.config.allowedShellCommands && Array.isArray(this.config.allowedShellCommands)) {
        return this.config.allowedShellCommands.includes(baseCommand)
      }
      return ALLOWED_SHELL_COMMANDS.has(baseCommand)
    }

    return false
  }
}

export const securityManager = new SecurityManager()

export async function checkWorkspacePermission(
  filePath: string,
  workspace: string | string[] | null,
  operation: OperationType
): Promise<boolean> {
  if (!workspace) return false
  if (!securityManager.validateWorkspacePath(filePath, workspace)) return false
  if (securityManager.isSensitivePath(filePath)) return false
  return await securityManager.checkPermission(operation, filePath)
}
