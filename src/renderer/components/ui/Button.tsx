import React, { ButtonHTMLAttributes, forwardRef } from 'react'
import { Loader2 } from 'lucide-react'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'ghost' | 'icon' | 'danger' | 'success' | 'outline'
    size?: 'sm' | 'md' | 'lg' | 'icon'
    isLoading?: boolean
    leftIcon?: React.ReactNode
    rightIcon?: React.ReactNode
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className = '', variant = 'primary', size = 'md', isLoading, leftIcon, rightIcon, children, disabled, ...props }, ref) => {

        const baseStyles = "inline-flex items-center justify-center rounded-md font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 disabled:pointer-events-none disabled:opacity-50 select-none active:scale-95"

        const variants = {
            primary: "bg-accent text-accent-foreground hover:bg-accent/90 shadow-glow hover:shadow-glow-lg",
            secondary: "bg-surface-active text-text-primary hover:bg-surface-hover border border-white/10 hover:border-white/20",
            ghost: "hover:bg-white/10 text-text-secondary hover:text-text-primary",
            icon: "hover:bg-white/10 text-text-muted hover:text-text-primary rounded-md",
            danger: "bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-500/20",
            success: "bg-green-500/10 text-green-500 hover:bg-green-500/20 border border-green-500/20",
            outline: "border border-border text-text-primary hover:bg-surface-hover"
        }

        const sizes = {
            sm: "h-8 px-3 text-xs",
            md: "h-9 px-4 py-2 text-sm",
            lg: "h-11 px-8 text-base",
            icon: "h-9 w-9 p-0"
        }

        const variantStyles = variants[variant]
        const sizeStyles = sizes[size]

        return (
            <button
                ref={ref}
                className={`${baseStyles} ${variantStyles} ${sizeStyles} ${className}`}
                disabled={disabled || isLoading}
                {...props}
            >
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {!isLoading && leftIcon && <span className="mr-2">{leftIcon}</span>}
                {children}
                {!isLoading && rightIcon && <span className="ml-2">{rightIcon}</span>}
            </button>
        )
    }
)

Button.displayName = "Button"
