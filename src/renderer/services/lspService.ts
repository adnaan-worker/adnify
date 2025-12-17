/**
 * LSP 服务 - 渲染进程端
 * 
 * 内置支持的语言:
 * - TypeScript/JavaScript
 * - HTML/CSS/JSON
 */

// 文档版本追踪
const documentVersions = new Map<string, number>()
const openedDocuments = new Set<string>()
let currentWorkspacePath: string | null = null

/**
 * 设置当前工作区路径
 */
export function setWorkspacePath(path: string): void {
  currentWorkspacePath = path
}

/**
 * 获取文件的语言 ID
 */
export function getLanguageId(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() || ''
  const languageMap: Record<string, string> = {
    ts: 'typescript',
    tsx: 'typescriptreact',
    js: 'javascript',
    jsx: 'javascriptreact',
    mjs: 'javascript',
    cjs: 'javascript',
    html: 'html',
    htm: 'html',
    css: 'css',
    scss: 'scss',
    less: 'less',
    json: 'json',
    jsonc: 'jsonc',
  }
  return languageMap[ext] || 'plaintext'
}

/**
 * 检查语言是否支持 LSP
 */
export function isLanguageSupported(languageId: string): boolean {
  const supported = [
    'typescript', 'typescriptreact', 'javascript', 'javascriptreact',
    'html', 'css', 'scss', 'less', 'json', 'jsonc',
  ]
  return supported.includes(languageId)
}

/**
 * 将文件路径转换为 LSP URI
 */
export function pathToLspUri(filePath: string): string {
  const normalizedPath = filePath.replace(/\\/g, '/')
  if (/^[a-zA-Z]:/.test(normalizedPath)) {
    return `file:///${normalizedPath}`
  }
  return `file://${normalizedPath}`
}

/**
 * 将 LSP URI 转换为文件路径
 */
