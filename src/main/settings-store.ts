import Store from 'electron-store'
import { defaultHandyPreferences } from '../shared/types'
import type { HandyPreferences } from '../shared/types'

export { defaultHandyPreferences }
export type { HandyPreferences, HandyRangeMode } from '../shared/types'

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
  handyPreferences: HandyPreferences
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
  handyPreferences: defaultHandyPreferences,
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

/**
 * Clamp a stored/incoming range into something the script transform can trust:
 * whole numbers, inside 0-100, min never above max. Sanitising on the way in
 * means every consumer can treat the bounds as already valid.
 */
function sanitizeHandyPreferences(partial: Partial<HandyPreferences> | undefined): HandyPreferences {
  const merged = { ...defaultHandyPreferences, ...(partial ?? {}) }
  const clamp = (n: number, fallback: number): number =>
    Number.isFinite(n) ? Math.min(100, Math.max(0, Math.round(n))) : fallback
  let rangeMin = clamp(merged.rangeMin, defaultHandyPreferences.rangeMin)
  let rangeMax = clamp(merged.rangeMax, defaultHandyPreferences.rangeMax)
  if (rangeMin > rangeMax) [rangeMin, rangeMax] = [rangeMax, rangeMin]
  return {
    rangeMin,
    rangeMax,
    rangeMode: merged.rangeMode === 'scale' ? 'scale' : 'limit'
  }
}

export function getHandyPreferences(): HandyPreferences {
  return sanitizeHandyPreferences(settingsStore.get('handyPreferences'))
}

export function setHandyPreferences(prefs: Partial<HandyPreferences>): HandyPreferences {
  const next = sanitizeHandyPreferences({ ...getHandyPreferences(), ...prefs })
  settingsStore.set('handyPreferences', next)
  return next
}
