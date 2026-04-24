import { useAppStore, sortVideos, refreshVideos } from '../../store/app-store'
import { usePlayerStore } from '../../store/player-store'
import type { VideoFile } from '../../../shared/types'
import { List, LayoutGrid, X, Trash2 } from 'lucide-react'
import { useConfirmDialog } from '../shared/ConfirmDialog'

function shuffleArray<T>(arr: T[]): T[] {
  const shuffled = [...arr]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

export function QuickButtons() {
  const videos = useAppStore((s) => s.videos)
  const setView = useAppStore((s) => s.setView)
  const viewMode = useAppStore((s) => s.viewMode)
  const setViewMode = useAppStore((s) => s.setViewMode)
  const searchQuery = useAppStore((s) => s.searchQuery)
  const setSearchQuery = useAppStore((s) => s.setSearchQuery)
  const currentFolderOnly = useAppStore((s) => s.currentFolderOnly)
  const setCurrentFolderOnly = useAppStore((s) => s.setCurrentFolderOnly)
  const selectedFolder = useAppStore((s) => s.selectedFolder)
  const selectedVideos = useAppStore((s) => s.selectedVideos)
  const clearSelection = useAppStore((s) => s.clearSelection)
  const sortField = useAppStore((s) => s.sortField)
  const sortDir = useAppStore((s) => s.sortDir)
  const { confirm, dialog } = useConfirmDialog()

  const getPlayableVideos = (): VideoFile[] => {
    // If videos are selected, use those from the Map (spans all folders)
    if (selectedVideos.size > 0) {
      const selected = Array.from(selectedVideos.values())
      return sortVideos(selected, sortField, sortDir)
    }
    // Otherwise use currently filtered/sorted videos
    let filtered = currentFolderOnly && selectedFolder && selectedFolder !== '__recent__'
      ? videos.filter((v) => v.folder.replace(/\\/g, '/') === selectedFolder!.replace(/\\/g, '/'))
      : videos
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      filtered = filtered.filter((v) => v.name.toLowerCase().includes(q))
    }
    return sortVideos(filtered, sortField, sortDir)
  }

  const startPlaylist = (mode: 'sequential' | 'random') => {
    const playable = getPlayableVideos()
    if (playable.length === 0) return
    const ordered: VideoFile[] = mode === 'random' ? shuffleArray(playable) : playable
    const store = usePlayerStore.getState()
    store.setPlaylist(ordered, mode)
    store.setPlaylistIndex(0)
    store.setCurrentVideo(ordered[0])
    setView('player')
  }

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '4px 12px',
      borderTop: '1px solid var(--border)'
    }}>
      <button onClick={() => startPlaylist('random')}>Play randomized</button>
      <button onClick={() => startPlaylist('sequential')}>Play in order</button>

      {selectedVideos.size > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--accent)' }}>
          <span>{selectedVideos.size} selected</span>
          <button
            onClick={clearSelection}
            title="Clear selection"
            style={{
              background: 'transparent',
              padding: '2px',
              minWidth: 0,
              display: 'flex',
              alignItems: 'center',
              color: 'var(--text-secondary)'
            }}
          >
            <X size={14} />
          </button>
          <button
            onClick={async () => {
              const count = selectedVideos.size
              const ok = await confirm(
                'Delete files',
                `Move ${count} file${count > 1 ? 's' : ''} to the recycle bin?`,
                'Delete'
              )
              if (!ok) return
              await window.api.deleteFiles(Array.from(selectedVideos.keys()))
              clearSelection()
              await refreshVideos()
            }}
            title="Delete selected"
            style={{
              background: 'transparent',
              padding: '2px',
              minWidth: 0,
              display: 'flex',
              alignItems: 'center',
              color: '#c44'
            }}
          >
            <Trash2 size={14} />
          </button>
        </div>
      )}

      <div style={{ flex: 1 }} />

      {selectedFolder && selectedFolder !== '__recent__' && (
        <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-secondary)', cursor: 'pointer', userSelect: 'none' }}>
          <input
            type="checkbox"
            checked={currentFolderOnly}
            onChange={(e) => setCurrentFolderOnly(e.target.checked)}
            style={{ margin: 0 }}
          />
          No subfolders
        </label>
      )}

      <input
        type="text"
        placeholder="Search..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        style={{
          width: 180,
          padding: '4px 8px',
          fontSize: 12
        }}
      />

      <button
        onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
        title={viewMode === 'grid' ? 'Switch to list view' : 'Switch to grid view'}
        style={{
          padding: '4px 8px',
          fontSize: 14,
          minWidth: 30,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        {viewMode === 'grid' ? <List size={16} /> : <LayoutGrid size={16} />}
      </button>
      {dialog}
    </div>
  )
}
