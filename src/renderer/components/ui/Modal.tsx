import React, { useEffect } from 'react'
import { X } from 'lucide-react'
import { createPortal } from 'react-dom'

interface ModalProps {
    isOpen: boolean
    onClose: () => void
    title?: string
    children: React.ReactNode
    size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | 'full'
    noPadding?: boolean
    className?: string
    showCloseButton?: boolean
}

export const Modal: React.FC<ModalProps> = ({ 
    isOpen, onClose, title, children, size = 'md', noPadding = false, className = '', showCloseButton = true
}) => {
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose()
        }
        if (isOpen) {
            document.addEventListener('keydown', handleEscape)
            document.body.style.overflow = 'hidden'
        }
        return () => {
            document.removeEventListener('keydown', handleEscape)
            document.body.style.overflow = 'unset'
        }
    }, [isOpen, onClose])

    if (!isOpen) return null

    const sizes = {
        sm: 'max-w-sm',
        md: 'max-w-md',
        lg: 'max-w-lg',
        xl: 'max-w-xl',
        '2xl': 'max-w-2xl',
        '3xl': 'max-w-3xl',
        '4xl': 'max-w-4xl',
        '5xl': 'max-w-5xl',
        'full': 'max-w-full mx-4 h-[90vh]'
    }

    return createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={onClose} />
            
            <div className={`
                relative w-full ${sizes[size]} 
                bg-background/80 backdrop-blur-2xl 
                border border-border 
                rounded-3xl shadow-2xl shadow-black/50 
                overflow-hidden animate-scale-in 
                flex flex-col ${className}
            `}>
                <div className="absolute inset-0 pointer-events-none overflow-hidden select-none">
                    <div className="absolute top-[-20%] right-[-10%] w-[50%] h-[50%] bg-accent/5 rounded-full blur-[100px]" />
                    <div className="absolute bottom-[-20%] left-[-10%] w-[40%] h-[40%] bg-blue-500/5 rounded-full blur-[80px]" />
                </div>

                {title && (
                    <div className="relative flex items-center justify-between px-6 py-5 border-b border-border bg-white/[0.02] z-10 shrink-0">
                        <h3 className="text-lg font-bold text-text-primary tracking-tight">{title}</h3>
                        {showCloseButton && (
                            <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/5 text-text-muted hover:text-text-primary transition-all duration-200 group">
                                <X className="w-5 h-5 group-hover:rotate-90 transition-transform duration-300" />
                            </button>
                        )}
                    </div>
                )}

                <div className={`relative z-10 custom-scrollbar ${noPadding ? '' : 'p-6'} flex-1 overflow-auto`}>
                    {children}
                </div>
            </div>
        </div>,
        document.body
    )
}
