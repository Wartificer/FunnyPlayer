import { useEffect, useState, useRef } from 'react'
import { useAppStore, sortVideos } from '../../store/app-store'
import { usePlayerStore } from '../../store/player-store'
import { useMediaLoader } from '../../hooks/useMediaLoader'
import type { VideoFile } from '../../../shared/types'
import { Play, Check, ChevronDown, Star } from 'lucide-react'
import { VideoContextMenu } from './VideoContextMenu'

const CARD_HEIGHT = 200

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

export function playVideo(video: VideoFile, scriptPath?: string) {
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

export function VideoCard({ video }: { video: VideoFile }) {
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
      playVideo(video)
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
    playVideo(video, scriptPath)
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
        cursor: 'pointer',
        borderRadius: 6,
        overflow: dropdownOpen ? 'visible' : 'hidden',
        background: 'var(--bg-secondary)',
        border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
        transition: 'border-color 0.2s',
        height: CARD_HEIGHT,
        display: 'flex',
        flexDirection: 'column',
        position: 'relative'
      }}
    >
      {/* Selection checkbox */}
      {showCheckbox && (
        <div
          onClick={handleCheckboxClick}
          style={{
            position: 'absolute',
            top: 6,
            left: 6,
            zIndex: 5,
            width: 22,
            height: 22,
            borderRadius: 4,
            background: isSelected ? 'var(--accent)' : 'rgba(0,0,0,0.6)',
            border: `2px solid ${isSelected ? 'var(--accent)' : 'rgba(255,255,255,0.5)'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer'
          }}
        >
          {isSelected && <Check size={14} color="#fff" strokeWidth={3} />}
        </div>
      )}

      <div style={{
        position: 'relative',
        flex: 1,
        minHeight: 0,
        background: '#111',
        filter: !funscriptEnabled || video.hasFunscript ? 'none' : 'grayscale(1)',
        opacity: !funscriptEnabled || video.hasFunscript ? 1 : 0.6
      }}>
        {thumbUrl ? (
          <img
            src={thumbUrl}
            alt=""
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover'
            }}
          />
        ) : (
          <div style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Play size={40} color="var(--text-secondary)" fill="var(--text-secondary)" />
          </div>
        )}

        {funscriptEnabled && !video.hasFunscript && (
          <div style={{
            position: 'absolute',
            top: 6,
            right: 6,
            background: 'rgba(233, 69, 96, 0.9)',
            color: '#fff',
            fontSize: 10,
            fontWeight: 700,
            padding: '2px 6px',
            borderRadius: 3
          }}>
            No script
          </div>
        )}

        {duration !== null && (
          <div style={{
            position: 'absolute',
            bottom: 0,
            right: 0,
            background: 'rgba(0,0,0,0.75)',
            color: '#fff',
            fontSize: 11,
            fontWeight: 600,
            padding: '2px 5px',
            borderTopLeftRadius: 5,
            lineHeight: 1.4,
            pointerEvents: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: 4
          }}>
            {isFavorite && <Star size={11} fill="#f5c518" color="#f5c518" />}
            {formatDuration(duration)}
          </div>
        )}

        {isFavorite && duration === null && (
          <div style={{
            position: 'absolute',
            bottom: 2,
            right: 4,
            pointerEvents: 'none'
          }}>
            <Star size={13} fill="#f5c518" color="#f5c518" />
          </div>
        )}
      </div>

      {/* Title bar with optional variant dropdown */}
      <div style={{
        padding: '6px 8px',
        fontSize: 12,
        lineHeight: '1.4',
        height: 42,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        position: 'relative'
      }}>
        <div style={{
          flex: 1,
          minWidth: 0,
          overflow: 'hidden',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical' as const,
          wordBreak: 'break-word' as const
        }}>
          {video.name}
        </div>

        {funscriptEnabled && hasVariants && !anySelected && (
          <div ref={dropdownRef} style={{ position: 'relative', flexShrink: 0 }}>
            <div
              onClick={handleDropdownToggle}
              style={{
                width: 20,
                height: 20,
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
                bottom: 24,
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
                    style={{
                      padding: '6px 12px',
                      fontSize: 12,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap'
                    }}
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
                    style={{
                      padding: '6px 12px',
                      fontSize: 12,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      textTransform: 'capitalize'
                    }}
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
      </div>

      {ctxMenu && (
        <VideoContextMenu x={ctxMenu.x} y={ctxMenu.y} video={video} onClose={() => setCtxMenu(null)} />
      )}
    </div>
  )
}
