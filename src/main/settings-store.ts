import Store from 'electron-store'

export interface SubtitleStyle {
  size: number           // percent (50-150, default 100)
  color: string          // hex color
  outlineWidth: number   // 0-10, default 3
  outlineColor: string   // hex color
  shadowOffset: number   // 0-10
  shadowSize: number     // 0-10
  shadowBlur: number     // 0-20
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

export interface ProfileData {
  folders: string[]
  recentVideos: string[]
  favorites: string[]
  hiddenVideos: string[]
  showHidden: boolean
  theme: 'dark' | 'light' | 'navy-blue'
  funscriptEnabled: boolean
  preferredAudioLang: string | null
  preferredSubtitleLang: string | null
  subtitleStyle: SubtitleStyle
  lastFolder: string | null
  lastViewMode: 'grid' | 'list'
}

interface SettingsSchema {
  currentProfile: string
  profiles: Record<string, ProfileData>
  handyConnectionKey: string
  volume: number
  windowBounds: { width: number; height: number; x?: number; y?: number }
}

const defaults: SettingsSchema = {
  currentProfile: 'Default',
  profiles: {
    Default: {
      folders: [],
      recentVideos: [],
      favorites: [],
      hiddenVideos: [],
      showHidden: false,
      theme: 'navy-blue',
      funscriptEnabled: true,
      preferredAudioLang: null,
      preferredSubtitleLang: null,
      subtitleStyle: defaultSubtitleStyle,
      lastFolder: null,
      lastViewMode: 'grid'
    }
  },
  handyConnectionKey: '',
  volume: 100,
  windowBounds: { width: 1280, height: 800 }
}

export const settingsStore = new Store<SettingsSchema>({ defaults })

// One-time migration from old flat schema
if (!(settingsStore as any).get('profiles')) {
  const oldFolders = (settingsStore as any).get('folders') ?? []
  const oldRecent = (settingsStore as any).get('recentVideos') ?? []
  settingsStore.set('profiles', {
    Default: {
      folders: oldFolders,
      recentVideos: oldRecent,
      theme: 'navy-blue' as const,
      funscriptEnabled: true
    }
  })
  settingsStore.set('currentProfile', 'Default')
  ;(settingsStore as any).delete('folders')
  ;(settingsStore as any).delete('recentVideos')
}

export function getCurrentProfileData(): ProfileData {
  const name = settingsStore.get('currentProfile')
  const profiles = settingsStore.get('profiles')
  const data = profiles[name] ?? profiles['Default']
  return {
    folders: data.folders ?? [],
    recentVideos: data.recentVideos ?? [],
    favorites: data.favorites ?? [],
    hiddenVideos: data.hiddenVideos ?? [],
    showHidden: data.showHidden ?? false,
    theme: data.theme ?? 'navy-blue',
    funscriptEnabled: data.funscriptEnabled ?? true,
    preferredAudioLang: data.preferredAudioLang ?? null,
    preferredSubtitleLang: data.preferredSubtitleLang ?? null,
    subtitleStyle: { ...defaultSubtitleStyle, ...(data.subtitleStyle ?? {}) },
    lastFolder: data.lastFolder ?? null,
    lastViewMode: data.lastViewMode ?? 'grid'
  }
}

export function updateCurrentProfile(partial: Partial<ProfileData>): void {
  const name = settingsStore.get('currentProfile')
  const profiles = settingsStore.get('profiles')
  profiles[name] = { ...profiles[name], ...partial }
  settingsStore.set('profiles', profiles)
}
