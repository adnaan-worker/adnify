/**
 * Plan 列表内容组件（用于 StatusBar 底部弹出框）
 */

import { useState, useEffect } from 'react'
import { ClipboardList } from 'lucide-react'
import { useStore } from '@store'
import { useModeStore } from '@/renderer/modes'
import BottomBarPopover from './ui/BottomBarPopover'

interface PlanListContentProps {
    language: 'en' | 'zh'
}

export default function PlanListContent({ language }: PlanListContentProps) {
    const { workspacePath, openFile, setActiveFile } = useStore()
    const [plans, setPlans] = useState<string[]>([])
    const [activePlan, setActivePlanPath] = useState<string | null>(null)

    const loadPlans = async () => {
        if (!workspacePath) return

        try {
            const plansDir = `${workspacePath}/.adnify/plans`
            const files = await window.electronAPI.readDir(plansDir)
            const planFiles = files
                .filter(f => !f.isDirectory && f.name.endsWith('.md'))
                .map(f => f.path)
            setPlans(planFiles)

            const active = await window.electronAPI.readFile(`${workspacePath}/.adnify/active_plan.txt`)
            if (active) {
                setActivePlanPath(active.trim())
            }
        } catch {
            setPlans([])
        }
    }

    useEffect(() => {
        loadPlans()
    }, [workspacePath])

    const handleOpenPlan = async (planPath: string) => {
        const content = await window.electronAPI.readFile(planPath)
        if (content) {
            openFile(planPath, content)
            setActiveFile(planPath)
            if (workspacePath) {
                await window.electronAPI.writeFile(`${workspacePath}/.adnify/active_plan.txt`, planPath)
            }
            setActivePlanPath(planPath)
        }
    }

    const getPlanName = (path: string) => {
        return path.split('/').pop()?.replace('.md', '') || 'Unknown'
    }

    return (
        <div className="p-2">
            {plans.length === 0 ? (
                <div className="p-4 text-xs text-text-muted text-center">
                    {language === 'zh' ? '暂无计划' : 'No plans yet'}
                    <p className="text-[10px] mt-1 opacity-60">
                        {language === 'zh' ? '在 Agent + Plan 模式下创建计划' : 'Create plans in Agent + Plan mode'}
                    </p>
                </div>
            ) : (
                <div className="space-y-0.5">
                    {plans.map(planPath => (
                        <button
                            key={planPath}
                            onClick={() => handleOpenPlan(planPath)}
                            className={`w-full px-3 py-2 text-left text-xs flex items-center gap-2 hover:bg-white/5 rounded transition-colors
                ${planPath === activePlan ? 'bg-purple-500/10 text-purple-400' : 'text-text-primary'}`}
                        >
                            <ClipboardList className="w-3.5 h-3.5 flex-shrink-0" />
                            <span className="truncate">{getPlanName(planPath)}</span>
                            {planPath === activePlan && (
                                <span className="ml-auto text-[10px] text-purple-400 bg-purple-500/20 px-1.5 py-0.5 rounded">
                                    Active
                                </span>
                            )}
                        </button>
                    ))}
                </div>
            )}
        </div>
    )
}

// 获取计划数量（用于角标）
export function getPlanCount(): number {
    return 0  // 暂时返回 0，可以后续实现
}

// Plan 列表弹出组件（包装 BottomBarPopover）
export function PlanListPopover({ language }: { language: 'en' | 'zh' }) {
    const { currentMode } = useModeStore()

    // 在 Agent 和 Plan 模式下都显示
    if (currentMode !== 'plan' && currentMode !== 'agent') return null

    return (
        <BottomBarPopover
            icon={<ClipboardList className="w-3 h-3" />}
            tooltip={language === 'zh' ? '计划列表' : 'Plan List'}
            title={language === 'zh' ? '计划列表' : 'Plan List'}
            width={320}
            height={240}
            language={language}
        >
            <PlanListContent language={language} />
        </BottomBarPopover>
    )
}
