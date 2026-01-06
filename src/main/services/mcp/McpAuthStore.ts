/**
 * MCP OAuth 认证存储
 * 持久化存储 OAuth tokens 和客户端信息
 */

import * as fs from 'fs'
import * as path from 'path'
import { app } from 'electron'
import { logger } from '@shared/utils/Logger'

export interface McpAuthTokens {
  accessToken: string
  refreshToken?: string
  expiresAt?: number
  scope?: string
}

export interface McpAuthClientInfo {
  clientId: string
  clientSecret?: string
  clientIdIssuedAt?: number
  clientSecretExpiresAt?: number
}

export interface McpAuthEntry {
  tokens?: McpAuthTokens
  clientInfo?: McpAuthClientInfo
  codeVerifier?: string
  oauthState?: string
  serverUrl?: string
}

export namespace McpAuthStore {
  const getFilePath = () => path.join(app.getPath('userData'), 'mcp-auth.json')

  export async function get(mcpName: string): Promise<McpAuthEntry | undefined> {
    const data = await all()
    return data[mcpName]
  }

  export async function getForUrl(mcpName: string, serverUrl: string): Promise<McpAuthEntry | undefined> {
    const entry = await get(mcpName)
    if (!entry) return undefined
    if (!entry.serverUrl) return undefined
    if (entry.serverUrl !== serverUrl) return undefined
    return entry
  }

  export async function all(): Promise<Record<string, McpAuthEntry>> {
    try {
      const filepath = getFilePath()
      if (!fs.existsSync(filepath)) return {}
      const content = fs.readFileSync(filepath, 'utf-8')
      return JSON.parse(content)
    } catch {
      return {}
    }
  }

  export async function set(mcpName: string, entry: McpAuthEntry, serverUrl?: string): Promise<void> {
    try {
      const filepath = getFilePath()
      const data = await all()
      if (serverUrl) {
        entry.serverUrl = serverUrl
      }
      data[mcpName] = entry
      fs.writeFileSync(filepath, JSON.stringify(data, null, 2), { mode: 0o600 })
    } catch (err) {
      logger.mcp?.error('[McpAuthStore] Failed to save:', err)
    }
  }

  export async function remove(mcpName: string): Promise<void> {
    try {
      const filepath = getFilePath()
      const data = await all()
      delete data[mcpName]
      fs.writeFileSync(filepath, JSON.stringify(data, null, 2), { mode: 0o600 })
    } catch (err) {
      logger.mcp?.error('[McpAuthStore] Failed to remove:', err)
    }
  }

  export async function updateTokens(
    mcpName: string,
    tokens: McpAuthTokens,
    serverUrl?: string
  ): Promise<void> {
    const entry = (await get(mcpName)) ?? {}
    entry.tokens = tokens
    await set(mcpName, entry, serverUrl)
  }

  export async function updateClientInfo(
    mcpName: string,
    clientInfo: McpAuthClientInfo,
    serverUrl?: string
  ): Promise<void> {
    const entry = (await get(mcpName)) ?? {}
    entry.clientInfo = clientInfo
    await set(mcpName, entry, serverUrl)
  }

  export async function updateCodeVerifier(mcpName: string, codeVerifier: string): Promise<void> {
    const entry = (await get(mcpName)) ?? {}
    entry.codeVerifier = codeVerifier
    await set(mcpName, entry)
  }

  export async function clearCodeVerifier(mcpName: string): Promise<void> {
    const entry = await get(mcpName)
    if (entry) {
      delete entry.codeVerifier
      await set(mcpName, entry)
    }
  }

  export async function updateOAuthState(mcpName: string, oauthState: string): Promise<void> {
    const entry = (await get(mcpName)) ?? {}
    entry.oauthState = oauthState
    await set(mcpName, entry)
  }

  export async function getOAuthState(mcpName: string): Promise<string | undefined> {
    const entry = await get(mcpName)
    return entry?.oauthState
  }

  export async function clearOAuthState(mcpName: string): Promise<void> {
    const entry = await get(mcpName)
    if (entry) {
      delete entry.oauthState
      await set(mcpName, entry)
    }
  }

  export async function isTokenExpired(mcpName: string): Promise<boolean | null> {
    const entry = await get(mcpName)
    if (!entry?.tokens) return null
    if (!entry.tokens.expiresAt) return false
    return entry.tokens.expiresAt < Date.now()
  }
}
