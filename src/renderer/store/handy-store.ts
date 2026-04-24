import { create } from 'zustand'

type HandyConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

interface HandyStore {
  connected: boolean
  setConnected: (c: boolean) => void
  connectionKey: string
  setConnectionKey: (key: string) => void
  showSettings: boolean
  setShowSettings: (show: boolean) => void
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
  status: 'disconnected',
  setStatus: (status) => set({ status })
}))
