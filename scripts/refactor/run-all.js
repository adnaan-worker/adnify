/**
 * 运行所有重构脚本
 * 用法: node scripts/refactor/run-all.js [--dry-run]
 */

const { execSync } = require('child_process')
const path = require('path')

const DRY_RUN = process.argv.includes('--dry-run')
const SCRIPTS_DIR = __dirname

const scripts = [
  'migrate-imports.js',
  'migrate-console-to-logger.js',
]

console.log('╔' + '═'.repeat(58) + '╗')
console.log('║' + ' Adnify Refactoring Suite'.padEnd(58) + '║')
console.log('╚' + '═'.repeat(58) + '╝')
console.log('')
console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`)
console.log('')

for (const script of scripts) {
  console.log('\n' + '─'.repeat(60))
  console.log(`Running: ${script}`)
  console.log('─'.repeat(60) + '\n')
  
  try {
    const scriptPath = path.join(SCRIPTS_DIR, script)
    const args = DRY_RUN ? '--dry-run' : ''
    execSync(`node "${scriptPath}" ${args}`, { 
      stdio: 'inherit',
      cwd: path.join(SCRIPTS_DIR, '../..')
    })
  } catch (error) {
    console.error(`\n✗ Script ${script} failed`)
    process.exit(1)
  }
}

console.log('\n' + '═'.repeat(60))
console.log('All refactoring scripts completed!')
console.log('═'.repeat(60))

if (!DRY_RUN) {
  console.log('\nNext steps:')
  console.log('  1. Run: npm run build')
  console.log('  2. Run: npm test')
  console.log('  3. Manual testing')
}
