/**
 * 主题系统配置
 * 支持内置主题和自定义主题
 * 使用 RGB 格式以支持 Tailwind 透明度修饰符
 */

import { logger } from '@utils/Logger'

export interface ThemeColors {
  // 背景色 (RGB 格式: "r g b")
  background: string
  backgroundSecondary: string
  backgroundTertiary: string
  
  // 表面色
  surface: string
  surfaceHover: string
  surfaceActive: string
  surfaceMuted: string

  // 文字色
  textPrimary: string
  textSecondary: string
  textMuted: string
  textInverted: string

  // 边框色
  border: string
  borderSubtle: string
  borderActive: string

  // 强调色
  accent: string
  accentHover: string
  accentActive: string
  accentForeground: string
  accentSubtle: string

  // 状态色
  statusSuccess: string
  statusWarning: string
  statusError: string
  statusInfo: string
}

export interface Theme {
  id: string
  name: string
  type: 'dark' | 'light'
  colors: ThemeColors
  monacoTheme: string
}

// 辅助函数：将 HEX 转换为 RGB 格式 "r g b"
function hexToRgb(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!result) return '0 0 0'
  return `${parseInt(result[1], 16)} ${parseInt(result[2], 16)} ${parseInt(result[3], 16)}`
}

// 内置主题 (使用 RGB 格式)
export const builtinThemes: Theme[] = [
  {
    id: 'adnify-dark',
    name: 'Adnify Dark',
    type: 'dark',
    monacoTheme: 'vs-dark',
    colors: {
      background: '10 10 12',         // Soft Deep Dark
      backgroundSecondary: '18 18 21',
      backgroundTertiary: '24 24 27',
      
      surface: '18 18 21',
      surfaceHover: '24 24 27',
      surfaceActive: '39 39 42',
      surfaceMuted: '63 63 70',

      textPrimary: '240 240 242',
      textSecondary: '161 161 170',
      textMuted: '113 113 122',
      textInverted: '0 0 0',

      border: '39 39 42',
      borderSubtle: '34 34 38',       // Dark subtle border (fixed from white)
      borderActive: '82 82 91',

      accent: '124 58 237',          // Violet 600
      accentHover: '109 40 217',     // Violet 700
      accentActive: '91 33 182',     // Violet 800
      accentForeground: '255 255 255',
      accentSubtle: '139 92 246',    // Violet 500

      statusSuccess: '34 197 94',
      statusWarning: '234 179 8',
      statusError: '239 68 68',
      statusInfo: '59 130 246',
    },
  },
  {
    id: 'midnight',
    name: 'Midnight',
    type: 'dark',
    monacoTheme: 'vs-dark',
    colors: {
      background: '2 6 23',           // Slate 950
      backgroundSecondary: '15 23 42', // Slate 900
      backgroundTertiary: '30 41 59',  // Slate 800
      
      surface: '15 23 42',
      surfaceHover: '30 41 59',
      surfaceActive: '51 65 85',
      surfaceMuted: '71 85 105',

      textPrimary: '248 250 252',
      textSecondary: '148 163 184',
      textMuted: '100 116 139',
      textInverted: '0 0 0',

      border: '30 41 59',
      borderSubtle: '248 250 252',
      borderActive: '71 85 105',

      accent: '56 189 248',          // Sky 400
      accentHover: '14 165 233',     // Sky 500
      accentActive: '2 132 199',     // Sky 600
      accentForeground: '0 0 0',
      accentSubtle: '125 211 252',   // Sky 300

      statusSuccess: '34 197 94',
      statusWarning: '234 179 8',
      statusError: '239 68 68',
      statusInfo: '59 130 246',
    },
  },
  {
    id: 'cyberpunk',
    name: 'Cyberpunk',
    type: 'dark',
    monacoTheme: 'vs-dark',
    colors: {
      background: '10 10 15',         // Dark Navy
      backgroundSecondary: '20 20 35',
      backgroundTertiary: '30 30 45',

      surface: '20 20 35',
      surfaceHover: '40 40 60',
      surfaceActive: '60 60 80',
      surfaceMuted: '80 80 100',

      textPrimary: '255 255 255',
      textSecondary: '200 200 255',
      textMuted: '150 150 200',
      textInverted: '0 0 0',

      border: '60 60 80',
      borderSubtle: '255 0 255',      // Neon Pink hint
      borderActive: '0 255 255',      // Neon Cyan hint

      accent: '255 0 128',            // Neon Pink
      accentHover: '255 50 150',
      accentActive: '200 0 100',
      accentForeground: '255 255 255',
      accentSubtle: '255 100 200',

      statusSuccess: '0 255 100',     // Neon Green
      statusWarning: '255 200 0',     // Neon Yellow
      statusError: '255 50 50',       // Neon Red
      statusInfo: '0 200 255',        // Neon Blue
    },
  },
  {
    id: 'dawn',
    name: 'Dawn',
    type: 'light',
    monacoTheme: 'vs',
    colors: {
      background: '255 255 255',
      backgroundSecondary: '248 250 252',
      backgroundTertiary: '241 245 249',

      surface: '255 255 255',
      surfaceHover: '241 245 249',
      surfaceActive: '226 232 240',
      surfaceMuted: '203 213 225',

      textPrimary: '15 23 42',
      textSecondary: '71 85 105',
      textMuted: '148 163 184',
      textInverted: '255 255 255',

      border: '226 232 240',
      borderSubtle: '15 23 42',
      borderActive: '203 213 225',

      accent: '79 70 229',
      accentHover: '67 56 202',
      accentActive: '55 48 163',
      accentForeground: '255 255 255',
      accentSubtle: '129 140 248',

      statusSuccess: '22 163 74',
      statusWarning: '202 138 4',
      statusError: '220 38 38',
      statusInfo: '37 99 235',
    },
  },
]

