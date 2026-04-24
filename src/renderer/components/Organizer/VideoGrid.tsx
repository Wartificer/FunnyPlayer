import { useState } from 'react'
import { useAppStore, sortVideos, refreshVideos, type SortField } from '../../store/app-store'
import { VideoCard } from './VideoCard'
import { useVirtualGrid } from '../../hooks/useInfiniteScroll'
import { ChevronUp, ChevronDown } from 'lucide-react'

const CARD_HEIGHT = 200
const GRID_GAP = 16
const GRID_PADDING = 16
const MIN_COL_WIDTH = 200

const ALL_SORT_OPTIONS: { value: SortField; label: string }[] = [
  { value: 'name', label: 'Name' },
  { value: 'size', label: 'Size' },
  { value: 'duration', label: 'Duration' },
  { value: 'lastModified', label: 'Date modified' },
  { value: 'hasFunscript', label: 'Has script' },
]

export function VideoGrid() {
  const videos = useAppStore((s) => s.videos)
  const selectedFolder = useAppStore((s) => s.selectedFolder)
  const searchQuery = useAppStore((s) => s.searchQuery)
  const currentFolderOnly = useAppStore((s) => s.currentFolderOnly)
  const sortField = useAppStore((s) => s.sortField)
  const sortDir = useAppStore((s) => s.sortDir)
  const setSort = useAppStore((s) => s.setSort)
  const funscriptEnabled = useAppStore((s) => s.funscriptEnabled)
  const [dragOver, setDragOver] = useState(false)
  const dragCounter = useState({ current: 0 })[0]

  const isRealFolder = selectedFolder && !selectedFolder.startsWith('__')

  const handleDragOver = (e: React.DragEvent) => {
    if (!isRealFolder) return
    if (e.dataTransfer.types.includes('Files') && !e.dataTransfer.types.includes('application/x-funnyplayer-videos')) {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'move'
    }
  }

  const handleDragEnter = (e: React.DragEvent) => {
    if (!isRealFolder) return
    if (e.dataTransfer.types.includes('Files') && !e.dataTransfer.types.includes('application/x-funnyplayer-videos')) {
      dragCounter.current++
      setDragOver(true)
    }
  }

  const handleDragLeave = () => {
    dragCounter.current--
    if (dragCounter.current <= 0) {
      dragCounter.current = 0
      setDragOver(false)
    }
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    dragCounter.current = 0
    setDragOver(false)
    if (!isRealFolder) return
    if (!e.dataTransfer.files.length) return
    const { webUtils } = require('electron')
    const paths = Array.from(e.dataTransfer.files).map((f) => webUtils.getPathForFile(f)).filter(Boolean)
    try {
      await window.api.moveFiles(paths, selectedFolder!)
      await refreshVideos()
    } catch (err) {
      console.error('[Grid Drop] ERROR:', err)
    }
  }

  let filtered = currentFolderOnly && selectedFolder && !selectedFolder.startsWith('__')
    ? videos.filter((v) => v.folder.replace(/\\/g, '/') === selectedFolder.replace(/\\/g, '/'))
    : videos

  if (searchQuery) {
    const q = searchQuery.toLowerCase()
    filtered = filtered.filter((v) => v.name.toLowerCase().includes(q))
  }

  const sorted = sortVideos(filtered, sortField, sortDir)
  const { visibleItems, topPadding, bottomPadding, containerProps } = useVirtualGrid(
    sorted, CARD_HEIGHT, GRID_GAP, GRID_PADDING, MIN_COL_WIDTH
  )

  const SORT_OPTIONS = funscriptEnabled
    ? ALL_SORT_OPTIONS
    : ALL_SORT_OPTIONS.filter((o) => o.value !== 'hasFunscript')

  if (!selectedFolder) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
        Select a folder to browse videos
      </div>
    )
  }

  if (sorted.length === 0) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
        {searchQuery ? 'No videos match your search' : 'No videos found in this folder'}
      </div>
    )
  }

  return (
    <div
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, position: 'relative' }}
    >
      {dragOver && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 100,
          border: '2px dashed var(--accent)',
          borderRadius: 8,
          background: 'rgba(0,0,0,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'none'
        }}>
          <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--accent)' }}>
            Drop files to move them here
          </span>
        </div>
      )}
      {/* Sort header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '4px 16px',
        borderBottom: '1px solid var(--border)',
        fontSize: 11,
        color: 'var(--text-secondary)',
        flexShrink: 0
      }}>
        <span>Sort by:</span>
        <select
          value={sortField}
          onChange={(e) => setSort(e.target.value as SortField)}
          style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            color: 'var(--text-primary)',
            padding: '2px 6px',
            borderRadius: 3,
            fontSize: 11
          }}
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <button
          onClick={() => setSort(sortField, sortDir === 'asc' ? 'desc' : 'asc')}
          style={{
            background: 'transparent',
            padding: '1px 6px',
            fontSize: 12,
            minWidth: 0
          }}
        >
          {sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>
        <span style={{ marginLeft: 'auto' }}>{sorted.length} videos</span>
      </div>

      {/* Grid */}
      <div {...containerProps}>
        <div style={{ paddingTop: topPadding, paddingBottom: bottomPadding }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: `repeat(auto-fill, minmax(${MIN_COL_WIDTH}px, 1fr))`,
            gap: GRID_GAP,
            padding: `0 ${GRID_PADDING}px`,
            alignContent: 'start'
          }}>
            {visibleItems.map((video) => (
              <VideoCard key={video.path} video={video} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
