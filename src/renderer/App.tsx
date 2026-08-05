import { useEffect, useState } from 'react'
import { useAppStore, loadProfile } from './store/app-store'
import { usePlayerStore } from './store/player-store'
import { useHandyStore } from './store/handy-store'
import { createMpv } from './mpv'
import type { VideoFile } from '../shared/types'
import { Topbar } from './components/Topbar/Topbar'
import { OrganizerScreen } from './components/Organizer/OrganizerScreen'
import { PlayerScreen } from './components/Player/PlayerScreen'
import { HandySettings } from './components/Settings/HandySettings'
import { HandyPreferences } from './components/Settings/HandyPreferences'
import { SettingsModal } from './components/Settings/SettingsModal'
import { ProfileModals } from './components/Profiles/ProfileModals'
import { AboutModal } from './components/Help/AboutModal'

async function openFileForPlayback(filePath: string): Promise<void> {
  // Create mpv before switching the view so MpvCanvas (which mounts as a child
  // of PlayerScreen) has a valid instance in its first effect — React runs
  // child effects before parent effects, so without this the canvas render
  // loop never starts on cold launches with a file argument.
  createMpv()

  const name = filePath.replace(/.*[\\/]/, '').replace(/\.[^.]+$/, '')
  const folder = filePath.replace(/[\\/][^\\/]+$/, '')
  // Don't call prepareVideo here — PlayerScreen calls it when the video loads,
  // which handles Handy sync and adding to Recent. Calling it here too would
  // race with PlayerScreen's own call and double-trigger the Handy API.
  const video: VideoFile = {
    path: filePath,
    name,
    folder,
    size: 0,
    lastModified: 0,
    hasFunscript: false,
    funscriptPath: null,
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
  const showHandyPreferences = useHandyStore((s) => s.showPreferences)
  const showSettingsModal = useAppStore((s) => s.showSettingsModal)
  const showAboutModal = useAppStore((s) => s.showAboutModal)
  const profileModal = useAppStore((s) => s.profileModal)
  const funscriptEnabled = useAppStore((s) => s.funscriptEnabled)
  const theme = useAppStore((s) => s.theme)

  // Gate first paint on init completing — otherwise the organizer flashes for
  // a few frames on cold launches that should open straight into the player.
  const [initialized, setInitialized] = useState(false)

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
      // Check if app was launched with a file (double-click / file association).
      // Must happen BEFORE setInitialized so the first render already has
      // view='player' — avoids the organizer flashing for a few frames.
      const pendingFile = await window.api.getPendingOpenFile()
      if (pendingFile) openFileForPlayback(pendingFile)
      setInitialized(true)

      const fsEnabled = useAppStore.getState().funscriptEnabled
      if (fsEnabled) {
        window.api.handyGetPreferences().then((prefs) => {
          useHandyStore.getState().setPreferences(prefs)
        }).catch(() => {})
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

  // Background matches window backgroundColor (#1a1a2e) so the pre-init frame
  // is indistinguishable from an app that finished loading.
  if (!initialized) return null

  return (
    <>
      {!hideTopbar && <Topbar />}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        {view === 'organizer' && <OrganizerScreen />}
        {view === 'player' && <PlayerScreen />}
      </div>
      {funscriptEnabled && showHandySettings && <HandySettings />}
      {funscriptEnabled && showHandyPreferences && <HandyPreferences />}
      {showSettingsModal && <SettingsModal />}
      {profileModal !== 'none' && <ProfileModals />}
      {showAboutModal && <AboutModal />}
    </>
  )
}
