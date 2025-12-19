import React, { useEffect } from 'react'
import { X } from 'lucide-react'
import { createPortal } from 'react-dom'

interface ModalProps {
    isOpen: boolean
    onClose: () => void
    title?: string
    children: React.ReactNode
    size?: 'sm' | 'md' | 'lg' | 'xl'
    noPadding?: boolean
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, size = 'md', noPadding = false }) => {
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
        xl: 'max-w-xl'
    }

    return createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-fade-in">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className={`relative w-full ${sizes[size]} bg-surface border border-white/10 rounded-xl shadow-2xl shadow-black/50 overflow-hidden animate-scale-in`}>
                {title && (
                    <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-white/5">
                        <h3 className="text-lg font-semibold text-text-primary">{title}</h3>
                        <button onClick={onClose} className="p-1 rounded-md hover:bg-white/10 text-text-muted hover:text-text-primary transition-colors">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                )}
                <div className={noPadding ? '' : 'p-6'}>
                    {children}
                </div>
            </div>
        </div>,
        document.body
    )
}
