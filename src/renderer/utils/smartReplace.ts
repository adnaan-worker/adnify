/**
 * 智能字符串替换模块
 * 
 * 参考 OpenCode 的多策略 Replacer 设计
 * 提供多种容错匹配策略，提高 AI 编辑成功率
 */

// ============================================
// 类型定义
// ============================================

export type Replacer = (content: string, find: string) => Generator<string, void, unknown>

export interface ReplaceResult {
    success: boolean
    newContent?: string
    matchedText?: string
    strategy?: string
    error?: string
}

// ============================================
// Levenshtein 距离算法（用于相似度计算）
// ============================================

function levenshtein(a: string, b: string): number {
    if (a === '' || b === '') {
        return Math.max(a.length, b.length)
    }
    
    const matrix = Array.from({ length: a.length + 1 }, (_, i) =>
        Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
    )

    for (let i = 1; i <= a.length; i++) {
        for (let j = 1; j <= b.length; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1
            matrix[i][j] = Math.min(
                matrix[i - 1][j] + 1,
                matrix[i][j - 1] + 1,
                matrix[i - 1][j - 1] + cost
            )
        }
    }
    return matrix[a.length][b.length]
}

// ============================================
// 替换策略实现
// ============================================

/**
 * 策略1: 精确匹配
 */
export const SimpleReplacer: Replacer = function* (_content, find) {
    yield find
}

/**
 * 策略2: 行首尾空白忽略匹配
 * 忽略每行的首尾空白进行匹配
 */
export const LineTrimmedReplacer: Replacer = function* (content, find) {
    const originalLines = content.split('\n')
    const searchLines = find.split('\n')

    // 移除末尾空行
    if (searchLines[searchLines.length - 1] === '') {
        searchLines.pop()
    }

    for (let i = 0; i <= originalLines.length - searchLines.length; i++) {
        let matches = true

        for (let j = 0; j < searchLines.length; j++) {
            const originalTrimmed = originalLines[i + j].trim()
            const searchTrimmed = searchLines[j].trim()

            if (originalTrimmed !== searchTrimmed) {
                matches = false
                break
            }
        }

        if (matches) {
            let matchStartIndex = 0
            for (let k = 0; k < i; k++) {
                matchStartIndex += originalLines[k].length + 1
            }

            let matchEndIndex = matchStartIndex
            for (let k = 0; k < searchLines.length; k++) {
                matchEndIndex += originalLines[i + k].length
                if (k < searchLines.length - 1) {
                    matchEndIndex += 1
                }
            }

            yield content.substring(matchStartIndex, matchEndIndex)
        }
    }
}


/**
 * 策略3: 块锚点匹配（基于首尾行 + 相似度）
 * 使用首尾行作为锚点，中间内容用相似度匹配
 */
export const BlockAnchorReplacer: Replacer = function* (content, find) {
    const SINGLE_CANDIDATE_THRESHOLD = 0.0
    const MULTIPLE_CANDIDATES_THRESHOLD = 0.3

    const originalLines = content.split('\n')
    const searchLines = find.split('\n')

    if (searchLines.length < 3) return

    if (searchLines[searchLines.length - 1] === '') {
        searchLines.pop()
    }

    const firstLineSearch = searchLines[0].trim()
    const lastLineSearch = searchLines[searchLines.length - 1].trim()
    const searchBlockSize = searchLines.length

    // 收集所有候选位置
    const candidates: Array<{ startLine: number; endLine: number }> = []
    for (let i = 0; i < originalLines.length; i++) {
        if (originalLines[i].trim() !== firstLineSearch) continue

        for (let j = i + 2; j < originalLines.length; j++) {
            if (originalLines[j].trim() === lastLineSearch) {
                candidates.push({ startLine: i, endLine: j })
                break
            }
        }
    }

    if (candidates.length === 0) return

    // 计算相似度并选择最佳匹配
    const calculateSimilarity = (startLine: number, endLine: number): number => {
        const actualBlockSize = endLine - startLine + 1
        let similarity = 0
        const linesToCheck = Math.min(searchBlockSize - 2, actualBlockSize - 2)

        if (linesToCheck > 0) {
            for (let j = 1; j < searchBlockSize - 1 && j < actualBlockSize - 1; j++) {
                const originalLine = originalLines[startLine + j].trim()
                const searchLine = searchLines[j].trim()
                const maxLen = Math.max(originalLine.length, searchLine.length)
                if (maxLen === 0) continue
                const distance = levenshtein(originalLine, searchLine)
                similarity += (1 - distance / maxLen) / linesToCheck
            }
        } else {
            similarity = 1.0
        }
        return similarity
    }

    const extractBlock = (startLine: number, endLine: number): string => {
        let matchStartIndex = 0
        for (let k = 0; k < startLine; k++) {
            matchStartIndex += originalLines[k].length + 1
        }
        let matchEndIndex = matchStartIndex
        for (let k = startLine; k <= endLine; k++) {
            matchEndIndex += originalLines[k].length
            if (k < endLine) matchEndIndex += 1
        }
        return content.substring(matchStartIndex, matchEndIndex)
    }

    if (candidates.length === 1) {
        const { startLine, endLine } = candidates[0]
        const similarity = calculateSimilarity(startLine, endLine)
        if (similarity >= SINGLE_CANDIDATE_THRESHOLD) {
            yield extractBlock(startLine, endLine)
        }
        return
    }

    // 多个候选，选择相似度最高的
    let bestMatch: { startLine: number; endLine: number } | null = null
    let maxSimilarity = -1

    for (const candidate of candidates) {
        const similarity = calculateSimilarity(candidate.startLine, candidate.endLine)
        if (similarity > maxSimilarity) {
            maxSimilarity = similarity
            bestMatch = candidate
        }
    }

    if (maxSimilarity >= MULTIPLE_CANDIDATES_THRESHOLD && bestMatch) {
        yield extractBlock(bestMatch.startLine, bestMatch.endLine)
    }
}

