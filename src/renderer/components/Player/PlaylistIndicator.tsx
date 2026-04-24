import { usePlayerStore } from '../../store/player-store'

export function PlaylistIndicator() {
  const playlist = usePlayerStore((s) => s.playlist)
  const playlistIndex = usePlayerStore((s) => s.playlistIndex)
  const playlistMode = usePlayerStore((s) => s.playlistMode)

  if (playlist.length === 0 || !playlistMode) return null

  return (
    <div style={{
      background: 'rgba(255,255,255,0.15)',
      padding: '3px 10px',
      borderRadius: 12,
      fontSize: 13,
      fontWeight: 500
    }}>
      {playlistIndex + 1}/{playlist.length}
    </div>
  )
}
