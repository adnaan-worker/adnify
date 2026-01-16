/**
 * 项目摘要生成器
 * 自动分析项目结构，生成给 AI 的上下文
 */

import * as fs from 'fs'
import * as path from 'path'
import { logger } from '@shared/utils/Logger'
import { ProjectSummary, DirectorySummary, FileSummary, SymbolInfo } from '../types'

// 常见目录描述
const DIR_DESCRIPTIONS: Record<string, string> = {
  src: 'Source code',
  lib: 'Library code',
  components: 'UI components',
  pages: 'Page components',
  views: 'View components',
  hooks: 'React hooks',
  utils: 'Utility functions',
  helpers: 'Helper functions',
  services: 'Service layer',
  api: 'API handlers',
  store: 'State management',
  stores: 'State management',
  models: 'Data models',
  types: 'Type definitions',
  config: 'Configuration',
  constants: 'Constants',
  assets: 'Static assets',
  styles: 'Stylesheets',
  tests: 'Test files',
  __tests__: 'Test files',
  main: 'Main process (Electron)',
  renderer: 'Renderer process (Electron)',
  shared: 'Shared code',
  common: 'Common utilities',
  core: 'Core functionality',
  features: 'Feature modules',
  modules: 'Application modules',
  plugins: 'Plugins',
  middleware: 'Middleware',
  routes: 'Route definitions',
  controllers: 'Controllers',
  handlers: 'Request handlers',
  schemas: 'Data schemas',
  public: 'Public assets',
  dist: 'Build output',
  build: 'Build output',
  scripts: 'Build/utility scripts',
  docs: 'Documentation',
  agent: 'AI Agent logic',
  prompts: 'Prompt templates',
  tools: 'Tool implementations',
  ipc: 'IPC handlers (Electron)',
  indexing: 'Code indexing',
  llm: 'LLM integration',
}

// 主要文件模式
const MAIN_FILE_PATTERNS = [
  /index\.[tj]sx?$/,
  /main\.[tj]sx?$/,
  /app\.[tj]sx?$/,
  /^[A-Z][a-zA-Z]+\.[tj]sx?$/,
]

// 重要文件模式
const IMPORTANT_FILE_PATTERNS = [
  /index\.[tj]sx?$/,
  /main\.[tj]sx?$/,
  /app\.[tj]sx?$/,
  /config/i,
  /service/i,
  /store/i,
  /router/i,
]

// 项目类型检测
interface ProjectType {
  framework: string
  runtime: string
  features: string[]
}

export class ProjectSummaryGenerator {
  private workspacePath: string
  private cachePath: string

  constructor(workspacePath: string) {
    this.workspacePath = workspacePath
    this.cachePath = path.join(workspacePath, '.adnify', 'project-summary.json')
  }

  /** 检测项目类型 */
  private detectProjectType(): ProjectType {
    const result: ProjectType = { framework: '', runtime: '', features: [] }

    try {
      const pkgPath = path.join(this.workspacePath, 'package.json')
      if (fs.existsSync(pkgPath)) {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
        const deps = { ...pkg.dependencies, ...pkg.devDependencies }

        // 检测框架
        if (deps.electron) {
          result.framework = 'Electron'
          result.runtime = 'Node.js + Chromium'
        } else if (deps.next) {
          result.framework = 'Next.js'
          result.runtime = 'Node.js'
        } else if (deps.nuxt) {
          result.framework = 'Nuxt'
          result.runtime = 'Node.js'
        } else if (deps.react || deps['react-dom']) {
          result.framework = 'React'
          result.runtime = 'Browser'
        } else if (deps.vue) {
          result.framework = 'Vue'
          result.runtime = 'Browser'
        } else if (deps.express || deps.fastify || deps.koa) {
          result.framework = deps.express ? 'Express' : deps.fastify ? 'Fastify' : 'Koa'
          result.runtime = 'Node.js'
        }

        // 检测特性
        if (deps.typescript) result.features.push('TypeScript')
        if (deps.tailwindcss) result.features.push('Tailwind CSS')
        if (deps.zustand || deps.redux || deps.mobx) result.features.push('State Management')
        if (deps.prisma || deps.typeorm || deps.mongoose) result.features.push('ORM/Database')
        if (deps.vitest || deps.jest) result.features.push('Testing')
        if (deps['@tanstack/react-query'] || deps.swr) result.features.push('Data Fetching')
      }
    } catch {
      // ignore
    }

    return result
  }

