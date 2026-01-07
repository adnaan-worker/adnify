import React, { InputHTMLAttributes, forwardRef } from 'react'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
    leftIcon?: React.ReactNode
    rightIcon?: React.ReactNode
    error?: boolean
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
    ({ className = '', leftIcon, rightIcon, error, ...props }, ref) => {
        return (
            <div className="relative flex items-center w-full group">
                {leftIcon && (
                    <div className="absolute left-3 text-text-muted pointer-events-none flex items-center justify-center transition-colors group-focus-within:text-accent">
                        {leftIcon}
                    </div>
                )}
                <input
                    ref={ref}
                    className={`
            flex h-10 w-full rounded-xl border bg-surface/30 backdrop-blur-sm px-4 py-2 text-sm text-text-primary placeholder:text-text-muted/40
            transition-all duration-200
            hover:bg-surface/50 hover:border-white/20
            focus:outline-none focus:bg-surface/60 focus:ring-2 focus:ring-accent/20 focus:border-accent/50 focus:shadow-[0_0_15px_-3px_rgba(var(--accent)/0.1)]
            disabled:cursor-not-allowed disabled:opacity-50
            ${error ? 'border-red-500/50 focus:ring-red-500/20 focus:border-red-500' : 'border-white/10'}
            ${leftIcon ? 'pl-10' : ''}
            ${rightIcon ? 'pr-10' : ''}
            ${className}
          `}
                    {...props}
                />
                {rightIcon && (
                    <div className="absolute right-3 text-text-muted flex items-center justify-center">
                        {rightIcon}
                    </div>
                )}
            </div>
        )
    }
)

Input.displayName = "Input"