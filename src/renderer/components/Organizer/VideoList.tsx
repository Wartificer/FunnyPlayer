import { useEffect, useState, useRef } from 'react'
import { useAppStore, sortVideos, refreshVideos, type SortField } from '../../store/app-store'
import { usePlayerStore } from '../../store/player-store'
import { useMediaLoader } from '../../hooks/useMediaLoader'
import { useVirtualList } from '../../hooks/useInfiniteScroll'
import type { VideoFile } from '../../../shared/types'
import { ChevronUp, ChevronDown, Play, Check, Star } from 'lucide-react'
import { VideoContextMenu } from './VideoContextMenu'

function formatSize(bytes: number): string {
  if (bytes === 0) return '-'
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

function formatDate(ms: number): string {
  if (ms === 0) return '-'
  const d = new Date(ms)
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

function SortableHeader({ field, label, width, align }: { field: SortField; label: string; width?: number; align?: string }) {
  const sortField = useAppStore((s) => s.sortField)
  const sortDir = useAppStore((s) => s.sortDir)
  const setSort = useAppStore((s) => s.setSort)
  const active = sortField === field

  return (
    <div
      onClick={() => setSort(field)}
      style={{
        width,
        flexShrink: width ? 0 : undefined,
        flex: width ? undefined : 1,
        textAlign: (align || 'left') as any,
        cursor: 'pointer',
        userSelect: 'none',
        color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
        fontWeight: active ? 700 : 600
      }}
    >
      {label} {active && (sortDir === 'asc' ? <ChevronUp size={11} style={{ display: 'inline' }} /> : <ChevronDown size={11} style={{ display: 'inline' }} />)}
    </div>
  )
}

function playVideoFromList(video: VideoFile, scriptPath?: string) {
  const { videos, selectedFolder, currentFolderOnly, searchQuery, sortField, sortDir } = useAppStore.getState()
  let list = currentFolderOnly && selectedFolder && selectedFolder !== '__recent__'
    ? videos.filter((v) => v.folder.replace(/\\/g, '/') === selectedFolder!.replace(/\\/g, '/'))
    : videos
  if (searchQuery) {
    const q = searchQuery.toLowerCase()
    list = list.filter((v) => v.name.toLowerCase().includes(q))
  }
  const sorted = sortVideos(list, sortField, sortDir)
  const idx = sorted.findIndex((v) => v.path === video.path)
  const store = usePlayerStore.getState()
  store.setScriptOverride(scriptPath ?? null)
  store.setPlaylist(sorted, null)
  store.setPlaylistIndex(idx >= 0 ? idx : 0)
  store.setCurrentVideo(video)
  useAppStore.getState().setView('player')
}

function VideoListItem({ video }: { video: VideoFile }) {
  const selectedVideos = useAppStore((s) => s.selectedVideos)
  const toggleSelection = useAppStore((s) => s.toggleSelection)
  const funscriptEnabled = useAppStore((s) => s.funscriptEnabled)
  const isFavorite = useAppStore((s) => s.favoritePaths.has(video.path))
  const { thumbUrl, duration } = useMediaLoader(video.path)
  const [hovered, setHovered] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const isSelected = selectedVideos.has(video.path)
  const anySelected = selectedVideos.size > 0
  const hasVariants = video.alternateScripts && video.alternateScripts.length > 0

  useEffect(() => {
    if (!dropdownOpen) return
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [dropdownOpen])

  const handleClick = () => {
    if (anySelected) {
      toggleSelection(video)
    } else {
      playVideoFromList(video)
    }
  }

  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    toggleSelection(video)
  }

  const handleDropdownToggle = (e: React.MouseEvent) => {
    e.stopPropagation()
    setDropdownOpen(!dropdownOpen)
  }

  const handleVariantClick = (scriptPath: string) => {
    setDropdownOpen(false)
    playVideoFromList(video, scriptPath)
  }

  const showCheckbox = hovered || anySelected

  return (
    <div
      onClick={handleClick}
      onContextMenu={(e) => { e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY }) }}
      draggable
      onDragStart={(e) => {
        const paths = selectedVideos.has(video.path)
          ? Array.from(selectedVideos.keys())
          : [video.path]
        e.dataTransfer.setData('application/x-funnyplayer-videos', JSON.stringify(paths))
        e.dataTransfer.effectAllowed = 'move'
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setDropdownOpen(false) }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '6px 12px',
        cursor: 'pointer',
        borderBottom: '1px solid var(--border)',
        transition: 'background 0.15s',
        background: isSelected ? 'rgba(var(--accent-rgb, 99,102,241), 0.1)' : 'transparent',
        position: 'relative'
      }}
    >
      {/* Checkbox */}
      <div
        onClick={showCheckbox ? handleCheckboxClick : undefined}
        style={{
          width: 20,
          height: 20,
          flexShrink: 0,
          borderRadius: 4,
          background: showCheckbox ? (isSelected ? 'var(--accent)' : 'rgba(255,255,255,0.1)') : 'transparent',
          border: showCheckbox ? `2px solid ${isSelected ? 'var(--accent)' : 'rgba(255,255,255,0.3)'}` : '2px solid transparent',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: showCheckbox ? 'pointer' : 'default'
        }}
      >
        {isSelected && <Check size={12} color="#fff" strokeWidth={3} />}
      </div>

      {/* Thumbnail */}
      <div style={{
        width: 80,
        height: 45,
        flexShrink: 0,
        background: '#111',
        borderRadius: 4,
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        filter: !funscriptEnabled || video.hasFunscript ? 'none' : 'grayscale(1)',
        opacity: !funscriptEnabled || video.hasFunscript ? 1 : 0.6
      }}>
        {thumbUrl ? (
          <img src={thumbUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <Play size={20} color="var(--text-secondary)" fill="var(--text-secondary)" />
        )}
      </div>

      {/* Favorite star */}
      {isFavorite && (
        <Star size={16} fill="#f5c518" color="#f5c518" style={{ flexShrink: 0 }} />
      )}

      {/* Title */}
      <div style={{
        flex: 1,
        minWidth: 0,
        fontSize: 13,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis'
      }}>
        {video.name}
      </div>

      {/* Script badge */}
      {funscriptEnabled && !video.hasFunscript && (
        <span style={{
          flexShrink: 0,
          background: 'rgba(233, 69, 96, 0.9)',
          color: '#fff',
          fontSize: 10,
          fontWeight: 700,
          padding: '2px 6px',
          borderRadius: 3
        }}>
          No script
        </span>
      )}

      {/* Script variant dropdown */}
      {funscriptEnabled && hasVariants && !anySelected && (
        <div ref={dropdownRef} style={{ position: 'relative', flexShrink: 0 }}>
          <div
            onClick={handleDropdownToggle}
            style={{
              width: 22,
              height: 22,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 3,
              background: 'rgba(255,255,255,0.1)',
              cursor: 'pointer'
            }}
          >
            <ChevronDown size={14} />
          </div>

          {dropdownOpen && (
            <div style={{
              position: 'absolute',
              bottom: 26,
              right: 0,
              background: 'var(--bg-primary)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              padding: '4px 0',
              minWidth: 140,
              zIndex: 50,
              boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
            }}>
              {video.funscriptPath && (
                <div
                  onClick={(e) => { e.stopPropagation(); handleVariantClick(video.funscriptPath!) }}
                  style={{ padding: '6px 12px', fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  Normal
                </div>
              )}
              {video.alternateScripts.map((v) => (
                <div
                  key={v.path}
                  onClick={(e) => { e.stopPropagation(); handleVariantClick(v.path) }}
                  style={{ padding: '6px 12px', fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap', textTransform: 'capitalize' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  {v.label}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Duration */}
      <span style={{ width: 60, textAlign: 'right', fontSize: 12, color: 'var(--text-secondary)', flexShrink: 0 }}>
        {duration !== null ? formatDuration(duration) : '-'}
      </span>

      {/* Size */}
      <span style={{ width: 70, textAlign: 'right', fontSize: 12, color: 'var(--text-secondary)', flexShrink: 0 }}>
        {formatSize(video.size)}
      </span>

      {/* Date */}
      <span style={{ width: 90, textAlign: 'right', fontSize: 12, color: 'var(--text-secondary)', flexShrink: 0 }}>
        {formatDate(video.lastModified)}
      </span>

      {ctxMenu && (
        <VideoContextMenu x={ctxMenu.x} y={ctxMenu.y} video={video} onClose={() => setCtxMenu(null)} />
      )}
    </div>
  )
}

export function VideoList() {
  const videos = useAppStore((s) => s.videos)
  const selectedFolder = useAppStore((s) => s.selectedFolder)
  const searchQuery = useAppStore((s) => s.searchQuery)
  const currentFolderOnly = useAppStore((s) => s.currentFolderOnly)
  const sortField = useAppStore((s) => s.sortField)
  const sortDir = useAppStore((s) => s.sortDir)
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
    if (!isRealFolder || !e.dataTransfer.files.length) return
    const { webUtils } = require('electron')
    const paths = Array.from(e.dataTransfer.files).map((f) => webUtils.getPathForFile(f)).filter(Boolean)
    await window.api.moveFiles(paths, selectedFolder!)
    await refreshVideos()
  }

  if (!selectedFolder) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
        Select a folder to browse videos
      </div>
    )
  }

  let filtered = currentFolderOnly && selectedFolder && selectedFolder !== '__recent__'
    ? videos.filter((v) => v.folder.replace(/\\/g, '/') === selectedFolder.replace(/\\/g, '/'))
    : videos

  if (searchQuery) {
    const q = searchQuery.toLowerCase()
    filtered = filtered.filter((v) => v.name.toLowerCase().includes(q))
  }

  const sorted = sortVideos(filtered, sortField, sortDir)
  const { visibleItems, topPadding, bottomPadding, containerProps } = useVirtualList(sorted, 58)

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
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '6px 12px',
        borderBottom: '1px solid var(--border)',
        fontSize: 11,
        textTransform: 'uppercase' as const
      }}>
        <div style={{ width: 20, flexShrink: 0 }} />
        <div style={{ width: 80, flexShrink: 0 }} />
        <SortableHeader field="name" label="Title" />
        {funscriptEnabled && <SortableHeader field="hasFunscript" label="Script" width={60} align="center" />}
        <SortableHeader field="duration" label="Duration" width={60} align="right" />
        <SortableHeader field="size" label="Size" width={70} align="right" />
        <SortableHeader field="lastModified" label="Modified" width={90} align="right" />
      </div>

      {/* Rows */}
      <div {...containerProps}>
        <div style={{ paddingTop: topPadding, paddingBottom: bottomPadding }}>
          {visibleItems.map((video) => (
            <VideoListItem key={video.path} video={video} />
          ))}
        </div>
      </div>
    </div>
  )
}
