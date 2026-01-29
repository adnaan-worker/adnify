/**
 * A simple rehype plugin to inject a cursor span at the end of the last text node.
 */
export const rehypeCursor = (options: { show: boolean }) => {
    return (tree: any) => {
        if (!options.show) return

        function appendToLast(node: any): boolean {
            if (!node.children || node.children.length === 0) {
                return false
            }

            const lastIndex = node.children.length - 1
            const last = node.children[lastIndex]

            // If last is text node
            if (last.type === 'text') {
                // Insert span after it
                node.children.push({
                    type: 'element',
                    tagName: 'span',
                    properties: { className: ['fuzzy-cursor'] },
                    children: []
                })
                return true
            }

            // If last is element, recurse
            if (last.type === 'element') {
                // Try to insert inside
                const inserted = appendToLast(last)
                if (inserted) return true

                // If couldn't insert inside (e.g. empty element), append to it
                last.children.push({
                    type: 'element',
                    tagName: 'span',
                    properties: { className: ['fuzzy-cursor'] },
                    children: []
                })
                return true
            }

            return false
        }

        appendToLast(tree)
    }
}
