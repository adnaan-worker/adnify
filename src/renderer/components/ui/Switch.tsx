import React, { forwardRef } from 'react'

export interface SwitchProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string
}

export const Switch = forwardRef<HTMLInputElement, SwitchProps>(
    ({ className = '', label, ...props }, ref) => {
        return (
            <label className={`inline-flex items-center cursor-pointer ${className}`}>
                <input type="checkbox" className="sr-only peer" ref={ref} {...props} />
                <div className="relative w-9 h-5 bg-surface-active peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-accent/50 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-text-secondary after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-accent peer-checked:after:bg-white"></div>
                {label && <span className="ms-3 text-sm font-medium text-text-primary">{label}</span>}
            </label>
        )
    }
)

Switch.displayName = "Switch"
