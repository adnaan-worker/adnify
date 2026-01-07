/**
 * 内嵌式 Toast 通知
 * 显示在底部状态栏上方，更加灵动简洁
 * 
 * 升级版：胶囊设计、超强模糊、细腻光影
 */

import { useState, useCallback, createContext, useContext, ReactNode, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react'

export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface ToastMessage {
  id: string
  type: ToastType
  message: string
  duration?: number
}

interface ToastContextType {
  toasts: ToastMessage[]
  addToast: (type: ToastType, message: string, durationOrDetail?: number | string) => string
  removeToast: (id: string) => void
  success: (message: string, durationOrDetail?: number | string) => string
  error: (message: string, durationOrDetail?: number | string) => string
  warning: (message: string, durationOrDetail?: number | string) => string
  info: (message: string, durationOrDetail?: number | string) => string
}

const ToastContext = createContext<ToastContextType | null>(null)

const TOAST_CONFIG = {
  success: {
    icon: CheckCircle2,
    bg: 'bg-background/80',
    border: 'border-green-500/30',
    text: 'text-green-400',
    glow: 'shadow-[0_8px_32px_-12px_rgba(34,197,94,0.3)]'
  },
  error: {
    icon: XCircle,
    bg: 'bg-background/80',
    border: 'border-red-500/30',
    text: 'text-red-400',
    glow: 'shadow-[0_8px_32px_-12px_rgba(239,68,68,0.3)]'
  },
  warning: {
    icon: AlertTriangle,
    bg: 'bg-background/80',
    border: 'border-yellow-500/30',
    text: 'text-yellow-400',
    glow: 'shadow-[0_8px_32px_-12px_rgba(234,179,8,0.3)]'
  },
  info: {
    icon: Info,
    bg: 'bg-background/80',
    border: 'border-blue-500/30',
    text: 'text-blue-400',
    glow: 'shadow-[0_8px_32_px_-12px_rgba(59,130,246,0.3)]'
  }
}

// 单个 Toast 项
function ToastItem({ toast, onDismiss }: { toast: ToastMessage; onDismiss: (id: string) => void }) {
  const config = TOAST_CONFIG[toast.type]
  const Icon = config.icon

  useEffect(() => {
    if (toast.duration === 0) return
    const timer = setTimeout(() => onDismiss(toast.id), toast.duration || 3000)
    return () => clearTimeout(timer)
  }, [toast.id, toast.duration, onDismiss])

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 30, scale: 0.8, filter: 'blur(10px)' }}
      animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
      exit={{ opacity: 0, y: -20, scale: 0.9, transition: { duration: 0.2 } }}
      transition={{ 
        type: 'spring', 
        stiffness: 400, 
        damping: 30,
        mass: 0.8
      }}
      className={`
        flex items-center gap-3 px-5 py-2.5 rounded-full border backdrop-blur-2xl
        ${config.bg} ${config.border} ${config.glow} pointer-events-auto
        group relative overflow-hidden
      `}
    >
      {/* Subtle background shimmer */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
      
      <Icon className={`w-4 h-4 ${config.text} shrink-0 relative z-10`} strokeWidth={2.5} />
      <span className="text-sm text-text-primary font-bold truncate max-w-[400px] relative z-10 tracking-tight">
        {toast.message}
      </span>
      <button
        onClick={() => onDismiss(toast.id)}
        className="p-1 hover:bg-white/10 rounded-full transition-all duration-200 shrink-0 relative z-10 active:scale-90"
      >
        <X className="w-3.5 h-3.5 text-text-muted hover:text-text-primary" />
      </button>
    </motion.div>
  )
}

// Toast 容器 - 显示在底部状态栏上方
function ToastContainer({ toasts, removeToast }: { toasts: ToastMessage[]; removeToast: (id: string) => void }) {
  return (
    <div className="fixed bottom-12 left-1/2 -translate-x-1/2 z-[9999] flex flex-col items-center gap-2.5 pointer-events-none">
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <div key={toast.id}>
            <ToastItem toast={toast} removeToast={removeToast} onDismiss={removeToast} />
          </div>
        ))}
      </AnimatePresence>
    </div>
  )
}

// Provider
export function InlineToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  const addToast = useCallback((type: ToastType, message: string, durationOrDetail?: number | string) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`
    let finalMessage = message
    let duration = 3000
    if (typeof durationOrDetail === 'string' && durationOrDetail) {
      finalMessage = `${message}: ${durationOrDetail}`
    } else if (typeof durationOrDetail === 'number') {
      duration = durationOrDetail
    }
    setToasts((prev) => {
      // 限制最多显示 5 个
      const newToasts = prev.length >= 5 ? prev.slice(1) : prev
      return [...newToasts, { id, type, message: finalMessage, duration }]
    })
    return id
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const success = useCallback((message: string, durationOrDetail?: number | string) => addToast('success', message, durationOrDetail), [addToast])
  const error = useCallback((message: string, durationOrDetail?: number | string) => addToast('error', message, durationOrDetail), [addToast])
  const warning = useCallback((message: string, durationOrDetail?: number | string) => addToast('warning', message, durationOrDetail), [addToast])
  const info = useCallback((message: string, durationOrDetail?: number | string) => addToast('info', message, durationOrDetail), [addToast])

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast, success, error, warning, info }}>
      {children}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </ToastContext.Provider>
  )
}

// Hook
export function useInlineToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useInlineToast must be used within InlineToastProvider')
  }
  return context
}

// 全局实例
let globalToast: ToastContextType | null = null

export function setGlobalInlineToast(toast: ToastContextType) {
  globalToast = toast
}

export const toast = {
  success: (message: string, durationOrDetail?: number | string) => globalToast?.success(message, durationOrDetail),
  error: (message: string, durationOrDetail?: number | string) => globalToast?.error(message, durationOrDetail),
  warning: (message: string, durationOrDetail?: number | string) => globalToast?.warning(message, durationOrDetail),
  info: (message: string, durationOrDetail?: number | string) => globalToast?.info(message, durationOrDetail),
}