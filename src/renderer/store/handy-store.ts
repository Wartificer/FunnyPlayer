import { create } from 'zustand'
import { defaultHandyPreferences } from '../../shared/types'
import type { HandyPreferences } from '../../shared/types'

type HandyConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

interface HandyStore {
  connected: boolean
  setConnected: (c: boolean) => void
  connectionKey: string
  setConnectionKey: (key: string) => void
  showSettings: boolean
  setShowSettings: (show: boolean) => void
  showPreferences: boolean
  setShowPreferences: (show: boolean) => void
  preferences: HandyPreferences
  setPreferences: (prefs: HandyPreferences) => void
  status: HandyConnectionStatus
  setStatus: (status: HandyConnectionStatus) => void
}

export const useHandyStore = create<HandyStore>((set) => ({
  connected: false,
  setConnected: (c) => set({ connected: c }),
  connectionKey: '',
  setConnectionKey: (key) => set({ connectionKey: key }),
  showSettings: false,
  setShowSettings: (show) => set({ showSettings: show }),
  showPreferences: false,
  setShowPreferences: (show) => set({ showPreferences: show }),
  preferences: { ...defaultHandyPreferences },
  setPreferences: (prefs) => set({ preferences: prefs }),
  status: 'disconnected',
  setStatus: (status) => set({ status })
}))
