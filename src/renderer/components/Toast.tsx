/**
 * 全局 Toast 通知组件
 * 支持 success、error、warning、info 四种类型
 */

import { useState, useCallback, createContext, useContext, ReactNode } from 'react'
import { Toast, ToastType } from './ui/Toast'

export interface ToastMessage {
  id: string
  type: ToastType
  title: string
  message?: string
  duration?: number // 毫秒，0 表示不自动关闭
  action?: {
    label: string
    onClick: () => void
  }
}

interface ToastContextType {
  toasts: ToastMessage[]
  addToast: (toast: Omit<ToastMessage, 'id'>) => string
  removeToast: (id: string) => void
  success: (title: string, message?: string) => string
  error: (title: string, message?: string) => string
  warning: (title: string, message?: string) => string
  info: (title: string, message?: string) => string
}

const ToastContext = createContext<ToastContextType | null>(null)

// Toast 容器组件
function ToastContainer({ toasts, removeToast }: { toasts: ToastMessage[]; removeToast: (id: string) => void }) {
  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <Toast
            id={toast.id}
            type={toast.type}
            title={toast.title}
            message={toast.message}
            duration={toast.duration}
            action={toast.action}
            onDismiss={removeToast}
          />
        </div>
      ))}
    </div>
  )
}

// Toast Provider
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  const addToast = useCallback((toast: Omit<ToastMessage, 'id'>) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`
    setToasts((prev) => [...prev, { ...toast, id }])
    return id
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const success = useCallback((title: string, message?: string) => {
    return addToast({ type: 'success', title, message })
  }, [addToast])

  const error = useCallback((title: string, message?: string) => {
    return addToast({ type: 'error', title, message })
  }, [addToast])

  const warning = useCallback((title: string, message?: string) => {
    return addToast({ type: 'warning', title, message })
  }, [addToast])

  const info = useCallback((title: string, message?: string) => {
    return addToast({ type: 'info', title, message })
  }, [addToast])

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast, success, error, warning, info }}>
      {children}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </ToastContext.Provider>
  )
}

// Hook
export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}

// 全局 toast 实例（用于非组件环境）
let globalToast: ToastContextType | null = null

export function setGlobalToast(toast: ToastContextType) {
  globalToast = toast
}

export const toast = {
  success: (title: string, message?: string) => globalToast?.success(title, message),
  error: (title: string, message?: string) => globalToast?.error(title, message),
  warning: (title: string, message?: string) => globalToast?.warning(title, message),
  info: (title: string, message?: string) => globalToast?.info(title, message),
  add: (t: Omit<ToastMessage, 'id'>) => globalToast?.addToast(t),
  remove: (id: string) => globalToast?.removeToast(id),
}
