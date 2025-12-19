import React, { forwardRef } from 'react'
import { Check } from 'lucide-react'

export interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
    ({ className = '', label, ...props }, ref) => {
        return (
            <label className={`inline-flex items-center cursor-pointer group ${className}`}>
                <div className="relative flex items-center">
                    <input type="checkbox" className="peer sr-only" ref={ref} {...props} />
                    <div className="w-4 h-4 border border-white/20 rounded bg-surface/50 peer-checked:bg-accent peer-checked:border-accent transition-all peer-focus:ring-2 peer-focus:ring-accent/50">
                        <Check className="w-3 h-3 text-white absolute top-0.5 left-0.5 opacity-0 peer-checked:opacity-100 transition-opacity" />
                    </div>
                </div>
                {label && <span className="ml-2 text-sm text-text-secondary group-hover:text-text-primary transition-colors select-none">{label}</span>}
            </label>
        )
    }
)

Checkbox.displayName = "Checkbox"
