import { useState, useEffect, useRef } from 'react'
import { getMpv } from '../../mpv'
import { usePlayerStore } from '../../store/player-store'
import { getTrackList, getTrackLabel, type MpvTrack } from '../../utils/mpv-tracks'
import { Check, ChevronRight } from 'lucide-react'

interface ContextMenuProps {
  x: number
  y: number
  onClose: () => void
}

type Submenu = 'file' | 'audio' | 'subtitles' | null

function CMenuItem({
  onClick,
  children,
  disabled
}: {
  onClick?: () => void
  children: React.ReactNode
  disabled?: boolean
}) {
  const [hovered, setHovered] = useState(false)
  return (
    <div
      role="menuitem"
      onClick={disabled ? undefined : onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        width: '100%',
        textAlign: 'left',
        padding: '6px 16px',
        fontSize: 13,
        cursor: disabled ? 'default' : 'pointer',
        background: !disabled && hovered ? 'var(--bg-tertiary)' : 'transparent',
        color: disabled ? 'var(--text-secondary)' : 'var(--text-primary)',
        whiteSpace: 'nowrap',
        userSelect: 'none'
      }}
    >
      {children}
    </div>
  )
}

export function ContextMenu({ x, y, onClose }: ContextMenuProps) {
  const [submenu, setSubmenu] = useState<Submenu>(null)
  const [audioTracks, setAudioTracks] = useState<MpvTrack[]>([])
  const [subtitleTracks, setSubtitleTracks] = useState<MpvTrack[]>([])
  const [currentAid, setCurrentAid] = useState<string>('')
  const [currentSid, setCurrentSid] = useState<string>('')
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const { audio, subtitle } = getTrackList()
    setAudioTracks(audio)
    setSubtitleTracks(subtitle)

    const mpv = getMpv()
    if (mpv) {
      setCurrentAid(mpv.getPropertyString('aid') || '')
      setCurrentSid(mpv.getPropertyString('sid') || '')
    }
  }, [])

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose() }
    }
    window.addEventListener('keydown', handleEscape, true)
    return () => window.removeEventListener('keydown', handleEscape, true)
  }, [onClose])

  const handleSetThumbnail = async () => {
    const mpv = getMpv()
    const video = usePlayerStore.getState().currentVideo
    if (!mpv || !video) return
    const userDir = await window.api.getUserDataPath()
    const tempPath = userDir.replace(/\\/g, '/') + '/_temp_screenshot.jpg'
    mpv.command('screenshot-to-file', tempPath, 'video')
    // Small delay for mpv to write
    setTimeout(async () => {
      await window.api.setVideoThumbnail(video.path, tempPath)
      onClose()
    }, 200)
  }

  const handleSetAudio = (id: number) => {
    const mpv = getMpv()
    if (mpv) {
      mpv.setPropertyString('aid', String(id))
      setCurrentAid(String(id))
    }
    onClose()
  }

  const handleSetSubtitle = (id: number | 'no') => {
    const mpv = getMpv()
    if (mpv) {
      mpv.setPropertyString('sid', String(id))
      setCurrentSid(String(id))
    }
    onClose()
  }

  const handleOpenFileLocation = () => {
    const video = usePlayerStore.getState().currentVideo
    if (video) window.api.openFileLocation(video.path)
    onClose()
  }

  const handleLoadSubtitleFile = async () => {
    const filePath = await window.api.openSubtitleDialog()
    if (!filePath) return
    const mpv = getMpv()
    if (mpv) {
      try {
        mpv.command('sub-add', filePath)
        // Refresh track list and select the new subtitle
        setTimeout(() => {
          const { subtitle } = getTrackList()
          setSubtitleTracks(subtitle)
          if (subtitle.length > 0) {
            const lastTrack = subtitle[subtitle.length - 1]
            mpv.setPropertyString('sid', String(lastTrack.id))
            setCurrentSid(String(lastTrack.id))
          }
        }, 100)
      } catch {}
    }
    onClose()
  }

  const panelStyle: React.CSSProperties = {
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border)',
    borderRadius: 6,
    padding: '4px 0',
    minWidth: 180,
    boxShadow: '0 4px 16px rgba(0,0,0,0.5)'
  }

  const submenuStyle: React.CSSProperties = {
    position: 'absolute',
    top: 0,
    left: '100%',
    ...panelStyle,
    maxHeight: '90vh',
    overflowY: 'auto'
  }

  const checkWidth = 18

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={(e) => { e.stopPropagation(); onClose() }}
        onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); onClose() }}
        style={{ position: 'fixed', inset: 0, zIndex: 55 }}
      />

      <div ref={menuRef} style={{ position: 'fixed', left: x, top: y, zIndex: 60 }}>
        <div style={panelStyle}>
          {/* File */}
          <div
            style={{ position: 'relative' }}
            onMouseEnter={() => setSubmenu('file')}
            onMouseLeave={() => setSubmenu(null)}
          >
            <CMenuItem>
              <span style={{ flex: 1 }}>File</span>
              <ChevronRight size={14} />
            </CMenuItem>
            {submenu === 'file' && (
              <div style={submenuStyle}>
                <CMenuItem onClick={handleSetThumbnail}>Set frame as thumbnail</CMenuItem>
                <CMenuItem onClick={handleOpenFileLocation}>Open file location</CMenuItem>
              </div>
            )}
          </div>

          {/* Audio */}
          <div
            style={{ position: 'relative' }}
            onMouseEnter={() => setSubmenu('audio')}
            onMouseLeave={() => setSubmenu(null)}
          >
            <CMenuItem>
              <span style={{ flex: 1 }}>Audio</span>
              <ChevronRight size={14} />
            </CMenuItem>
            {submenu === 'audio' && (
              <div style={submenuStyle}>
                {audioTracks.length === 0 ? (
                  <CMenuItem disabled>No audio tracks</CMenuItem>
                ) : (
                  audioTracks.map((t) => (
                    <CMenuItem key={t.id} onClick={() => handleSetAudio(t.id)}>
                      <span style={{ width: checkWidth, flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                        {String(t.id) === currentAid && <Check size={12} />}
                      </span>
                      <span style={{ flex: 1 }}>{getTrackLabel(t)}</span>
                    </CMenuItem>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Subtitles */}
          <div
            style={{ position: 'relative' }}
            onMouseEnter={() => setSubmenu('subtitles')}
            onMouseLeave={() => setSubmenu(null)}
          >
            <CMenuItem>
              <span style={{ flex: 1 }}>Subtitles</span>
              <ChevronRight size={14} />
            </CMenuItem>
            {submenu === 'subtitles' && (
              <div style={submenuStyle}>
                <CMenuItem onClick={() => handleSetSubtitle('no')}>
                  <span style={{ width: checkWidth, flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                    {currentSid === 'no' && <Check size={12} />}
                  </span>
                  <span style={{ flex: 1 }}>None</span>
                </CMenuItem>
                {subtitleTracks.length === 0 ? (
                  <CMenuItem disabled>No subtitle tracks</CMenuItem>
                ) : (
                  subtitleTracks.map((t) => (
                    <CMenuItem key={t.id} onClick={() => handleSetSubtitle(t.id)}>
                      <span style={{ width: checkWidth, flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                        {String(t.id) === currentSid && <Check size={12} />}
                      </span>
                      <span style={{ flex: 1 }}>{getTrackLabel(t)}</span>
                    </CMenuItem>
                  ))
                )}
                <div style={{ borderTop: '1px solid var(--border)', margin: '4px 0' }} />
                <CMenuItem onClick={handleLoadSubtitleFile}>Load subtitle file...</CMenuItem>
              </div>
            )}
          </div>

          <div style={{ borderTop: '1px solid var(--border)', margin: '4px 0' }} />
        </div>
      </div>
    </>
  )
}
