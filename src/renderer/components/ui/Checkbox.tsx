import React, { forwardRef } from 'react'
import { Check } from 'lucide-react'

export interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
    ({ className = '', label, ...props }, ref) => {
        return (
            <label className={`inline-flex items-center cursor-pointer group select-none ${className}`}>
                <div className="relative flex items-center justify-center">
                    <input type="checkbox" className="peer sr-only" ref={ref} {...props} />
                    {/* Background & Border */}
                    <div className="
                        w-5 h-5 rounded-lg border border-white/20 bg-surface/30 backdrop-blur-sm
                        transition-all duration-300 ease-out
                        group-hover:border-accent/50 group-hover:bg-surface/50
                        peer-focus-visible:ring-2 peer-focus-visible:ring-accent/50
                        peer-checked:bg-accent peer-checked:border-accent peer-checked:shadow-[0_0_10px_rgba(var(--accent)/0.4)]
                        peer-disabled:opacity-50 peer-disabled:cursor-not-allowed
                    " />
                    
                    {/* Check Icon with Scale Animation */}
                    <Check 
                        className="
                            w-3.5 h-3.5 text-white absolute pointer-events-none
                            opacity-0 scale-50 peer-checked:opacity-100 peer-checked:scale-100
                            transition-all duration-200 ease-spring
                        " 
                        strokeWidth={3}
                    />
                </div>
                {label && (
                    <span className="ml-2.5 text-sm font-medium text-text-muted group-hover:text-text-primary transition-colors duration-200">
                        {label}
                    </span>
                )}
            </label>
        )
    }
)

Checkbox.displayName = "Checkbox"