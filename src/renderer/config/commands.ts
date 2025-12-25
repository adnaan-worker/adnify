
import { keybindingService } from '@services/keybindingService'

export const registerCoreCommands = () => {
    const commands = [
        { id: 'file.save', title: 'Save File', category: 'File', defaultKey: 'Ctrl+S' },
        { id: 'file.open', title: 'Open File', category: 'File', defaultKey: 'Ctrl+O' },
        { id: 'view.toggleSidebar', title: 'Toggle Sidebar', category: 'View', defaultKey: 'Ctrl+B' },
        { id: 'view.toggleTerminal', title: 'Toggle Terminal', category: 'View', defaultKey: 'Ctrl+`' },
        { id: 'editor.find', title: 'Find', category: 'Editor', defaultKey: 'Ctrl+F' },
        { id: 'editor.replace', title: 'Replace', category: 'Editor', defaultKey: 'Ctrl+H' },
        { id: 'terminal.new', title: 'New Terminal', category: 'Terminal', defaultKey: 'Ctrl+Shift+`' },

        // Chat
        { id: 'chat.send', title: 'Send Message', category: 'Chat', defaultKey: 'Enter' },
        { id: 'chat.stop', title: 'Stop Generation', category: 'Chat', defaultKey: 'Escape' },

        // List/Tree
        { id: 'list.select', title: 'Select Item', category: 'List', defaultKey: 'Enter' },
        { id: 'list.cancel', title: 'Cancel Selection', category: 'List', defaultKey: 'Escape' },
        { id: 'list.focusDown', title: 'Focus Next Item', category: 'List', defaultKey: 'ArrowDown' },
        { id: 'list.focusUp', title: 'Focus Previous Item', category: 'List', defaultKey: 'ArrowUp' },

        // Git
        { id: 'git.commit', title: 'Commit Changes', category: 'Git', defaultKey: 'Ctrl+Enter' },

        // Editor
        { id: 'editor.save', title: 'Save File', category: 'File', defaultKey: 'Ctrl+S' }, // Duplicate of file.save, but for consistency
        { id: 'editor.cancel', title: 'Cancel Operation', category: 'Editor', defaultKey: 'Escape' },

        // Workbench
        { id: 'workbench.action.showCommands', title: 'Show Command Palette', category: 'View', defaultKey: 'Ctrl+Shift+P' },
        { id: 'workbench.action.quickOpen', title: 'Go to File', category: 'File', defaultKey: 'Ctrl+P' },
        { id: 'workbench.action.openSettings', title: 'Open Settings', category: 'File', defaultKey: 'Ctrl+,' },
        { id: 'workbench.action.showShortcuts', title: 'Keyboard Shortcuts', category: 'Help', defaultKey: '?' },
        { id: 'workbench.action.toggleComposer', title: 'Toggle Composer', category: 'View', defaultKey: 'Ctrl+Shift+I' },
        { id: 'workbench.action.toggleDevTools', title: 'Toggle Developer Tools', category: 'Help', defaultKey: 'F12' },
        { id: 'workbench.action.closePanel', title: 'Close Panel', category: 'View', defaultKey: 'Escape' },
        { id: 'help.about', title: 'About', category: 'Help', defaultKey: '' },
    ]

    commands.forEach(cmd => keybindingService.registerCommand(cmd))
}