export function lspUriToPath(uri: string): string {
  let path = uri
  if (path.startsWith('file:///')) path = path.slice(8)
  else if (path.startsWith('file://')) path = path.slice(7)
  
  try { path = decodeURIComponent(path) } catch {}
  
  if (/^[a-zA-Z]:/.test(path)) {
    path = path.replace(/\//g, '\\')
  }
  return path
}

/**
 * 启动 LSP 服务器
 */
export async function startLspServer(workspacePath: string): Promise<boolean> {
  try {
    const result = await window.electronAPI.lspStart(workspacePath)
    return result.success
  } catch (error) {
    console.error('[LSP] Failed to start:', error)
    return false
  }
}

/**
 * 停止 LSP 服务器
 */
export async function stopLspServer(): Promise<void> {
  try {
    await window.electronAPI.lspStop()
    documentVersions.clear()
    openedDocuments.clear()
  } catch (error) {
    console.error('[LSP] Failed to stop:', error)
  }
}

/**
 * 通知服务器文档已打开
 */
export async function didOpenDocument(filePath: string, content: string): Promise<void> {
  const uri = pathToLspUri(filePath)
  const languageId = getLanguageId(filePath)
  
  if (!isLanguageSupported(languageId)) return
  
  if (openedDocuments.has(uri)) {
    await didChangeDocument(filePath, content)
    return
  }
  
  const version = 1
  documentVersions.set(uri, version)
  openedDocuments.add(uri)
  
  await window.electronAPI.lspDidOpen({
    uri,
    languageId,
    version,
    text: content,
    workspacePath: currentWorkspacePath,
  } as any)
}

/**
 * 通知服务器文档已变更
 */
export async function didChangeDocument(filePath: string, content: string): Promise<void> {
  const uri = pathToLspUri(filePath)
  const languageId = getLanguageId(filePath)
  
  if (!isLanguageSupported(languageId)) return
  
  const newVersion = (documentVersions.get(uri) || 0) + 1
  documentVersions.set(uri, newVersion)
  
  await window.electronAPI.lspDidChange({
    uri,
    version: newVersion,
    text: content,
    workspacePath: currentWorkspacePath,
  } as any)
}

/**
 * 通知服务器文档已关闭
 */
export async function didCloseDocument(filePath: string): Promise<void> {
  const uri = pathToLspUri(filePath)
  const languageId = getLanguageId(filePath)
  
  if (!isLanguageSupported(languageId)) return
  
  documentVersions.delete(uri)
  openedDocuments.delete(uri)
  
  await window.electronAPI.lspDidClose({ 
    uri,
    workspacePath: currentWorkspacePath,
  } as any)
}

/**
 * 跳转到定义
 */
export async function goToDefinition(
  filePath: string,
  line: number,
  character: number
): Promise<{ uri: string; range: any }[] | null> {
  const uri = pathToLspUri(filePath)
  
  try {
    const result = await window.electronAPI.lspDefinition({ uri, line, character })
    if (!result) return null
    return Array.isArray(result) ? result : [result]
  } catch {
    return null
  }
}

/**
 * 查找引用
 */
export async function findReferences(
  filePath: string,
  line: number,
  character: number
): Promise<{ uri: string; range: any }[] | null> {
  const uri = pathToLspUri(filePath)
  
  try {
    return await window.electronAPI.lspReferences({ uri, line, character })
  } catch {
    return null
  }
}

/**
 * 获取悬停信息
 */
export async function getHoverInfo(
  filePath: string,
  line: number,
  character: number
): Promise<{ contents: any; range?: any } | null> {
  const uri = pathToLspUri(filePath)
  
  try {
    return await window.electronAPI.lspHover({ uri, line, character })
  } catch {
    return null
  }
}

/**
 * 获取代码补全
 */
export async function getCompletions(
  filePath: string,
  line: number,
  character: number
): Promise<any> {
  const uri = pathToLspUri(filePath)
  
  try {
    return await window.electronAPI.lspCompletion({ uri, line, character })
  } catch {
    return null
  }
}

/**
 * 重命名符号
 */
export async function renameSymbol(
  filePath: string,
  line: number,
  character: number,
  newName: string
): Promise<any> {
  const uri = pathToLspUri(filePath)
  
  try {
    return await window.electronAPI.lspRename({ uri, line, character, newName })
  } catch {
    return null
  }
}

/**
 * 监听诊断信息
 */
export function onDiagnostics(
  callback: (uri: string, diagnostics: any[]) => void
): () => void {
  return window.electronAPI.onLspDiagnostics((params) => {
    callback(params.uri, params.diagnostics)
  })
}

/**
 * 跳转到类型定义
 */
export async function goToTypeDefinition(
  filePath: string,
  line: number,
  character: number
): Promise<{ uri: string; range: any }[] | null> {
  const uri = pathToLspUri(filePath)
  
  try {
    const result = await window.electronAPI.lspTypeDefinition({ uri, line, character })
    if (!result) return null
    return Array.isArray(result) ? result : [result]
  } catch {
    return null
  }
}

/**
 * 跳转到实现
 */
export async function goToImplementation(
  filePath: string,
  line: number,
  character: number
): Promise<{ uri: string; range: any }[] | null> {
  const uri = pathToLspUri(filePath)
  
  try {
    const result = await window.electronAPI.lspImplementation({ uri, line, character })
    if (!result) return null
    return Array.isArray(result) ? result : [result]
  } catch {
    return null
  }
}

/**
 * 获取签名帮助
 */
export async function getSignatureHelp(
  filePath: string,
  line: number,
  character: number
): Promise<any> {
  const uri = pathToLspUri(filePath)
  
  try {
    return await window.electronAPI.lspSignatureHelp({ uri, line, character })
  } catch {
    return null
  }
}

/**
 * 准备重命名
 */
export async function prepareRename(
  filePath: string,
  line: number,
  character: number
): Promise<{ range: any; placeholder: string } | null> {
  const uri = pathToLspUri(filePath)
  
  try {
    return await window.electronAPI.lspPrepareRename({ uri, line, character })
  } catch {
    return null
  }
}

/**
 * 获取文档符号（大纲）
 */
export async function getDocumentSymbols(filePath: string): Promise<any[]> {
  const uri = pathToLspUri(filePath)
  
  try {
    return await window.electronAPI.lspDocumentSymbol({ uri }) || []
  } catch {
    return []
  }
}

/**
 * 搜索工作区符号
 */
export async function searchWorkspaceSymbols(query: string): Promise<any[]> {
  try {
    return await window.electronAPI.lspWorkspaceSymbol({ query }) || []
  } catch {
    return []
  }
}

/**
 * 获取代码操作
 */
export async function getCodeActions(
  filePath: string,
  range: { start: { line: number; character: number }; end: { line: number; character: number } },
  diagnostics?: any[]
): Promise<any[]> {
  const uri = pathToLspUri(filePath)
  
  try {
    return await window.electronAPI.lspCodeAction({ uri, range, diagnostics }) || []
  } catch {
    return []
  }
}

/**
 * 格式化文档
 */
export async function formatDocument(
  filePath: string,
  options?: { tabSize?: number; insertSpaces?: boolean }
): Promise<any[]> {
  const uri = pathToLspUri(filePath)
  
  try {
    return await window.electronAPI.lspFormatting({ uri, options }) || []
  } catch {
    return []
  }
}

/**
 * 格式化选区
 */
export async function formatRange(
  filePath: string,
  range: { start: { line: number; character: number }; end: { line: number; character: number } },
  options?: { tabSize?: number; insertSpaces?: boolean }
): Promise<any[]> {
  const uri = pathToLspUri(filePath)
  
  try {
    return await window.electronAPI.lspRangeFormatting({ uri, range, options }) || []
  } catch {
    return []
  }
}

/**
 * 获取文档高亮
 */
export async function getDocumentHighlights(
  filePath: string,
  line: number,
  character: number
): Promise<any[]> {
  const uri = pathToLspUri(filePath)
  
  try {
    return await window.electronAPI.lspDocumentHighlight({ uri, line, character }) || []
  } catch {
    return []
  }
}

/**
 * 获取折叠范围
 */
export async function getFoldingRanges(filePath: string): Promise<any[]> {
  const uri = pathToLspUri(filePath)
  
  try {
    return await window.electronAPI.lspFoldingRange({ uri }) || []
  } catch {
    return []
  }
}

/**
 * 解析补全项
 */
export async function resolveCompletionItem(item: any): Promise<any> {
  try {
    return await window.electronAPI.lspCompletionResolve(item)
  } catch {
    return item
  }
}

/**
 * 获取内联提示
 */
export async function getInlayHints(
  filePath: string,
  range: { start: { line: number; character: number }; end: { line: number; character: number } }
): Promise<any[]> {
  const uri = pathToLspUri(filePath)
  
  try {
    return await window.electronAPI.lspInlayHint({ uri, range }) || []
  } catch {
    return []
  }
}
