/**
 * 错误边界组件
 * 捕获 React 组件树中的错误并显示友好的错误界面
 */

import { logger } from '@utils/Logger'
import { Component, ReactNode } from 'react'
import { AlertTriangle, RefreshCw, Bug } from 'lucide-react'

interface Props {
	children: ReactNode
	fallback?: ReactNode
}

interface State {
	hasError: boolean
	error: Error | null
	errorInfo: React.ErrorInfo | null
}

export class ErrorBoundary extends Component<Props, State> {
	constructor(props: Props) {
		super(props)
		this.state = { hasError: false, error: null, errorInfo: null }
	}

	static getDerivedStateFromError(error: Error): Partial<State> {
		return { hasError: true, error }
	}

	componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
		logger.ui.error('ErrorBoundary caught an error:', error, errorInfo)
		this.setState({ errorInfo })
	}

	handleReset = () => {
		this.setState({ hasError: false, error: null, errorInfo: null })
	}

	render() {
		if (this.state.hasError) {
			if (this.props.fallback) {
				return this.props.fallback
			}

			return (
				<div className="flex flex-col items-center justify-center h-full p-8 bg-background">
					<div className="max-w-md w-full bg-surface border border-border-subtle rounded-xl p-6 shadow-lg">
						<div className="flex items-center gap-3 mb-4">
							<div className="p-2 rounded-lg bg-status-error/10">
								<AlertTriangle className="w-6 h-6 text-status-error" />
							</div>
							<div>
								<h2 className="text-lg font-semibold text-text-primary">Something went wrong</h2>
								<p className="text-sm text-text-muted">An unexpected error occurred</p>
							</div>
						</div>

						{this.state.error && (
							<div className="mb-4 p-3 bg-background rounded-lg border border-border-subtle">
								<p className="text-sm font-mono text-status-error break-all">
									{this.state.error.message}
								</p>
							</div>
						)}

						<div className="flex gap-2">
							<button
								onClick={this.handleReset}
								className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-accent text-white hover:bg-accent-hover transition-colors"
							>
								<RefreshCw className="w-4 h-4" />
								Try Again
							</button>
							<button
								onClick={() => window.location.reload()}
								className="px-4 py-2 rounded-lg bg-surface-hover text-text-primary hover:bg-surface-active transition-colors"
							>
								Reload
							</button>
						</div>

						{this.state.errorInfo && (
							<details className="mt-4">
								<summary className="text-xs text-text-muted cursor-pointer hover:text-text-secondary flex items-center gap-1">
									<Bug className="w-3 h-3" />
									Technical Details
								</summary>
								<pre className="mt-2 p-2 bg-background rounded text-[10px] font-mono text-text-muted overflow-auto max-h-32">
									{this.state.errorInfo.componentStack}
								</pre>
							</details>
						)}
					</div>
				</div>
			)
		}

		return this.props.children
	}
}

/**
 * 错误提示组件
 * 用于显示非致命错误
 */
export function ErrorAlert({
	message,
	details,
	onRetry,
	onDismiss,
}: {
	message: string
	details?: string
	onRetry?: () => void
	onDismiss?: () => void
}) {
	return (
		<div className="p-4 bg-status-error/10 border border-status-error/20 rounded-lg animate-fade-in">
			<div className="flex items-start gap-3">
				<AlertTriangle className="w-5 h-5 text-status-error flex-shrink-0 mt-0.5" />
				<div className="flex-1 min-w-0">
					<p className="text-sm font-medium text-status-error">{message}</p>
					{details && (
						<p className="mt-1 text-xs text-text-muted">{details}</p>
					)}
					{(onRetry || onDismiss) && (
						<div className="flex gap-2 mt-3">
							{onRetry && (
								<button
									onClick={onRetry}
									className="px-3 py-1 text-xs rounded bg-status-error/20 text-status-error hover:bg-status-error/30 transition-colors"
								>
									Retry
								</button>
							)}
							{onDismiss && (
								<button
									onClick={onDismiss}
									className="px-3 py-1 text-xs rounded bg-surface text-text-muted hover:text-text-primary transition-colors"
								>
									Dismiss
								</button>
							)}
						</div>
					)}
				</div>
			</div>
		</div>
	)
}

/**
 * 加载状态组件
 */
export function LoadingSpinner({ size = 'md', text }: { size?: 'sm' | 'md' | 'lg'; text?: string }) {
	const sizeClasses = {
		sm: 'w-4 h-4 border-2',
		md: 'w-6 h-6 border-2',
		lg: 'w-8 h-8 border-3',
	}

	return (
		<div className="flex flex-col items-center justify-center gap-2">
			<div className={`${sizeClasses[size]} border-accent border-t-transparent rounded-full animate-spin`} />
			{text && <span className="text-sm text-text-muted">{text}</span>}
		</div>
	)
}
