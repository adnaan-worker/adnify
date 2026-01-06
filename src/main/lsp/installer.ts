/**
 * LSP 服务器自动安装器
 * 参考 OpenCode 的实现，支持自动下载和安装 LSP 服务器
 */

import { app } from 'electron'
import { spawn, execSync } from 'child_process'
import * as path from 'path'
import * as fs from 'fs'
import { logger } from '@shared/utils/Logger'

// LSP 服务器安装目录（在应用数据目录下）
const LSP_BIN_DIR = path.join(app.getPath('userData'), 'lsp-servers')

// 确保目录存在
function ensureLspBinDir(): string {
  if (!fs.existsSync(LSP_BIN_DIR)) {
    fs.mkdirSync(LSP_BIN_DIR, { recursive: true })
  }
  return LSP_BIN_DIR
}

/**
 * 获取 LSP 服务器安装目录
 */
export function getLspBinDir(): string {
  return ensureLspBinDir()
}

/**
 * 检查命令是否存在于 PATH 中
 */
export function commandExists(cmd: string): boolean {
  try {
    if (process.platform === 'win32') {
      execSync(`where ${cmd}`, { stdio: 'ignore' })
    } else {
      execSync(`which ${cmd}`, { stdio: 'ignore' })
    }
    return true
  } catch {
    return false
  }
}

/**
 * 运行 npm 安装包到指定目录
 */
async function npmInstall(packageName: string, targetDir: string): Promise<boolean> {
  return new Promise((resolve) => {
    const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm'
    
    const proc = spawn(npmCmd, ['install', packageName, '--prefix', targetDir], {
      cwd: targetDir,
      stdio: 'pipe',
      shell: true,
    })
    
    proc.on('close', (code) => {
      resolve(code === 0)
    })
    
    proc.on('error', () => {
      resolve(false)
    })
  })
}

// ============ 各语言服务器安装函数 ============

export interface LspInstallResult {
  success: boolean
  path?: string
  error?: string
}

/**
 * 安装 TypeScript Language Server
 */
export async function installTypeScriptServer(): Promise<LspInstallResult> {
  const binDir = ensureLspBinDir()
  const serverPath = path.join(binDir, 'node_modules', 'typescript-language-server', 'lib', 'cli.mjs')
  
  if (fs.existsSync(serverPath)) {
    return { success: true, path: serverPath }
  }
  
  logger.lsp.info('[LSP Installer] Installing typescript-language-server...')
  
  const success = await npmInstall('typescript-language-server typescript', binDir)
  
  if (success && fs.existsSync(serverPath)) {
    logger.lsp.info('[LSP Installer] typescript-language-server installed successfully')
    return { success: true, path: serverPath }
  }
  
  return { success: false, error: 'Failed to install typescript-language-server' }
}

/**
 * 安装 VSCode Language Servers (HTML/CSS/JSON)
 */
export async function installVscodeLanguageServers(): Promise<LspInstallResult> {
  const binDir = ensureLspBinDir()
  const htmlPath = path.join(binDir, 'node_modules', 'vscode-langservers-extracted', 'bin', 'vscode-html-language-server.js')
  
  if (fs.existsSync(htmlPath)) {
    return { success: true, path: path.dirname(htmlPath) }
  }
  
  logger.lsp.info('[LSP Installer] Installing vscode-langservers-extracted...')
  
  const success = await npmInstall('vscode-langservers-extracted', binDir)
  
  if (success && fs.existsSync(htmlPath)) {
    logger.lsp.info('[LSP Installer] vscode-langservers-extracted installed successfully')
    return { success: true, path: path.dirname(htmlPath) }
  }
  
  return { success: false, error: 'Failed to install vscode-langservers-extracted' }
}

/**
 * 安装 Pyright (Python LSP)
 */
export async function installPyright(): Promise<LspInstallResult> {
  const binDir = ensureLspBinDir()
  const serverPath = path.join(binDir, 'node_modules', 'pyright', 'dist', 'pyright-langserver.js')
  
  if (fs.existsSync(serverPath)) {
    return { success: true, path: serverPath }
  }
  
  logger.lsp.info('[LSP Installer] Installing pyright...')
  
  const success = await npmInstall('pyright', binDir)
  
  if (success && fs.existsSync(serverPath)) {
    logger.lsp.info('[LSP Installer] pyright installed successfully')
    return { success: true, path: serverPath }
  }
  
  return { success: false, error: 'Failed to install pyright' }
}

/**
 * 安装 Vue Language Server
 */
