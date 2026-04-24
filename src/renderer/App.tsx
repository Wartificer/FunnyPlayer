import { useEffect } from 'react'
import { useAppStore, loadProfile } from './store/app-store'
import { usePlayerStore } from './store/player-store'
import { useHandyStore } from './store/handy-store'
import type { VideoFile } from '../shared/types'
import { Topbar } from './components/Topbar/Topbar'
import { OrganizerScreen } from './components/Organizer/OrganizerScreen'
import { PlayerScreen } from './components/Player/PlayerScreen'
import { HandySettings } from './components/Settings/HandySettings'
import { SettingsModal } from './components/Settings/SettingsModal'
import { ProfileModals } from './components/Profiles/ProfileModals'

async function openFileForPlayback(filePath: string): Promise<void> {
  const result = await window.api.prepareVideo(filePath) as { filePath: string; funscriptPath: string | null }
  const name = filePath.replace(/.*[\\/]/, '').replace(/\.[^.]+$/, '')
  const folder = filePath.replace(/[\\/][^\\/]+$/, '')
  const video: VideoFile = {
    path: filePath,
    name,
    folder,
    size: 0,
    lastModified: 0,
    hasFunscript: result.funscriptPath != null,
    funscriptPath: result.funscriptPath ?? null,
    alternateScripts: []
  }
  const store = usePlayerStore.getState()
  store.setScriptOverride(null)
  store.setPlaylist([video], null)
  store.setPlaylistIndex(0)
  store.setCurrentVideo(video)
  useAppStore.getState().setView('player')
}

export default function App() {
  const view = useAppStore((s) => s.view)
  const isFullscreen = useAppStore((s) => s.isFullscreen)
  const setIsFullscreen = useAppStore((s) => s.setIsFullscreen)
  const showHandySettings = useHandyStore((s) => s.showSettings)
  const showSettingsModal = useAppStore((s) => s.showSettingsModal)
  const profileModal = useAppStore((s) => s.profileModal)
  const funscriptEnabled = useAppStore((s) => s.funscriptEnabled)
  const theme = useAppStore((s) => s.theme)

  const hideTopbar = isFullscreen

  // Apply theme to DOM when it changes
  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  // Global fullscreen toggle (F11 / Alt+Enter)
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      if (e.key === 'F11' || (e.altKey && e.key === 'Enter')) {
        e.preventDefault()
        await window.api.windowToggleFullscreen()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    const unsub = window.api.onFullscreenChanged((isFs: boolean) => {
      setIsFullscreen(isFs)
    })
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      unsub()
    }
  }, [setIsFullscreen])

  // Init: load profile, auto-connect Handy, restore volume, handle open-file
  useEffect(() => {
    loadProfile().then(async () => {
      // Check if app was launched with a file (double-click / file association)
      const pendingFile = await window.api.getPendingOpenFile()
      if (pendingFile) openFileForPlayback(pendingFile)

      const fsEnabled = useAppStore.getState().funscriptEnabled
      if (fsEnabled) {
        window.api.handyGetKey().then((key: string) => {
          if (key) {
            const store = useHandyStore.getState()
            store.setConnectionKey(key)
            store.setStatus('connecting')
            window.api.handyConnect(key).then((ok: boolean) => {
              useHandyStore.getState().setConnected(ok)
              useHandyStore.getState().setStatus(ok ? 'connected' : 'error')
            }).catch(() => {
              useHandyStore.getState().setStatus('error')
            })
          }
        })
      }
    })
    window.api.getVolume().then((vol: number) => {
      if (vol != null) usePlayerStore.getState().setVolume(vol)
    })

    // Handle files opened while the app is already running (second instance)
    const unsubOpenFile = window.api.onOpenFile((filePath: string) => {
      openFileForPlayback(filePath)
    })
    return () => { unsubOpenFile() }
  }, [])

  return (
    <>
      {!hideTopbar && <Topbar />}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        {view === 'organizer' && <OrganizerScreen />}
        {view === 'player' && <PlayerScreen />}
      </div>
      {funscriptEnabled && showHandySettings && <HandySettings />}
      {showSettingsModal && <SettingsModal />}
      {profileModal !== 'none' && <ProfileModals />}
    </>
  )
}
