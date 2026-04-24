import { useState, useEffect } from 'react'
import type { VideoFile } from '../../../shared/types'
import { refreshVideos, useAppStore } from '../../store/app-store'
import { playVideo } from './VideoCard'
import { ConfirmDialog } from '../shared/ConfirmDialog'
import { RenameDialog } from '../shared/RenameDialog'
import { Play, Pencil, Trash2, Star, StarOff, EyeOff, Eye, FolderOpen } from 'lucide-react'

interface Props {
  x: number
  y: number
  video: VideoFile
  onClose: () => void
}

function MenuItem({ onClick, children, danger, icon }: { onClick: () => void; children: React.ReactNode; danger?: boolean; icon?: React.ReactNode }) {
  const [hovered, setHovered] = useState(false)
  return (
    <div
      role="menuitem"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: '6px 16px',
        fontSize: 13,
        cursor: 'pointer',
        background: hovered ? 'var(--bg-tertiary)' : 'transparent',
        color: danger ? '#c44' : 'var(--text-primary)',
        whiteSpace: 'nowrap',
        userSelect: 'none',
        display: 'flex',
        alignItems: 'center',
        gap: 8
      }}
    >
      {icon && <span style={{ display: 'flex', alignItems: 'center', opacity: 0.7, flexShrink: 0 }}>{icon}</span>}
      {children}
    </div>
  )
}

type Mode = 'menu' | 'rename' | 'delete'

export function VideoContextMenu({ x, y, video, onClose }: Props) {
  const [mode, setMode] = useState<Mode>('menu')
  const selectedVideos = useAppStore((s) => s.selectedVideos)
  const clearSelection = useAppStore((s) => s.clearSelection)
  const favoritePaths = useAppStore((s) => s.favoritePaths)
  const hiddenPaths = useAppStore((s) => s.hiddenPaths)

  // Determine the set of affected paths
  const affectedPaths = selectedVideos.size > 0 && selectedVideos.has(video.path)
    ? Array.from(selectedVideos.keys())
    : [video.path]
  const isMulti = affectedPaths.length > 1

  // Check current state for the right-clicked video
  const isFavorited = favoritePaths.has(video.path)
  const isHidden = hiddenPaths.has(video.path)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const menuWidth = 220
  const menuHeight = 240
  const clampedX = Math.min(x, window.innerWidth - menuWidth)
  const clampedY = Math.min(y, window.innerHeight - menuHeight)

  const handlePlay = () => {
    onClose()
    playVideo(video)
  }

  const handleToggleFavorite = async () => {
    onClose()
    const favs: string[] = await window.api.getFavorites()
    const favSet = new Set(favs)
    if (isFavorited) {
      for (const p of affectedPaths) favSet.delete(p)
    } else {
      for (const p of affectedPaths) favSet.add(p)
    }
    const updated = Array.from(favSet)
    await window.api.setFavorites(updated)
    useAppStore.getState().setFavoritePaths(favSet)
    await refreshVideos()
  }

  const handleToggleHidden = async () => {
    onClose()
    const hidden: string[] = await window.api.getHiddenVideos()
    const hiddenSet = new Set(hidden)
    if (isHidden) {
      for (const p of affectedPaths) hiddenSet.delete(p)
    } else {
      for (const p of affectedPaths) hiddenSet.add(p)
    }
    const updated = Array.from(hiddenSet)
    await window.api.setHiddenVideos(updated)
    useAppStore.getState().setHiddenPaths(hiddenSet)
    await refreshVideos()
  }

  const handleOpenLocation = () => {
    onClose()
    window.api.openFileLocation(video.path)
  }

  if (mode === 'rename') {
    return (
      <RenameDialog
        videoPath={video.path}
        currentName={video.name}
        onDone={async () => { onClose(); await refreshVideos() }}
        onCancel={onClose}
      />
    )
  }

  if (mode === 'delete') {
    const count = affectedPaths.length
    return (
      <ConfirmDialog
        title={count > 1 ? `Delete ${count} files` : 'Delete file'}
        message={count > 1
          ? `Move ${count} selected files to the recycle bin?`
          : `Move "${video.name}" to the recycle bin?`}
        confirmLabel="Delete"
        onConfirm={async () => {
          onClose()
          try {
            await window.api.deleteFiles(affectedPaths)
            if (isMulti) clearSelection()
            await refreshVideos()
          } catch (err: any) {
            alert('Failed to delete: ' + err.message)
          }
        }}
        onCancel={onClose}
      />
    )
  }

  return (
    <>
      <div
        onClick={(e) => { e.stopPropagation(); onClose() }}
        onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); onClose() }}
        style={{ position: 'fixed', inset: 0, zIndex: 9998 }}
      />
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'fixed',
          left: clampedX,
          top: clampedY,
          zIndex: 9999,
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          borderRadius: 6,
          boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
          minWidth: 180,
          padding: '4px 0',
          overflow: 'hidden'
        }}
      >
        {!isMulti && <MenuItem onClick={handlePlay} icon={<Play size={14} />}>Play</MenuItem>}
        {!isMulti && <MenuItem onClick={() => setMode('rename')} icon={<Pencil size={14} />}>Rename</MenuItem>}
        <MenuItem onClick={() => setMode('delete')} danger icon={<Trash2 size={14} />}>
          {isMulti ? `Delete ${affectedPaths.length} files` : 'Delete'}
        </MenuItem>
        <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
        <MenuItem onClick={handleToggleFavorite} icon={isFavorited ? <StarOff size={14} /> : <Star size={14} />}>
          {isFavorited ? 'Unfavorite' : 'Favorite'}
        </MenuItem>
        <MenuItem onClick={handleToggleHidden} icon={isHidden ? <Eye size={14} /> : <EyeOff size={14} />}>
          {isHidden ? 'Unhide' : 'Hide'}
        </MenuItem>
        {!isMulti && (
          <>
            <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
            <MenuItem onClick={handleOpenLocation} icon={<FolderOpen size={14} />}>Open file location</MenuItem>
          </>
        )}
      </div>
    </>
  )
}
