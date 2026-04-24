import { create } from 'zustand'
import type { VideoFile } from '../../shared/types'

export interface SubtitleStyle {
  size: number
  color: string
  outlineWidth: number
  outlineColor: string
  shadowOffset: number
  shadowSize: number
  shadowBlur: number
}

export const defaultSubtitleStyle: SubtitleStyle = {
  size: 100,
  color: '#FFFFFF',
  outlineWidth: 3,
  outlineColor: '#000000',
  shadowOffset: 2,
  shadowSize: 1,
  shadowBlur: 3
}

export type SortField = 'name' | 'size' | 'lastModified' | 'hasFunscript' | 'duration'
export type SortDir = 'asc' | 'desc'
export type ProfileModal = 'none' | 'manage' | 'create'

export interface ProfileInfo {
  name: string
  funscriptEnabled: boolean
}

interface AppStore {
  view: 'organizer' | 'player'
  setView: (view: 'organizer' | 'player') => void
  isFullscreen: boolean
  setIsFullscreen: (val: boolean) => void
  folders: string[]
  setFolders: (folders: string[]) => void
  selectedFolder: string | null
  setSelectedFolder: (folder: string | null) => void
  videos: VideoFile[]
  setVideos: (videos: VideoFile[]) => void
  viewMode: 'grid' | 'list'
  setViewMode: (mode: 'grid' | 'list') => void
  searchQuery: string
  setSearchQuery: (query: string) => void
  currentFolderOnly: boolean
  setCurrentFolderOnly: (val: boolean) => void
  sortField: SortField
  sortDir: SortDir
  setSort: (field: SortField, dir?: SortDir) => void
  selectedVideos: Map<string, VideoFile>
  toggleSelection: (video: VideoFile) => void
  clearSelection: () => void


  // Profile state
  currentProfile: string
  setCurrentProfile: (name: string) => void
  profiles: ProfileInfo[]
  setProfiles: (profiles: ProfileInfo[]) => void
  funscriptEnabled: boolean
  setFunscriptEnabled: (val: boolean) => void

  // Theme
  theme: 'dark' | 'light' | 'navy-blue'
  setTheme: (theme: 'dark' | 'light' | 'navy-blue') => void

  // Preferred language
  preferredAudioLang: string | null
  setPreferredAudioLang: (lang: string | null) => void
  preferredSubtitleLang: string | null
  setPreferredSubtitleLang: (lang: string | null) => void

  // Subtitle style
  subtitleStyle: SubtitleStyle
  setSubtitleStyle: (style: SubtitleStyle) => void

  // Modals
  showSettingsModal: boolean
  setShowSettingsModal: (val: boolean) => void
  showAboutModal: boolean
  setShowAboutModal: (val: boolean) => void
  profileModal: ProfileModal
  setProfileModal: (val: ProfileModal) => void

  // Hidden visibility
  showHidden: boolean
  setShowHidden: (val: boolean) => void

  // Favorites & hidden sets (for UI indicators)
  favoritePaths: Set<string>
  setFavoritePaths: (paths: Set<string>) => void
  hiddenPaths: Set<string>
  setHiddenPaths: (paths: Set<string>) => void
}

// Non-reactive duration cache — written by VideoCard/VideoListItem, read by sortVideos
export const durationCache: Record<string, number> = {}

export function setVideoDuration(path: string, seconds: number): void {
  durationCache[path] = seconds
}

export function sortVideos(videos: VideoFile[], field: SortField, dir: SortDir): VideoFile[] {
  return [...videos].sort((a, b) => {
    let cmp = 0
    if (field === 'name') cmp = a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
    else if (field === 'size') cmp = a.size - b.size
    else if (field === 'lastModified') cmp = a.lastModified - b.lastModified
    else if (field === 'hasFunscript') cmp = (a.hasFunscript ? 1 : 0) - (b.hasFunscript ? 1 : 0)
    else if (field === 'duration') {
      const da = durationCache[a.path] ?? -1
      const db = durationCache[b.path] ?? -1
      cmp = da - db
    }
    return dir === 'asc' ? cmp : -cmp
  })
}

export async function refreshVideos(): Promise<void> {
  const s = useAppStore.getState()
  const folder = s.selectedFolder
  if (!folder) return
  let videos: VideoFile[]
  if (folder === '__recent__') videos = await window.api.getRecentVideos()
  else if (folder === '__favorites__') videos = await window.api.getFavoriteVideos()
  else if (folder === '__hidden__') videos = await window.api.getHiddenVideoList()
  else videos = await window.api.getVideos(folder)
  s.setVideos(videos)
  // Prune selection for removed files
  if (s.selectedVideos.size > 0) {
    const paths = new Set(videos.map((v: VideoFile) => v.path))
    const pruned = new Map<string, VideoFile>()
    s.selectedVideos.forEach((v, k) => { if (paths.has(k)) pruned.set(k, v) })
    if (pruned.size !== s.selectedVideos.size) {
      useAppStore.setState({ selectedVideos: pruned })
    }
  }
}

