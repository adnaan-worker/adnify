/**
 * 工作区状态持久化服务
 * 保存和恢复打开的文件、活动文件等状态
 * 数据存储在 .adnify/workspace-state.json
 * 
 * 注意：此服务依赖 adnifyDirService 进行目录管理
 * 请确保在使用前已调用 adnifyDir.initialize()
 */

import { useStore } from '../store'
import { adnifyDir, ADNIFY_FILES } from './adnifyDirService'

interface WorkspaceState {
  openFiles: string[] // 打开的文件路径列表
  activeFilePath: string | null
  expandedFolders: string[]
  savedAt: number
}

/**
 * 保存工作区状态
 */
export async function saveWorkspaceState(): Promise<void> {
  const { openFiles, activeFilePath, expandedFolders } = useStore.getState()
  
  if (!adnifyDir.isInitialized()) return
  
  const state: WorkspaceState = {
    openFiles: openFiles.map((f: { path: string }) => f.path),
    activeFilePath,
    expandedFolders: Array.from(expandedFolders),
    savedAt: Date.now(),
  }
  
  const success = await adnifyDir.writeJson(ADNIFY_FILES.WORKSPACE_STATE, state)
  if (success) {
    console.log('[WorkspaceState] Saved:', state.openFiles.length, 'files')
  } else {
    console.error('[WorkspaceState] Failed to save')
  }
}

/**
 * 恢复工作区状态
 */
export async function restoreWorkspaceState(): Promise<void> {
  const { openFile, setActiveFile, toggleFolder } = useStore.getState()
  
  if (!adnifyDir.isInitialized()) return
  
  const state = await adnifyDir.readJson<WorkspaceState>(ADNIFY_FILES.WORKSPACE_STATE)
  if (!state) {
    console.log('[WorkspaceState] No saved state')
    return
  }
  
  console.log('[WorkspaceState] Restoring:', state.openFiles.length, 'files')
  
  // 恢复展开的文件夹
  for (const folder of state.expandedFolders) {
    toggleFolder(folder)
  }
  
  // 恢复打开的文件
  for (const filePath of state.openFiles) {
    try {
      const fileContent = await window.electronAPI.readFile(filePath)
      if (fileContent !== null) {
        openFile(filePath, fileContent)
      }
    } catch {
      console.warn('[WorkspaceState] Failed to restore file:', filePath)
    }
  }
  
  // 恢复活动文件
  if (state.activeFilePath) {
    setActiveFile(state.activeFilePath)
  }
  
  console.log('[WorkspaceState] Restored successfully')
}

/**
 * 设置自动保存
 */
let saveTimeout: NodeJS.Timeout | null = null

export function scheduleStateSave(): void {
  if (saveTimeout) {
    clearTimeout(saveTimeout)
  }
  // 延迟 2 秒保存，避免频繁写入
  saveTimeout = setTimeout(() => {
    saveWorkspaceState()
  }, 2000)
}

/**
 * 监听状态变化并自动保存
 */
export function initWorkspaceStateSync(): () => void {
  // 订阅 store 变化
  const unsubscribe = useStore.subscribe(
    (state, prevState) => {
      // 检测打开文件或活动文件变化
      if (
        state.openFiles !== prevState.openFiles ||
        state.activeFilePath !== prevState.activeFilePath ||
        state.expandedFolders !== prevState.expandedFolders
      ) {
        scheduleStateSave()
      }
    }
  )
  
  // 窗口关闭前保存
  const handleBeforeUnload = () => {
    saveWorkspaceState()
  }
  window.addEventListener('beforeunload', handleBeforeUnload)
  
  return () => {
    unsubscribe()
    window.removeEventListener('beforeunload', handleBeforeUnload)
    if (saveTimeout) {
      clearTimeout(saveTimeout)
    }
  }
}
