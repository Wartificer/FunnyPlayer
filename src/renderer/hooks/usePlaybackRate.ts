import { useCallback, useEffect, useRef } from 'react'
import { usePlayerStore } from '../store/player-store'
import { useAppStore } from '../store/app-store'
import { getMpv } from '../mpv'

export const MIN_PLAYBACK_RATE = 0.5
export const MAX_PLAYBACK_RATE = 3
export const PLAYBACK_RATE_STEP = 0.1

/** Long enough that a run of key presses settles into a single re-upload. */
const COMMIT_DEBOUNCE_MS = 1000

/** 0.1 steps accumulate float error fast — snap back to the grid every time. */
const roundRate = (rate: number): number => Math.round(rate * 10) / 10

const clampRate = (rate: number): number =>
  Math.min(MAX_PLAYBACK_RATE, Math.max(MIN_PLAYBACK_RATE, roundRate(rate)))

export const formatRate = (rate: number): string => `${rate.toFixed(1)}×`

/**
 * Video playback speed, kept in lockstep with the device.
 *
 * The Handy has no speed control of its own — the script has to be re-timed and
 * re-uploaded for every rate. That means a rate change is slow and can fail, so
 * the order here matters: the video keeps playing at its current speed until the
 * device confirms it is holding the re-timed script, and only then does mpv's
 * speed move. If the device never confirms, neither side changes and the two
 * stay in sync at the old rate.
 */
export function usePlaybackRate() {
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()
  // Rate changes are serialised: a burst of key presses must not interleave two
  // uploads and leave the device holding the older one.
  const inFlightRef = useRef<Promise<void>>(Promise.resolve())

  const commit = useCallback(async (rate: number): Promise<void> => {
    const store = usePlayerStore.getState()
    // Superseded while queued, or already applied — nothing to do.
    if (rate !== store.pendingPlaybackRate || rate === store.playbackRate) return

    store.setRateChanging(true)
    try {
      let resync = false
      if (useAppStore.getState().funscriptEnabled) {
        // Throws if the device could not be re-timed, which skips the speed
        // change below and leaves video and device together on the old rate.
        resync = (await window.api.handySetPlaybackRate(rate)).resync
      }

      const mpv = getMpv()
      if (mpv) mpv.setPropertyDouble('speed', rate)
      usePlayerStore.getState().setPlaybackRate(rate)

      // Re-timing stopped the device. Nudge it back to the playhead so the new
      // speed takes effect on the video playing right now.
      if (resync) {
        let pos = 0
        try {
          pos = mpv?.getPropertyDouble('time-pos') ?? 0
        } catch {
          // No file loaded — resync at 0 rather than skipping the nudge.
        }
        await window.api.handyOnPlay(pos * 1000)
      }
    } catch (err) {
      console.error('[usePlaybackRate] Failed to change playback rate:', err)
      // Drop the pending rate back to what is actually playing so the OSD stops
      // promising a speed we never reached.
      usePlayerStore.getState().setPendingPlaybackRate(usePlayerStore.getState().playbackRate)
    } finally {
      usePlayerStore.getState().setRateChanging(false)
    }
  }, [])

  const schedule = useCallback(
    (rate: number, delayMs = COMMIT_DEBOUNCE_MS) => {
      // Always clears the previous timer, so a reset supersedes a keypress still
      // waiting out its debounce rather than racing it.
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        inFlightRef.current = inFlightRef.current.catch(() => {}).then(() => commit(rate))
      }, delayMs)
    },
    [commit]
  )

  /** Step the target rate by one increment. The video does not move yet. */
  const bumpRate = useCallback(
    (direction: 1 | -1) => {
      const store = usePlayerStore.getState()
      const next = clampRate(store.pendingPlaybackRate + direction * PLAYBACK_RATE_STEP)
      if (next === store.pendingPlaybackRate) return
      store.setPendingPlaybackRate(next)
      schedule(next)
    },
    [schedule]
  )

  /**
   * Back to 1×. Unlike the +/- keys there is nothing to coalesce here — a click
   * is one deliberate action — so it commits immediately instead of sitting out
   * the debounce and looking unresponsive.
   */
  const resetRate = useCallback(() => {
    const store = usePlayerStore.getState()
    if (store.pendingPlaybackRate === 1 && store.playbackRate === 1) return
    store.setPendingPlaybackRate(1)
    schedule(1, 0)
  }, [schedule])

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  return { bumpRate, resetRate }
}