/**
 * 策略4: 空白归一化匹配
 * 将连续空白归一化为单个空格后匹配
 */
export const WhitespaceNormalizedReplacer: Replacer = function* (content, find) {
    const normalizeWhitespace = (text: string) => text.replace(/\s+/g, ' ').trim()
    const normalizedFind = normalizeWhitespace(find)

    const lines = content.split('\n')
    
    // 单行匹配
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        if (normalizeWhitespace(line) === normalizedFind) {
            yield line
        }
    }

    // 多行匹配
    const findLines = find.split('\n')
    if (findLines.length > 1) {
        for (let i = 0; i <= lines.length - findLines.length; i++) {
            const block = lines.slice(i, i + findLines.length)
            if (normalizeWhitespace(block.join('\n')) === normalizedFind) {
                yield block.join('\n')
            }
        }
    }
}

/**
 * 策略5: 缩进灵活匹配
 * 移除最小公共缩进后匹配
 */
export const IndentationFlexibleReplacer: Replacer = function* (content, find) {
    const removeIndentation = (text: string) => {
        const lines = text.split('\n')
        const nonEmptyLines = lines.filter((line) => line.trim().length > 0)
        if (nonEmptyLines.length === 0) return text

        const minIndent = Math.min(
            ...nonEmptyLines.map((line) => {
                const match = line.match(/^(\s*)/)
                return match ? match[1].length : 0
            })
        )

        return lines.map((line) => (line.trim().length === 0 ? line : line.slice(minIndent))).join('\n')
    }

    const normalizedFind = removeIndentation(find)
    const contentLines = content.split('\n')
    const findLines = find.split('\n')

    for (let i = 0; i <= contentLines.length - findLines.length; i++) {
        const block = contentLines.slice(i, i + findLines.length).join('\n')
        if (removeIndentation(block) === normalizedFind) {
            yield block
        }
    }
}


/**
 * 策略6: 转义字符归一化匹配
 * 处理转义字符差异
 */
export const EscapeNormalizedReplacer: Replacer = function* (content, find) {
    const unescapeString = (str: string): string => {
        return str.replace(/\\(n|t|r|'|"|`|\\|\n|\$)/g, (match, capturedChar) => {
            switch (capturedChar) {
                case 'n': return '\n'
                case 't': return '\t'
                case 'r': return '\r'
                case "'": return "'"
                case '"': return '"'
                case '`': return '`'
                case '\\': return '\\'
                case '\n': return '\n'
                case '$': return '$'
                default: return match
            }
        })
    }

    const unescapedFind = unescapeString(find)

    if (content.includes(unescapedFind)) {
        yield unescapedFind
    }

    const lines = content.split('\n')
    const findLines = unescapedFind.split('\n')

    for (let i = 0; i <= lines.length - findLines.length; i++) {
        const block = lines.slice(i, i + findLines.length).join('\n')
        const unescapedBlock = unescapeString(block)

        if (unescapedBlock === unescapedFind) {
            yield block
        }
    }
}

/**
 * 策略7: 首尾空白修剪匹配
 */
export const TrimmedBoundaryReplacer: Replacer = function* (content, find) {
    const trimmedFind = find.trim()

    if (trimmedFind === find) return

    if (content.includes(trimmedFind)) {
        yield trimmedFind
    }

    const lines = content.split('\n')
    const findLines = find.split('\n')

    for (let i = 0; i <= lines.length - findLines.length; i++) {
        const block = lines.slice(i, i + findLines.length).join('\n')
        if (block.trim() === trimmedFind) {
            yield block
        }
    }
}

/**
 * 策略8: 上下文感知匹配
 * 使用首尾行作为上下文锚点，中间内容允许部分差异
 */
