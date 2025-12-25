/**
 * 批量替换 console.* 为 logger.*
 * 用法: node scripts/refactor/migrate-console-to-logger.js [--dry-run]
 */

const fs = require('fs')
const path = require('path')

const DRY_RUN = process.argv.includes('--dry-run')
const SRC_DIR = path.join(__dirname, '../../src')

// 排除的文件/目录
const EXCLUDE_PATTERNS = [
  'node_modules',
  'dist',
  '.git',
  'Logger.ts',  // 排除 Logger 本身
  '.test.ts',
  '.test.run.ts',
]

// 根据文件路径推断日志分类
function inferCategory(filePath) {
  const relativePath = filePath.toLowerCase().replace(/\\/g, '/')
  
  // Agent 相关
  if (relativePath.includes('/agent/')) return 'agent'
  
  // LSP 相关
  if (relativePath.includes('/lsp') || relativePath.includes('lspmanager')) return 'lsp'
  
  // 补全相关
  if (relativePath.includes('/completion')) return 'completion'
  
  // 索引相关
  if (relativePath.includes('/indexing/') || relativePath.includes('indexworker')) return 'index'
  
  // 设置相关
  if (relativePath.includes('/settings') || relativePath.includes('settingsmodal')) return 'settings'
  
  // 安全相关
  if (relativePath.includes('/security/')) return 'security'
  
  // IPC 相关
  if (relativePath.includes('/ipc/')) return 'ipc'
  
  // 终端相关
  if (relativePath.includes('terminal')) return 'terminal'
  
  // Git 相关
  if (relativePath.includes('git')) return 'git'
  
  // 文件相关
  if (relativePath.includes('file') || relativePath.includes('directory')) return 'file'
  
  // Store 相关
  if (relativePath.includes('/store/')) return 'store'
  
  // UI 组件
  if (relativePath.includes('/components/')) return 'ui'
  if (relativePath.includes('/hooks/')) return 'ui'
  
  // 配置相关
  if (relativePath.includes('/config/')) return 'settings'
  
  // 服务层默认
  if (relativePath.includes('/services/')) return 'system'
  
  // Main 进程
  if (relativePath.includes('/main/')) return 'system'
  
  return 'system'
}

