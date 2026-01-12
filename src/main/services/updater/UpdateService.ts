/**
 * 自动更新服务
 * 
 * 支持：
 * - 安装版：使用 electron-updater 自动更新
 * - 便携版：检测更新并提示用户手动下载
 * 
 * 平台差异：
 * - Windows: NSIS 安装版 / Portable 便携版
 * - macOS: DMG / ZIP
 * - Linux: AppImage / tar.gz
 */

import { app, BrowserWindow } from 'electron'
import { autoUpdater, UpdateInfo, ProgressInfo } from 'electron-updater'
import { logger } from '@shared/utils/Logger'
import * as path from 'path'
import * as fs from 'fs'

export interface UpdateStatus {
  status: 'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error'
  version?: string
  releaseNotes?: string
  releaseDate?: string
  downloadUrl?: string
  progress?: number
  error?: string
  isPortable: boolean
}

class UpdateService {
  private status: UpdateStatus = {
    status: 'idle',
    isPortable: false,
  }
  private mainWindow: BrowserWindow | null = null
  private updateCheckInterval: NodeJS.Timeout | null = null

  /**
   * 初始化更新服务
   */
  initialize(mainWindow: BrowserWindow): void {
    this.mainWindow = mainWindow
    this.status.isPortable = this.detectPortableMode()

    logger.system.info(`[Updater] Initialized, portable: ${this.status.isPortable}, platform: ${process.platform}`)

    if (this.status.isPortable) {
      // 便携版：只检查更新，不自动下载
      this.setupPortableUpdater()
    } else {
      // 安装版：使用 electron-updater
      this.setupAutoUpdater()
    }
  }

  /**
   * 检测是否为便携版
   */
  private detectPortableMode(): boolean {
    const exePath = app.getPath('exe')
    const exeDir = path.dirname(exePath)

    // Windows 便携版检测
    if (process.platform === 'win32') {
      // 便携版通常没有 Uninstall 相关文件
      const uninstallPath = path.join(exeDir, 'Uninstall Adnify.exe')
      if (!fs.existsSync(uninstallPath)) {
        // 检查是否在 Program Files 目录
        const isInProgramFiles = exeDir.toLowerCase().includes('program files')
        return !isInProgramFiles
      }
      return false
    }

    // macOS 检测
    if (process.platform === 'darwin') {
      // 如果不在 /Applications 目录，认为是便携版
      return !exePath.startsWith('/Applications/')
    }

    // Linux 检测
    if (process.platform === 'linux') {
      // AppImage 会设置这个环境变量
      if (process.env.APPIMAGE) {
        return false // AppImage 可以自动更新
      }
      // tar.gz 解压的是便携版
      return true
    }

    return false
  }