export const ContextAwareReplacer: Replacer = function* (content, find) {
    const findLines = find.split('\n')
    if (findLines.length < 3) return

    if (findLines[findLines.length - 1] === '') {
        findLines.pop()
    }

    const contentLines = content.split('\n')
    const firstLine = findLines[0].trim()
    const lastLine = findLines[findLines.length - 1].trim()

    for (let i = 0; i < contentLines.length; i++) {
        if (contentLines[i].trim() !== firstLine) continue

        for (let j = i + 2; j < contentLines.length; j++) {
            if (contentLines[j].trim() === lastLine) {
                const blockLines = contentLines.slice(i, j + 1)
                const block = blockLines.join('\n')

                if (blockLines.length === findLines.length) {
                    let matchingLines = 0
                    let totalNonEmptyLines = 0

                    for (let k = 1; k < blockLines.length - 1; k++) {
                        const blockLine = blockLines[k].trim()
                        const findLine = findLines[k].trim()

                        if (blockLine.length > 0 || findLine.length > 0) {
                            totalNonEmptyLines++
                            if (blockLine === findLine) {
                                matchingLines++
                            }
                        }
                    }

                    if (totalNonEmptyLines === 0 || matchingLines / totalNonEmptyLines >= 0.5) {
                        yield block
                        break
                    }
                }
                break
            }
        }
    }
}

/**
 * 策略9: 多次出现匹配（用于 replaceAll）
 */
export const MultiOccurrenceReplacer: Replacer = function* (content, find) {
    let startIndex = 0

    while (true) {
        const index = content.indexOf(find, startIndex)
        if (index === -1) break

        yield find
        startIndex = index + find.length
    }
}

// ============================================
// 主替换函数
// ============================================

/**
 * 所有替换策略（按优先级排序）
 */
const REPLACER_STRATEGIES: Array<{ name: string; replacer: Replacer }> = [
    { name: 'exact', replacer: SimpleReplacer },
    { name: 'line-trimmed', replacer: LineTrimmedReplacer },
    { name: 'block-anchor', replacer: BlockAnchorReplacer },
    { name: 'whitespace-normalized', replacer: WhitespaceNormalizedReplacer },
    { name: 'indentation-flexible', replacer: IndentationFlexibleReplacer },
    { name: 'escape-normalized', replacer: EscapeNormalizedReplacer },
    { name: 'trimmed-boundary', replacer: TrimmedBoundaryReplacer },
    { name: 'context-aware', replacer: ContextAwareReplacer },
    { name: 'multi-occurrence', replacer: MultiOccurrenceReplacer },
]

/**
 * 智能替换函数
 * 尝试多种策略找到匹配，提高容错性
 */
export function smartReplace(
    content: string,
    oldString: string,
    newString: string,
    replaceAll = false
): ReplaceResult {
    if (oldString === newString) {
        return { success: false, error: 'old_string and new_string must be different' }
    }

    if (!oldString) {
        return { success: false, error: 'old_string is required' }
    }

    let foundMatch = false

    for (const { name, replacer } of REPLACER_STRATEGIES) {
        for (const search of replacer(content, oldString)) {
            const index = content.indexOf(search)
            if (index === -1) continue

            foundMatch = true

            if (replaceAll) {
                return {
                    success: true,
                    newContent: content.replaceAll(search, newString),
                    matchedText: search,
                    strategy: name,
                }
            }

            // 检查是否唯一
            const lastIndex = content.lastIndexOf(search)
            if (index !== lastIndex) {
                continue // 不唯一，尝试下一个策略
            }

            return {
                success: true,
                newContent: content.substring(0, index) + newString + content.substring(index + search.length),
                matchedText: search,
                strategy: name,
            }
        }
    }

    if (foundMatch) {
        return {
            success: false,
            error: 'Found multiple matches for old_string. Include more surrounding context to make it unique.',
        }
    }

    return {
        success: false,
        error: 'old_string not found in file. Use read_file to get exact content including whitespace.',
    }
}

/**
 * 规范化行尾
 */
export function normalizeLineEndings(text: string): string {
    return text.replaceAll('\r\n', '\n')
}

/**
 * 生成简化的 diff（用于显示）
 */
export function trimDiff(diff: string): string {
    const lines = diff.split('\n')
    const contentLines = lines.filter(
        (line) =>
            (line.startsWith('+') || line.startsWith('-') || line.startsWith(' ')) &&
            !line.startsWith('---') &&
            !line.startsWith('+++')
    )

    if (contentLines.length === 0) return diff

    let min = Infinity
    for (const line of contentLines) {
        const content = line.slice(1)
        if (content.trim().length > 0) {
            const match = content.match(/^(\s*)/)
            if (match) min = Math.min(min, match[1].length)
        }
    }

    if (min === Infinity || min === 0) return diff

    const trimmedLines = lines.map((line) => {
        if (
            (line.startsWith('+') || line.startsWith('-') || line.startsWith(' ')) &&
            !line.startsWith('---') &&
            !line.startsWith('+++')
        ) {
            const prefix = line[0]
            const content = line.slice(1)
            return prefix + content.slice(min)
        }
        return line
    })

    return trimmedLines.join('\n')
}
