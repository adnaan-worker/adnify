import React, { InputHTMLAttributes, forwardRef } from 'react'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
    leftIcon?: React.ReactNode
    rightIcon?: React.ReactNode
    error?: boolean
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
    ({ className = '', leftIcon, rightIcon, error, ...props }, ref) => {
        return (
            <div className="relative flex items-center w-full">
                {leftIcon && (
                    <div className="absolute left-3 text-text-muted pointer-events-none flex items-center justify-center">
                        {leftIcon}
                    </div>
                )}
                <input
                    ref={ref}
                    className={`
            flex h-9 w-full rounded-md border bg-surface/50 px-3 py-1 text-sm text-text-primary placeholder:text-text-muted/50
            focus:outline-none focus:ring-1 focus:ring-accent/50 focus:border-accent/50 transition-all
            disabled:cursor-not-allowed disabled:opacity-50
            ${error ? 'border-red-500 focus:ring-red-500/50' : 'border-white/10'}
            ${leftIcon ? 'pl-9' : ''}
            ${rightIcon ? 'pr-9' : ''}
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
