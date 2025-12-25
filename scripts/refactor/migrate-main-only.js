/**
 * 只迁移 main 进程的 console 到 logger
 */

const fs = require('fs')
const path = require('path')

const MAIN_DIR = path.join(__dirname, '../../src/main')

const EXCLUDE = ['Logger.ts', '.test.ts']

function inferCategory(filePath) {
  const p = filePath.toLowerCase().replace(/\\/g, '/')
  if (p.includes('/lsp') || p.includes('lspmanager')) return 'lsp'
  if (p.includes('/indexing/')) return 'index'
  if (p.includes('/security/')) return 'security'
  if (p.includes('/ipc/')) return 'ipc'
  if (p.includes('/settings')) return 'settings'
  return 'system'
}

function createReplacements(category) {
  return [
    { pattern: /console\.log\(/g, replacement: `logger.${category}.info(` },
    { pattern: /console\.info\(/g, replacement: `logger.${category}.info(` },
    { pattern: /console\.warn\(/g, replacement: `logger.${category}.warn(` },
    { pattern: /console\.error\(/g, replacement: `logger.${category}.error(` },
    { pattern: /console\.debug\(/g, replacement: `logger.${category}.debug(` },
  ]
}

const LOGGER_IMPORT = "import { logger } from '@shared/utils/Logger'"

let stats = { modified: 0, replacements: 0 }

function getAllFiles(dir) {
  const files = []
  function walk(d) {
    for (const item of fs.readdirSync(d)) {
      const full = path.join(d, item)
      if (fs.statSync(full).isDirectory()) walk(full)
      else if (item.endsWith('.ts') && !EXCLUDE.some(e => item.includes(e))) files.push(full)
    }
  }
  walk(dir)
  return files
}

function hasConsole(content) {
  return /console\.(log|info|warn|error|debug)\(/.test(content)
}

function hasLoggerImport(content) {
  return /import\s+.*logger.*from/.test(content)
}

function addImport(content) {
  const match = content.match(/^import\s+/m)
  if (match) {
    return content.slice(0, match.index) + LOGGER_IMPORT + '\n' + content.slice(match.index)
  }
  return LOGGER_IMPORT + '\n' + content
}

function migrate(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8')
  if (!hasConsole(content)) return

  let original = content
  let count = 0
  const category = inferCategory(filePath)

  for (const rule of createReplacements(category)) {
    const matches = content.match(rule.pattern)
    if (matches) {
      content = content.replace(rule.pattern, rule.replacement)
      count += matches.length
    }
  }

  if (count > 0 && !hasLoggerImport(content)) {
    content = addImport(content)
  }

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf-8')
    stats.modified++
    stats.replacements += count
    console.log(`  ✓ ${path.relative(MAIN_DIR, filePath)} [${category}] (${count})`)
  }
}

console.log('Migrating main process console to logger...\n')
getAllFiles(MAIN_DIR).forEach(migrate)
console.log(`\nDone: ${stats.modified} files, ${stats.replacements} replacements`)
