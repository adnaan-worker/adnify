/**
 * 流式编辑服务
 * 支持实时编辑预览和增量更新
 */

import { logger } from '@utils/Logger'
import { StreamingEditState } from './toolTypes'

type StreamingEditListener = (state: StreamingEditState) => void

class StreamingEditService {
	private activeEdits: Map<string, StreamingEditState> = new Map()
	private listeners: Map<string, Set<StreamingEditListener>> = new Map()

	/**
	 * 开始流式编辑
	 */
	startEdit(filePath: string, originalContent: string): string {
		const editId = crypto.randomUUID()

		const state: StreamingEditState = {
			editId,
			filePath,
			originalContent,
			currentContent: originalContent,
			isComplete: false,
			startTime: Date.now(),
		}

		this.activeEdits.set(editId, state)
		this.listeners.set(editId, new Set())

		return editId
	}

	/**
	 * 追加内容到流式编辑
	 */
	appendContent(editId: string, content: string): void {
		const state = this.activeEdits.get(editId)
		if (!state) return

		state.currentContent += content
		this.notifyListeners(editId, state)
	}

	/**
	 * 替换当前内容
	 */
	replaceContent(editId: string, newContent: string): void {
		const state = this.activeEdits.get(editId)
		if (!state) return

		state.currentContent = newContent
		this.notifyListeners(editId, state)
	}

	/**
	 * 应用增量更新（用于 search/replace 块）
	 */
	applyDelta(editId: string, searchText: string, replaceText: string): boolean {
		const state = this.activeEdits.get(editId)
		if (!state) return false

		if (state.currentContent.includes(searchText)) {
			state.currentContent = state.currentContent.replace(searchText, replaceText)
			this.notifyListeners(editId, state)
			return true
		}

		return false
	}

	/**
	 * 完成流式编辑
	 */
	completeEdit(editId: string): StreamingEditState | null {
		const state = this.activeEdits.get(editId)
		if (!state) return null

		state.isComplete = true
		this.notifyListeners(editId, state)

		return state
	}

	/**
	 * 取消流式编辑
	 */
	cancelEdit(editId: string): void {
		this.activeEdits.delete(editId)
		this.listeners.delete(editId)
	}

	/**
	 * 获取编辑状态
	 */
	getEditState(editId: string): StreamingEditState | null {
		return this.activeEdits.get(editId) || null
	}

	/**
	 * 获取文件的活动编辑
	 */
	getActiveEditForFile(filePath: string): { editId: string; state: StreamingEditState } | null {
		for (const [editId, state] of this.activeEdits) {
			if (state.filePath === filePath && !state.isComplete) {
				return { editId, state }
			}
		}
		return null
	}

	/**
	 * 订阅编辑更新
	 */
	subscribe(editId: string, listener: StreamingEditListener): () => void {
		const listeners = this.listeners.get(editId)
		if (!listeners) {
			throw new Error(`Edit not found: ${editId}`)
		}

		listeners.add(listener)

		// 立即发送当前状态
		const state = this.activeEdits.get(editId)
		if (state) {
			listener(state)
		}

		return () => {
			listeners.delete(listener)
		}
	}

	/**
	 * 通知监听器
	 */
	private notifyListeners(editId: string, state: StreamingEditState): void {
		const listeners = this.listeners.get(editId)
		if (!listeners) return

		for (const listener of listeners) {
			try {
				listener(state)
			} catch (e) {
				logger.agent.error('Streaming edit listener error:', e)
			}
		}
	}

	/**
	 * 清理已完成的编辑（内存管理）
	 */
	cleanup(maxAge: number = 60000): void {
		const now = Date.now()

		for (const [editId, state] of this.activeEdits) {
			if (state.isComplete && now - state.startTime > maxAge) {
				this.activeEdits.delete(editId)
				this.listeners.delete(editId)
			}
		}
	}

	/**
	 * 获取所有活动编辑
	 */
	getAllActiveEdits(): Map<string, StreamingEditState> {
		return new Map(
			Array.from(this.activeEdits).filter(([, state]) => !state.isComplete)
		)
	}

	/**
	 * 清除所有编辑
	 */
	clearAll(): void {
		this.activeEdits.clear()
		this.listeners.clear()
	}
}

// 单例导出
export const streamingEditService = new StreamingEditService()

// 定期清理
setInterval(() => {
	streamingEditService.cleanup()
}, 30000)
