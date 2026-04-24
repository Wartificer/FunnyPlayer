import fs from 'fs'
import path from 'path'

export interface FunscriptMatch {
  defaultScript: string | null
  variants: { label: string; path: string }[]
}

/**
 * Find the default funscript (exact name match) and any variants.
 * e.g. for "video.mp4":
 *   - "video.funscript" → default
 *   - "video-smooth.funscript" → variant with label "smooth"
 *   - "video (alt).funscript" → variant with label "(alt)"
 */
export function matchAllFunscripts(videoPath: string): FunscriptMatch {
  const dir = path.dirname(videoPath)
  const base = path.basename(videoPath).replace(/\.[^.]+$/, '')
  const defaultPath = path.join(dir, base + '.funscript')
  const defaultScript = fs.existsSync(defaultPath) ? defaultPath : null

  const variants: { label: string; path: string }[] = []

  try {
    const entries = fs.readdirSync(dir)
    for (const entry of entries) {
      if (!entry.toLowerCase().endsWith('.funscript')) continue
      const entryBase = entry.replace(/\.funscript$/i, '')
      // Skip the exact match (that's the default)
      if (entryBase === base) continue
      // Check if it starts with the video name
      if (!entryBase.startsWith(base)) continue
      // Extract the suffix after the video name
      const suffix = entryBase.slice(base.length)
      // Accept separators like "-", " ", "_", "." before the variant name
      const label = suffix.replace(/^[\s\-_.]+/, '')
      if (label) {
        variants.push({ label, path: path.join(dir, entry) })
      }
    }
  } catch {
    // skip inaccessible dirs
  }

  variants.sort((a, b) => a.label.localeCompare(b.label))
  return { defaultScript, variants }
}

/** Simple check — kept for backward compat */
export function matchFunscript(videoPath: string): string | null {
  const base = videoPath.replace(/\.[^.]+$/, '')
  const funscriptPath = base + '.funscript'
  return fs.existsSync(funscriptPath) ? funscriptPath : null
}

interface FolderTreeNode {
  path: string
  name: string
  children: FolderTreeNode[]
}

export function buildFolderTree(folderPath: string): FolderTreeNode {
  const result: FolderTreeNode = {
    path: folderPath,
    name: path.basename(folderPath),
    children: []
  }

  try {
    const entries = fs.readdirSync(folderPath, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.isDirectory()) {
        result.children.push(buildFolderTree(path.join(folderPath, entry.name)))
      }
    }
  } catch {
    // skip inaccessible
  }

  result.children.sort((a, b) => a.name.localeCompare(b.name))
  return result
}
