import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron'
import path from 'path'

export default defineConfig({
	plugins: [
		react(),
		electron([
			{
				entry: 'src/main/main.ts',
				vite: {
					resolve: {
						alias: {
							'@': path.resolve(__dirname, './src'),
							'@shared': path.resolve(__dirname, './src/shared'),
							'@main': path.resolve(__dirname, './src/main'),
						}
					},
					build: {
						outDir: 'dist/main',
						rollupOptions: {
							external: [
								'electron',
								'electron-store',
								'@anthropic-ai/sdk',
								'openai',
								'@google/generative-ai',
								'node-pty',
								'@parcel/watcher',
								'@parcel/watcher-win32-x64',
								'@parcel/watcher-win32-arm64',
								'@parcel/watcher-darwin-x64',
								'@parcel/watcher-darwin-arm64',
								'@parcel/watcher-linux-x64-glibc',
								'@parcel/watcher-linux-x64-musl',
								'@parcel/watcher-linux-arm64-glibc',
								'@parcel/watcher-linux-arm64-musl',
								'dugite',
								'@vscode/ripgrep',
								'@lancedb/lancedb',
								'apache-arrow'
							]
						}
					}
				}
			},
			{
				// Worker 文件需要单独编译到与 main.js 相同的目录
				entry: 'src/main/indexing/indexer.worker.ts',
				vite: {
					resolve: {
						alias: {
							'@': path.resolve(__dirname, './src'),
							'@shared': path.resolve(__dirname, './src/shared'),
							'@main': path.resolve(__dirname, './src/main'),
						}
					},
					build: {
						outDir: 'dist/main',
						lib: {
							entry: 'src/main/indexing/indexer.worker.ts',
							formats: ['cjs'],
							fileName: () => 'indexer.worker.js'
						},
						rollupOptions: {
							external: [
								'electron',
								'@lancedb/lancedb',
								'apache-arrow',
								'web-tree-sitter'
							]
						}
					}
				}
			},
			{
				entry: 'src/main/preload.ts',
				onstart(options) {
					options.reload()
				},
				vite: {
					build: {
						outDir: 'dist/preload'
					}
				}
			}
		])
	],
	resolve: {
		alias: {
			'@': path.resolve(__dirname, './src'),
			'@main': path.resolve(__dirname, './src/main'),
			'@renderer': path.resolve(__dirname, './src/renderer'),
			'@shared': path.resolve(__dirname, './src/shared'),
			'@components': path.resolve(__dirname, './src/renderer/components'),
			'@features': path.resolve(__dirname, './src/renderer/features'),
			'@services': path.resolve(__dirname, './src/renderer/services'),
			'@store': path.resolve(__dirname, './src/renderer/store'),
			'@hooks': path.resolve(__dirname, './src/renderer/hooks'),
			'@utils': path.resolve(__dirname, './src/renderer/utils'),
			'@app-types': path.resolve(__dirname, './src/renderer/types'),
			// Monaco 编辑器国际化：将 vscode-nls 指向 monaco-editor-nls
			'vscode-nls': path.resolve(__dirname, './node_modules/monaco-editor-nls')
		}
	},
	base: './',
	build: {
		outDir: 'dist/renderer',
		rollupOptions: {
			output: {
				// 代码分割配置 - 优化首屏加载
				manualChunks: {
					// Monaco Editor 单独打包（最大的依赖）
					'monaco-editor': ['monaco-editor'],
					// React 相关
					'react-vendor': ['react', 'react-dom'],
					// 状态管理
					'state': ['zustand'],
					// UI 图标
					'icons': ['lucide-react'],
					// 终端相关 - 懒加载优化
					'terminal': ['@xterm/xterm', '@xterm/addon-fit', '@xterm/addon-webgl', '@xterm/addon-web-links'],
					// Markdown 渲染 - 懒加载优化
					'markdown': ['react-markdown', 'react-syntax-highlighter'],
				},
			},
		},
		// 增加 chunk 大小警告阈值
		chunkSizeWarningLimit: 1500,
	},
	optimizeDeps: {
		include: ['monaco-editor']
	}
})