export async function installVueServer(): Promise<LspInstallResult> {
  const binDir = ensureLspBinDir()
  const serverPath = path.join(binDir, 'node_modules', '@vue', 'language-server', 'bin', 'vue-language-server.js')
  
  if (fs.existsSync(serverPath)) {
    return { success: true, path: serverPath }
  }
  
  logger.lsp.info('[LSP Installer] Installing @vue/language-server...')
  
  const success = await npmInstall('@vue/language-server', binDir)
  
  if (success && fs.existsSync(serverPath)) {
    logger.lsp.info('[LSP Installer] @vue/language-server installed successfully')
    return { success: true, path: serverPath }
  }
  
  return { success: false, error: 'Failed to install @vue/language-server' }
}

/**
 * 安装 gopls (Go LSP)
 * 需要系统已安装 Go
 */
export async function installGopls(): Promise<LspInstallResult> {
  // 检查 Go 是否已安装
  if (!commandExists('go')) {
    return { success: false, error: 'Go is not installed. Please install Go first.' }
  }
  
  const binDir = ensureLspBinDir()
  const ext = process.platform === 'win32' ? '.exe' : ''
  const goplsPath = path.join(binDir, 'gopls' + ext)
  
  if (fs.existsSync(goplsPath)) {
    return { success: true, path: goplsPath }
  }
  
  logger.lsp.info('[LSP Installer] Installing gopls...')
  
  return new Promise((resolve) => {
    const proc = spawn('go', ['install', 'golang.org/x/tools/gopls@latest'], {
      env: { ...process.env, GOBIN: binDir },
      stdio: 'pipe',
    })
    
    proc.on('close', (code) => {
      if (code === 0 && fs.existsSync(goplsPath)) {
        logger.lsp.info('[LSP Installer] gopls installed successfully')
        resolve({ success: true, path: goplsPath })
      } else {
        resolve({ success: false, error: 'Failed to install gopls' })
      }
    })
    
    proc.on('error', (err) => {
      resolve({ success: false, error: err.message })
    })
  })
}

/**
 * 获取已安装的 LSP 服务器路径
 */
export function getInstalledServerPath(serverType: string): string | null {
  const binDir = getLspBinDir()
  
  const paths: Record<string, string[]> = {
    typescript: [
      path.join(binDir, 'node_modules', 'typescript-language-server', 'lib', 'cli.mjs'),
      path.join(binDir, 'node_modules', 'typescript-language-server', 'lib', 'cli.js'),
    ],
    html: [
      path.join(binDir, 'node_modules', 'vscode-langservers-extracted', 'bin', 'vscode-html-language-server.js'),
    ],
    css: [
      path.join(binDir, 'node_modules', 'vscode-langservers-extracted', 'bin', 'vscode-css-language-server.js'),
    ],
    json: [
      path.join(binDir, 'node_modules', 'vscode-langservers-extracted', 'bin', 'vscode-json-language-server.js'),
    ],
    python: [
      path.join(binDir, 'node_modules', 'pyright', 'dist', 'pyright-langserver.js'),
    ],
    vue: [
      path.join(binDir, 'node_modules', '@vue', 'language-server', 'bin', 'vue-language-server.js'),
    ],
    go: [
      path.join(binDir, 'gopls' + (process.platform === 'win32' ? '.exe' : '')),
    ],
  }
  
  const serverPaths = paths[serverType]
  if (!serverPaths) return null
  
  for (const p of serverPaths) {
    if (fs.existsSync(p)) return p
  }
  
  return null
}

/**
 * 获取所有 LSP 服务器的安装状态
 */
export function getLspServerStatus(): Record<string, { installed: boolean; path?: string }> {
  const servers = ['typescript', 'html', 'css', 'json', 'python', 'vue', 'go']
  const status: Record<string, { installed: boolean; path?: string }> = {}
  
  for (const server of servers) {
    const serverPath = getInstalledServerPath(server)
    status[server] = {
      installed: !!serverPath,
      path: serverPath || undefined,
    }
  }
  
  return status
}

/**
 * 安装所有基础 LSP 服务器
 */
export async function installBasicServers(): Promise<void> {
  logger.lsp.info('[LSP Installer] Installing basic LSP servers...')
  
  // 并行安装 TypeScript 和 VSCode 语言服务器
  await Promise.all([
    installTypeScriptServer(),
    installVscodeLanguageServers(),
  ])
  
  logger.lsp.info('[LSP Installer] Basic LSP servers installation complete')
}
