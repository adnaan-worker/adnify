/**
 * 修复 @types/ 别名为 @app-types/
 */

const fs = require('fs')
const path = require('path')

const SRC_DIR = path.join(__dirname, '../../src')

let stats = { modified: 0, replacements: 0 }

function getAllFiles(dir) {
  const files = []
  function walk(d) {
    for (const item of fs.readdirSync(d)) {
      const full = path.join(d, item)
      if (item === 'node_modules' || item === 'dist') continue
      if (fs.statSync(full).isDirectory()) walk(full)
      else if (item.endsWith('.ts') || item.endsWith('.tsx')) files.push(full)
    }
  }
  walk(dir)
  return files
}

function fix(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8')
  const original = content
  
  // 替换 @types/ 为 @app-types/
  const matches = content.match(/from ['"]@types\//g)
  if (matches) {
    content = content.replace(/from ['"]@types\//g, "from '@app-types/")
    fs.writeFileSync(filePath, content, 'utf-8')
    stats.modified++
    stats.replacements += matches.length
    console.log(`  ✓ ${path.relative(SRC_DIR, filePath)} (${matches.length})`)
  }
}

console.log('Fixing @types/ to @app-types/...\n')
getAllFiles(SRC_DIR).forEach(fix)
console.log(`\nDone: ${stats.modified} files, ${stats.replacements} replacements`)
