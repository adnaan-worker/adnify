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
            flex h-9 w-full rounded-xl border px-3 py-1.5 text-sm text-text-primary placeholder:text-text-muted/40 shadow-sm
            transition-all duration-200
            bg-black/20 border-white/10
            hover:bg-black/30 hover:border-white/20
            focus:outline-none focus:bg-black/40 focus:border-accent/50 focus:ring-2 focus:ring-accent/10
            disabled:cursor-not-allowed disabled:opacity-50
            ${error ? 'border-red-500/50 focus:ring-red-500/20 focus:border-red-500' : ''}
            ${leftIcon ? 'pl-10' : ''}
            ${rightIcon ? 'pr-10' : ''}
            ${className}
          `}
                    {...props}
                />
                {rightIcon && (
                    <div className="absolute right-3 text-text-muted flex items-center justify-center transition-colors group-focus-within:text-accent">
                        {rightIcon}
                    </div>
                )}
            </div>
        )
    }
)

Input.displayName = "Input"
