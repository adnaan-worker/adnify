/**
 * UI/UX 工具类型定义
 */

/** 搜索域类型 */
export type UiuxDomain = 
  | 'style' 
  | 'color' 
  | 'typography' 
  | 'chart' 
  | 'landing' 
  | 'product' 
  | 'ux' 
  | 'prompt'
  // 新增域
  | 'icons'
  | 'react-performance'
  | 'ui-reasoning'
  | 'web-interface'

/** 搜索域类型（包含 stack） */
export type UiuxSearchDomain = UiuxDomain | 'stack'

/** 技术栈类型 */
export type TechStack = 
  | 'html-tailwind' 
  | 'react' 
  | 'nextjs' 
  | 'vue' 
  | 'svelte' 
  | 'swiftui' 
  | 'react-native' 
  | 'flutter'
  // 新增技术栈
  | 'jetpack-compose'
  | 'nuxt-ui'
  | 'nuxtjs'
  | 'shadcn'

/** 搜索结果 */
export interface UiuxSearchResult {
  domain: UiuxSearchDomain
  query: string
  count: number
  results: Record<string, unknown>[]
  stack?: TechStack
}

/** 域配置 */
export interface DomainConfig {
  searchFields: string[]
  outputFields: string[]
}

/** 所有域的配置 */
export const DOMAIN_CONFIGS: Record<UiuxDomain, DomainConfig> = {
  style: {
    searchFields: ['Style Category', 'Keywords', 'Best For', 'Type'],
    outputFields: ['Style Category', 'Type', 'Keywords', 'Primary Colors', 'Effects & Animation', 'Best For', 'Performance', 'Accessibility', 'Framework Compatibility', 'Complexity'],
  },
  prompt: {
    searchFields: ['Style Category', 'AI Prompt Keywords (Copy-Paste Ready)', 'CSS/Technical Keywords'],
    outputFields: ['Style Category', 'AI Prompt Keywords (Copy-Paste Ready)', 'CSS/Technical Keywords', 'Implementation Checklist'],
  },
  color: {
    searchFields: ['Product Type', 'Keywords', 'Notes'],
    outputFields: ['Product Type', 'Keywords', 'Primary (Hex)', 'Secondary (Hex)', 'CTA (Hex)', 'Background (Hex)', 'Text (Hex)', 'Border (Hex)', 'Notes'],
  },
  chart: {
    searchFields: ['Data Type', 'Keywords', 'Best Chart Type', 'Accessibility Notes'],
    outputFields: ['Data Type', 'Keywords', 'Best Chart Type', 'Secondary Options', 'Color Guidance', 'Accessibility Notes', 'Library Recommendation', 'Interactive Level'],
  },
  landing: {
    searchFields: ['Pattern Name', 'Keywords', 'Conversion Optimization', 'Section Order'],
    outputFields: ['Pattern Name', 'Keywords', 'Section Order', 'Primary CTA Placement', 'Color Strategy', 'Conversion Optimization'],
  },
  product: {
    searchFields: ['Product Type', 'Keywords', 'Primary Style Recommendation', 'Key Considerations'],
    outputFields: ['Product Type', 'Keywords', 'Primary Style Recommendation', 'Secondary Styles', 'Landing Page Pattern', 'Dashboard Style (if applicable)', 'Color Palette Focus'],
  },
  ux: {
    searchFields: ['Category', 'Issue', 'Description', 'Platform'],
    outputFields: ['Category', 'Issue', 'Platform', 'Description', 'Do', "Don't", 'Code Example Good', 'Code Example Bad', 'Severity'],
  },
  typography: {
    searchFields: ['Font Pairing Name', 'Category', 'Mood/Style Keywords', 'Best For', 'Heading Font', 'Body Font'],
    outputFields: ['Font Pairing Name', 'Category', 'Heading Font', 'Body Font', 'Mood/Style Keywords', 'Best For', 'Google Fonts URL', 'CSS Import', 'Tailwind Config', 'Notes'],
  },
  // 新增域配置
  icons: {
    searchFields: ['Category', 'Icon Name', 'Keywords', 'Best For', 'Library'],
    outputFields: ['Category', 'Icon Name', 'Keywords', 'Library', 'Import Code', 'Usage', 'Best For', 'Style'],
  },
  'react-performance': {
    searchFields: ['Category', 'Issue', 'Keywords', 'Description', 'Platform'],
    outputFields: ['Category', 'Issue', 'Platform', 'Description', 'Do', "Don't", 'Code Example Good', 'Code Example Bad', 'Severity'],
  },
  'ui-reasoning': {
    searchFields: ['UI_Category', 'Recommended_Pattern', 'Style_Priority', 'Color_Mood'],
    outputFields: ['UI_Category', 'Recommended_Pattern', 'Style_Priority', 'Color_Mood', 'Typography_Mood', 'Key_Effects', 'Decision_Rules', 'Anti_Patterns', 'Severity'],
  },
  'web-interface': {
    searchFields: ['Category', 'Issue', 'Keywords', 'Description', 'Platform'],
    outputFields: ['Category', 'Issue', 'Platform', 'Description', 'Do', "Don't", 'Code Example Good', 'Code Example Bad', 'Severity'],
  },
}

/** 技术栈配置 */
export const STACK_CONFIG: DomainConfig = {
  searchFields: ['Category', 'Guideline', 'Description', 'Do', "Don't"],
  outputFields: ['Category', 'Guideline', 'Description', 'Do', "Don't", 'Code Good', 'Code Bad', 'Severity', 'Docs URL'],
}

/** 可用技术栈列表 */
export const AVAILABLE_STACKS: TechStack[] = [
  'html-tailwind',
  'react',
  'nextjs',
  'vue',
  'svelte',
  'swiftui',
  'react-native',
  'flutter',
  // 新增技术栈
  'jetpack-compose',
  'nuxt-ui',
  'nuxtjs',
  'shadcn',
]
