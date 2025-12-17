import { useState, useEffect } from 'react'

interface TypewriterProps {
    content: string
    speed?: number
    onComplete?: () => void
    className?: string
}

export default function Typewriter({
    content,
    speed = 10,
    onComplete,
    className = ''
}: TypewriterProps) {
    const [displayedContent, setDisplayedContent] = useState('')
    const [currentIndex, setCurrentIndex] = useState(0)

    useEffect(() => {
        setDisplayedContent('')
        setCurrentIndex(0)
    }, [content])

    useEffect(() => {
        if (currentIndex < content.length) {
            const timeout = setTimeout(() => {
                setDisplayedContent(prev => prev + content[currentIndex])
                setCurrentIndex(prev => prev + 1)
            }, speed)

            return () => clearTimeout(timeout)
        } else {
            onComplete?.()
        }
    }, [currentIndex, content, speed, onComplete])

    return (
        <div className={className}>
            {displayedContent}
            {currentIndex < content.length && (
                <span className="inline-block w-1.5 h-3.5 bg-accent ml-0.5 animate-pulse align-middle" />
            )}
        </div>
    )
}
