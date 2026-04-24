import { useEffect, useRef, useCallback, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { useAppStore, SubtitleStyle } from '../../store/app-store'
import { usePlayerStore } from '../../store/player-store'
import { createMpv, getMpv } from '../../mpv'
import { MpvCanvas } from './MpvCanvas'
import { Controls } from './Controls'
import { PlaylistIndicator } from './PlaylistIndicator'
import { ScriptLoadingIndicator, useScriptLoadingStore } from './ScriptLoadingIndicator'
import { ContextMenu } from './ContextMenu'
import { useAutoHide } from '../../hooks/useAutoHide'
import { getTrackList } from '../../utils/mpv-tracks'
import { matchesLanguage } from '../../constants/languages'

/** Convert hex (#RRGGBB) to mpv's ASS color format (&HBBGGRR&) */
function hexToAssColor(hex: string): string {
  const r = hex.slice(1, 3)
  const g = hex.slice(3, 5)
  const b = hex.slice(5, 7)
  return `&H00${b}${g}${r}&`.toUpperCase()
}

function applySubtitleStyle(style: SubtitleStyle) {
  const mpv = getMpv()
  if (!mpv) return
  try {
    mpv.setPropertyDouble('sub-font-size', style.size * 0.55)
  } catch (e) { console.warn('sub-font-size:', e) }
  try {
    mpv.setPropertyString('sub-color', hexToAssColor(style.color))
  } catch (e) { console.warn('sub-color:', e) }
  try {
    mpv.setPropertyDouble('sub-border-size', style.outlineWidth)
  } catch (e) { console.warn('sub-border-size:', e) }
  try {
    mpv.setPropertyString('sub-border-color', hexToAssColor(style.outlineColor))
  } catch (e) { console.warn('sub-border-color:', e) }
  try {
    mpv.setPropertyDouble('sub-shadow-offset', style.shadowOffset)
  } catch (e) { console.warn('sub-shadow-offset:', e) }
  try {
    mpv.setPropertyString('sub-shadow-color', hexToAssColor(style.outlineColor))
  } catch (e) { console.warn('sub-shadow-color:', e) }
  try {
    // 'no' preserves ASS positioning/formatting; our style only affects plain subs (SRT etc.)
    mpv.setPropertyString('sub-ass-override', 'no')
  } catch (e) { console.warn('sub-ass-override:', e) }
}

/** Vertical volume OSD on the right side of the screen */
function VolumeOSD({ volume, visible }: { volume: number; visible: boolean }) {
  if (!visible) return null
  const fraction = Math.min(volume / 100, 1)

  return (
    <div style={{
      position: 'absolute',
      right: 30,
      top: 30,
      height: '50%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 8,
      zIndex: 30,
      pointerEvents: 'none',
      background: 'rgba(0,0,0,0.6)',
      borderRadius: 12,
      padding: '12px 10px'
    }}>
      <span style={{
        fontSize: 22,
        fontWeight: 700,
        minWidth: '60px',
        textAlign: 'center',
        color: '#fff',
        textShadow: '0 1px 4px rgba(0,0,0,0.8)'
      }}>
        {volume}%
      </span>
      <div style={{
        flex: 1,
        width: 20,
        borderRadius: 10,
        background: 'rgba(255,255,255,0.1)',
        border: '1px solid rgba(255,255,255,0.3)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: `${fraction * 100}%`,
          background: '#fff',
          borderRadius: 10
        }} />
      </div>
    </div>
  )
}

/** Seek OSD — centered, slightly right */
function SeekOSD({ text, visible }: { text: string; visible: boolean }) {
  if (!visible) return null
  return (
    <div style={{
      position: 'absolute',
      top: '50%',
      left: '55%',
      transform: 'translate(-50%, -50%)',
      zIndex: 30,
      pointerEvents: 'none',
      background: 'rgba(0,0,0,0.6)',
      borderRadius: 10,
      padding: '10px 20px'
    }}>
      <span style={{
        fontSize: 28,
        fontWeight: 700,
        color: '#fff',
        textShadow: '0 1px 4px rgba(0,0,0,0.8)'
      }}>
        {text}
      </span>
    </div>
  )
}

// --- Seek action helpers ---

interface SeekAction {
  amount: number
  label: string
  isFrame: boolean
}

function getSeekAction(key: string, e: { shiftKey: boolean; ctrlKey: boolean; altKey: boolean }): SeekAction | null {
  if (key !== 'ArrowLeft' && key !== 'ArrowRight') return null
  const forward = key === 'ArrowRight'
  const sign = forward ? 1 : -1
  if (e.altKey) return { amount: 0, label: forward ? '+1f' : '-1f', isFrame: true }
  if (e.ctrlKey) return { amount: sign * 30, label: `${forward ? '+' : '-'}30s`, isFrame: false }
  if (e.shiftKey) return { amount: sign * 3, label: `${forward ? '+' : '-'}3s`, isFrame: false }
  return { amount: sign * 10, label: `${forward ? '+' : '-'}10s`, isFrame: false }
}

function executeSeek(action: SeekAction) {
  const mpv = getMpv()
  if (!mpv) return
  if (action.isFrame) {
    mpv.command(action.label.includes('+') ? 'frame-step' : 'frame-back-step')
  } else {
    mpv.command('seek', String(action.amount), 'relative')
  }
  if (useAppStore.getState().funscriptEnabled) {
    const pos = mpv.getPropertyDouble('time-pos') || 0
    window.api.handyOnSeek(pos * 1000)
  }
}

// --- Apply preferred tracks after file loads ---

function applyPreferredTracks() {
  const mpv = getMpv()
  if (!mpv) return
  const { preferredAudioLang, preferredSubtitleLang } = useAppStore.getState()
  const { audio, subtitle } = getTrackList()

  if (preferredAudioLang) {
    const match = audio.find((t) => matchesLanguage(t.lang, preferredAudioLang))
    if (match) mpv.setPropertyString('aid', String(match.id))
  }
  if (preferredSubtitleLang) {
    const match = subtitle.find((t) => matchesLanguage(t.lang, preferredSubtitleLang))
    if (match) mpv.setPropertyString('sid', String(match.id))
  }
}

export function PlayerScreen() {
  const containerRef = useRef<HTMLDivElement>(null)
  const eventTimerRef = useRef<ReturnType<typeof setInterval>>()
  const setView = useAppStore((s) => s.setView)
  const setIsFullscreen = useAppStore((s) => s.setIsFullscreen)
  const funscriptEnabled = useAppStore((s) => s.funscriptEnabled)
  const currentVideo = usePlayerStore((s) => s.currentVideo)
  const scriptOverride = usePlayerStore((s) => s.scriptOverride)
  const volume = usePlayerStore((s) => s.volume)
  const controlsVisible = useAutoHide(3000)

  const [canvasSize, setCanvasSize] = useState({ width: 1280, height: 720 })

  // Volume OSD
  const [volumeOsdVisible, setVolumeOsdVisible] = useState(false)
  const volumeOsdTimerRef = useRef<ReturnType<typeof setTimeout>>()
  const prevVolumeRef = useRef(volume)

  // Seek OSD
  const [seekOsdText, setSeekOsdText] = useState('')
  const [seekOsdVisible, setSeekOsdVisible] = useState(false)
  const seekOsdTimerRef = useRef<ReturnType<typeof setTimeout>>()

  // Context menu
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)

  // Custom key repeat for arrow seeking
  const activeSeekKeysRef = useRef<Map<string, { startTime: number; lastFire: number; action: SeekAction }>>(new Map())
  const seekRepeatTimerRef = useRef<ReturnType<typeof setInterval>>()

  const showSeekOsd = useCallback((text: string) => {
    setSeekOsdText(text)
    setSeekOsdVisible(true)
    if (seekOsdTimerRef.current) clearTimeout(seekOsdTimerRef.current)
    seekOsdTimerRef.current = setTimeout(() => setSeekOsdVisible(false), 1000)
  }, [])

  // Volume OSD
  useEffect(() => {
    if (prevVolumeRef.current !== volume) {
      prevVolumeRef.current = volume
      setVolumeOsdVisible(true)
      if (volumeOsdTimerRef.current) clearTimeout(volumeOsdTimerRef.current)
      volumeOsdTimerRef.current = setTimeout(() => setVolumeOsdVisible(false), 1500)
    }
    return () => { if (volumeOsdTimerRef.current) clearTimeout(volumeOsdTimerRef.current) }
  }, [volume])

  const switchingRef = useRef(false)

  const toggleFullscreen = useCallback(async () => {
    const isFs = await window.api.windowToggleFullscreen()
    setIsFullscreen(isFs)
  }, [setIsFullscreen])

  const goBack = useCallback(() => {
    const mpv = getMpv()
    if (mpv) mpv.setPropertyBool('pause', true)
    if (funscriptEnabled) window.api.handyOnPause()
    usePlayerStore.getState().clearPlaylist()
    setView('organizer')
  }, [setView, funscriptEnabled])

  // Double-click to toggle fullscreen
  const lastClickRef = useRef(0)
  const handleVideoAreaClick = useCallback(() => {
    const now = Date.now()
    if (now - lastClickRef.current < 300) {
      toggleFullscreen()
      lastClickRef.current = 0
    } else {
      lastClickRef.current = now
    }
  }, [toggleFullscreen])

  // Context menu handler
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY })
  }, [])

  // Initialize mpv on mount
  useEffect(() => {
    const mpv = createMpv()
    if (!mpv) {
      console.error('[PlayerScreen] Failed to create mpv')
      return
    }
    // Volume and subtitle style are kept in sync by dedicated effects below,
    // so no initial set is needed here. Observers are registered inside createMpv.

    eventTimerRef.current = setInterval(() => {
      const m = getMpv()
      if (!m) return

      const events = m.processEvents()
      for (const evt of events) {
        if (evt.type === 'property-change') {
          if (evt.name === 'pause' && typeof evt.data === 'boolean') {
            usePlayerStore.getState().setIsPlaying(!evt.data)
          } else if (evt.name === 'time-pos' && typeof evt.data === 'number') {
            usePlayerStore.getState().setPosition(evt.data)
          } else if (evt.name === 'duration' && typeof evt.data === 'number') {
            usePlayerStore.getState().setDuration(evt.data)
          }
        } else if (evt.type === 'end-file') {
          // Always clear the switching flag so the player never gets stuck.
          // Only advance the playlist if we weren't in the middle of switching tracks.
          const wasSwitching = switchingRef.current
          switchingRef.current = false
          if (!wasSwitching) {
            handleEndFile()
          }
        } else if (evt.type === 'file-loaded') {
          switchingRef.current = false
          console.log('[mpv] File loaded, triggering Handy play sync')
          // Load external subtitles if available
          const cv = usePlayerStore.getState().currentVideo
          if (cv) {
            window.api.findExternalSubtitles(cv.path).then((subs) => {
              const mp = getMpv()
              if (!mp) return
              for (const sub of subs) {
                try { mp.command('sub-add', sub) } catch {}
              }
            })
          }
          // Apply preferred tracks after a short delay for track list to be available
          setTimeout(() => {
            applyPreferredTracks()
            const mp = getMpv()
            if (!mp) return
            const paused = mp.getPropertyBool('pause')
            if (!paused) {
              const pos = mp.getPropertyDouble('time-pos') || 0
              usePlayerStore.getState().setIsPlaying(true)
              if (useAppStore.getState().funscriptEnabled) {
                window.api.handyOnPlay(pos * 1000)
              }
            }
          }, 200)
        }
      }
    }, 16)

    // On unmount: stop the event loop but keep the mpv instance alive.
    // Destroying and recreating the native addon on every player open is unreliable;
    // keeping it alive lets subsequent loadfile calls always work.
    return () => {
      if (eventTimerRef.current) clearInterval(eventTimerRef.current)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Resize canvas to fit container
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect
      const w = Math.round(width) || 1280
      const h = Math.round(height) || 720
      setCanvasSize({ width: w, height: h })
      const mpv = getMpv()
      if (mpv) mpv.setRenderSize(w, h)
    })

    observer.observe(container)
    const rect = container.getBoundingClientRect()
    const w = Math.round(rect.width) || 1280
    const h = Math.round(rect.height) || 720
    setCanvasSize({ width: w, height: h })
    const mpv = getMpv()
    if (mpv) mpv.setRenderSize(w, h)

    return () => observer.disconnect()
  }, [])

  const lastPreparedRef = useRef<string | null>(null)

  // Apply subtitle style changes live
  const subtitleStyle = useAppStore((s) => s.subtitleStyle)
  useEffect(() => {
    applySubtitleStyle(subtitleStyle)
  }, [subtitleStyle])

  // Load video when currentVideo changes
  useEffect(() => {
    const mpv = getMpv()
    if (!mpv || !currentVideo) return

    console.log(`[PlayerScreen] Loading: ${currentVideo.path}`)
    switchingRef.current = true
    usePlayerStore.getState().setPosition(0)
    usePlayerStore.getState().setDuration(0)

    const { playlistMode } = usePlayerStore.getState()
    mpv.setPropertyString('loop-file', playlistMode ? 'no' : 'inf')

    mpv.command('loadfile', currentVideo.path)
    // Explicit unpause — mpv defaults to playing on loadfile, but a prior
    // session may have left pause=true. Guarantees autoplay on every load.
    mpv.setPropertyBool('pause', false)

    usePlayerStore.getState().setSpriteSheet(null)
    window.api.generateSpriteSheet(currentVideo.path).then((info) => {
      if (info) usePlayerStore.getState().setSpriteSheet(info)
    })

    const prepareKey = currentVideo.path + '|' + (scriptOverride ?? '')
    if (lastPreparedRef.current === prepareKey) return
    lastPreparedRef.current = prepareKey

    useScriptLoadingStore.getState().setLoading(true)
    window.api.prepareVideo(currentVideo.path, scriptOverride ?? undefined)
      .then(() => {
        useScriptLoadingStore.getState().setLoading(false)
        const mp = getMpv()
        if (!mp) return
        const paused = mp.getPropertyBool('pause')
        if (!paused) {
          const pos = mp.getPropertyDouble('time-pos') || 0
          console.log(`[PlayerScreen] Script loaded, resyncing Handy at ${pos.toFixed(0)}s`)
          if (useAppStore.getState().funscriptEnabled) {
            window.api.handyOnPlay(pos * 1000)
          }
        }
      })
      .catch((err) => {
        console.error('[PlayerScreen] prepareVideo error:', err)
        useScriptLoadingStore.getState().setLoading(false)
      })
  }, [currentVideo, scriptOverride])

  // Sync volume
  useEffect(() => {
    const mpv = getMpv()
    if (mpv) mpv.setPropertyDouble('volume', volume)
  }, [volume])

  const handleEndFile = useCallback(() => {
    const { playlist, playlistIndex, playlistMode, setPlaylistIndex, setCurrentVideo } = usePlayerStore.getState()
    if (playlistMode && playlist.length > 0) {
      const nextIndex = playlistIndex + 1
      if (nextIndex < playlist.length) {
        setPlaylistIndex(nextIndex)
        setCurrentVideo(playlist[nextIndex])
      }
    }
  }, [])

  // Custom seek repeat interval
  useEffect(() => {
    seekRepeatTimerRef.current = setInterval(() => {
      const now = Date.now()
      activeSeekKeysRef.current.forEach((entry, key) => {
        const elapsed = now - entry.startTime
        if (elapsed < 1000) return // Wait 1s before repeating

        let interval: number
        if (elapsed < 3000) {
          interval = 500 // Every 0.5s for first 2s of hold
        } else {
          interval = 200 // Every 0.2s after that
        }

        if (now - entry.lastFire >= interval) {
          entry.lastFire = now
          executeSeek(entry.action)
          showSeekOsd(entry.action.label)
        }
      })
    }, 50)

    return () => {
      if (seekRepeatTimerRef.current) clearInterval(seekRepeatTimerRef.current)
    }
  }, [showSeekOsd])

  // Keyboard + wheel controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const mpv = getMpv()
      if (!mpv) return

      // Seek keys: custom repeat
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault()
        // Suppress native repeat
        if (activeSeekKeysRef.current.has(e.key)) return

        const action = getSeekAction(e.key, e)
        if (!action) return
        executeSeek(action)
        showSeekOsd(action.label)
        activeSeekKeysRef.current.set(e.key, { startTime: Date.now(), lastFire: Date.now(), action })
        return
      }

      if (e.key === 'Escape') {
        goBack()
      } else if (e.key === ' ') {
        e.preventDefault()
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
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        const vol = Math.min(200, volume + 5)
        usePlayerStore.getState().setVolume(vol)
        window.api.setVolume(vol)
        mpv.setPropertyDouble('volume', vol)
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        const vol = Math.max(0, volume - 5)
        usePlayerStore.getState().setVolume(vol)
        window.api.setVolume(vol)
        mpv.setPropertyDouble('volume', vol)
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        activeSeekKeysRef.current.delete(e.key)
      }
    }

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault()
      const delta = e.deltaY < 0 ? 5 : -5
      const currentVol = usePlayerStore.getState().volume
      const vol = Math.max(0, Math.min(200, currentVol + delta))
      usePlayerStore.getState().setVolume(vol)
      window.api.setVolume(vol)
      const mpv = getMpv()
      if (mpv) mpv.setPropertyDouble('volume', vol)
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    window.addEventListener('wheel', handleWheel, { passive: false })
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      window.removeEventListener('wheel', handleWheel)
      activeSeekKeysRef.current.clear()
    }
  }, [goBack, toggleFullscreen, volume, showSeekOsd])

  return (
    <div
      ref={containerRef}
      onClick={handleVideoAreaClick}
      onContextMenu={handleContextMenu}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes('Files')) {
          e.preventDefault()
          e.dataTransfer.dropEffect = 'copy'
        }
      }}
      onDrop={(e) => {
        e.preventDefault()
        const mpv = getMpv()
        if (!mpv) return
        const { webUtils } = require('electron')
        const subtitleExts = ['.srt', '.ass', '.ssa', '.sub', '.vtt']
        for (const file of Array.from(e.dataTransfer.files)) {
          const filePath = webUtils.getPathForFile(file)
          if (!filePath) continue
          const ext = filePath.replace(/.*\./, '.').toLowerCase()
          if (subtitleExts.includes(ext)) {
            try { mpv.command('sub-add', filePath) } catch {}
          }
        }
      }}
      style={{
        height: '100%',
        background: '#000',
        position: 'relative',
        cursor: controlsVisible ? 'default' : 'none'
      }}
    >
      <MpvCanvas width={canvasSize.width} height={canvasSize.height} />
      {funscriptEnabled && <ScriptLoadingIndicator />}
      <VolumeOSD volume={volume} visible={volumeOsdVisible} />
      <SeekOSD text={seekOsdText} visible={seekOsdVisible} />

      {controlsVisible && (
        <>
          <div onClick={(e) => e.stopPropagation()} style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            padding: '12px 16px',
            background: 'linear-gradient(to bottom, rgba(0,0,0,0.7), transparent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            zIndex: 10
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button
                onClick={(e) => { e.stopPropagation(); goBack() }}
                style={{ background: 'rgba(255,255,255,0.15)', fontSize: 16, padding: '4px 10px' }}
              >
                <ArrowLeft size={16} />
              </button>
              <span style={{ fontSize: 14, fontWeight: 500 }}>
                {currentVideo?.name || ''}
              </span>
            </div>
            <PlaylistIndicator />
          </div>

          <Controls />
        </>
      )}

      {contextMenu && (
        <ContextMenu x={contextMenu.x} y={contextMenu.y} onClose={() => setContextMenu(null)} />
      )}
    </div>
  )
}
