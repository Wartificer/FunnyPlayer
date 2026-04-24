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

export interface PlaylistState {
  videos: VideoFile[]
  currentIndex: number
  mode: 'sequential' | 'random'
}
