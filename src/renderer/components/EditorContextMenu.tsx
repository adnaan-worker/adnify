/**
 * 编辑器自定义右键菜单组件
 * 完全国际化支持
 */
import { useEffect, useRef } from 'react'
import { useStore } from '@store'
import { t, TranslationKey } from '@renderer/i18n'
import type { editor } from 'monaco-editor'

interface MenuItem {
  id: string
  labelKey: TranslationKey
  shortcut?: string
  action: () => void
  divider?: boolean
}

interface EditorContextMenuProps {
  x: number
  y: number
  editor: editor.IStandaloneCodeEditor
  onClose: () => void
}

export default function EditorContextMenu({ x, y, editor, onClose }: EditorContextMenuProps) {
  const { language } = useStore()
  const menuRef = useRef<HTMLDivElement>(null)

  // 点击外部关闭菜单
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])

  // 调整菜单位置，防止超出屏幕
  useEffect(() => {
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect()
      const viewportWidth = window.innerWidth
      const viewportHeight = window.innerHeight
      
      if (x + rect.width > viewportWidth) {
        menuRef.current.style.left = `${viewportWidth - rect.width - 10}px`
      }
      if (y + rect.height > viewportHeight) {
        menuRef.current.style.top = `${viewportHeight - rect.height - 10}px`
      }
    }
  }, [x, y])

  const runAction = (actionId: string) => {
    editor.getAction(actionId)?.run()
    onClose()
  }

  const menuItems: MenuItem[] = [
    // 导航
    { id: 'goto-def', labelKey: 'ctxGotoDefinition', shortcut: 'F12', action: () => runAction('editor.action.revealDefinition') },
    { id: 'find-refs', labelKey: 'ctxFindReferences', shortcut: 'Shift+F12', action: () => runAction('editor.action.goToReferences') },
    { id: 'goto-symbol', labelKey: 'ctxGotoSymbol', shortcut: 'Ctrl+Shift+O', action: () => runAction('editor.action.quickOutline'), divider: true },
    // 编辑
    { id: 'rename', labelKey: 'ctxRename', shortcut: 'F2', action: () => runAction('editor.action.rename') },
    { id: 'change-all', labelKey: 'ctxChangeAll', shortcut: 'Ctrl+F2', action: () => runAction('editor.action.changeAll') },
    { id: 'format', labelKey: 'ctxFormat', shortcut: 'Shift+Alt+F', action: () => runAction('editor.action.formatDocument'), divider: true },
    // 剪贴板
    { id: 'cut', labelKey: 'ctxCut', shortcut: 'Ctrl+X', action: () => runAction('editor.action.clipboardCutAction') },
    { id: 'copy', labelKey: 'ctxCopy', shortcut: 'Ctrl+C', action: () => runAction('editor.action.clipboardCopyAction') },
    { id: 'paste', labelKey: 'ctxPaste', shortcut: 'Ctrl+V', action: () => runAction('editor.action.clipboardPasteAction'), divider: true },
    // 查找
    { id: 'find', labelKey: 'ctxFind', shortcut: 'Ctrl+F', action: () => runAction('actions.find') },
    { id: 'replace', labelKey: 'ctxReplace', shortcut: 'Ctrl+H', action: () => runAction('editor.action.startFindReplaceAction'), divider: true },
    // 其他
    { id: 'comment', labelKey: 'ctxToggleComment', shortcut: 'Ctrl+/', action: () => runAction('editor.action.commentLine') },
    { id: 'delete-line', labelKey: 'ctxDeleteLine', shortcut: 'Ctrl+Shift+K', action: () => runAction('editor.action.deleteLines') },
    { id: 'select-next', labelKey: 'ctxSelectNext', shortcut: 'Ctrl+D', action: () => runAction('editor.action.addSelectionToNextFindMatch') },
  ]

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-surface border border-border-subtle rounded-lg shadow-xl py-1 min-w-[220px] select-none"
      style={{ left: x, top: y }}
    >
      {menuItems.map((item, index) => (
        <div key={item.id}>
          <button
            className="w-full px-3 py-1.5 text-left text-sm text-text-primary hover:bg-surface-hover flex items-center justify-between gap-4 transition-colors"
            onClick={item.action}
          >
            <span>{t(item.labelKey, language)}</span>
            {item.shortcut && (
              <span className="text-xs text-text-muted opacity-60">{item.shortcut}</span>
            )}
          </button>
          {item.divider && index < menuItems.length - 1 && (
            <div className="my-1 border-t border-border-subtle" />
          )}
        </div>
      ))}
    </div>
  )
}
