/**
 * 对话分支辅助组件 (Branch Controls)
 * 包含 BranchSelector (头部入口) 和 MessageBranchActions (消息气泡操作)
 */

import { useState, useCallback } from 'react'
import { GitBranch, RotateCcw, ChevronDown } from 'lucide-react'
import { useAgentStore, selectBranches, selectActiveBranch, selectIsOnBranch } from '@/renderer/agent'
import { Button } from '../ui'

/**
 * 分支选择器 - 显示在聊天面板顶部左侧
 * 始终显示当前分支状态，点击展开分支管理
 */
export function BranchSelector({ 
  language = 'en',
  onClick 
}: { 
  language?: 'zh' | 'en'
  onClick?: () => void 
}) {
  const activeBranch = useAgentStore(selectActiveBranch)
  const branches = useAgentStore(selectBranches)
  const isOnBranch = useAgentStore(selectIsOnBranch)

  // 计算显示文本
  const displayText = isOnBranch && activeBranch 
    ? activeBranch.name 
    : (language === 'zh' ? '主线' : 'Main')

  const hasBranches = branches.length > 0

  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs transition-colors ${
        isOnBranch 
          ? 'bg-accent/10 border border-accent/20 text-accent hover:bg-accent/20' 
          : 'hover:bg-white/5 text-text-muted hover:text-text-primary'
      }`}
      title={language === 'zh' ? '点击管理分支' : 'Click to manage branches'}
    >
      <GitBranch className="w-3.5 h-3.5" />
      <span className="truncate max-w-[120px]">{displayText}</span>
      {hasBranches && !isOnBranch && (
        <span className="ml-1 px-1 py-0.5 rounded bg-white/10 text-[10px]">
          +{branches.length}
        </span>
      )}
      <ChevronDown className="w-3 h-3 opacity-50" />
    </button>
  )
}

/**
 * 消息操作按钮 - 创建分支/重新生成
 */
export function MessageBranchActions({
  messageId,
  language = 'en',
  onRegenerate,
}: {
  messageId: string
  language?: 'zh' | 'en'
  onRegenerate?: (messageId: string) => void
}) {
  const [showConfirm, setShowConfirm] = useState(false)

  const handleCreateBranch = useCallback(() => {
    if (onRegenerate) {
      onRegenerate(messageId)
    }
    setShowConfirm(false)
  }, [messageId, onRegenerate])

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setShowConfirm(true)}
        className="text-xs gap-1 h-6 px-2 hover:bg-white/5"
        title={language === 'zh' ? '重新生成（创建分支）' : 'Regenerate (create branch)'}
      >
        <RotateCcw className="w-3 h-3" />
        <span>{language === 'zh' ? '重新生成' : 'Regenerate'}</span>
      </Button>

      {showConfirm && (
        <div className="absolute top-full right-0 mt-1 p-2 rounded-lg bg-surface border border-border shadow-xl z-50 min-w-[240px]">
          <p className="text-xs text-text-muted mb-2">
            {language === 'zh' 
              ? '这将创建一个新分支并重新生成回复' 
              : 'This will create a new branch and regenerate the response'}
          </p>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowConfirm(false)}
              className="flex-1 h-6 text-xs"
            >
              {language === 'zh' ? '取消' : 'Cancel'}
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleCreateBranch}
              className="flex-1 h-6 text-xs whitespace-nowrap"
            >
              <GitBranch className="w-3 h-3 mr-1" />
              {language === 'zh' ? '创建分支' : 'Create Branch'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
