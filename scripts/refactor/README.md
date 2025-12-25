# Adnify 重构脚本

## 使用方法

### 1. 预览变更（推荐先执行）
```bash
# 预览所有变更
node scripts/refactor/run-all.js --dry-run

# 或单独预览
node scripts/refactor/migrate-imports.js --dry-run
node scripts/refactor/migrate-console-to-logger.js --dry-run
```

### 2. 执行变更
```bash
# 执行所有重构
node scripts/refactor/run-all.js

# 或单独执行
node scripts/refactor/migrate-imports.js
node scripts/refactor/migrate-console-to-logger.js
```

### 3. 验证
```bash
# TypeScript 编译检查
npx tsc --noEmit

# 运行测试
npm test

# 构建
npm run build
```

## 脚本说明

| 脚本 | 功能 |
|------|------|
| `migrate-imports.js` | 将相对路径 `../` 迁移到路径别名 `@/` |
| `migrate-console-to-logger.js` | 将 `console.*` 替换为 `logger.*` |
| `run-all.js` | 按顺序运行所有脚本 |

## 路径别名映射

| 别名 | 路径 |
|------|------|
| `@/*` | `src/*` |
| `@main/*` | `src/main/*` |
| `@renderer/*` | `src/renderer/*` |
| `@shared/*` | `src/shared/*` |
| `@components/*` | `src/renderer/components/*` |
| `@features/*` | `src/renderer/features/*` |
| `@services/*` | `src/renderer/services/*` |
| `@store/*` | `src/renderer/store/*` |
| `@hooks/*` | `src/renderer/hooks/*` |
| `@utils/*` | `src/renderer/utils/*` |
| `@types/*` | `src/renderer/types/*` |

## 日志分类映射

脚本会根据文件路径自动推断日志分类：

| 路径包含 | 分类 |
|----------|------|
| `/agent/` | `agent` |
| `/services/lsp` | `lsp` |
| `/services/completion` | `completion` |
| `/store/` | `store` |
| `/components/` | `ui` |
| `/ipc/` | `ipc` |
| `/security/` | `security` |
| `/indexing/` | `index` |
| 其他 | `system` |

## 注意事项

1. 执行前请确保代码已提交到 Git
2. 建议在新分支上执行重构
3. 执行后需要手动检查并修复可能的问题
4. 某些复杂的相对路径可能需要手动调整
