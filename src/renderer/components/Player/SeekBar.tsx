import { useRef, useState } from 'react'
import { usePlayerStore } from '../../store/player-store'
import { getMpv } from '../../mpv'

function formatTime(seconds: number): string {
  if (!isFinite(seconds)) return '0:00'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

export function SeekBar() {
  const position = usePlayerStore((s) => s.position)
  const duration = usePlayerStore((s) => s.duration)
  const spriteSheet = usePlayerStore((s) => s.spriteSheet)

  const trackRef = useRef<HTMLDivElement>(null)
  const [hoverX, setHoverX] = useState<number | null>(null)
  const [hoverFraction, setHoverFraction] = useState(0)

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const mpv = getMpv()
    if (!mpv || !duration) return
    const rect = e.currentTarget.getBoundingClientRect()
    const fraction = (e.clientX - rect.left) / rect.width
    const seekTo = fraction * duration
    mpv.setPropertyDouble('time-pos', seekTo)
    window.api.handyOnSeek(seekTo * 1000)
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const fraction = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    setHoverX(e.clientX - rect.left)
    setHoverFraction(fraction)
  }

  const handleMouseLeave = () => {
    setHoverX(null)
  }

  const progress = duration > 0 ? (position / duration) * 100 : 0

  // Calculate sprite sheet background position for hover preview
  let thumbStyle: React.CSSProperties | null = null
  if (spriteSheet && hoverX !== null && duration > 0) {
    const hoverTime = hoverFraction * duration
    const frameIndex = Math.min(
      Math.floor(hoverTime / spriteSheet.interval),
      spriteSheet.totalFrames - 1
    )
    const col = frameIndex % spriteSheet.cols
    const row = Math.floor(frameIndex / spriteSheet.cols)
    // Windows paths use backslashes — convert to forward slashes for file:// URL
    const spriteUrl = `file:///${spriteSheet.path.replace(/\\/g, '/')}`

    thumbStyle = {
      width: spriteSheet.thumbWidth,
      height: spriteSheet.thumbHeight,
      backgroundImage: `url("${spriteUrl}")`,
      backgroundPosition: `-${col * spriteSheet.thumbWidth}px -${row * spriteSheet.thumbHeight}px`,
      backgroundSize: `${spriteSheet.cols * spriteSheet.thumbWidth}px ${spriteSheet.rows * spriteSheet.thumbHeight}px`,
      borderRadius: 4,
      border: '2px solid rgba(255,255,255,0.8)',
      boxShadow: '0 2px 8px rgba(0,0,0,0.6)'
    }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, position: 'relative', padding: '0 8px' }}>
      <span style={{ fontSize: 12, minWidth: 45, textAlign: 'right' }}>
        {formatTime(position)}
      </span>

      <div
        ref={trackRef}
        onClick={handleSeek}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{
          flex: 1,
          height: 36,
          display: 'flex',
          alignItems: 'center',
          cursor: 'pointer',
          position: 'relative',
          overflow: 'visible'
        }}
      >
        {/* Hover thumbnail preview — positioned well above the track */}
        {thumbStyle && hoverX !== null && (
          <div style={{
            position: 'absolute',
            bottom: 30,
            left: Math.max(0, Math.min(
              hoverX - spriteSheet!.thumbWidth / 2,
              (trackRef.current?.clientWidth || 0) - spriteSheet!.thumbWidth
            )),
            zIndex: 100,
            pointerEvents: 'none'
          }}>
            <div style={thumbStyle} />
            <div style={{
              textAlign: 'center',
              fontSize: 11,
              color: '#fff',
              textShadow: '0 1px 3px rgba(0,0,0,0.8)',
              marginTop: 2
            }}>
              {formatTime(hoverFraction * duration)}
            </div>
          </div>
        )}

        {/* Track background */}
        <div style={{
          position: 'absolute',
          left: 0,
          right: 0,
          height: 10,
          background: 'rgba(255,255,255,0.15)',
          borderRadius: 5
        }} />
        {/* Progress fill */}
        <div style={{
          position: 'absolute',
          left: 0,
          width: `${progress}%`,
          height: 10,
          background: 'var(--accent)',
          borderRadius: 5
        }} />
        {/* Thumb */}
        {duration > 0 && (
          <div style={{
            position: 'absolute',
            left: `${progress}%`,
            width: 14,
            height: 14,
            borderRadius: '50%',
            background: '#fff',
            transform: 'translateX(-50%)',
            boxShadow: '0 1px 3px rgba(0,0,0,0.4)'
          }} />
        )}
      </div>

      <span style={{ fontSize: 12, minWidth: 45 }}>
        {formatTime(duration)}
      </span>
    </div>
  )
}
