import { create } from 'zustand'
import type { VideoFile } from '../../shared/types'

export interface SpriteSheetInfo {
  path: string
  cols: number
  rows: number
  thumbWidth: number
  thumbHeight: number
  interval: number
  totalFrames: number
  duration: number
}

interface PlayerStore {
  currentVideo: VideoFile | null
  setCurrentVideo: (video: VideoFile | null) => void
  scriptOverride: string | null
  setScriptOverride: (path: string | null) => void
  isPlaying: boolean
  setIsPlaying: (playing: boolean) => void
  position: number
  setPosition: (pos: number) => void
  duration: number
  setDuration: (dur: number) => void
  volume: number
  setVolume: (vol: number) => void

  /** Rate the video is actually playing at — only moves once the device agrees. */
  playbackRate: number
  setPlaybackRate: (rate: number) => void
  /** Rate the user has dialled in with +/-, still waiting to be committed. */
  pendingPlaybackRate: number
  setPendingPlaybackRate: (rate: number) => void
  /** True while the script is being re-timed for a new rate. */
  rateChanging: boolean
  setRateChanging: (val: boolean) => void

  // Sprite sheet for seek preview
  spriteSheet: SpriteSheetInfo | null
  setSpriteSheet: (info: SpriteSheetInfo | null) => void

  // Playlist
  playlist: VideoFile[]
  playlistIndex: number
  playlistMode: 'sequential' | 'random' | null
  setPlaylist: (videos: VideoFile[], mode: 'sequential' | 'random' | null) => void
  setPlaylistIndex: (index: number) => void
  clearPlaylist: () => void
}

export const usePlayerStore = create<PlayerStore>((set) => ({
  currentVideo: null,
  setCurrentVideo: (video) => set({ currentVideo: video }),
  scriptOverride: null,
  setScriptOverride: (path) => set({ scriptOverride: path }),
  isPlaying: false,
  setIsPlaying: (playing) => set({ isPlaying: playing }),
  position: 0,
  setPosition: (pos) => set({ position: pos }),
  duration: 0,
  setDuration: (dur) => set({ duration: dur }),
  volume: 100,
  setVolume: (vol) => set({ volume: vol }),

  playbackRate: 1,
  setPlaybackRate: (rate) => set({ playbackRate: rate }),
  pendingPlaybackRate: 1,
  setPendingPlaybackRate: (rate) => set({ pendingPlaybackRate: rate }),
  rateChanging: false,
  setRateChanging: (val) => set({ rateChanging: val }),

  spriteSheet: null,
  setSpriteSheet: (info) => set({ spriteSheet: info }),

  playlist: [],
  playlistIndex: 0,
  playlistMode: null,
  setPlaylist: (videos, mode) => set({ playlist: videos, playlistMode: mode, playlistIndex: 0 }),
  setPlaylistIndex: (index) => set({ playlistIndex: index }),
  clearPlaylist: () => set({ playlist: [], playlistIndex: 0, playlistMode: null, currentVideo: null })
}))
