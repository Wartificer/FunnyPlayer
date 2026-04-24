import { useEffect, useState, useRef, useCallback } from 'react'
import { useAppStore } from '../../store/app-store'
import { FolderTree } from './FolderTree'
import { VideoGrid } from './VideoGrid'
import { VideoList } from './VideoList'

export function OrganizerScreen() {
  const selectedFolder = useAppStore((s) => s.selectedFolder)
  const setVideos = useAppStore((s) => s.setVideos)
  const viewMode = useAppStore((s) => s.viewMode)
  const [treeWidth, setTreeWidth] = useState(240)
  const dragging = useRef(false)

  useEffect(() => {
    if (selectedFolder === '__recent__') {
      window.api.getRecentVideos().then(setVideos)
    } else if (selectedFolder === '__favorites__') {
      window.api.getFavoriteVideos().then(setVideos)
    } else if (selectedFolder === '__hidden__') {
      window.api.getHiddenVideoList().then(setVideos)
    } else if (selectedFolder) {
      window.api.getVideos(selectedFolder).then(setVideos)
    }
  }, [selectedFolder, setVideos])

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    dragging.current = true
    const onMove = (ev: MouseEvent) => {
      if (!dragging.current) return
      const w = Math.max(120, Math.min(ev.clientX, 600))
      setTreeWidth(w)
    }
    const onUp = () => {
      dragging.current = false
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [])

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      <div style={{ width: treeWidth, flexShrink: 0 }}>
        <FolderTree />
      </div>
      <div
        onMouseDown={onMouseDown}
        style={{
          width: 4,
          cursor: 'col-resize',
          flexShrink: 0,
          background: 'var(--border)',
        }}
      />
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', minHeight: 0 }}>
        {viewMode === 'grid' ? <VideoGrid /> : <VideoList />}
      </div>
    </div>
  )
}
