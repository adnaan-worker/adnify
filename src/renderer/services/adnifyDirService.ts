/**
 * .adnify 目录统一管理服务
 * 
 * 所有项目级数据都存储在 .adnify 目录下：
 * .adnify/
 *   ├── index/              # 代码库向量索引
 *   ├── checkpoints.json    # 文件回滚检查点
 *   ├── sessions.json       # Agent 会话历史
 *   ├── settings.json       # 项目级设置
 *   ├── workspace-state.json # 工作区状态（打开的文件等）
 *   └── rules.md            # 项目 AI 规则
 * 
 * 使用方法：
 *   import { adnifyDir } from './adnifyDirService'
 *   
 *   // 初始化（打开工作区时调用一次）
 *   await adnifyDir.initialize(workspacePath)
 *   
 *   // 获取文件路径
 *   const checkpointsPath = adnifyDir.getFilePath('checkpoints.json')
 */

// 目录名常量
export const ADNIFY_DIR_NAME = '.adnify'

// 子目录和文件
export const ADNIFY_FILES = {
  INDEX_DIR: 'index',
  CHECKPOINTS: 'checkpoints.json',
  SESSIONS: 'sessions.json',
  SETTINGS: 'settings.json',
  WORKSPACE_STATE: 'workspace-state.json',
  RULES: 'rules.md',
} as const

type AdnifyFile = typeof ADNIFY_FILES[keyof typeof ADNIFY_FILES]

class AdnifyDirService {
  private workspacePath: string | null = null
  private initialized = false

  /**
   * 初始化 .adnify 目录
   * 应该在打开工作区时调用一次
   */
  async initialize(workspacePath: string): Promise<boolean> {
    if (this.initialized && this.workspacePath === workspacePath) {
      console.log('[AdnifyDir] Already initialized for this workspace')
      return true
    }

    this.workspacePath = workspacePath
    
    try {
      const adnifyPath = this.getDirPath()
      
      // 检查目录是否存在
      const exists = await window.electronAPI.fileExists(adnifyPath)
      
      if (!exists) {
        // 创建 .adnify 目录
        const created = await window.electronAPI.ensureDir(adnifyPath)
        if (!created) {
          console.error('[AdnifyDir] Failed to create directory')
          return false
        }
        console.log('[AdnifyDir] Created directory:', adnifyPath)
      }

      // 创建 index 子目录
      const indexPath = this.getFilePath(ADNIFY_FILES.INDEX_DIR)
      const indexExists = await window.electronAPI.fileExists(indexPath)
      if (!indexExists) {
        await window.electronAPI.ensureDir(indexPath)
      }

      this.initialized = true
      console.log('[AdnifyDir] Initialized:', adnifyPath)
      return true
    } catch (error) {
      console.error('[AdnifyDir] Initialization failed:', error)
      return false
    }
  }

  /**
   * 重置服务（切换工作区时调用）
   */
  reset(): void {
    this.workspacePath = null
    this.initialized = false
    console.log('[AdnifyDir] Reset')
  }

  /**
   * 检查是否已初始化
   */
  isInitialized(): boolean {
    return this.initialized && this.workspacePath !== null
  }

  /**
   * 获取当前工作区路径
   */
  getWorkspacePath(): string | null {
    return this.workspacePath
  }

  /**
   * 获取 .adnify 目录路径
   */
  getDirPath(): string {
    if (!this.workspacePath) {
      throw new Error('[AdnifyDir] Not initialized. Call initialize() first.')
    }
    return `${this.workspacePath}/${ADNIFY_DIR_NAME}`
  }

  /**
   * 获取 .adnify 下的文件/目录路径
   */
  getFilePath(file: AdnifyFile | string): string {
    return `${this.getDirPath()}/${file}`
  }

  /**
   * 读取 JSON 文件
   */
  async readJson<T>(file: AdnifyFile): Promise<T | null> {
    if (!this.isInitialized()) {
      console.warn('[AdnifyDir] Not initialized')
      return null
    }

    try {
      const filePath = this.getFilePath(file)
      const content = await window.electronAPI.readFile(filePath)
      if (!content) return null
      return JSON.parse(content) as T
    } catch (error) {
      // 文件不存在或解析失败
      return null
    }
  }

  /**
   * 写入 JSON 文件
   */
  async writeJson<T>(file: AdnifyFile, data: T): Promise<boolean> {
    if (!this.isInitialized()) {
      console.warn('[AdnifyDir] Not initialized')
      return false
    }

    try {
      const filePath = this.getFilePath(file)
      const content = JSON.stringify(data, null, 2)
      return await window.electronAPI.writeFile(filePath, content)
    } catch (error) {
      console.error(`[AdnifyDir] Failed to write ${file}:`, error)
      return false
    }
  }

  /**
   * 读取文本文件
   */
  async readText(file: AdnifyFile | string): Promise<string | null> {
    if (!this.isInitialized()) {
      console.warn('[AdnifyDir] Not initialized')
      return null
    }

    try {
      const filePath = this.getFilePath(file)
      return await window.electronAPI.readFile(filePath)
    } catch {
      return null
    }
  }

  /**
   * 写入文本文件
   */
  async writeText(file: AdnifyFile | string, content: string): Promise<boolean> {
    if (!this.isInitialized()) {
      console.warn('[AdnifyDir] Not initialized')
      return false
    }

    try {
      const filePath = this.getFilePath(file)
      return await window.electronAPI.writeFile(filePath, content)
    } catch (error) {
      console.error(`[AdnifyDir] Failed to write ${file}:`, error)
      return false
    }
  }

  /**
   * 检查文件是否存在
   */
  async fileExists(file: AdnifyFile | string): Promise<boolean> {
    if (!this.isInitialized()) return false
    
    try {
      const filePath = this.getFilePath(file)
      return await window.electronAPI.fileExists(filePath)
    } catch {
      return false
    }
  }

  /**
   * 删除文件
   */
  async deleteFile(file: AdnifyFile | string): Promise<boolean> {
    if (!this.isInitialized()) return false

    try {
      const filePath = this.getFilePath(file)
      return await window.electronAPI.deleteFile(filePath)
    } catch {
      return false
    }
  }
}

// 单例导出
export const adnifyDir = new AdnifyDirService()
