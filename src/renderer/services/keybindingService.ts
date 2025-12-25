
import { logger } from '@/renderer/utils/Logger'

export interface Command {
    id: string
    title: string
    category?: string
    defaultKey?: string
    handler?: () => void
}

export interface Keybinding {
    commandId: string
    key: string
}

class KeybindingService {
    private commands: Map<string, Command> = new Map()
    private overrides: Map<string, string> = new Map()
    private initialized = false

    async init() {
        if (this.initialized) return
        await this.loadOverrides()
        this.initialized = true
        logger.system.info('KeybindingService initialized', { commandCount: this.commands.size })
    }

    registerCommand(command: Command) {
        this.commands.set(command.id, command)
    }

    getBinding(commandId: string): string | undefined {
        return this.overrides.get(commandId) || this.commands.get(commandId)?.defaultKey
    }

    getAllCommands(): Command[] {
        return Array.from(this.commands.values())
    }

    isOverridden(commandId: string): boolean {
        return this.overrides.has(commandId)
    }

    /**
     * 处理按键事件
     * @returns 如果事件被处理则返回 true
     */
    handleKeyDown(e: KeyboardEvent | React.KeyboardEvent): boolean {
        for (const [id, command] of this.commands) {
            if (this.matches(e as KeyboardEvent, id)) {
                logger.system.debug('Executing command', { id })
                if (command.handler) {
                    command.handler()
                    return true
                }
            }
        }
        return false
    }

    matches(e: KeyboardEvent | React.KeyboardEvent, commandId: string): boolean {
        const binding = this.getBinding(commandId)
        if (!binding) return false

        const parts = binding.toLowerCase().split('+')
        const key = parts.pop()

        const meta = parts.includes('meta') || parts.includes('cmd') || parts.includes('command')
        const ctrl = parts.includes('ctrl') || parts.includes('control')
        const shift = parts.includes('shift')
        const alt = parts.includes('alt') || parts.includes('option')

        const modifiersMatch =
            (e.metaKey === meta) &&
            (e.ctrlKey === ctrl) &&
            (e.shiftKey === shift) &&
            (e.altKey === alt)

        // Handle special keys
        let keyMatch = false
        if (key === 'space') {
            keyMatch = e.code === 'Space' || e.key === ' '
        } else {
            keyMatch = e.key.toLowerCase() === key
        }

        if (modifiersMatch && keyMatch) {
            logger.system.debug('Match found for command', { commandId, binding })
        }

        return modifiersMatch && keyMatch
    }

    async updateBinding(commandId: string, newKey: string | null) {
        if (newKey === null) {
            this.overrides.delete(commandId)
        } else {
            this.overrides.set(commandId, newKey)
        }
        await this.saveOverrides()
    }

    async resetBinding(commandId: string) {
        this.overrides.delete(commandId)
        await this.saveOverrides()
    }

    private async loadOverrides() {
        try {
            const saved = await window.electronAPI.getSetting('keybindings') as Record<string, string>
            if (saved) {
                this.overrides = new Map(Object.entries(saved))
            }
        } catch (e) {
            logger.system.error('Failed to load keybindings', { error: e })
        }
    }

    private async saveOverrides() {
        try {
            const obj = Object.fromEntries(this.overrides)
            await window.electronAPI.setSetting('keybindings', obj)
        } catch (e) {
            logger.system.error('Failed to save keybindings', { error: e })
        }
    }
}

export const keybindingService = new KeybindingService()
