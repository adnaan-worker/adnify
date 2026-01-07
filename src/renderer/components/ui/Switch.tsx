import React, { forwardRef } from 'react'

export interface SwitchProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string
}

export const Switch = forwardRef<HTMLInputElement, SwitchProps>(
    ({ className = '', label, ...props }, ref) => {
        return (
            <label className={`inline-flex items-center cursor-pointer group select-none ${className}`}>
                <div className="relative">
                    <input type="checkbox" className="sr-only peer" ref={ref} {...props} />
                    {/* Track */}
                    <div className="
                        w-11 h-6 rounded-full 
                        bg-surface/30 border border-white/10 backdrop-blur-sm
                        peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-accent/50 
                        peer-checked:bg-accent peer-checked:border-accent
                        transition-all duration-300 ease-in-out
                        group-hover:border-white/20
                    "></div>
                    
                    {/* Thumb with Glow */}
                    <div className="
                        absolute top-0.5 left-0.5 
                        bg-white w-5 h-5 rounded-full shadow-md
                        transition-all duration-300 ease-[cubic-bezier(0.175,0.885,0.32,1.275)]
                        peer-checked:translate-x-5
                        group-hover:scale-95 peer-checked:group-hover:scale-110
                    ">
                        {/* Optional subtle inner glow for active state */}
                        <div className="absolute inset-0 rounded-full bg-accent/0 peer-checked:bg-accent/10 transition-colors" />
                    </div>
                </div>
                {label && (
                    <span className="ml-3 text-sm font-medium text-text-muted group-hover:text-text-primary transition-colors duration-200">
                        {label}
                    </span>
                )}
            </label>
        )
    }
)

Switch.displayName = "Switch"