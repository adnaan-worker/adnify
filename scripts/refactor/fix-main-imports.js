/**
 * 修复 main 进程中的导入路径
 * main 进程应该使用 @shared 而不是 @utils/@services
 */

const fs = require('fs')
const path = require('path')

const MAIN_DIR = path.join(__dirname, '../../src/main')

// 替换规则
const REPLACEMENTS = [
  {
    pattern: /import\s*\{\s*logger\s*\}\s*from\s*['"]@utils\/Logger['"]/g,
    replacement: "import { logger } from '@shared/utils/Logger'"
  },
  {
    pattern: /from\s*['"]@services\/llm['"]/g,
    replacement: "from '../services/llm'"
  },
]

let stats = { filesModified: 0, replacements: 0 }

function getAllFiles(dir, extensions = ['.ts']) {
  const files = []
  function walk(currentDir) {
    try {
      const items = fs.readdirSync(currentDir)
      for (const item of items) {
        const fullPath = path.join(currentDir, item)
        const stat = fs.statSync(fullPath)
        if (stat.isDirectory()) {
          walk(fullPath)
        } else if (extensions.some(ext => item.endsWith(ext))) {
          files.push(fullPath)
        }
      }
    } catch (e) {
      console.error(`Error reading ${currentDir}:`, e.message)
    }
  }
  walk(dir)
  return files
}

function fixFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf-8')
    let original = content
    let count = 0

    for (const rule of REPLACEMENTS) {
      const matches = content.match(rule.pattern)
      if (matches) {
        content = content.replace(rule.pattern, rule.replacement)
        count += matches.length
      }
    }

    if (content !== original) {
      fs.writeFileSync(filePath, content, 'utf-8')
      stats.filesModified++
      stats.replacements += count
      const rel = path.relative(path.join(__dirname, '../..'), filePath)
      console.log(`  ✓ ${rel} (${count} replacements)`)
    }
  } catch (e) {
    console.error(`Error processing ${filePath}:`, e.message)
  }
}

console.log('='.repeat(50))
console.log('Fixing main process imports')
console.log('='.repeat(50))
console.log(`Source: ${MAIN_DIR}\n`)

const files = getAllFiles(MAIN_DIR)
console.log(`Found ${files.length} files\n`)

files.forEach(fixFile)

console.log('\n' + '='.repeat(50))
console.log(`Files modified: ${stats.filesModified}`)
console.log(`Replacements:   ${stats.replacements}`)
console.log('='.repeat(50))
