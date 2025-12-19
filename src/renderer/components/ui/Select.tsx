import React, { useState, useRef, useEffect } from 'react'
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
}

export function Select({ options, value, onChange, placeholder = 'Select...', className = '', disabled = false }: SelectProps) {
    const [isOpen, setIsOpen] = useState(false)
    const containerRef = useRef<HTMLDivElement>(null)

    const selectedOption = options.find(opt => opt.value === value)

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false)
            }
        }

        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const handleSelect = (optionValue: string) => {
        onChange(optionValue)
        setIsOpen(false)
    }

    return (
        <div ref={containerRef} className={`relative ${className}`}>
            <button
                type="button"
                onClick={() => !disabled && setIsOpen(!isOpen)}
                disabled={disabled}
                className={`
                    w-full flex items-center justify-between px-3 py-1.5 text-sm 
                    bg-surface-active/50 border border-white/10 rounded-md 
                    hover:bg-surface-hover hover:border-white/20 transition-all
                    focus:outline-none focus:ring-2 focus:ring-accent/50
                    ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                `}
            >
                <div className="flex items-center gap-2 truncate">
                    {selectedOption?.icon && <span className="flex-shrink-0">{selectedOption.icon}</span>}
                    <span className={selectedOption ? 'text-text-primary' : 'text-text-muted'}>
                        {selectedOption ? selectedOption.label : placeholder}
                    </span>
                </div>
                <ChevronDown className={`w-4 h-4 text-text-muted transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute z-50 w-full mt-1 py-1 bg-surface border border-border-subtle rounded-md shadow-xl animate-fade-in max-h-60 overflow-auto custom-scrollbar">
                    {options.map((option) => (
                        <button
                            key={option.value}
                            onClick={() => handleSelect(option.value)}
                            className={`
                                w-full flex items-center justify-between px-3 py-1.5 text-sm text-left
                                hover:bg-surface-hover transition-colors
                                ${option.value === value ? 'text-accent bg-accent/5' : 'text-text-secondary'}
                            `}
                        >
                            <div className="flex items-center gap-2 truncate">
                                {option.icon && <span className="flex-shrink-0 w-4 h-4">{option.icon}</span>}
                                <span>{option.label}</span>
                            </div>
                            {option.value === value && <Check className="w-3.5 h-3.5" />}
                        </button>
                    ))}
                    {options.length === 0 && (
                        <div className="px-3 py-2 text-xs text-text-muted text-center">No options</div>
                    )}
                </div>
            )}
        </div>
    )
}
