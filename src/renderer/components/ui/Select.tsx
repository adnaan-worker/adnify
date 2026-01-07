import React, { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, Check } from 'lucide-react'

export interface SelectOption {
    value: string
    label: string
    icon?: React.ReactNode
}

interface SelectProps {
    options: SelectOption[]
    value: string
    onChange: (value: string) => void
    placeholder?: string
    className?: string
    disabled?: boolean
    dropdownPosition?: 'top' | 'bottom' | 'auto'
}

export function Select({
    options,
    value,
    onChange,
    placeholder = 'Select...',
    className = '',
    disabled = false,
    dropdownPosition = 'auto'
}: SelectProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({})
    const containerRef = useRef<HTMLDivElement>(null)
    const dropdownRef = useRef<HTMLDivElement>(null)

    const selectedOption = options.find(opt => opt.value === value)

    useEffect(() => {
        if (isOpen && containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect()
            const spaceBelow = window.innerHeight - rect.bottom
            const spaceAbove = rect.top
            const shouldShowAbove = dropdownPosition === 'top' || 
                (dropdownPosition === 'auto' && spaceBelow < 250 && spaceAbove > spaceBelow)
            
            setDropdownStyle({
                position: 'fixed',
                left: rect.left,
                width: rect.width,
                zIndex: 9999,
                ...(shouldShowAbove 
                    ? { bottom: window.innerHeight - rect.top + 6 }
                    : { top: rect.bottom + 6 }
                ),
            })
        }
    }, [isOpen, dropdownPosition])

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node) &&
                dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false)
            }
        }
        if (isOpen) document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [isOpen])

    const dropdown = isOpen && (
        <div
            ref={dropdownRef}
            style={dropdownStyle}
            className="p-1.5 bg-background/95 backdrop-blur-2xl border border-border rounded-xl shadow-2xl animate-scale-in max-h-64 overflow-auto custom-scrollbar flex flex-col gap-0.5"
        >
            {options.map((option) => (
                <button
                    key={option.value}
                    onClick={() => { onChange(option.value); setIsOpen(false); }}
                    className={`
                        w-full flex items-center justify-between px-3 py-2 text-sm text-left rounded-lg transition-all duration-200
                        ${option.value === value 
                            ? 'text-accent bg-accent/10 font-bold' 
                            : 'text-text-secondary hover:bg-white/5 hover:text-text-primary'
                        }
                    `}
                >
                    <div className="flex items-center gap-2.5 truncate">
                        {option.icon && <span className="flex-shrink-0 w-4 h-4 opacity-70">{option.icon}</span>}
                        <span>{option.label}</span>
                    </div>
                    {option.value === value && <Check className="w-3.5 h-3.5" strokeWidth={2} />}
                </button>
            ))}
        </div>
    )

    return (
        <div ref={containerRef} className={`relative ${className}`}>
            <button
                type="button"
                onClick={() => !disabled && setIsOpen(!isOpen)}
                disabled={disabled}
                className={`
                    w-full flex items-center justify-between px-3 h-9 text-sm 
                    rounded-lg border shadow-sm transition-all duration-200
                    bg-black/20 border-white/10
                    hover:bg-black/30 hover:border-white/20
                    focus:outline-none
                    ${isOpen ? 'border-accent/50 ring-2 ring-accent/10 bg-black/40' : ''}
                    ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                `}
            >
                <div className="flex items-center gap-2 truncate">
                    {selectedOption?.icon && <span className="flex-shrink-0 w-4 h-4 text-text-muted">{selectedOption.icon}</span>}
                    <span className={`truncate ${selectedOption ? 'text-text-primary' : 'text-text-muted'}`}>
                        {selectedOption ? selectedOption.label : placeholder}
                    </span>
                </div>
                <ChevronDown className={`w-4 h-4 text-text-muted/70 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {createPortal(dropdown, document.body)}
        </div>
    )
}