// 替换规则
function createReplacements(category) {
  return [
    { pattern: /console\.log\(/g, replacement: `logger.${category}.info(` },
    { pattern: /console\.info\(/g, replacement: `logger.${category}.info(` },
    { pattern: /console\.warn\(/g, replacement: `logger.${category}.warn(` },
    { pattern: /console\.error\(/g, replacement: `logger.${category}.error(` },
    { pattern: /console\.debug\(/g, replacement: `logger.${category}.debug(` },
  ]
}

// Logger 导入语句
const LOGGER_IMPORT_RENDERER = "import { logger } from '@utils/Logger'"
const LOGGER_IMPORT_MAIN = "import { logger } from '@shared/utils/Logger'"
const LOGGER_IMPORT_SHARED = "import { logger } from './Logger'"

// 统计
let stats = {
  filesScanned: 0,
  filesModified: 0,
  replacements: 0,
  importsAdded: 0,
  errors: []
}

function shouldExclude(filePath) {
  return EXCLUDE_PATTERNS.some(pattern => filePath.includes(pattern))
}

function getAllFiles(dir, extensions = ['.ts', '.tsx']) {
  const files = []
  
  function walk(currentDir) {
    const items = fs.readdirSync(currentDir)
    for (const item of items) {
      const fullPath = path.join(currentDir, item)
      
      if (shouldExclude(fullPath)) continue
      
      const stat = fs.statSync(fullPath)
      if (stat.isDirectory()) {
        walk(fullPath)
      } else if (extensions.some(ext => item.endsWith(ext))) {
        files.push(fullPath)
      }
    }
  }
  
  walk(dir)
  return files
}

function hasConsoleUsage(content) {
  return /console\.(log|info|warn|error|debug)\(/.test(content)
}

function hasLoggerImport(content) {
  return /import\s+.*logger.*from/.test(content)
}

function addLoggerImport(content, filePath) {
  // 确定使用哪个导入路径
  let importStatement
  if (filePath.includes('/renderer/')) {
    importStatement = LOGGER_IMPORT_RENDERER
  } else if (filePath.includes('/main/')) {
    importStatement = LOGGER_IMPORT_MAIN
  } else if (filePath.includes('/shared/utils/')) {
    importStatement = LOGGER_IMPORT_SHARED
  } else {
    importStatement = LOGGER_IMPORT_RENDERER
  }
  
  // 找到第一个 import 语句的位置
  const importMatch = content.match(/^import\s+/m)
  if (importMatch) {
    const insertPos = importMatch.index
    return content.slice(0, insertPos) + importStatement + '\n' + content.slice(insertPos)
  }
  
  // 如果没有 import，添加到文件开头（跳过注释）
  const commentEnd = content.match(/^(\/\*[\s\S]*?\*\/\s*|\/\/.*\n)*/m)
  const insertPos = commentEnd ? commentEnd[0].length : 0
  return content.slice(0, insertPos) + importStatement + '\n\n' + content.slice(insertPos)
}

function migrateFile(filePath) {
  stats.filesScanned++
  
  try {
    let content = fs.readFileSync(filePath, 'utf-8')
    
    if (!hasConsoleUsage(content)) {
      return
    }
    
    let originalContent = content
    let fileReplacements = 0
    
    const category = inferCategory(filePath)
    const replacements = createReplacements(category)
    
    for (const rule of replacements) {
      const matches = content.match(rule.pattern)
      if (matches) {
        content = content.replace(rule.pattern, rule.replacement)
        fileReplacements += matches.length
      }
    }
    
    // 添加 logger 导入（如果需要）
    let importAdded = false
    if (fileReplacements > 0 && !hasLoggerImport(content)) {
      content = addLoggerImport(content, filePath)
      importAdded = true
      stats.importsAdded++
    }
    
    if (content !== originalContent) {
      stats.filesModified++
      stats.replacements += fileReplacements
      
      const relativePath = path.relative(SRC_DIR, filePath)
      console.log(`  ✓ ${relativePath} [${category}] (${fileReplacements} replacements${importAdded ? ', +import' : ''})`)
      
      if (!DRY_RUN) {
        fs.writeFileSync(filePath, content, 'utf-8')
      }
    }
  } catch (error) {
    stats.errors.push({ file: filePath, error: error.message })
  }
}

function main() {
  console.log('='.repeat(60))
  console.log('Console to Logger Migration Script')
  console.log('='.repeat(60))
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no changes)' : 'LIVE (will modify files)'}`)
  console.log(`Source: ${SRC_DIR}`)
  console.log('')
  
  const files = getAllFiles(SRC_DIR)
  console.log(`Found ${files.length} TypeScript files\n`)
  
  console.log('Processing files...')
  for (const file of files) {
    migrateFile(file)
  }
  
  console.log('\n' + '='.repeat(60))
  console.log('Summary')
  console.log('='.repeat(60))
  console.log(`Files scanned:  ${stats.filesScanned}`)
  console.log(`Files modified: ${stats.filesModified}`)
  console.log(`Replacements:   ${stats.replacements}`)
  console.log(`Imports added:  ${stats.importsAdded}`)
  
  if (stats.errors.length > 0) {
    console.log(`\nErrors (${stats.errors.length}):`)
    for (const err of stats.errors) {
      console.log(`  ✗ ${err.file}: ${err.error}`)
    }
  }
  
  if (DRY_RUN) {
    console.log('\n⚠️  DRY RUN - No files were modified')
    console.log('Run without --dry-run to apply changes')
  } else {
    console.log('\n✓ Migration complete!')
  }
}

main()
