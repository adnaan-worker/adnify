/**
 * 批量迁移相对路径到路径别名
 * 用法: node scripts/refactor/migrate-imports.js [--dry-run]
 */

const fs = require('fs')
const path = require('path')

const DRY_RUN = process.argv.includes('--dry-run')
const SRC_DIR = path.join(__dirname, '../../src')

// 路径别名映射规则
const ALIAS_RULES = [
  // renderer 内部路径
  { pattern: /from ['"]\.\.\/\.\.\/\.\.\/shared\//g, replacement: "from '@shared/" },
  { pattern: /from ['"]\.\.\/\.\.\/shared\//g, replacement: "from '@shared/" },
  { pattern: /from ['"]\.\.\/shared\//g, replacement: "from '@shared/" },
  
  { pattern: /from ['"]\.\.\/\.\.\/store['"]/g, replacement: "from '@store'" },
  { pattern: /from ['"]\.\.\/store['"]/g, replacement: "from '@store'" },
  { pattern: /from ['"]\.\.\/\.\.\/store\//g, replacement: "from '@store/" },
  { pattern: /from ['"]\.\.\/store\//g, replacement: "from '@store/" },
  
  { pattern: /from ['"]\.\.\/\.\.\/\.\.\/services\//g, replacement: "from '@services/" },
  { pattern: /from ['"]\.\.\/\.\.\/services\//g, replacement: "from '@services/" },
  { pattern: /from ['"]\.\.\/services\//g, replacement: "from '@services/" },
  
  { pattern: /from ['"]\.\.\/\.\.\/\.\.\/components\//g, replacement: "from '@components/" },
  { pattern: /from ['"]\.\.\/\.\.\/components\//g, replacement: "from '@components/" },
  { pattern: /from ['"]\.\.\/components\//g, replacement: "from '@components/" },
  
  { pattern: /from ['"]\.\.\/\.\.\/\.\.\/hooks\//g, replacement: "from '@hooks/" },
  { pattern: /from ['"]\.\.\/\.\.\/hooks\//g, replacement: "from '@hooks/" },
  { pattern: /from ['"]\.\.\/hooks\//g, replacement: "from '@hooks/" },
  
  { pattern: /from ['"]\.\.\/\.\.\/\.\.\/utils\//g, replacement: "from '@utils/" },
  { pattern: /from ['"]\.\.\/\.\.\/utils\//g, replacement: "from '@utils/" },
  { pattern: /from ['"]\.\.\/utils\//g, replacement: "from '@utils/" },
  
  { pattern: /from ['"]\.\.\/\.\.\/\.\.\/types\//g, replacement: "from '@types/" },
  { pattern: /from ['"]\.\.\/\.\.\/types\//g, replacement: "from '@types/" },
  { pattern: /from ['"]\.\.\/types\//g, replacement: "from '@types/" },
  
  { pattern: /from ['"]\.\.\/\.\.\/\.\.\/config\//g, replacement: "from '@renderer/config/" },
  { pattern: /from ['"]\.\.\/\.\.\/config\//g, replacement: "from '@renderer/config/" },
  { pattern: /from ['"]\.\.\/config\//g, replacement: "from '@renderer/config/" },
  
  { pattern: /from ['"]\.\.\/\.\.\/\.\.\/i18n['"]/g, replacement: "from '@renderer/i18n'" },
  { pattern: /from ['"]\.\.\/\.\.\/i18n['"]/g, replacement: "from '@renderer/i18n'" },
  { pattern: /from ['"]\.\.\/i18n['"]/g, replacement: "from '@renderer/i18n'" },
  
  { pattern: /from ['"]\.\.\/\.\.\/\.\.\/agent\//g, replacement: "from '@renderer/agent/" },
  { pattern: /from ['"]\.\.\/\.\.\/agent\//g, replacement: "from '@renderer/agent/" },
  { pattern: /from ['"]\.\.\/agent\//g, replacement: "from '@renderer/agent/" },
  
  { pattern: /from ['"]\.\.\/\.\.\/\.\.\/features\//g, replacement: "from '@features/" },
  { pattern: /from ['"]\.\.\/\.\.\/features\//g, replacement: "from '@features/" },
  { pattern: /from ['"]\.\.\/features\//g, replacement: "from '@features/" },
  
  { pattern: /from ['"]\.\.\/\.\.\/\.\.\/plan\//g, replacement: "from '@renderer/plan/" },
  { pattern: /from ['"]\.\.\/\.\.\/plan\//g, replacement: "from '@renderer/plan/" },
  { pattern: /from ['"]\.\.\/plan\//g, replacement: "from '@renderer/plan/" },
  
  { pattern: /from ['"]\.\.\/\.\.\/\.\.\/modes\//g, replacement: "from '@renderer/modes/" },
  { pattern: /from ['"]\.\.\/\.\.\/modes\//g, replacement: "from '@renderer/modes/" },
  { pattern: /from ['"]\.\.\/modes\//g, replacement: "from '@renderer/modes/" },
]

// 统计
let stats = {
  filesScanned: 0,
  filesModified: 0,
  replacements: 0,
  errors: []
}

function getAllFiles(dir, extensions = ['.ts', '.tsx']) {
  const files = []
  
  function walk(currentDir) {
    const items = fs.readdirSync(currentDir)
    for (const item of items) {
      const fullPath = path.join(currentDir, item)
      const stat = fs.statSync(fullPath)
      
      if (stat.isDirectory()) {
        if (!['node_modules', 'dist', '.git'].includes(item)) {
          walk(fullPath)
        }
      } else if (extensions.some(ext => item.endsWith(ext))) {
        files.push(fullPath)
      }
    }
  }
  
  walk(dir)
  return files
}

function migrateFile(filePath) {
  stats.filesScanned++
  
  try {
    let content = fs.readFileSync(filePath, 'utf-8')
    let originalContent = content
    let fileReplacements = 0
    
    for (const rule of ALIAS_RULES) {
      const matches = content.match(rule.pattern)
      if (matches) {
        content = content.replace(rule.pattern, rule.replacement)
        fileReplacements += matches.length
      }
    }
    
    if (content !== originalContent) {
      stats.filesModified++
      stats.replacements += fileReplacements
      
      const relativePath = path.relative(SRC_DIR, filePath)
      console.log(`  ✓ ${relativePath} (${fileReplacements} replacements)`)
      
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
  console.log('Import Path Migration Script')
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
