/**
 * 代码库索引主服务
 * 整合 Embedding、分块、向量存储
 */

import * as fs from 'fs'
import * as path from 'path'
import { BrowserWindow } from 'electron'
import { EmbeddingService } from './embedder'
import { ChunkerService } from './chunker'
import { VectorStoreService } from './vectorStore'
import {
  IndexConfig,
  IndexStatus,
  SearchResult,
  CodeChunk,
  IndexedChunk,
  EmbeddingConfig,
  DEFAULT_INDEX_CONFIG,
} from './types'

export class CodebaseIndexService {
  private workspacePath: string
  private config: IndexConfig
  private embedder: EmbeddingService
  private chunker: ChunkerService
  private vectorStore: VectorStoreService
  private mainWindow: BrowserWindow | null = null

  private status: IndexStatus = {
    isIndexing: false,
    totalFiles: 0,
    indexedFiles: 0,
    totalChunks: 0,
  }

  constructor(workspacePath: string, config?: Partial<IndexConfig>) {
    this.workspacePath = workspacePath
    this.config = { ...DEFAULT_INDEX_CONFIG, ...config }
    this.embedder = new EmbeddingService(this.config.embedding)
    this.chunker = new ChunkerService(this.config)
    this.vectorStore = new VectorStoreService(workspacePath)
  }

