import { useRef, useCallback } from 'react'
import { usePlayerStore } from '../../store/player-store'
import { useAppStore } from '../../store/app-store'
import { getMpv } from '../../mpv'
import { SeekBar } from './SeekBar'
import { SkipBack, Pause, Play, SkipForward, Volume2, VolumeX, Volume1 } from 'lucide-react'

function setVol(vol: number) {
  const clamped = Math.max(0, Math.min(200, Math.round(vol)))
  usePlayerStore.getState().setVolume(clamped)
  window.api.setVolume(clamped)
  const mpv = getMpv()
  if (mpv) mpv.setPropertyDouble('volume', clamped)
}

function VolumeIcon({ volume }: { volume: number }) {
  if (volume === 0) return <VolumeX size={16} />
  if (volume < 50) return <Volume1 size={16} />
  return <Volume2 size={16} />
}

/** VLC-style slanted volume slider */
function VolumeSlider() {
  const volume = usePlayerStore((s) => s.volume)
  const trackRef = useRef<HTMLDivElement>(null)
  const draggingRef = useRef(false)

  // Slider dimensions
  const W = 100
  const H = 32      // track area height
  const MIN_H = 3   // thin end (left)
  const MAX_H = H   // tall end (right)

  const fractionFromEvent = useCallback((clientX: number) => {
    if (!trackRef.current) return 0
    const rect = trackRef.current.getBoundingClientRect()
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
  }, [])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    draggingRef.current = true
    const frac = fractionFromEvent(e.clientX)
    setVol(frac * 125)

    const onMove = (ev: MouseEvent) => {
      if (!draggingRef.current) return
      const f = fractionFromEvent(ev.clientX)
      setVol(f * 125)
    }
    const onUp = () => {
      draggingRef.current = false
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [fractionFromEvent])

  // Volume fraction relative to the 125% slider max
  const sliderFrac = Math.min(volume / 125, 1)

  // Build the slanted shape using clip-path polygon
  // Track: full trapezoid from (0, H-MIN_H) to (0, H) to (W, 0) to (W, H)
  // Actually: left edge is thin, right edge is tall
  // Top-left: (0, H - MIN_H), Top-right: (W, H - MAX_H) = (W, 0), Bottom: full width at H

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
      {/* Volume text indicator */}
      <span style={{
        fontSize: 10,
        color: 'rgba(255,255,255,0.7)',
        paddingRight: 2,
        userSelect: 'none'
      }}>
        {volume}%
      </span>

      {/* Slanted track */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <VolumeIcon volume={volume} />
        <div
          ref={trackRef}
          onMouseDown={handleMouseDown}
          style={{
            width: W,
            height: H,
            position: 'relative',
            cursor: 'pointer'
          }}
        >
          {/* Background track (gray trapezoid) */}
          <div style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(255,255,255,0.15)',
            clipPath: `polygon(0% ${((H - MIN_H) / H) * 100}%, 100% 0%, 100% 100%, 0% 100%)`
          }} />

          {/* Filled portion (gradient trapezoid, clipped to volume fraction) */}
          <div style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: `${sliderFrac * 100}%`,
            height: '100%',
            background: 'linear-gradient(to right, #4caf50, #ffeb3b, #f44336)',
            clipPath: `polygon(0% ${((H - MIN_H) / H) * 100}%, 100% ${((H - (MIN_H + (MAX_H - MIN_H) * sliderFrac)) / H) * 100}%, 100% 100%, 0% 100%)`
          }} />

          {/* Thumb indicator line */}
          {volume > 0 && (
            <div style={{
              position: 'absolute',
              left: `${sliderFrac * 100}%`,
              top: 0,
              bottom: 0,
              width: 2,
              background: '#fff',
              transform: 'translateX(-1px)',
              boxShadow: '0 0 4px rgba(0,0,0,0.5)',
              pointerEvents: 'none'
            }} />
          )}
        </div>
      </div>
    </div>
  )
}

export function Controls() {
  const isPlaying = usePlayerStore((s) => s.isPlaying)
  const playlist = usePlayerStore((s) => s.playlist)
  const playlistIndex = usePlayerStore((s) => s.playlistIndex)

  const inPlaylistMode = playlist.length > 1

  const togglePause = () => {
    const mpv = getMpv()
    if (!mpv) return
    const paused = mpv.getPropertyBool('pause')
    mpv.setPropertyBool('pause', !paused)
    if (useAppStore.getState().funscriptEnabled) {
      if (paused) {
        const pos = mpv.getPropertyDouble('time-pos') || 0
        window.api.handyOnPlay(pos * 1000)
      } else {
        window.api.handyOnPause()
      }
    }
  }

  const playPrev = () => {
    if (!inPlaylistMode) return
    const prev = Math.max(0, playlistIndex - 1)
    if (prev === playlistIndex) return
    usePlayerStore.getState().setScriptOverride(null)
    usePlayerStore.getState().setPlaylistIndex(prev)
    usePlayerStore.getState().setCurrentVideo(playlist[prev])
  }

  const playNext = () => {
    if (!inPlaylistMode) return
    const next = Math.min(playlist.length - 1, playlistIndex + 1)
    if (next === playlistIndex) return
    usePlayerStore.getState().setScriptOverride(null)
    usePlayerStore.getState().setPlaylistIndex(next)
    usePlayerStore.getState().setCurrentVideo(playlist[next])
  }

  return (
    <div onClick={(e) => e.stopPropagation()} style={{
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      background: 'linear-gradient(to top, rgba(0,0,0,0.8), transparent)',
      padding: '40px 16px 16px',
      zIndex: 10,
      overflow: 'visible'
    }}>
      {/* Row: playback buttons (center) + volume (right) */}
      <div style={{
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        marginBottom: 8,
        position: 'relative'
      }}>
        {/* Center: playback controls */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          position: 'absolute',
          left: '50%',
          transform: 'translateX(-50%)'
        }}>
          {inPlaylistMode && (
            <button onClick={playPrev} style={{
              background: 'rgba(0,0,0,0.45)',
              width: 36, height: 36,
              borderRadius: '50%',
              padding: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0
            }}>
              <SkipBack size={16} />
            </button>
          )}
          <button
            onClick={togglePause}
            style={{
              background: 'rgba(0,0,0,0.45)',
              width: 44, height: 44,
              borderRadius: '50%',
              padding: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0
            }}
          >
            {isPlaying ? <Pause size={22} /> : <Play size={22} />}
          </button>
          {inPlaylistMode && (
            <button onClick={playNext} style={{
              background: 'rgba(0,0,0,0.45)',
              width: 36, height: 36,
              borderRadius: '50%',
              padding: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0
            }}>
              <SkipForward size={16} />
            </button>
          )}
        </div>

        {/* Right: volume control */}
        <div style={{ marginLeft: 'auto' }}>
          <VolumeSlider />
        </div>
      </div>

      {/* Bottom: seek bar */}
      <SeekBar />
    </div>
  )
}
