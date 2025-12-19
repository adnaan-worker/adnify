import { useEffect, useState } from 'react'
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react'

export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface ToastProps {
    id: string
    type: ToastType
    title: string
    message?: string
    duration?: number
    onDismiss: (id: string) => void
    action?: {
        label: string
        onClick: () => void
    }
}

const TOAST_ICONS = {
    success: CheckCircle,
    error: XCircle,
    warning: AlertTriangle,
    info: Info,
}

const TOAST_STYLES = {
    success: "bg-green-500/10 border-green-500/20 text-green-500",
    error: "bg-red-500/10 border-red-500/20 text-red-500",
    warning: "bg-yellow-500/10 border-yellow-500/20 text-yellow-500",
    info: "bg-blue-500/10 border-blue-500/20 text-blue-500",
}

export function Toast({ id, type, title, message, duration = 3000, onDismiss, action }: ToastProps) {
    const [isExiting, setIsExiting] = useState(false)
    const Icon = TOAST_ICONS[type]
    const style = TOAST_STYLES[type]

    useEffect(() => {
        if (duration === 0) return
        const timer = setTimeout(() => {
            setIsExiting(true)
            setTimeout(() => onDismiss(id), 200)
        }, duration)
        return () => clearTimeout(timer)
    }, [duration, id, onDismiss])

    const handleDismiss = () => {
        setIsExiting(true)
        setTimeout(() => onDismiss(id), 200)
    }

    return (
        <div className={`
      relative flex items-start gap-3 p-4 rounded-lg border shadow-lg backdrop-blur-md transition-all duration-200
      ${style}
      ${isExiting ? 'opacity-0 translate-x-4' : 'opacity-100 translate-x-0'}
      animate-slide-in-right
    `}>
            <Icon className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
                <h4 className="text-sm font-semibold">{title}</h4>
                {message && <p className="text-xs opacity-90 mt-1 break-words">{message}</p>}
                {action && (
                    <button
                        onClick={action.onClick}
                        className="text-xs font-medium underline mt-2 hover:opacity-80"
                    >
                        {action.label}
                    </button>
                )}
            </div>
            <button onClick={handleDismiss} className="p-1 hover:bg-black/10 rounded transition-colors">
                <X className="w-4 h-4 opacity-70" />
            </button>
        </div>
    )
}
