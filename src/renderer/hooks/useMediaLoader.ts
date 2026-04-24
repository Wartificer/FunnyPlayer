import { useEffect, useState } from 'react'
import { durationCache, setVideoDuration } from '../store/app-store'

// Shared sequential queue for thumbnail and duration loading
type Task = { key: string; run: () => Promise<void> }
const queue: Task[] = []
let running = false
let currentKey: string | null = null

function enqueue(key: string, run: () => Promise<void>) {
  // Don't add duplicates
  if (currentKey === key || queue.some((t) => t.key === key)) return
  queue.push({ key, run })
  drain()
}

function dequeue(key: string) {
  const idx = queue.findIndex((t) => t.key === key)
  if (idx !== -1) queue.splice(idx, 1)
}

async function drain() {
  if (running) return
  running = true
  while (queue.length > 0) {
    const task = queue.shift()!
    currentKey = task.key
    try { await task.run() } catch {}
    currentKey = null
  }
  running = false
}

// Shared thumbnail cache so re-mounts don't re-fetch
const thumbCache: Record<string, string> = {}

export function useMediaLoader(videoPath: string) {
  const [thumbUrl, setThumbUrl] = useState<string | null>(thumbCache[videoPath] ?? null)
  const [duration, setDuration] = useState<number | null>(durationCache[videoPath] ?? null)

  useEffect(() => {
    let cancelled = false
    const needsThumb = !thumbCache[videoPath]
    const needsDuration = durationCache[videoPath] == null

    if (!needsThumb && !needsDuration) return

    enqueue(videoPath, async () => {
      if (cancelled) return
      if (needsThumb) {
        const path = await window.api.getVideoThumbnail(videoPath)
        if (!cancelled && path) {
          const url = `file://${path}`
          thumbCache[videoPath] = url
          setThumbUrl(url)
        }
      }
      if (cancelled) return
      if (needsDuration) {
        const d = await window.api.getVideoDuration(videoPath)
        if (!cancelled && d !== null) {
          setVideoDuration(videoPath, d)
          setDuration(d)
        }
      }
    })

    return () => {
      cancelled = true
      dequeue(videoPath)
    }
  }, [videoPath])

  return { thumbUrl, duration }
}
