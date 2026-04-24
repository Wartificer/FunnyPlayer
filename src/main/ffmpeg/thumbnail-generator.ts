import { execFile } from 'child_process'
import ffmpegPath from 'ffmpeg-static'
import ffprobePath from 'ffprobe-static'
import path from 'path'
import fs from 'fs'
import crypto from 'crypto'
import { app } from 'electron'

let cacheDir = ''

export function getCacheDir(): string {
  if (!cacheDir) {
    cacheDir = path.join(app.getPath('userData'), 'thumb-cache')
  }
  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true })
  }
  return cacheDir
}

export function hashPath(filePath: string): string {
  return crypto.createHash('md5').update(filePath).digest('hex')
}

// --- Concurrency limiter: max 2 ffmpeg processes at a time ---

const queue: Array<() => void> = []
let running = 0
const MAX_CONCURRENT = 2

function acquireSlot(): Promise<void> {
  if (running < MAX_CONCURRENT) {
    running++
    return Promise.resolve()
  }
  return new Promise((resolve) => {
    queue.push(() => { running++; resolve() })
  })
}

function releaseSlot(): void {
  running--
  if (queue.length > 0) {
    const next = queue.shift()!
    next()
  }
}

// --- Duration cache: in-memory + persisted JSON file ---

let durationCache: Record<string, number> = {}
let durationCacheLoaded = false

function getDurationCachePath(): string {
  return path.join(getCacheDir(), '_durations.json')
}

function loadDurationCache(): void {
  if (durationCacheLoaded) return
  durationCacheLoaded = true
  const cachePath = getDurationCachePath()
  if (fs.existsSync(cachePath)) {
    try {
      durationCache = JSON.parse(fs.readFileSync(cachePath, 'utf-8'))
    } catch {
      durationCache = {}
    }
  }
}

function saveDurationToCache(hash: string, duration: number): void {
  durationCache[hash] = duration
  // Write async to avoid blocking
  const cachePath = getDurationCachePath()
  fs.writeFile(cachePath, JSON.stringify(durationCache), () => {})
}

// --- Single thumbnail for organizer cards ---

export function getVideoDuration(videoPath: string): Promise<number | null> {
  loadDurationCache()
  const hash = hashPath(videoPath)

  // Instant return from cache
  if (hash in durationCache) {
    return Promise.resolve(durationCache[hash])
  }

  // Check sprite sheet meta (also cached on disk)
  const metaPath = path.join(getCacheDir(), `${hash}_sprite.json`)
  if (fs.existsSync(metaPath)) {
    try {
      const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'))
      if (typeof meta.duration === 'number') {
        saveDurationToCache(hash, meta.duration)
        return Promise.resolve(meta.duration)
      }
    } catch {}
  }

  // Fallback: run ffprobe (only for videos with no thumbnail yet)
  return new Promise((resolve) => {
    execFile(
      ffprobePath.path,
      ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', videoPath],
      { timeout: 10000 },
      (err, stdout) => {
        if (err) { resolve(null); return }
        const d = parseFloat(stdout.trim())
        if (isFinite(d)) {
          saveDurationToCache(hash, d)
          resolve(d)
        } else {
          resolve(null)
        }
      }
    )
  })
}

export async function getVideoThumbnail(videoPath: string): Promise<string | null> {
  const hash = hashPath(videoPath)
  const thumbPath = path.join(getCacheDir(), `${hash}.jpg`)

  if (fs.existsSync(thumbPath)) {
    return thumbPath
  }

  if (!fs.existsSync(videoPath)) {
    return null
  }

  await acquireSlot()
  try {
    return await extractThumbnail(videoPath, thumbPath)
  } finally {
    releaseSlot()
  }
}