// 主题管理器
class ThemeManager {
  private currentTheme: Theme = builtinThemes[0]
  private customThemes: Theme[] = []
  private listeners: Set<(theme: Theme) => void> = new Set()
  private initialized = false

  constructor() {
    // 不在构造函数中加载，等待 init() 调用
  }

  async loadFromConfig() {
    try {
      const savedThemeId = await window.electronAPI.getSetting('themeId')
      const savedCustomThemes = await window.electronAPI.getSetting('customThemes')

      if (savedCustomThemes && Array.isArray(savedCustomThemes)) {
        this.customThemes = savedCustomThemes as Theme[]
      }

      if (savedThemeId && typeof savedThemeId === 'string') {
        const theme = this.getThemeById(savedThemeId)
        if (theme) {
          this.currentTheme = theme
        }
      }
    } catch (e) {
      logger.settings.error('Failed to load theme from config:', e)
    }
  }

  private saveToConfig() {
    try {
      window.electronAPI.setSetting('themeId', this.currentTheme.id)
      window.electronAPI.setSetting('customThemes', this.customThemes)
    } catch (e) {
      logger.settings.error('Failed to save theme to config:', e)
    }
  }

  getAllThemes(): Theme[] {
    return [...builtinThemes, ...this.customThemes]
  }

  getThemeById(id: string): Theme | undefined {
    return this.getAllThemes().find(t => t.id === id)
  }

  getCurrentTheme(): Theme {
    return this.currentTheme
  }

  setTheme(themeId: string) {
    const theme = this.getThemeById(themeId)
    if (theme) {
      this.currentTheme = theme
      this.applyTheme(theme)
      this.saveToConfig()
      this.notifyListeners()
    }
  }

  addCustomTheme(theme: Theme) {
    if (this.getThemeById(theme.id)) {
      theme.id = `${theme.id}-${Date.now()}`
    }
    this.customThemes.push(theme)
    this.saveToConfig()
  }

  removeCustomTheme(themeId: string) {
    this.customThemes = this.customThemes.filter(t => t.id !== themeId)
    if (this.currentTheme.id === themeId) {
      this.setTheme('adnify-dark')
    }
    this.saveToConfig()
  }

  applyTheme(theme: Theme) {
    const root = document.documentElement
    const colors = theme.colors

    // 设置 CSS 变量 (RGB 格式) - 修复变量名以匹配 Tailwind Config
    root.style.setProperty('--background', colors.background)
    root.style.setProperty('--background-secondary', colors.backgroundSecondary)
    root.style.setProperty('--background-tertiary', colors.backgroundTertiary)
    
    root.style.setProperty('--surface', colors.surface)
    root.style.setProperty('--surface-hover', colors.surfaceHover)
    root.style.setProperty('--surface-active', colors.surfaceActive)
    root.style.setProperty('--surface-muted', colors.surfaceMuted)
    
    root.style.setProperty('--text-primary', colors.textPrimary)
    root.style.setProperty('--text-secondary', colors.textSecondary)
    root.style.setProperty('--text-muted', colors.textMuted)
    root.style.setProperty('--text-inverted', colors.textInverted)
    
    root.style.setProperty('--border', colors.border)
    root.style.setProperty('--border-subtle', colors.borderSubtle)
    root.style.setProperty('--border-active', colors.borderActive)
    
    root.style.setProperty('--accent', colors.accent)
    root.style.setProperty('--accent-hover', colors.accentHover)
    root.style.setProperty('--accent-active', colors.accentActive)
    root.style.setProperty('--accent-foreground', colors.accentForeground)
    root.style.setProperty('--accent-subtle', colors.accentSubtle)
    
    root.style.setProperty('--status-success', colors.statusSuccess)
    root.style.setProperty('--status-warning', colors.statusWarning)
    root.style.setProperty('--status-error', colors.statusError)
    root.style.setProperty('--status-info', colors.statusInfo)

    // 设置主题类型
    root.setAttribute('data-theme', theme.type)

    // 更新 color-scheme
    root.style.colorScheme = theme.type

    logger.settings.info('[Theme] Applied theme:', theme.name)
  }

  subscribe(callback: (theme: Theme) => void): () => void {
    this.listeners.add(callback)
    return () => this.listeners.delete(callback)
  }

  private notifyListeners() {
    this.listeners.forEach(cb => cb(this.currentTheme))
  }

  async init() {
    if (this.initialized) return
    await this.loadFromConfig()
    this.applyTheme(this.currentTheme)
    this.initialized = true
  }
}

export const themeManager = new ThemeManager()

// 导出辅助函数
export { hexToRgb }
