import fs from 'fs'
import path from 'path'

const VIDEO_EXTENSIONS = new Set([
  '.mp4', '.mkv', '.avi', '.wmv', '.mov', '.flv', '.webm',
  '.m4v', '.mpg', '.mpeg', '.ts', '.vob', '.3gp', '.ogv'
])

export interface ScannedVideo {
  path: string
  name: string
  folder: string
  size: number
  lastModified: number
}

export function scanFolder(folderPath: string): ScannedVideo[] {
  const videos: ScannedVideo[] = []
  scanRecursive(folderPath, videos)
  return videos
}

function scanRecursive(dir: string, results: ScannedVideo[]): void {
  let entries: fs.Dirent[]
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return
  }

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      scanRecursive(fullPath, results)
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase()
      if (VIDEO_EXTENSIONS.has(ext)) {
        try {
          const stat = fs.statSync(fullPath)
          results.push({
            path: fullPath,
            name: path.basename(entry.name, ext),
            folder: dir,
            size: stat.size,
            lastModified: stat.mtimeMs
          })
        } catch {
          // skip inaccessible files
        }
      }
    }
  }
}
