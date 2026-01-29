import { useState, useEffect, useRef } from 'react'

interface UseFluidTypewriterOptions {
    /** Base speed (chars per frame) */
    baseSpeed?: number
    /** Speed multiplier based on queue length */
    accelerationFactor?: number
    /** Whether to enable fluid effect */
    enabled?: boolean
}

/**
 * A hook that simulates a fluid typewriter effect.
 * It buffers incoming content and releases it at a variable speed.
 */
export const useFluidTypewriter = (
    content: string,
    isStreaming: boolean,
    options: UseFluidTypewriterOptions = {}
) => {
    const {
        baseSpeed = 1,
        accelerationFactor = 50,
        enabled = true
    } = options

    // If disabled, just return content directly
    if (!enabled) return content

    const [displayedContent, setDisplayedContent] = useState(isStreaming ? '' : content)
    const queue = useRef<string[]>([])
    const lastContentLength = useRef(isStreaming ? 0 : content.length)
    const animationRef = useRef<number>()
    const lastFrameTime = useRef<number>(0)

    // Reset when not streaming or content changes significantly (e.g. new message)
    useEffect(() => {
        if (!isStreaming) {
            setDisplayedContent(content)
            queue.current = []
            lastContentLength.current = content.length
            return
        }
    }, [isStreaming, content])

    // Push new content to queue
    useEffect(() => {
        if (!isStreaming) return

        const currentLength = content.length
        if (currentLength > lastContentLength.current) {
            const newText = content.slice(lastContentLength.current)
            queue.current.push(...newText.split(''))
            lastContentLength.current = currentLength
        }
    }, [content, isStreaming])

    // Animation Loop
    useEffect(() => {
        if (!isStreaming) return

        const animate = (time: number) => {
            if (!lastFrameTime.current) lastFrameTime.current = time

            // Consume queue
            if (queue.current.length > 0) {
                // Variable speed: baseSpeed + queue/accelerationFactor chars per frame
                // Example: if queue has 100 chars, speed = 1 + 2 = 3 chars/frame
                const speed = baseSpeed + Math.floor(queue.current.length / accelerationFactor)
                const charsToTake = Math.min(queue.current.length, speed)

                const nextChars = queue.current.splice(0, charsToTake).join('')
                setDisplayedContent(prev => prev + nextChars)
            }

            lastFrameTime.current = time
            animationRef.current = requestAnimationFrame(animate)
        }

        animationRef.current = requestAnimationFrame(animate)
        return () => {
            if (animationRef.current) cancelAnimationFrame(animationRef.current)
        }
    }, [isStreaming, baseSpeed, accelerationFactor])

    return displayedContent
}