  /**
   * 设置安装版自动更新
   */
  private setupAutoUpdater(): void {
    // 配置 electron-updater
    autoUpdater.autoDownload = false
    autoUpdater.autoInstallOnAppQuit = true
    autoUpdater.allowDowngrade = false

    // 根据架构选择正确的更新通道
    const arch = process.arch
    const channel = arch === 'arm64' ? 'latest-arm64' : 'latest'
    
    logger.system.info(`[Updater] Using update channel: ${channel} for arch: ${arch}`)

    // GitHub Releases 作为更新源
    autoUpdater.setFeedURL({
      provider: 'github',
      owner: 'adnaan-worker',
      repo: 'adnify',
    })
    
    // 设置更新通道（对应 yml 文件名）
    autoUpdater.channel = channel

    // 事件监听
    autoUpdater.on('checking-for-update', () => {
      this.updateStatus({ status: 'checking' })
    })

    autoUpdater.on('update-available', (info: UpdateInfo) => {
      this.updateStatus({
        status: 'available',
        version: info.version,
        releaseNotes: this.formatReleaseNotes(info.releaseNotes),
        releaseDate: info.releaseDate,
      })
    })

    autoUpdater.on('update-not-available', () => {
      this.updateStatus({ status: 'not-available' })
    })

    autoUpdater.on('download-progress', (progress: ProgressInfo) => {
      this.updateStatus({
        status: 'downloading',
        progress: Math.round(progress.percent),
      })
    })

    autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
      logger.system.info(`[Updater] Update downloaded: ${info.version}, files:`, info.files)
      this.updateStatus({
        status: 'downloaded',
        version: info.version,
      })
    })

    autoUpdater.on('error', (err: Error) => {
      logger.system.error('[Updater] Error:', err)
      this.updateStatus({
        status: 'error',
        error: err.message,
      })
    })

    // 延迟 30 秒后检查更新，避免启动时阻塞
    setTimeout(() => this.checkForUpdates(), 30 * 1000)

    // 每 4 小时检查一次（减少 API 调用）
    this.updateCheckInterval = setInterval(
      () => {
        this.checkForUpdates()
      },
      4 * 60 * 60 * 1000
    )
  }

  /**
   * 设置便携版更新检查
   */
  private setupPortableUpdater(): void {
    // 便携版只检查是否有新版本，不自动下载
    // 延迟 30 秒后检查
    setTimeout(() => this.checkForUpdatesPortable(), 30 * 1000)

    // 每 4 小时检查一次
    this.updateCheckInterval = setInterval(
      () => {
        this.checkForUpdatesPortable()
      },
      4 * 60 * 60 * 1000
    )
  }

  /**
   * 检查更新（安装版）
   */
  async checkForUpdates(): Promise<UpdateStatus> {
    if (this.status.isPortable) {
      return this.checkForUpdatesPortable()
    }

    try {
      this.updateStatus({ status: 'checking' })
      await autoUpdater.checkForUpdates()
    } catch (err: any) {
      logger.system.error('[Updater] Check failed:', err)
      this.updateStatus({
        status: 'error',
        error: err.message,
      })
    }

    return this.status
  }

  /**
   * 检查更新（便携版）
   */
  async checkForUpdatesPortable(): Promise<UpdateStatus> {
    try {
      this.updateStatus({ status: 'checking' })

      // 从 GitHub API 获取最新 release
      const response = await fetch(
        'https://api.github.com/repos/adnaan-worker/adnify/releases/latest',
        {
          headers: {
            Accept: 'application/vnd.github.v3+json',
            'User-Agent': 'Adnify-Updater',
          },
        }
      )

      if (!response.ok) {
        // 403 通常是速率限制，404 是仓库不存在或无 release
        if (response.status === 403) {
          const remaining = response.headers.get('X-RateLimit-Remaining')
          const resetTime = response.headers.get('X-RateLimit-Reset')
          logger.system.warn(`[Updater] Rate limited. Remaining: ${remaining}, Reset: ${resetTime}`)
          throw new Error('GitHub API 请求频率超限，请稍后再试')
        }
        if (response.status === 404) {
          // 仓库不存在或没有 release，静默处理
          this.updateStatus({ status: 'not-available' })
          return this.status
        }
        throw new Error(`GitHub API error: ${response.status}`)
      }

      const release = (await response.json()) as {
        tag_name: string
        body: string
        published_at: string
        assets: Array<{ name: string; browser_download_url: string }>
      }
      const latestVersion = release.tag_name.replace(/^v/, '')
      const currentVersion = app.getVersion()

      if (this.isNewerVersion(latestVersion, currentVersion)) {
        // 找到对应平台的下载链接
        const downloadUrl = this.findDownloadUrl(release.assets)

        this.updateStatus({
          status: 'available',
          version: latestVersion,
          releaseNotes: release.body,
          releaseDate: release.published_at,
          downloadUrl,
        })
      } else {
        this.updateStatus({ status: 'not-available' })
      }
    } catch (err: any) {
      logger.system.error('[Updater] Portable check failed:', err)
      this.updateStatus({
        status: 'error',
        error: err.message,
      })
    }

    return this.status
  }

  /**
   * 下载更新（仅安装版）
   */
  async downloadUpdate(): Promise<void> {
    if (this.status.isPortable) {
      throw new Error('Portable version cannot auto-download. Please download manually.')
    }

    if (this.status.status !== 'available') {
      throw new Error('No update available')
    }

    await autoUpdater.downloadUpdate()
  }

  /**
   * 安装更新并重启（仅安装版）
   */
  quitAndInstall(): void {
    if (this.status.isPortable) {
      throw new Error('Portable version cannot auto-install')
    }

    if (this.status.status !== 'downloaded') {
      throw new Error('Update not downloaded')
    }

    // 设置退出时自动安装
    autoUpdater.autoInstallOnAppQuit = true
    
    logger.system.info('[Updater] Initiating quit and install...')
    
    // 延迟一点执行，确保所有窗口都已关闭
    setTimeout(() => {
      // isSilent: true - 静默安装，避免 UAC 弹窗干扰
      // isForceRunAfter: true - 安装后强制重启应用
      logger.system.info('[Updater] Calling autoUpdater.quitAndInstall(true, true)')
      autoUpdater.quitAndInstall(true, true)
    }, 100)
  }

  /**
   * 获取当前状态
   */
  getStatus(): UpdateStatus {
    return { ...this.status }
  }

  /**
   * 清理
   */
  destroy(): void {
    if (this.updateCheckInterval) {
      clearInterval(this.updateCheckInterval)
      this.updateCheckInterval = null
    }
  }

  // =================== 私有方法 ===================

  private updateStatus(partial: Partial<UpdateStatus>): void {
    this.status = { ...this.status, ...partial }
    this.notifyRenderer()
  }

  private notifyRenderer(): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('updater:status', this.status)
    }
  }

  private formatReleaseNotes(notes: string | { version: string; note: string | null }[] | null | undefined): string {
    if (!notes) return ''
    if (typeof notes === 'string') return notes
    return notes.map(n => n.note || '').filter(Boolean).join('\n\n')
  }

  private isNewerVersion(latest: string, current: string): boolean {
    const latestParts = latest.split('.').map(Number)
    const currentParts = current.split('.').map(Number)

    for (let i = 0; i < Math.max(latestParts.length, currentParts.length); i++) {
      const l = latestParts[i] || 0
      const c = currentParts[i] || 0
      if (l > c) return true
      if (l < c) return false
    }
    return false
  }

  private findDownloadUrl(assets: any[]): string | undefined {
    const platform = process.platform
    const arch = process.arch

    // 根据平台和架构找到对应的便携版下载链接
    const patterns: Record<string, RegExp[]> = {
      'win32-x64': [/Portable.*x64\.exe$/i, /win.*x64.*portable/i],
      'win32-arm64': [/Portable.*arm64\.exe$/i, /win.*arm64.*portable/i],
      'darwin-x64': [/x64.*mac\.zip$/i, /darwin.*x64.*zip/i],
      'darwin-arm64': [/arm64.*mac\.zip$/i, /darwin.*arm64.*zip/i],
      'linux-x64': [/x86_64.*linux\.tar\.gz$/i, /linux.*x64.*tar\.gz/i],
      'linux-arm64': [/arm64.*linux\.tar\.gz$/i, /linux.*arm64.*tar\.gz/i],
    }

    const key = `${platform}-${arch}`
    const regexes = patterns[key] || []

    for (const asset of assets) {
      for (const regex of regexes) {
        if (regex.test(asset.name)) {
          return asset.browser_download_url
        }
      }
    }

    // 回退到 release 页面
    return `https://github.com/adnaan-worker/adnify/releases/latest`
  }
}

export const updateService = new UpdateService()
