import { ipcMain, dialog, BrowserWindow, app, shell } from 'electron'
import fs from 'fs'
import pathMod from 'path'
import { scanFolder } from './scanner/folder-scanner'
import { matchAllFunscripts, buildFolderTree } from './scanner/funscript-matcher'
import { SyncManager } from './handy/sync-manager'
import {
  settingsStore,
  getCurrentProfileData,
  updateCurrentProfile,
  getHandyPreferences,
  setHandyPreferences
} from './settings-store'
import type { SubtitleStyle, HandyPreferences } from './settings-store'
import { extractSubtitle } from './ffmpeg/video-processor'
import { getVideoThumbnail, generateSpriteSheet, setVideoThumbnail, getVideoDuration } from './ffmpeg/thumbnail-generator'
import type { VideoFile } from '../shared/types'

let syncManager = new SyncManager()

export function registerIpcHandlers(mainWindow: BrowserWindow): void {
  // --- Profile management ---
  ipcMain.handle('get-profiles', () => {
    const profiles = settingsStore.get('profiles')
    return Object.entries(profiles).map(([name, data]) => ({
      name,
      funscriptEnabled: data.funscriptEnabled
    }))
  })

  ipcMain.handle('get-current-profile', () => {
    return settingsStore.get('currentProfile')
  })

  ipcMain.handle('set-current-profile', (_e, name: string) => {
    const profiles = settingsStore.get('profiles')
    if (profiles[name]) {
      settingsStore.set('currentProfile', name)
      return true
    }
    return false
  })

  ipcMain.handle('create-profile', (_e, name: string, funscriptEnabled: boolean) => {
    const profiles = settingsStore.get('profiles')
    if (profiles[name]) return false
    profiles[name] = {
      folders: [],
      recentVideos: [],
      theme: 'navy-blue',
      funscriptEnabled
    }
    settingsStore.set('profiles', profiles)
    return true
  })

  ipcMain.handle('rename-profile', (_e, oldName: string, newName: string) => {
    if (oldName === 'Default') return false
    const profiles = settingsStore.get('profiles')
    if (!profiles[oldName] || profiles[newName]) return false
    profiles[newName] = profiles[oldName]
    delete profiles[oldName]
    settingsStore.set('profiles', profiles)
    if (settingsStore.get('currentProfile') === oldName) {
      settingsStore.set('currentProfile', newName)
    }
    return true
  })

  ipcMain.handle('delete-profile', (_e, name: string) => {
    if (name === 'Default') return false
    const profiles = settingsStore.get('profiles')
    if (!profiles[name]) return false
    delete profiles[name]
    settingsStore.set('profiles', profiles)
    if (settingsStore.get('currentProfile') === name) {
      settingsStore.set('currentProfile', 'Default')
    }
    return true
  })

  // --- Theme ---
  ipcMain.handle('get-theme', () => {
    return getCurrentProfileData().theme
  })

  ipcMain.handle('set-theme', (_e, theme: 'dark' | 'light' | 'navy-blue') => {
    updateCurrentProfile({ theme })
  })

  // --- Funscript enabled ---
  ipcMain.handle('get-funscript-enabled', () => {
    return getCurrentProfileData().funscriptEnabled
  })

  // --- Favorites / Hidden ---
  ipcMain.handle('get-favorites', () => {
    return getCurrentProfileData().favorites
  })

  ipcMain.handle('set-favorites', (_e, paths: string[]) => {
    updateCurrentProfile({ favorites: paths })
  })

  ipcMain.handle('get-hidden-videos', () => {
    return getCurrentProfileData().hiddenVideos
  })

  ipcMain.handle('set-hidden-videos', (_e, paths: string[]) => {
    updateCurrentProfile({ hiddenVideos: paths })
  })

  ipcMain.handle('get-show-hidden', () => {
    return getCurrentProfileData().showHidden
  })

  ipcMain.handle('set-show-hidden', (_e, val: boolean) => {
    updateCurrentProfile({ showHidden: val })
  })

  ipcMain.handle('get-last-folder', () => {
    return getCurrentProfileData().lastFolder
  })

  ipcMain.handle('set-last-folder', (_e, folder: string | null) => {
    updateCurrentProfile({ lastFolder: folder })
  })

  ipcMain.handle('get-last-view-mode', () => {
    return getCurrentProfileData().lastViewMode
  })

  ipcMain.handle('set-last-view-mode', (_e, mode: 'grid' | 'list') => {
    updateCurrentProfile({ lastViewMode: mode })
  })

  // --- Preferred language ---
  ipcMain.handle('get-preferred-audio-lang', () => {
    return getCurrentProfileData().preferredAudioLang
  })

  ipcMain.handle('set-preferred-audio-lang', (_e, lang: string | null) => {
    updateCurrentProfile({ preferredAudioLang: lang })
  })

  ipcMain.handle('get-preferred-subtitle-lang', () => {
    return getCurrentProfileData().preferredSubtitleLang
  })

  ipcMain.handle('set-preferred-subtitle-lang', (_e, lang: string | null) => {
    updateCurrentProfile({ preferredSubtitleLang: lang })
  })

  // --- Subtitle style ---
  ipcMain.handle('get-subtitle-style', () => {
    return getCurrentProfileData().subtitleStyle
  })

  ipcMain.handle('set-subtitle-style', (_e, style: SubtitleStyle) => {
    updateCurrentProfile({ subtitleStyle: style })
  })

  // --- Thumbnail override ---
  ipcMain.handle('set-video-thumbnail', (_e, videoPath: string, screenshotPath: string) => {
    return setVideoThumbnail(videoPath, screenshotPath)
  })

  // --- User data path ---
  ipcMain.handle('get-user-data-path', () => {
    return app.getPath('userData')
  })

  // --- Open file location ---
  ipcMain.handle('open-file-location', (_e, filePath: string) => {
    shell.showItemInFolder(filePath)
  })

  // --- External subtitle files ---
  const SUBTITLE_EXTS = ['.srt', '.ass', '.ssa', '.sub', '.vtt']

  ipcMain.handle('find-external-subtitles', (_e, videoPath: string): string[] => {
    const dir = pathMod.dirname(videoPath)
    const base = pathMod.basename(videoPath).replace(/\.[^.]+$/, '')
    const found: string[] = []
    try {
      for (const entry of fs.readdirSync(dir)) {
        const ext = pathMod.extname(entry).toLowerCase()
        if (!SUBTITLE_EXTS.includes(ext)) continue
        const entryBase = entry.slice(0, entry.length - ext.length)
        // Match exact base name or base + language tag (e.g., video.en.srt)
        if (entryBase === base || entryBase.startsWith(base + '.') || entryBase.startsWith(base + '-') || entryBase.startsWith(base + '_')) {
          found.push(pathMod.join(dir, entry))
        }
      }
    } catch {}
    return found
  })

  ipcMain.handle('open-subtitle-dialog', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [
        { name: 'Subtitle files', extensions: ['srt', 'ass', 'ssa', 'sub', 'vtt'] },
        { name: 'All files', extensions: ['*'] }
      ]
    })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })

  // --- Folder management ---
  ipcMain.handle('add-folder', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory']
    })
    if (result.canceled || result.filePaths.length === 0) return null
    const folder = result.filePaths[0]
    const profile = getCurrentProfileData()
    if (!profile.folders.includes(folder)) {
      updateCurrentProfile({ folders: [...profile.folders, folder] })
    }
    return folder
  })

  ipcMain.handle('get-folders', () => {
    return getCurrentProfileData().folders
  })

  ipcMain.handle('remove-folder', (_e, folderPath: string) => {
    const profile = getCurrentProfileData()
    updateCurrentProfile({ folders: profile.folders.filter((f) => f !== folderPath) })
  })

  ipcMain.handle('get-folder-tree', (_e, folderPath: string) => {
    return buildFolderTree(folderPath)
  })

  ipcMain.handle('get-videos', (_e, folderPath: string): VideoFile[] => {
    const hiddenSet = new Set(getCurrentProfileData().hiddenVideos)
    const scanned = scanFolder(folderPath)
    return scanned.filter((v) => !hiddenSet.has(v.path)).map((v) => {
      const match = matchAllFunscripts(v.path)
      return {
        ...v,
        hasFunscript: match.defaultScript !== null || match.variants.length > 0,
        funscriptPath: match.defaultScript,
        alternateScripts: match.variants
      }
    })
  })

  ipcMain.handle('get-recent-videos', (): VideoFile[] => {
    const profile = getCurrentProfileData()
    const hiddenSet = new Set(profile.hiddenVideos)
    const recentPaths = profile.recentVideos
    const videos: VideoFile[] = []
    for (const videoPath of recentPaths) {
      if (hiddenSet.has(videoPath)) continue
      const match = matchAllFunscripts(videoPath)
      videos.push({
        path: videoPath,
        name: videoPath.replace(/.*[\\/]/, '').replace(/\.[^.]+$/, ''),
        folder: videoPath.replace(/[\\/][^\\/]+$/, ''),
        size: 0,
        lastModified: 0,
        hasFunscript: match.defaultScript !== null || match.variants.length > 0,
        funscriptPath: match.defaultScript,
        alternateScripts: match.variants
      })
    }
    return videos
  })

  ipcMain.handle('get-favorite-videos', (): VideoFile[] => {
    const profile = getCurrentProfileData()
    const hiddenSet = new Set(profile.hiddenVideos)
    const paths = profile.favorites
    const videos: VideoFile[] = []
    for (const videoPath of paths) {
      if (hiddenSet.has(videoPath)) continue
      try {
        const stat = fs.statSync(videoPath)
        const match = matchAllFunscripts(videoPath)
        videos.push({
          path: videoPath,
          name: videoPath.replace(/.*[\\/]/, '').replace(/\.[^.]+$/, ''),
          folder: videoPath.replace(/[\\/][^\\/]+$/, ''),
          size: stat.size,
          lastModified: stat.mtimeMs,
          hasFunscript: match.defaultScript !== null || match.variants.length > 0,
          funscriptPath: match.defaultScript,
          alternateScripts: match.variants
        })
      } catch {}
    }
    return videos
  })

  ipcMain.handle('get-hidden-video-list', (): VideoFile[] => {
    const paths = getCurrentProfileData().hiddenVideos
    const videos: VideoFile[] = []
    for (const videoPath of paths) {
      try {
        const stat = fs.statSync(videoPath)
        const match = matchAllFunscripts(videoPath)
        videos.push({
          path: videoPath,
          name: videoPath.replace(/.*[\\/]/, '').replace(/\.[^.]+$/, ''),
          folder: videoPath.replace(/[\\/][^\\/]+$/, ''),
          size: stat.size,
          lastModified: stat.mtimeMs,
          hasFunscript: match.defaultScript !== null || match.variants.length > 0,
          funscriptPath: match.defaultScript,
          alternateScripts: match.variants
        })
      } catch {}
    }
    return videos
  })

  // --- File operations ---
  ipcMain.handle('move-files', async (_e, filePaths: string[], destFolder: string) => {
    const moved: string[] = []
    const errors: string[] = []
    for (const filePath of filePaths) {
      try {
        const fileName = pathMod.basename(filePath)
        const dest = pathMod.join(destFolder, fileName)
        if (filePath === dest) continue
        // Find associated funscripts before moving
        const match = matchAllFunscripts(filePath)
        const scripts = [match.defaultScript, ...match.variants.map(v => v.path)].filter(Boolean) as string[]
        await fs.promises.rename(filePath, dest).catch(async () => {
          await fs.promises.copyFile(filePath, dest)
          await fs.promises.unlink(filePath)
        })
        moved.push(filePath)
        for (const script of scripts) {
          const scriptDest = pathMod.join(destFolder, pathMod.basename(script))
          await fs.promises.rename(script, scriptDest).catch(async () => {
            await fs.promises.copyFile(script, scriptDest)
            await fs.promises.unlink(script)
          }).catch(() => {})
        }
      } catch (err: any) {
        errors.push(`${filePath}: ${err.message}`)
      }
    }
    return { moved, errors }
  })

  ipcMain.handle('delete-files', async (_e, filePaths: string[]) => {
    const deleted: string[] = []
    const errors: string[] = []
    for (const filePath of filePaths) {
      try {
        // Find associated funscripts before deleting
        const match = matchAllFunscripts(filePath)
        const scripts = [match.defaultScript, ...match.variants.map(v => v.path)].filter(Boolean) as string[]
        await shell.trashItem(filePath)
        deleted.push(filePath)
        for (const script of scripts) {
          await shell.trashItem(script).catch(() => {})
        }
      } catch (err: any) {
        errors.push(`${filePath}: ${err.message}`)
      }
    }
    return { deleted, errors }
  })

  ipcMain.handle('get-related-files', (_e, filePath: string): string[] => {
    const dir = pathMod.dirname(filePath)
    const ext = pathMod.extname(filePath)
    const base = pathMod.basename(filePath, ext)
    try {
      return fs.readdirSync(dir).filter((entry) => {
        const entryName = entry.replace(/\.[^.]+$/, '')
        // Match exact name or name followed by a separator (e.g. base-fast.funscript, base.srt)
        return entryName === base || entry.startsWith(base + '-') || entry.startsWith(base + '_') || entry.startsWith(base + ' ') || entry.startsWith(base + '.')
      }).filter((entry) => {
        // Exclude directories
        try { return fs.statSync(pathMod.join(dir, entry)).isFile() } catch { return false }
      })
    } catch { return [] }
  })

  ipcMain.handle('rename-file', async (_e, filePath: string, newName: string) => {
    const dir = pathMod.dirname(filePath)
    const ext = pathMod.extname(filePath)
    const oldBase = pathMod.basename(filePath, ext)
    // Find ALL related files before renaming
    const entries = fs.readdirSync(dir)
    const related = entries.filter((entry) => {
      const entryName = entry.replace(/\.[^.]+$/, '')
      return entryName === oldBase || entry.startsWith(oldBase + '-') || entry.startsWith(oldBase + '_') || entry.startsWith(oldBase + ' ') || entry.startsWith(oldBase + '.')
    }).filter((entry) => {
      try { return fs.statSync(pathMod.join(dir, entry)).isFile() } catch { return false }
    })
    // Rename each: replace the oldBase prefix with newName
    for (const entry of related) {
      const suffix = entry.slice(oldBase.length) // e.g. ".mp4", "-fast.funscript", ".srt"
      const newEntry = newName + suffix
      try { fs.renameSync(pathMod.join(dir, entry), pathMod.join(dir, newEntry)) } catch {}
    }
    const newPath = pathMod.join(dir, newName + ext)
    return { newPath }
  })

  // --- Video processing ---
  ipcMain.handle('prepare-video', async (_e, filePath: string, scriptOverride?: string) => {
    console.log(`[IPC] prepare-video: ${filePath}, script override: ${scriptOverride ?? 'none'}`)

    // Add to recent
    const profile = getCurrentProfileData()
    const recent = profile.recentVideos.filter((p) => p !== filePath)
    recent.unshift(filePath)
    updateCurrentProfile({ recentVideos: recent.slice(0, 50) })

    // Use override if provided, otherwise auto-match. Fall back to the first
    // variant when there's no exact-name script — the library already counts a
    // video as scripted on variants alone, so plain Play should honour that
    // rather than silently starting with no script.
    const match = matchAllFunscripts(filePath)
    const funscriptPath = scriptOverride ?? match.defaultScript ?? match.variants[0]?.path ?? null
    console.log(`[IPC] Funscript match: ${funscriptPath ?? 'none'}, handy connected: ${syncManager.getConnected()}`)

    if (syncManager.getConnected()) {
      if (funscriptPath) {
        mainWindow.webContents.send('handy-script-loading', true)
        try {
          await syncManager.setupScript(funscriptPath)
        } catch (err) {
          console.error('[IPC] Handy setup error:', err)
        }
        mainWindow.webContents.send('handy-script-loading', false)
      } else {
        // Must be explicit: leaving the device alone here would let the previous
        // video's script keep running against this one.
        await syncManager.clearScript().catch((err) => {
          console.error('[IPC] Handy clear error:', err)
        })
      }
    }

    return { filePath, funscriptPath }
  })

  ipcMain.handle('extract-subtitle', async (_e, originalPath: string, subtitleStreamIndex: number) => {
    console.log(`[IPC] extract-subtitle: stream ${subtitleStreamIndex}`)
    return extractSubtitle(originalPath, subtitleStreamIndex)
  })

  // --- Thumbnails ---
  ipcMain.handle('get-video-thumbnail', async (_e, filePath: string) => {
    return getVideoThumbnail(filePath)
  })

  ipcMain.handle('get-video-duration', async (_e, filePath: string) => {
    return getVideoDuration(filePath)
  })

  ipcMain.handle('generate-sprite-sheet', async (_e, filePath: string) => {
    return generateSpriteSheet(filePath)
  })

  // --- Handy sync ---
  ipcMain.handle('handy-on-play', async (_e, positionMs: number) => {
    console.log(`[IPC] handy-on-play: ${positionMs}ms`)
    syncManager.onPlay(positionMs).catch(console.error)
  })

  ipcMain.handle('handy-on-pause', async () => {
    console.log('[IPC] handy-on-pause')
    syncManager.onPause().catch(console.error)
  })

  ipcMain.handle('handy-on-seek', async (_e, positionMs: number) => {
    console.log(`[IPC] handy-on-seek: ${positionMs}ms`)
    syncManager.onSeek(positionMs).catch(console.error)
  })

  // --- Handy connection ---
  ipcMain.handle('handy-connect', async (_e, key: string) => {
    settingsStore.set('handyConnectionKey', key)
    const connected = await syncManager.connect(key)
    mainWindow.webContents.send('handy-status', { connected })
    return connected
  })

  ipcMain.handle('handy-disconnect', () => {
    syncManager.disconnect()
    mainWindow.webContents.send('handy-status', { connected: false })
  })

  ipcMain.handle('handy-get-key', () => {
    return settingsStore.get('handyConnectionKey')
  })

  // --- Handy device preferences ---
  ipcMain.handle('handy-get-preferences', () => {
    return getHandyPreferences()
  })

  /**
   * Persist the preference and rebuild the loaded script under it. Returns the
   * sanitised preference plus whether playback needs resyncing — the renderer
   * owns the playhead, so only it can issue the follow-up seek.
   */
  ipcMain.handle('handy-set-preferences', async (_e, prefs: Partial<HandyPreferences>) => {
    const saved = setHandyPreferences(prefs)
    console.log(`[IPC] handy-set-preferences: ${saved.rangeMin}-${saved.rangeMax} (${saved.rangeMode})`)
    let resync = false
    try {
      resync = await syncManager.reloadScript()
    } catch (err) {
      console.error('[IPC] Handy script reload error:', err)
    }
    return { preferences: saved, resync }
  })

  // --- Settings ---
  ipcMain.handle('get-volume', () => {
    return settingsStore.get('volume')
  })

  ipcMain.handle('set-volume', (_e, percent: number) => {
    settingsStore.set('volume', percent)
  })

  // --- Window controls ---
  ipcMain.handle('window-minimize', () => {
    mainWindow.minimize()
  })

  ipcMain.handle('window-maximize', () => {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize()
    } else {
      mainWindow.maximize()
    }
  })

  ipcMain.handle('window-close', () => {
    mainWindow.close()
  })

  ipcMain.handle('window-toggle-fullscreen', () => {
    mainWindow.setFullScreen(!mainWindow.isFullScreen())
    return mainWindow.isFullScreen()
  })

  ipcMain.handle('window-is-fullscreen', () => {
    return mainWindow.isFullScreen()
  })
}

export async function cleanup(): Promise<void> {
  await syncManager.onPause().catch(() => {})
  syncManager.disconnect()
}
