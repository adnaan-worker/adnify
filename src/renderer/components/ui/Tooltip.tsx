import React, { useState, useRef, useEffect } from 'react'

interface TooltipProps {
    content: React.ReactNode
    children: React.ReactNode
    side?: 'top' | 'bottom' | 'left' | 'right'
    delay?: number
    className?: string
}

export function Tooltip({ content, children, side = 'top', delay = 300, className = '' }: TooltipProps) {
    const [isVisible, setIsVisible] = useState(false)
    const [position, setPosition] = useState({ top: 0, left: 0 })
    const triggerRef = useRef<HTMLDivElement>(null)
    const tooltipRef = useRef<HTMLDivElement>(null)
    const timeoutRef = useRef<NodeJS.Timeout | null>(null)

    const show = () => {
        timeoutRef.current = setTimeout(() => {
            setIsVisible(true)
            updatePosition()
        }, delay)
    }

    const hide = () => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current)
        }
        setIsVisible(false)
    }

    const updatePosition = () => {
        if (!triggerRef.current) return

        const triggerRect = triggerRef.current.getBoundingClientRect()
        const tooltipRect = tooltipRef.current?.getBoundingClientRect() || { width: 0, height: 0 }

        // Default offset
        const offset = 8

        let top = 0
        let left = 0

        switch (side) {
            case 'top':
                top = triggerRect.top - tooltipRect.height - offset
                left = triggerRect.left + (triggerRect.width - tooltipRect.width) / 2
                break
            case 'bottom':
                top = triggerRect.bottom + offset
                left = triggerRect.left + (triggerRect.width - tooltipRect.width) / 2
                break
            case 'left':
                top = triggerRect.top + (triggerRect.height - tooltipRect.height) / 2
                left = triggerRect.left - tooltipRect.width - offset
                break
            case 'right':
                top = triggerRect.top + (triggerRect.height - tooltipRect.height) / 2
                left = triggerRect.right + offset
                break
        }

        setPosition({ top, left })
    }

    useEffect(() => {
        if (isVisible) {
            updatePosition()
            window.addEventListener('resize', updatePosition)
            window.addEventListener('scroll', updatePosition)
        }
        return () => {
            window.removeEventListener('resize', updatePosition)
            window.removeEventListener('scroll', updatePosition)
        }
    }, [isVisible])

    return (
        <div
            ref={triggerRef}
            onMouseEnter={show}
            onMouseLeave={hide}
            className={`relative inline-block ${className}`}
        >
            {children}
            {isVisible && (
                <div
                    ref={tooltipRef}
                    className="fixed z-50 px-2 py-1 text-xs font-medium text-text-primary bg-surface border border-border-subtle rounded shadow-xl animate-fade-in pointer-events-none whitespace-nowrap"
                    style={{ top: position.top, left: position.left }}
                >
                    {content}
                    {/* Arrow could be added here if needed */}
                </div>
            )}
        </div>
    )
}
