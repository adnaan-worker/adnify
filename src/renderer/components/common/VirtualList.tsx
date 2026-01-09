/**
 * 通用虚拟列表组件
 * 只渲染可见区域的项目，提升大列表性能
 */

import { useRef, useState, useEffect, useCallback, useMemo, ReactNode, forwardRef, useImperativeHandle } from 'react'

export interface VirtualListProps<T> {
  /** 数据项数组 */
  items: T[]
  /** 每项的高度（像素） */
  itemHeight: number
  /** 渲染单个项目 */
  renderItem: (item: T, index: number, style: React.CSSProperties) => ReactNode
  /** 获取项目的唯一 key */
  getKey: (item: T, index: number) => string | number
  /** 容器类名 */
  className?: string
  /** 额外渲染的缓冲区项目数 */
  bufferSize?: number
  /** 空列表时显示的内容 */
  emptyContent?: ReactNode
  /** 滚动事件回调 */
  onScroll?: (scrollTop: number) => void
  /** 容器样式 */
  style?: React.CSSProperties
  /** 内容区域额外样式 */
  contentStyle?: React.CSSProperties
}

export interface VirtualListRef {
  scrollToIndex: (index: number, behavior?: ScrollBehavior) => void
  scrollToTop: () => void
  scrollToBottom: () => void
  getScrollTop: () => number
}

function VirtualListInner<T>(
  {
    items,
    itemHeight,
    renderItem,
    getKey,
    className = '',
    bufferSize = 5,
    emptyContent,
    onScroll,
    style,
    contentStyle,
  }: VirtualListProps<T>,
  ref: React.Ref<VirtualListRef>
) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [containerHeight, setContainerHeight] = useState(0)

  // 暴露方法给父组件
  useImperativeHandle(ref, () => ({
    scrollToIndex: (index: number, behavior: ScrollBehavior = 'smooth') => {
      if (containerRef.current) {
        const top = index * itemHeight
        containerRef.current.scrollTo({ top, behavior })
      }
    },
    scrollToTop: () => {
      containerRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
    },
    scrollToBottom: () => {
      if (containerRef.current) {
        containerRef.current.scrollTo({ 
          top: containerRef.current.scrollHeight, 
          behavior: 'smooth' 
        })
      }
    },
    getScrollTop: () => scrollTop,
  }))

  // 监听容器尺寸变化
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerHeight(entry.contentRect.height)
      }
    })

    observer.observe(container)
    setContainerHeight(container.clientHeight)

    return () => observer.disconnect()
  }, [])

  // 计算可见范围
  const visibleRange = useMemo(() => {
    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - bufferSize)
    const endIndex = Math.min(
      items.length,
      Math.ceil((scrollTop + containerHeight) / itemHeight) + bufferSize
    )
    return { startIndex, endIndex }
  }, [scrollTop, containerHeight, items.length, itemHeight, bufferSize])

  // 可见项目
  const visibleItems = useMemo(() => {
    return items.slice(visibleRange.startIndex, visibleRange.endIndex)
  }, [items, visibleRange])

  // 总高度
  const totalHeight = items.length * itemHeight

  // 滚动处理
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const newScrollTop = e.currentTarget.scrollTop
    setScrollTop(newScrollTop)
    onScroll?.(newScrollTop)
  }, [onScroll])

  if (items.length === 0 && emptyContent) {
    return (
      <div ref={containerRef} className={`overflow-y-auto custom-scrollbar ${className}`} style={style}>
        {emptyContent}
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className={`overflow-y-auto custom-scrollbar ${className}`}
      onScroll={handleScroll}
      style={style}
    >
      <div style={{ height: totalHeight, position: 'relative', ...contentStyle }}>
        {visibleItems.map((item, index) => {
          const actualIndex = visibleRange.startIndex + index
          const itemStyle: React.CSSProperties = {
            position: 'absolute',
            top: actualIndex * itemHeight,
            left: 0,
            right: 0,
            height: itemHeight,
          }
          return (
            <div key={getKey(item, actualIndex)} style={itemStyle}>
              {renderItem(item, actualIndex, {})}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// 使用 forwardRef 包装，支持泛型
export const VirtualList = forwardRef(VirtualListInner) as <T>(
  props: VirtualListProps<T> & { ref?: React.Ref<VirtualListRef> }
) => ReactNode

// 导出 hook 用于获取 ref
export function useVirtualListRef() {
  return useRef<VirtualListRef>(null)
}