  /** 生成项目摘要 */
  generate(
    fileSymbols: Map<string, SymbolInfo[]>,
    languages: Record<string, number>
  ): ProjectSummary {
    const dirStats = new Map<string, { files: string[]; symbols: number }>()

    // 统计目录
    for (const [relativePath, symbols] of fileSymbols) {
      const dir = path.dirname(relativePath)
      const stats = dirStats.get(dir) || { files: [], symbols: 0 }
      if (!stats.files.includes(relativePath)) {
        stats.files.push(relativePath)
      }
      stats.symbols += symbols.length
      dirStats.set(dir, stats)
    }

    // 构建目录摘要
    const structure: DirectorySummary[] = []
    for (const [dirPath, stats] of dirStats) {
      structure.push({
        path: dirPath || '.',
        description: this.inferDirDescription(dirPath),
        fileCount: stats.files.length,
        mainFiles: this.findMainFiles(stats.files),
      })
    }
    structure.sort((a, b) => b.fileCount - a.fileCount)

    // 找出关键文件
    const keyFiles: FileSummary[] = []
    for (const [relativePath, symbols] of fileSymbols) {
      const isImportant = IMPORTANT_FILE_PATTERNS.some(p => p.test(relativePath))
      if (isImportant || symbols.length >= 5) {
        const ext = path.extname(relativePath).slice(1)
        keyFiles.push({
          relativePath,
          language: ext || 'unknown',
          symbols,
        })
      }
    }
    keyFiles.sort((a, b) => b.symbols.length - a.symbols.length)

    const summary: ProjectSummary = {
      name: path.basename(this.workspacePath),
      structure: structure.slice(0, 20),
      keyFiles: keyFiles.slice(0, 20),
      totalFiles: fileSymbols.size,
      totalSymbols: Array.from(fileSymbols.values()).reduce((sum, s) => sum + s.length, 0),
      languages,
      generatedAt: Date.now(),
    }

    // 异步保存缓存
    this.saveCache(summary)

    return summary
  }

  /** 生成摘要文本（用于系统提示词） */
  toText(summary: ProjectSummary): string {
    const lines: string[] = []
    const projectType = this.detectProjectType()

    lines.push(`# Project: ${summary.name}`)
    lines.push('')

    // 项目类型
    if (projectType.framework || projectType.runtime) {
      const typeInfo = [projectType.framework, projectType.runtime].filter(Boolean).join(' / ')
      lines.push(`**Type:** ${typeInfo}`)
      if (projectType.features.length > 0) {
        lines.push(`**Stack:** ${projectType.features.join(', ')}`)
      }
      lines.push('')
    }

    // 语言统计
    const langStats = Object.entries(summary.languages)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([lang, count]) => `${lang}(${count})`)
      .join(', ')
    lines.push(`**Languages:** ${langStats}`)
    lines.push(`**Scale:** ${summary.totalFiles} files, ${summary.totalSymbols} symbols`)
    lines.push('')

    // 目录结构
    lines.push('## Directory Structure')
    for (const dir of summary.structure.slice(0, 15)) {
      const desc = dir.description ? ` - ${dir.description}` : ''
      lines.push(`- \`${dir.path}/\`${desc} (${dir.fileCount} files)`)
    }
    lines.push('')

    // 关键文件和符号
    lines.push('## Key Files & Exports')
    for (const file of summary.keyFiles.slice(0, 12)) {
      const symbols = file.symbols.slice(0, 6)
      const symbolStr = symbols.map(s => `${s.kind === 'class' ? '📦' : s.kind === 'function' ? 'ƒ' : '•'}${s.name}`).join(', ')
      lines.push(`- \`${file.relativePath}\`: ${symbolStr}${file.symbols.length > 6 ? '...' : ''}`)
    }

    return lines.join('\n')
  }

  /** 加载缓存 */
  async loadCache(): Promise<ProjectSummary | null> {
    try {
      if (fs.existsSync(this.cachePath)) {
        const content = await fs.promises.readFile(this.cachePath, 'utf-8')
        return JSON.parse(content)
      }
    } catch (e) {
      logger.index.warn('[ProjectSummary] Failed to load cache:', e)
    }
    return null
  }

  /** 清除缓存 */
  async clearCache(): Promise<void> {
    try {
      if (fs.existsSync(this.cachePath)) {
        await fs.promises.unlink(this.cachePath)
        logger.index.info('[ProjectSummary] Cache cleared')
      }
    } catch (e) {
      logger.index.warn('[ProjectSummary] Failed to clear cache:', e)
    }
  }

  /** 保存缓存 */
  private async saveCache(summary: ProjectSummary): Promise<void> {
    try {
      const dir = path.dirname(this.cachePath)
      if (!fs.existsSync(dir)) {
        await fs.promises.mkdir(dir, { recursive: true })
      }
      await fs.promises.writeFile(this.cachePath, JSON.stringify(summary, null, 2))
    } catch (e) {
      logger.index.warn('[ProjectSummary] Failed to save cache:', e)
    }
  }

  /** 推断目录描述 */
  private inferDirDescription(dirPath: string): string {
    const dirName = path.basename(dirPath) || 'root'
    return DIR_DESCRIPTIONS[dirName.toLowerCase()] || ''
  }

  /** 找出主要文件 */
  private findMainFiles(files: string[]): string[] {
    return files
      .filter(f => MAIN_FILE_PATTERNS.some(p => p.test(path.basename(f))))
      .map(f => path.basename(f))
      .slice(0, 5)
  }
}