export const useAppStore = create<AppStore>((set) => ({
  view: 'organizer',
  setView: (view) => set({ view }),
  isFullscreen: false,
  setIsFullscreen: (val) => set({ isFullscreen: val }),
  folders: [],
  setFolders: (folders) => set({ folders }),
  selectedFolder: '__recent__' as string | null,
  setSelectedFolder: (folder) => {
    set({ selectedFolder: folder })
    window.api.setLastFolder(folder)
  },
  videos: [],
  setVideos: (videos) => set({ videos }),
  viewMode: 'grid',
  setViewMode: (mode) => {
    set({ viewMode: mode })
    window.api.setLastViewMode(mode)
  },
  searchQuery: '',
  setSearchQuery: (query) => set({ searchQuery: query }),
  currentFolderOnly: false,
  setCurrentFolderOnly: (val) => set({ currentFolderOnly: val }),
  sortField: 'name',
  sortDir: 'asc',
  setSort: (field, dir) => set((s) => {
    if (dir) return { sortField: field, sortDir: dir }
    if (s.sortField === field) return { sortField: field, sortDir: s.sortDir === 'asc' ? 'desc' : 'asc' }
    return { sortField: field, sortDir: 'asc' }
  }),
  selectedVideos: new Map<string, VideoFile>(),
  toggleSelection: (video) => set((s) => {
    const next = new Map(s.selectedVideos)
    if (next.has(video.path)) next.delete(video.path); else next.set(video.path, video)
    return { selectedVideos: next }
  }),
  clearSelection: () => set({ selectedVideos: new Map<string, VideoFile>() }),


  // Profile
  currentProfile: 'Default',
  setCurrentProfile: (name) => set({ currentProfile: name }),
  profiles: [{ name: 'Default', funscriptEnabled: true }],
  setProfiles: (profiles) => set({ profiles }),
  funscriptEnabled: true,
  setFunscriptEnabled: (val) => set({ funscriptEnabled: val }),

  // Theme
  theme: 'navy-blue',
  setTheme: (theme) => set({ theme }),

  // Preferred language
  preferredAudioLang: null as string | null,
  setPreferredAudioLang: (lang) => set({ preferredAudioLang: lang }),
  preferredSubtitleLang: null as string | null,
  setPreferredSubtitleLang: (lang) => set({ preferredSubtitleLang: lang }),

  // Subtitle style
  subtitleStyle: { ...defaultSubtitleStyle },
  setSubtitleStyle: (style) => set({ subtitleStyle: style }),

  // Modals
  showSettingsModal: false,
  setShowSettingsModal: (val) => set({ showSettingsModal: val }),
  showAboutModal: false,
  setShowAboutModal: (val) => set({ showAboutModal: val }),
  profileModal: 'none',
  setProfileModal: (val) => set({ profileModal: val }),

  showHidden: false,
  setShowHidden: (val) => set({ showHidden: val }),

  favoritePaths: new Set<string>(),
  setFavoritePaths: (paths) => set({ favoritePaths: paths }),
  hiddenPaths: new Set<string>(),
  setHiddenPaths: (paths) => set({ hiddenPaths: paths })
}))

export async function loadProfile(): Promise<void> {
  const store = useAppStore.getState()
  const [currentProfile, profiles, folders, theme, funscriptEnabled, preferredAudioLang, preferredSubtitleLang, subtitleStyle, showHidden, favorites, hiddenVideos, lastFolder, lastViewMode] = await Promise.all([
    window.api.getCurrentProfile(),
    window.api.getProfiles(),
    window.api.getFolders(),
    window.api.getTheme(),
    window.api.getFunscriptEnabled(),
    window.api.getPreferredAudioLang(),
    window.api.getPreferredSubtitleLang(),
    window.api.getSubtitleStyle(),
    window.api.getShowHidden(),
    window.api.getFavorites(),
    window.api.getHiddenVideos(),
    window.api.getLastFolder(),
    window.api.getLastViewMode()
  ])
  store.setCurrentProfile(currentProfile)
  store.setProfiles(profiles)
  store.setFolders(folders)
  store.setTheme(theme)
  store.setFunscriptEnabled(funscriptEnabled)
  store.setPreferredAudioLang(preferredAudioLang)
  store.setPreferredSubtitleLang(preferredSubtitleLang)
  store.setSubtitleStyle(subtitleStyle ? { ...defaultSubtitleStyle, ...subtitleStyle } : { ...defaultSubtitleStyle })
  store.setShowHidden(showHidden)
  store.setFavoritePaths(new Set(favorites))
  store.setHiddenPaths(new Set(hiddenVideos))
  // Restore viewMode without re-persisting
  useAppStore.setState({ viewMode: lastViewMode ?? 'grid' })
  // Restore last folder (bypass setter to avoid re-persisting, use setState directly)
  const folder = lastFolder ?? '__recent__'
  useAppStore.setState({ selectedFolder: folder })
  let videos: VideoFile[]
  if (folder === '__recent__') videos = await window.api.getRecentVideos()
  else if (folder === '__favorites__') videos = await window.api.getFavoriteVideos()
  else if (folder === '__hidden__') videos = await window.api.getHiddenVideoList()
  else videos = await window.api.getVideos(folder)
  store.setVideos(videos)
  document.documentElement.dataset.theme = theme
}
