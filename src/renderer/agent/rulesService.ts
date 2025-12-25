/**
 * 项目规则服务
 * 支持 .adnify/rules.md 或 .cursorrules 文件
 * 让用户定义项目级 AI 行为偏好
 */

import { logger } from '@utils/Logger'
import { useStore } from '@store'
import { joinPath } from '@utils/pathUtils'

export interface ProjectRules {
  content: string
  source: string  // 规则文件路径
  lastModified: number
}

class RulesService {
  private cachedRules: ProjectRules | null = null
  private lastCheckTime = 0
  private checkInterval = 5000 // 5秒检查一次文件变化

  // 支持的规则文件名（按优先级）
  private ruleFiles = [
    '.adnify/rules.md',
    '.adnifyrules',
    '.cursorrules',
    '.cursor/rules.md',
    'CODING_GUIDELINES.md',
  ]

  /**
   * 获取项目规则
   */
  async getRules(forceRefresh = false): Promise<ProjectRules | null> {
    const { workspacePath } = useStore.getState()
    if (!workspacePath) return null

    const now = Date.now()
    
    // 使用缓存（除非强制刷新或超过检查间隔）
    if (!forceRefresh && this.cachedRules && (now - this.lastCheckTime) < this.checkInterval) {
      return this.cachedRules
    }

    this.lastCheckTime = now

    // 按优先级查找规则文件
    for (const ruleFile of this.ruleFiles) {
      const fullPath = this.joinPath(workspacePath, ruleFile)
      const content = await window.electronAPI.readFile(fullPath)
      
      if (content !== null) {
        this.cachedRules = {
          content: content.trim(),
          source: ruleFile,
          lastModified: now,
        }
        logger.agent.info(`[RulesService] Loaded rules from: ${ruleFile}`)
        return this.cachedRules
      }
    }

    // 没有找到规则文件
    this.cachedRules = null
    return null
  }

  /**
   * 创建默认规则文件
   */
  async createDefaultRules(): Promise<boolean> {
    const { workspacePath } = useStore.getState()
    if (!workspacePath) return false

    const defaultRules = `# Project Rules for AI Assistant

## Code Style
- Use TypeScript for all new files
- Prefer functional components with hooks
- Use meaningful variable names
- Add comments for complex logic

## Project Structure
- Components go in src/components/
- Utilities go in src/utils/
- Types go in src/types/

## Conventions
- Use async/await over .then()
- Prefer const over let
- Use template literals for string interpolation

## Testing
- Write tests for critical business logic
- Use descriptive test names

## Documentation
- Add JSDoc comments for public APIs
- Keep README up to date
`

    // 创建 .adnify 目录
    const adnifyDir = this.joinPath(workspacePath, '.adnify')
    await window.electronAPI.mkdir(adnifyDir)

    // 写入规则文件
    const rulesPath = this.joinPath(workspacePath, '.adnify/rules.md')
    const success = await window.electronAPI.writeFile(rulesPath, defaultRules)
    
    if (success) {
      this.cachedRules = {
        content: defaultRules,
        source: '.adnify/rules.md',
        lastModified: Date.now(),
      }
    }

    return success
  }

  /**
   * 构建包含规则的系统提示
   */
  async buildSystemPromptWithRules(basePrompt: string): Promise<string> {
    const rules = await this.getRules()
    
    if (!rules || !rules.content) {
      return basePrompt
    }

    return `${basePrompt}

<project_rules>
The user has defined the following project-specific rules and guidelines. Follow them strictly:

${rules.content}
</project_rules>`
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.cachedRules = null
    this.lastCheckTime = 0
  }

  /**
   * 路径拼接辅助函数 - 使用 pathUtils
   */
  private joinPath(base: string, relative: string): string {
    return joinPath(base, relative)
  }
}

export const rulesService = new RulesService()
