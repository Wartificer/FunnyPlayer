export interface ScriptVariant {
  label: string
  path: string
}

export interface VideoFile {
  path: string
  name: string
  folder: string
  size: number
  lastModified: number
  hasFunscript: boolean
  funscriptPath: string | null
  alternateScripts: ScriptVariant[]
}

export interface FolderNode {
  path: string
  name: string
  children: FolderNode[]
}

export interface MpvEvent {
  type: 'property-change' | 'end-file' | 'file-loaded'
  name?: string
  data?: unknown
}

export interface HandyStatus {
  connected: boolean
  mode?: number
  state?: string
}

/**
 * How the configured motion range is applied to a script.
 *
 * 'limit' — positions outside the range are pinned to the nearest bound. Motion
 *   already inside the range is untouched, so strokes that stayed within it feel
 *   exactly as scripted while the extremes flatten off.
 * 'scale' — the script's own lowest and highest positions are mapped onto the
 *   range bounds and everything between is interpolated, preserving the shape of
 *   the whole script at reduced size.
 */
export type HandyRangeMode = 'limit' | 'scale'

export interface HandyPreferences {
  rangeMin: number // 0-100
  rangeMax: number // 0-100
  rangeMode: HandyRangeMode
}

export const defaultHandyPreferences: HandyPreferences = {
  rangeMin: 0,
  rangeMax: 100,
  rangeMode: 'limit'
}

export interface PlaylistState {
  videos: VideoFile[]
  currentIndex: number
  mode: 'sequential' | 'random'
}