function extractThumbnail(videoPath: string, thumbPath: string): Promise<string | null> {
  return new Promise((resolve) => {
    execFile(
      ffprobePath.path,
      ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', videoPath],
      { timeout: 10000 },
      (err, stdout) => {
        if (err) {
          console.error(`[Thumbnail] ffprobe error for ${videoPath}:`, err.message)
          resolve(null)
          return
        }

        const duration = parseFloat(stdout.trim())

        // Cache the duration as a side effect
        if (isFinite(duration)) {
          loadDurationCache()
          saveDurationToCache(hashPath(videoPath), duration)
        }
        // Seek to middle of the video to avoid black intro screens
        const seekTo = isFinite(duration) && duration > 2 ? Math.floor(duration * 0.5) : 1

        execFile(
          ffmpegPath as unknown as string,
          [
            '-ss', String(seekTo),
            '-i', videoPath,
            '-frames:v', '1',
            '-update', '1',
            '-vf', 'scale=320:-2',
            '-q:v', '6',
            '-y',
            thumbPath
          ],
          { timeout: 15000 },
          (err2) => {
            if (err2) {
              console.error(`[Thumbnail] ffmpeg error for ${videoPath}:`, err2.message)
              resolve(null)
              return
            }
            resolve(thumbPath)
          }
        )
      }
    )
  })
}

// --- Sprite sheet for seek bar preview ---

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

export async function generateSpriteSheet(videoPath: string): Promise<SpriteSheetInfo | null> {
  const hash = hashPath(videoPath)
  const spritePath = path.join(getCacheDir(), `${hash}_sprite.jpg`)
  const metaPath = path.join(getCacheDir(), `${hash}_sprite.json`)

  if (fs.existsSync(spritePath) && fs.existsSync(metaPath)) {
    try {
      return JSON.parse(fs.readFileSync(metaPath, 'utf8'))
    } catch {
      // Corrupted cache, regenerate
    }
  }

  if (!fs.existsSync(videoPath)) {
    return null
  }

  await acquireSlot()
  try {
    return await buildSpriteSheet(videoPath, spritePath, metaPath)
  } finally {
    releaseSlot()
  }
}

function buildSpriteSheet(videoPath: string, spritePath: string, metaPath: string): Promise<SpriteSheetInfo | null> {
  return new Promise((resolve) => {
    execFile(
      ffprobePath.path,
      ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', videoPath],
      { timeout: 10000 },
      (err, stdout) => {
        if (err || !stdout.trim()) {
          console.error(`[SpriteSheet] ffprobe error:`, err?.message)
          resolve(null)
          return
        }

        const duration = parseFloat(stdout.trim())
        if (!isFinite(duration) || duration < 2) {
          resolve(null)
          return
        }

        // Cache the duration as a side effect
        loadDurationCache()
        saveDurationToCache(hashPath(videoPath), duration)

        let interval = 10
        if (duration > 1800) interval = 30
        else if (duration > 600) interval = 15

        const totalFrames = Math.min(Math.floor(duration / interval), 150)
        const cols = 10
        const rows = Math.ceil(totalFrames / cols)
        const thumbWidth = 160
        const thumbHeight = 90

        console.log(`[SpriteSheet] Generating: ${totalFrames} frames, ${cols}x${rows} grid, interval=${interval}s`)

        execFile(
          ffmpegPath as unknown as string,
          [
            '-i', videoPath,
            '-vf', `fps=1/${interval},scale=${thumbWidth}:${thumbHeight}:force_original_aspect_ratio=decrease,pad=${thumbWidth}:${thumbHeight}:(ow-iw)/2:(oh-ih)/2,tile=${cols}x${rows}`,
            '-frames:v', '1',
            '-update', '1',
            '-q:v', '5',
            '-y',
            spritePath
          ],
          { timeout: 120000 },
          (err2) => {
            if (err2) {
              console.error(`[SpriteSheet] ffmpeg error:`, err2.message)
              resolve(null)
              return
            }

            const info: SpriteSheetInfo = {
              path: spritePath,
              cols,
              rows,
              thumbWidth,
              thumbHeight,
              interval,
              totalFrames,
              duration
            }

            fs.writeFileSync(metaPath, JSON.stringify(info))
            console.log(`[SpriteSheet] Generated: ${spritePath}`)
            resolve(info)
          }
        )
      }
    )
  })
}

// --- Set custom thumbnail from a screenshot ---

export function setVideoThumbnail(videoPath: string, screenshotPath: string): string {
  const dest = path.join(getCacheDir(), `${hashPath(videoPath)}.jpg`)
  fs.copyFileSync(screenshotPath, dest)
  return dest
}
