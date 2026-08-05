import { ipcRenderer } from 'electron'
import type { HandyPreferences } from '../shared/types'

// With contextIsolation: false, we can attach directly to window
// Keep the same api shape for backward compat
const api = {
  // Profiles
  getProfiles: () => ipcRenderer.invoke('get-profiles') as Promise<Array<{ name: string; funscriptEnabled: boolean }>>,
  getCurrentProfile: () => ipcRenderer.invoke('get-current-profile') as Promise<string>,
  setCurrentProfile: (name: string) => ipcRenderer.invoke('set-current-profile', name) as Promise<boolean>,
  createProfile: (name: string, funscriptEnabled: boolean) => ipcRenderer.invoke('create-profile', name, funscriptEnabled) as Promise<boolean>,
  renameProfile: (oldName: string, newName: string) => ipcRenderer.invoke('rename-profile', oldName, newName) as Promise<boolean>,
  deleteProfile: (name: string) => ipcRenderer.invoke('delete-profile', name) as Promise<boolean>,

  // Theme
  getTheme: () => ipcRenderer.invoke('get-theme') as Promise<'dark' | 'light' | 'navy-blue'>,
  setTheme: (theme: 'dark' | 'light' | 'navy-blue') => ipcRenderer.invoke('set-theme', theme),

  // Funscript
  getFunscriptEnabled: () => ipcRenderer.invoke('get-funscript-enabled') as Promise<boolean>,

  // Favorites / Hidden
  getFavorites: () => ipcRenderer.invoke('get-favorites') as Promise<string[]>,
  setFavorites: (paths: string[]) => ipcRenderer.invoke('set-favorites', paths),
  getHiddenVideos: () => ipcRenderer.invoke('get-hidden-videos') as Promise<string[]>,
  setHiddenVideos: (paths: string[]) => ipcRenderer.invoke('set-hidden-videos', paths),
  getShowHidden: () => ipcRenderer.invoke('get-show-hidden') as Promise<boolean>,
  setShowHidden: (val: boolean) => ipcRenderer.invoke('set-show-hidden', val),

  // Last folder / view mode (per profile)
  getLastFolder: () => ipcRenderer.invoke('get-last-folder') as Promise<string | null>,
  setLastFolder: (folder: string | null) => ipcRenderer.invoke('set-last-folder', folder),
  getLastViewMode: () => ipcRenderer.invoke('get-last-view-mode') as Promise<'grid' | 'list'>,
  setLastViewMode: (mode: 'grid' | 'list') => ipcRenderer.invoke('set-last-view-mode', mode),

  // Preferred language
  getPreferredAudioLang: () => ipcRenderer.invoke('get-preferred-audio-lang') as Promise<string | null>,
  setPreferredAudioLang: (lang: string | null) => ipcRenderer.invoke('set-preferred-audio-lang', lang),
  getPreferredSubtitleLang: () => ipcRenderer.invoke('get-preferred-subtitle-lang') as Promise<string | null>,
  setPreferredSubtitleLang: (lang: string | null) => ipcRenderer.invoke('set-preferred-subtitle-lang', lang),

  // Subtitle style
  getSubtitleStyle: () => ipcRenderer.invoke('get-subtitle-style'),
  setSubtitleStyle: (style: any) => ipcRenderer.invoke('set-subtitle-style', style),

  // Thumbnails
  setVideoThumbnail: (videoPath: string, screenshotPath: string) => ipcRenderer.invoke('set-video-thumbnail', videoPath, screenshotPath) as Promise<string>,
  getUserDataPath: () => ipcRenderer.invoke('get-user-data-path') as Promise<string>,
  openFileLocation: (filePath: string) => ipcRenderer.invoke('open-file-location', filePath),

  // File operations
  moveFiles: (filePaths: string[], destFolder: string) => ipcRenderer.invoke('move-files', filePaths, destFolder) as Promise<{ moved: string[]; errors: string[] }>,
  deleteFiles: (filePaths: string[]) => ipcRenderer.invoke('delete-files', filePaths) as Promise<{ deleted: string[]; errors: string[] }>,
  renameFile: (filePath: string, newName: string) => ipcRenderer.invoke('rename-file', filePath, newName) as Promise<{ newPath: string }>,
  getRelatedFiles: (filePath: string) => ipcRenderer.invoke('get-related-files', filePath) as Promise<string[]>,

  // Subtitle files
  findExternalSubtitles: (videoPath: string) => ipcRenderer.invoke('find-external-subtitles', videoPath) as Promise<string[]>,
  openSubtitleDialog: () => ipcRenderer.invoke('open-subtitle-dialog') as Promise<string | null>,

  // Folders
  addFolder: () => ipcRenderer.invoke('add-folder'),
  getFolders: () => ipcRenderer.invoke('get-folders'),
  removeFolder: (path: string) => ipcRenderer.invoke('remove-folder', path),
  getFolderTree: (path: string) => ipcRenderer.invoke('get-folder-tree', path),
  getVideos: (folderPath: string) => ipcRenderer.invoke('get-videos', folderPath),
  getRecentVideos: () => ipcRenderer.invoke('get-recent-videos'),
  getFavoriteVideos: () => ipcRenderer.invoke('get-favorite-videos'),
  getHiddenVideoList: () => ipcRenderer.invoke('get-hidden-video-list'),

  // Video processing (kept for prepare-video which adds to recent + handy setup)
  prepareVideo: (filePath: string, scriptOverride?: string) => ipcRenderer.invoke('prepare-video', filePath, scriptOverride),
  extractSubtitle: (originalPath: string, subtitleStreamIndex: number) =>
    ipcRenderer.invoke('extract-subtitle', originalPath, subtitleStreamIndex),

  // Thumbnails
  getVideoThumbnail: (filePath: string) => ipcRenderer.invoke('get-video-thumbnail', filePath),
  getVideoDuration: (filePath: string) => ipcRenderer.invoke('get-video-duration', filePath) as Promise<number | null>,
  generateSpriteSheet: (filePath: string) => ipcRenderer.invoke('generate-sprite-sheet', filePath),

  // Handy sync
  handyOnPlay: (positionMs: number) => ipcRenderer.invoke('handy-on-play', positionMs),
  handyOnPause: () => ipcRenderer.invoke('handy-on-pause'),
  handyOnSeek: (positionMs: number) => ipcRenderer.invoke('handy-on-seek', positionMs),

  // Handy connection
  handyConnect: (key: string) => ipcRenderer.invoke('handy-connect', key),
  handyDisconnect: () => ipcRenderer.invoke('handy-disconnect'),
  handyGetKey: () => ipcRenderer.invoke('handy-get-key'),

  // Handy device preferences
  handyGetPreferences: () => ipcRenderer.invoke('handy-get-preferences') as Promise<HandyPreferences>,
  handySetPreferences: (prefs: Partial<HandyPreferences>) =>
    ipcRenderer.invoke('handy-set-preferences', prefs) as Promise<{ preferences: HandyPreferences; resync: boolean }>,

  onHandyStatus: (callback: (status: unknown) => void) => {
    const handler = (_: unknown, status: unknown) => callback(status)
    ipcRenderer.on('handy-status', handler)
    return () => ipcRenderer.removeListener('handy-status', handler)
  },
  onHandyScriptLoading: (callback: (loading: boolean) => void) => {
    const handler = (_: unknown, loading: boolean) => callback(loading)
    ipcRenderer.on('handy-script-loading', handler)
    return () => ipcRenderer.removeListener('handy-script-loading', handler)
  },

  // Settings
  getVolume: () => ipcRenderer.invoke('get-volume'),
  setVolume: (percent: number) => ipcRenderer.invoke('set-volume', percent),

  // Window controls
  windowMinimize: () => ipcRenderer.invoke('window-minimize'),
  windowMaximize: () => ipcRenderer.invoke('window-maximize'),
  windowClose: () => ipcRenderer.invoke('window-close'),
  windowToggleFullscreen: () => ipcRenderer.invoke('window-toggle-fullscreen'),
  windowIsFullscreen: () => ipcRenderer.invoke('window-is-fullscreen'),
  onFullscreenChanged: (callback: (isFs: boolean) => void) => {
    const handler = (_: unknown, isFs: boolean) => callback(isFs)
    ipcRenderer.on('fullscreen-changed', handler)
    return () => ipcRenderer.removeListener('fullscreen-changed', handler)
  },

  // File association: app launched with a video file or file opened while running
  getPendingOpenFile: () => ipcRenderer.invoke('get-pending-open-file') as Promise<string | null>,
  onOpenFile: (callback: (filePath: string) => void) => {
    const handler = (_: unknown, filePath: string) => callback(filePath)
    ipcRenderer.on('open-file', handler)
    return () => ipcRenderer.removeListener('open-file', handler)
  }
}

;(window as any).api = api

export type ElectronAPI = typeof api
