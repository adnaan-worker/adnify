/**
 * 安全设置组件
 */

import { AlertTriangle } from 'lucide-react'
import { useStore } from '@store'
import { Switch } from '@components/ui'
import { Language } from '@renderer/i18n'

interface SecuritySettingsProps {
    language: Language
}

export function SecuritySettings({ language }: SecuritySettingsProps) {
    const { securitySettings, update } = useStore()

    return (
        <div className="space-y-8 animate-fade-in pb-10">
            <div className="p-5 bg-yellow-500/10 border border-yellow-500/20 rounded-2xl flex items-start gap-4 shadow-sm">
                <div className="p-2 bg-yellow-500/10 rounded-lg shrink-0">
                    <AlertTriangle className="w-5 h-5 text-yellow-500" />
                </div>
                <div>
                    <h3 className="text-sm font-bold text-yellow-500 mb-1 tracking-tight">
                        {language === 'zh' ? '安全沙箱 (开发中)' : 'Security Sandbox (WIP)'}
                    </h3>
                    <p className="text-xs text-text-secondary leading-relaxed opacity-90">
                        {language === 'zh'
                            ? 'Adnify 目前直接在您的系统上运行命令。请确保您只运行受信任的代码。未来版本将引入基于 Docker 的沙箱环境。'
                            : 'Adnify currently runs commands directly on your system. Ensure you only run trusted code. Future versions will introduce a Docker-based sandbox.'}
                    </p>
                </div>
            </div>

            <section className="space-y-5 p-6 bg-surface/20 backdrop-blur-md rounded-2xl border border-border shadow-sm">
                <h4 className="text-[11px] font-bold text-text-muted uppercase tracking-widest opacity-60 ml-1">
                    {language === 'zh' ? '安全选项' : 'Security Options'}
                </h4>
                <div className="space-y-4">
                    <Switch label={language === 'zh' ? '启用操作确认' : 'Enable permission confirmation'} checked={securitySettings.enablePermissionConfirm} onChange={(e) => update('securitySettings', { enablePermissionConfirm: e.target.checked })} />
                    <Switch label={language === 'zh' ? '启用审计日志' : 'Enable audit log'} checked={securitySettings.enableAuditLog} onChange={(e) => update('securitySettings', { enableAuditLog: e.target.checked })} />
                    <Switch label={language === 'zh' ? '严格工作区模式' : 'Strict workspace mode'} checked={securitySettings.strictWorkspaceMode} onChange={(e) => update('securitySettings', { strictWorkspaceMode: e.target.checked })} />
                    <Switch label={language === 'zh' ? '显示安全警告' : 'Show security warnings'} checked={securitySettings.showSecurityWarnings} onChange={(e) => update('securitySettings', { showSecurityWarnings: e.target.checked })} />
                </div>
            </section>
        </div>
    )
}
