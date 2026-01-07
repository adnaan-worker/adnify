import React, { ButtonHTMLAttributes, forwardRef } from 'react'
import { Loader2 } from 'lucide-react'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'ghost' | 'icon' | 'danger' | 'success' | 'outline'
    size?: 'sm' | 'md' | 'lg' | 'icon'
    isLoading?: boolean
    leftIcon?: React.ReactNode
    rightIcon?: React.ReactNode
    glow?: boolean // 强制开启微光效果
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className = '', variant = 'primary', size = 'md', isLoading, leftIcon, rightIcon, children, disabled, glow, ...props }, ref) => {

        // Base: 增加 tracking-wide, 更大的圆角 rounded-xl, 相对定位用于流光
        const baseStyles = "relative inline-flex items-center justify-center rounded-xl font-medium transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 disabled:pointer-events-none disabled:opacity-50 select-none active:scale-[0.98] overflow-hidden group"

        const variants = {
            // Primary: 仿 Composer Generate 按钮，带有流光和渐变
            primary: `
                bg-accent text-white border border-white/10
                shadow-[0_0_20px_-5px_rgba(var(--accent)/0.5)]
                hover:shadow-[0_0_25px_-5px_rgba(var(--accent)/0.6)]
                hover:bg-accent-hover
                before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-white/20 before:to-transparent
                before:translate-x-[-200%] hover:before:translate-x-[200%] before:transition-transform before:duration-[1s] before:ease-in-out
            `,
            // Secondary: 玻璃质感，半透明背景
            secondary: "bg-surface/50 backdrop-blur-md text-text-primary border border-border/50 hover:bg-surface-hover hover:border-accent/30 shadow-sm",
            
            // Ghost: 极简，Hover 时显示背景
            ghost: "text-text-secondary hover:text-text-primary hover:bg-white/5 data-[state=open]:bg-white/5",
            
            // Icon: 专门为图标优化
            icon: "text-text-muted hover:text-text-primary hover:bg-white/5 rounded-lg aspect-square",
            
            // Danger: 红色微光
            danger: "bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500/20 hover:border-red-500/30 hover:shadow-[0_0_15px_-3px_rgba(239,68,68,0.2)]",
            
            // Success: 绿色微光
            success: "bg-green-500/10 text-green-500 border border-green-500/20 hover:bg-green-500/20 hover:border-green-500/30 hover:shadow-[0_0_15px_-3px_rgba(34,197,94,0.2)]",
            
            // Outline: 细边框，适合次要操作
            outline: "border border-border text-text-primary bg-transparent hover:bg-surface/50 hover:border-text-muted/50"
        }

        const sizes = {
            sm: "h-7 px-3 text-xs gap-1.5",
            md: "h-9 px-4 py-2 text-sm gap-2",
            lg: "h-11 px-6 text-base gap-2.5",
            icon: "h-9 w-9 p-0 flex items-center justify-center" // 确保图标居中
        }

        const variantStyles = variants[variant]
        const sizeStyles = sizes[size]

        // 额外的微光层（如果 variant 是 primary 或 glow=true）
        const showGlow = glow || variant === 'primary';

        return (
            <button
                ref={ref}
                className={`${baseStyles} ${variantStyles} ${sizeStyles} ${className}`}
                disabled={disabled || isLoading}
                {...props}
            >
                {/* 内部高光边框 (Inner highlight) */}
                <div className="absolute inset-0 rounded-xl border border-white/5 pointer-events-none" />
                
                {isLoading && <Loader2 className="animate-spin" size={size === 'sm' ? 12 : 16} />}
                
                {!isLoading && leftIcon && <span className="flex-shrink-0">{leftIcon}</span>}
                <span className="relative z-10 flex items-center gap-2">{children}</span>
                {!isLoading && rightIcon && <span className="flex-shrink-0">{rightIcon}</span>}
            </button>
        )
    }
)

Button.displayName = "Button"