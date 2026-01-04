/**
 * 调试适配器注册表
 * 定义各种语言的调试适配器配置
 */

import { join } from 'path'
import type { DebugAdapterInfo, DebugAdapterDescriptor, DebugConfig } from '../types'

/**
 * 内置调试适配器
 */
export const builtinAdapters: DebugAdapterInfo[] = [
  // Node.js 调试器（使用内置的 node inspect）
  {
    type: 'node',
    label: 'Node.js',
    languages: ['javascript', 'typescript'],
    async getDescriptor(config: DebugConfig): Promise<DebugAdapterDescriptor> {
      // Node.js 使用内置的 inspector，我们通过 js-debug 适配器连接
      // 如果没有安装 js-debug，回退到直接连接 inspector
      return {
        type: 'server',
        port: config.port || 9229,
        host: config.host || '127.0.0.1',
      }
    },
    configurationSnippets: [
      {
        label: 'Node.js: Launch Program',
        description: 'Launch a Node.js program in debug mode',
        body: {
          type: 'node',
          name: 'Launch Program',
          request: 'launch',
          program: '${file}',
          cwd: '${workspaceFolder}',
          stopOnEntry: false,
        },
      },
      {
        label: 'Node.js: Attach',
        description: 'Attach to a running Node.js process',
        body: {
          type: 'node',
          name: 'Attach to Process',
          request: 'attach',
          port: 9229,
          host: 'localhost',
        },
      },
      {
        label: 'Node.js: Launch via npm',
        description: 'Launch a Node.js program via npm script',
        body: {
          type: 'node',
          name: 'Launch via npm',
          request: 'launch',
          runtimeExecutable: 'npm',
          runtimeArgs: ['run-script', 'debug'],
          cwd: '${workspaceFolder}',
        },
      },
    ],
  },

  // Python 调试器（使用 debugpy）
  {
    type: 'python',
    label: 'Python',
    languages: ['python'],
    async getDescriptor(_config: DebugConfig): Promise<DebugAdapterDescriptor> {
      // debugpy 可以通过 pip 安装: pip install debugpy
      return {
        type: 'executable',
        command: 'python',
        args: ['-m', 'debugpy.adapter'],
      }
    },
    configurationSnippets: [
      {
        label: 'Python: Current File',
        description: 'Debug the currently open Python file',
        body: {
          type: 'python',
          name: 'Python: Current File',
          request: 'launch',
          program: '${file}',
          cwd: '${workspaceFolder}',
          console: 'integratedTerminal',
        },
      },
      {
        label: 'Python: Attach',
        description: 'Attach to a running Python process',
        body: {
          type: 'python',
          name: 'Python: Attach',
          request: 'attach',
          port: 5678,
          host: 'localhost',
        },
      },
    ],
  },

  // Go 调试器（使用 delve）
  {
    type: 'go',
    label: 'Go',
    languages: ['go'],
    async getDescriptor(_config: DebugConfig): Promise<DebugAdapterDescriptor> {
      // dlv 可以通过 go install 安装: go install github.com/go-delve/delve/cmd/dlv@latest
      return {
        type: 'executable',
        command: 'dlv',
        args: ['dap'],
      }
    },
    configurationSnippets: [
      {
        label: 'Go: Launch Package',
        description: 'Debug the Go package in the current directory',
        body: {
          type: 'go',
          name: 'Launch Package',
          request: 'launch',
          mode: 'auto',
          program: '${workspaceFolder}',
        },
      },
      {
        label: 'Go: Launch File',
        description: 'Debug a single Go file',
        body: {
          type: 'go',
          name: 'Launch File',
          request: 'launch',
          mode: 'auto',
          program: '${file}',
        },
      },
      {
        label: 'Go: Attach',
        description: 'Attach to a running Go process',
        body: {
          type: 'go',
          name: 'Attach to Process',
          request: 'attach',
          mode: 'local',
          processId: 0,
        },
      },
    ],
  },

  // Rust 调试器（使用 codelldb 或 lldb-vscode）
  {
    type: 'lldb',
    label: 'LLDB (Rust/C/C++)',
    languages: ['rust', 'c', 'cpp'],
    async getDescriptor(_config: DebugConfig): Promise<DebugAdapterDescriptor> {
      // codelldb 需要单独安装
      return {
        type: 'executable',
        command: 'codelldb',
        args: ['--port', '0'],
      }
    },
    configurationSnippets: [
      {
        label: 'LLDB: Launch',
        description: 'Launch a program with LLDB',
        body: {
          type: 'lldb',
          name: 'LLDB: Launch',
          request: 'launch',
          program: '${workspaceFolder}/target/debug/${workspaceFolderBasename}',
          cwd: '${workspaceFolder}',
        },
      },
    ],
  },
]

/**
 * 获取调试适配器信息
 */
export function getAdapterInfo(type: string): DebugAdapterInfo | undefined {
  return builtinAdapters.find(a => a.type === type)
}

/**
 * 获取语言对应的调试适配器
 */
export function getAdapterForLanguage(languageId: string): DebugAdapterInfo | undefined {
  return builtinAdapters.find(a => a.languages.includes(languageId))
}

/**
 * 获取所有配置代码片段
 */
export function getAllConfigSnippets(): Array<{ type: string; snippets: DebugAdapterInfo['configurationSnippets'] }> {
  return builtinAdapters.map(a => ({
    type: a.type,
    snippets: a.configurationSnippets,
  }))
}
