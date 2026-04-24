import { useState, useEffect, useCallback, useRef } from 'react'

const BUFFER = 10 // extra items above/below viewport

interface VirtualGridResult<T> {
  scrollRef: React.RefObject<HTMLDivElement>
  onScroll: () => void
  visibleItems: T[]
  topPadding: number
  bottomPadding: number
  totalHeight: number
  containerProps: {
    ref: React.RefObject<HTMLDivElement>
    onScroll: () => void
    style: React.CSSProperties
  }
}

export function useVirtualGrid<T>(
  items: T[],
  rowHeight: number,
  gap: number,
  containerPadding: number,
  minColWidth: number
): VirtualGridResult<T> {
  const scrollRef = useRef<HTMLDivElement>(null!)
  const [range, setRange] = useState({ start: 0, end: 100 })
  const itemsRef = useRef(items)
  itemsRef.current = items

  const getColCount = useCallback(() => {
    const el = scrollRef.current
    if (!el) return 4
    const availableWidth = el.clientWidth - containerPadding * 2
    return Math.max(1, Math.floor((availableWidth + gap) / (minColWidth + gap)))
  }, [gap, containerPadding, minColWidth])

  const recalc = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const cols = getColCount()
    const totalRows = Math.ceil(itemsRef.current.length / cols)
    const effectiveRowHeight = rowHeight + gap
    const scrollTop = el.scrollTop
    const viewportHeight = el.clientHeight

    const firstVisibleRow = Math.floor(scrollTop / effectiveRowHeight)
    const lastVisibleRow = Math.ceil((scrollTop + viewportHeight) / effectiveRowHeight)

    const startRow = Math.max(0, firstVisibleRow - BUFFER)
    const endRow = Math.min(totalRows, lastVisibleRow + BUFFER)

    const start = startRow * cols
    const end = Math.min(endRow * cols, itemsRef.current.length)

    setRange((prev) => {
      if (prev.start === start && prev.end === end) return prev
      return { start, end }
    })
  }, [getColCount, rowHeight, gap])

  // Recalc on items change
  useEffect(() => { recalc() }, [items.length, recalc])

  // Recalc on resize
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const obs = new ResizeObserver(() => recalc())
    obs.observe(el)
    return () => obs.disconnect()
  }, [recalc])

  const cols = scrollRef.current ? getColCount() : 4
  const effectiveRowHeight = rowHeight + gap
  const totalRows = Math.ceil(items.length / cols)
  const totalHeight = totalRows * effectiveRowHeight - gap + containerPadding * 2

  const startRow = Math.floor(range.start / cols)
  const endRow = Math.ceil(range.end / cols)
  const topPadding = containerPadding + startRow * effectiveRowHeight
  const bottomPadding = Math.max(0, (totalRows - endRow) * effectiveRowHeight + containerPadding)

  const visibleItems = items.slice(range.start, range.end)

  return {
    scrollRef,
    onScroll: recalc,
    visibleItems,
    topPadding,
    bottomPadding,
    totalHeight,
    containerProps: {
      ref: scrollRef,
      onScroll: recalc,
      style: { flex: 1, overflow: 'auto' }
    }
  }
}

interface VirtualListResult<T> {
  visibleItems: T[]
  topPadding: number
  bottomPadding: number
  containerProps: {
    ref: React.RefObject<HTMLDivElement>
    onScroll: () => void
    style: React.CSSProperties
  }
}

export function useVirtualList<T>(
  items: T[],
  rowHeight: number
): VirtualListResult<T> {
  const scrollRef = useRef<HTMLDivElement>(null!)
  const [range, setRange] = useState({ start: 0, end: 100 })
  const itemsRef = useRef(items)
  itemsRef.current = items

  const recalc = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const scrollTop = el.scrollTop
    const viewportHeight = el.clientHeight

    const firstVisible = Math.floor(scrollTop / rowHeight)
    const lastVisible = Math.ceil((scrollTop + viewportHeight) / rowHeight)

    const start = Math.max(0, firstVisible - BUFFER)
    const end = Math.min(itemsRef.current.length, lastVisible + BUFFER)

    setRange((prev) => {
      if (prev.start === start && prev.end === end) return prev
      return { start, end }
    })
  }, [rowHeight])

  useEffect(() => { recalc() }, [items.length, recalc])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const obs = new ResizeObserver(() => recalc())
    obs.observe(el)
    return () => obs.disconnect()
  }, [recalc])

  const totalHeight = items.length * rowHeight
  const topPadding = range.start * rowHeight
  const bottomPadding = Math.max(0, (items.length - range.end) * rowHeight)
  const visibleItems = items.slice(range.start, range.end)

  return {
    visibleItems,
    topPadding,
    bottomPadding,
    containerProps: {
      ref: scrollRef,
      onScroll: recalc,
      style: { flex: 1, overflow: 'auto' }
    }
  }
}