  /**
   * 设置主窗口（用于发送进度事件）
   */
  setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window
  }

  /**
   * 初始化服务
   */
  async initialize(): Promise<void> {
    await this.vectorStore.initialize()
    
    // 从数据库读取实际的索引统计
    const hasExistingIndex = await this.vectorStore.hasIndex()
    if (hasExistingIndex) {
      const stats = await this.vectorStore.getStats()
      this.status.totalChunks = stats.chunkCount
      this.status.totalFiles = stats.fileCount
    }
    
    console.log('[IndexService] Initialized for:', this.workspacePath, 
      hasExistingIndex ? `(${this.status.totalChunks} chunks)` : '(no index)')
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<IndexConfig>): void {
    this.config = { ...this.config, ...config }
    if (config.embedding) {
      this.embedder.updateConfig(config.embedding)
    }
    this.chunker.updateConfig(this.config)
  }

  /**
   * 更新 Embedding 配置
   */
  updateEmbeddingConfig(config: Partial<EmbeddingConfig>): void {
    this.config.embedding = { ...this.config.embedding, ...config }
    this.embedder.updateConfig(this.config.embedding)
  }

  /**
   * 获取当前状态
   */
  getStatus(): IndexStatus {
    return { ...this.status }
  }

  /**
   * 检查是否有索引
   */
  async hasIndex(): Promise<boolean> {
    return this.vectorStore.hasIndex()
  }

  /**
   * 全量索引工作区
   */
  async indexWorkspace(): Promise<void> {
    if (this.status.isIndexing) {
      console.log('[IndexService] Already indexing, skipping...')
      return
    }

    this.status = {
      isIndexing: true,
      totalFiles: 0,
      indexedFiles: 0,
      totalChunks: 0,
    }
    this.emitProgress()

    try {
      // 1. 收集所有代码文件
      console.log('[IndexService] Collecting files...')
      const files = await this.collectCodeFiles(this.workspacePath)
      this.status.totalFiles = files.length
      this.emitProgress()

      if (files.length === 0) {
        console.log('[IndexService] No code files found')
        this.status.isIndexing = false
        this.emitProgress()
        return
      }

      // 2. 分块所有文件
      console.log(`[IndexService] Chunking ${files.length} files...`)
      const allChunks: CodeChunk[] = []

      for (const file of files) {
        try {
          const content = fs.readFileSync(file, 'utf-8')
          
          // 跳过太大的文件
          if (content.length > this.config.maxFileSize) {
            console.log(`[IndexService] Skipping large file: ${file}`)
            continue
          }

          const chunks = this.chunker.chunkFile(file, content, this.workspacePath)
          allChunks.push(...chunks)
        } catch (e) {
          console.error(`[IndexService] Error chunking file ${file}:`, e)
        }

        this.status.indexedFiles++
        this.emitProgress()
      }

      console.log(`[IndexService] Created ${allChunks.length} chunks`)

      // 3. 批量 Embedding
      console.log('[IndexService] Generating embeddings...')
      const indexedChunks = await this.embedChunks(allChunks)
      this.status.totalChunks = indexedChunks.length

      // 4. 存储到向量数据库
      console.log('[IndexService] Storing to vector database...')
      await this.vectorStore.createIndex(indexedChunks)

      this.status.lastIndexedAt = Date.now()
      console.log(`[IndexService] Indexing complete: ${indexedChunks.length} chunks`)
    } catch (e) {
      console.error('[IndexService] Indexing failed:', e)
      this.status.error = e instanceof Error ? e.message : String(e)
    } finally {
      this.status.isIndexing = false
      this.emitProgress()
    }
  }

  /**
   * 增量更新单个文件
   */
  async updateFile(filePath: string): Promise<void> {
    if (!this.vectorStore.isInitialized()) {
      return
    }

    // 检查文件是否应该被索引
    if (!this.chunker.shouldIndexFile(filePath)) {
      return
    }

    try {
      // 检查文件是否存在
      if (!fs.existsSync(filePath)) {
        // 文件被删除，从索引中移除
        await this.vectorStore.deleteFile(filePath)
        console.log(`[IndexService] Removed from index: ${filePath}`)
        return
      }

      const content = fs.readFileSync(filePath, 'utf-8')

      // 跳过太大的文件
      if (content.length > this.config.maxFileSize) {
        return
      }

      // 分块
      const chunks = this.chunker.chunkFile(filePath, content, this.workspacePath)

      if (chunks.length === 0) {
        await this.vectorStore.deleteFile(filePath)
        return
      }

      // Embedding
      const indexedChunks = await this.embedChunks(chunks)

      // 更新向量存储
      await this.vectorStore.upsertFile(filePath, indexedChunks)
      console.log(`[IndexService] Updated index for: ${filePath}`)
    } catch (e) {
      console.error(`[IndexService] Error updating file ${filePath}:`, e)
    }
  }

  /**
   * 语义搜索
   */
  async search(query: string, topK: number = 10): Promise<SearchResult[]> {
    if (!this.vectorStore.isInitialized()) {
      throw new Error('Index not initialized')
    }

    // 生成查询向量
    const queryVector = await this.embedder.embed(query)

    // 向量搜索
    return this.vectorStore.search(queryVector, topK)
  }

  /**
   * 混合搜索（向量 + 关键词）
   */
  async hybridSearch(query: string, topK: number = 10): Promise<SearchResult[]> {
    // 1. 向量搜索
    const semanticResults = await this.search(query, topK * 2)

    // 2. 关键词搜索（使用 ripgrep，通过 IPC 调用）
    // 这里简化处理，只返回向量搜索结果
    // 完整实现需要调用 ripgrep 并融合结果

    return semanticResults.slice(0, topK)
  }

  /**
   * 清空索引
   */
  async clearIndex(): Promise<void> {
    await this.vectorStore.clear()
    this.status = {
      isIndexing: false,
      totalFiles: 0,
      indexedFiles: 0,
      totalChunks: 0,
    }
    console.log('[IndexService] Index cleared')
  }

  /**
   * 测试 Embedding 连接
   */
  async testEmbeddingConnection(): Promise<{ success: boolean; error?: string; latency?: number }> {
    return this.embedder.testConnection()
  }

  // ========== 私有方法 ==========

  /**
   * 收集所有代码文件
   */
  private async collectCodeFiles(dir: string): Promise<string[]> {
    const files: string[] = []

    const walk = (currentDir: string) => {
      let entries: fs.Dirent[]
      try {
        entries = fs.readdirSync(currentDir, { withFileTypes: true })
      } catch {
        return
      }

      for (const entry of entries) {
        // 跳过忽略的目录
        if (entry.isDirectory()) {
          if (this.chunker.shouldIgnoreDir(entry.name)) {
            continue
          }
          walk(path.join(currentDir, entry.name))
        } else if (entry.isFile()) {
          const fullPath = path.join(currentDir, entry.name)
          if (this.chunker.shouldIndexFile(fullPath)) {
            files.push(fullPath)
          }
        }
      }
    }

    walk(dir)
    return files
  }

  /**
   * 批量 Embedding
   */
  private async embedChunks(chunks: CodeChunk[]): Promise<IndexedChunk[]> {
    const batchSize = 50  // 每批处理的数量
    const indexedChunks: IndexedChunk[] = []

    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize)
      const texts = batch.map(c => this.prepareTextForEmbedding(c))

      try {
        const vectors = await this.embedder.embedBatch(texts)

        for (let j = 0; j < batch.length; j++) {
          indexedChunks.push({
            ...batch[j],
            vector: vectors[j],
          })
        }
      } catch (e) {
        console.error(`[IndexService] Embedding batch failed:`, e)
        // 继续处理下一批
      }

      // 更新进度
      this.emitProgress()
    }

    return indexedChunks
  }

  /**
   * 准备用于 Embedding 的文本
   */
  private prepareTextForEmbedding(chunk: CodeChunk): string {
    // 添加文件路径和符号信息作为上下文
    let text = `File: ${chunk.relativePath}\n`
    
    if (chunk.symbols && chunk.symbols.length > 0) {
      text += `Symbols: ${chunk.symbols.join(', ')}\n`
    }
    
    text += `\n${chunk.content}`
    
    // 限制长度（大多数 Embedding 模型有 token 限制）
    const maxLength = 8000
    if (text.length > maxLength) {
      text = text.slice(0, maxLength)
    }
    
    return text
  }

  /**
   * 发送进度事件到渲染进程
   */
  private emitProgress(): void {
    if (this.mainWindow) {
      this.mainWindow.webContents.send('index:progress', this.status)
    }
  }
}

// 全局索引服务实例
let indexServiceInstance: CodebaseIndexService | null = null

/**
 * 获取或创建索引服务实例
 */
export function getIndexService(workspacePath: string): CodebaseIndexService {
  if (!indexServiceInstance || indexServiceInstance['workspacePath'] !== workspacePath) {
    indexServiceInstance = new CodebaseIndexService(workspacePath)
  }
  return indexServiceInstance
}

/**
 * 销毁索引服务实例
 */
export function destroyIndexService(): void {
  indexServiceInstance = null
}
