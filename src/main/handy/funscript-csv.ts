import fs from 'fs'
import crypto from 'crypto'
import { applyRange } from '../../shared/funscript-range'
import { defaultHandyPreferences } from '../../shared/types'
import type { HandyPreferences } from '../../shared/types'
import type { FunscriptAction } from '../../shared/funscript-range'

interface Funscript {
  actions: FunscriptAction[]
}

/**
 * Re-time a script for a video playing at `rate`.
 *
 * The device has no playback-speed control of its own — HSSP only accepts a
 * start offset — so the only way to follow a sped-up video is to hand it a
 * script whose timeline is already compressed. An action due at video time `at`
 * must fire `at / rate` ms after the start, so that is the timestamp the device
 * gets. Positions are untouched; only the clock changes.
 *
 * The caller is responsible for converting playback positions the same way
 * before handing them to hsspPlay — see SyncManager.toScriptTime().
 */
export function applyTimeScale(actions: FunscriptAction[], rate: number): FunscriptAction[] {
  if (rate === 1) return actions

  const scaled: FunscriptAction[] = []
  let prevAt = -1
  for (const action of actions) {
    let at = Math.round(action.at / rate)
    // Compressing the timeline can collapse two actions onto the same
    // millisecond. Nudging rather than dropping keeps every stroke the script
    // asked for, at a sub-millisecond cost that no device can resolve anyway.
    if (at <= prevAt) at = prevAt + 1
    prevAt = at
    scaled.push({ at, pos: action.pos })
  }
  return scaled
}

/**
 * Convert a .funscript to the CSV form the Handy consumes, applying the user's
 * motion-range preference and the current playback rate on the way.
 *
 * The output deliberately carries no `#time_ms,position` header and ends with a
 * trailing newline: that is exactly the normalisation Handy's script hosting
 * applies to whatever it is given. Emitting it pre-normalised means the file we
 * upload is served back byte-for-byte, so this sha256 also describes the hosted
 * file — which is what lets /hssp/setup verify the download and lets the device
 * skip re-downloading a script it already holds.
 *
 * Because both the range and the rate are baked into the CSV, the sha256 covers
 * them too: changing either yields a different script identity, which is exactly
 * what makes the upload cache and the device-side skip do the right thing.
 */
export function funscriptToCsv(
  funscriptPath: string,
  prefs: HandyPreferences = defaultHandyPreferences,
  playbackRate = 1
): { csv: string; sha256: string } {
  const raw = fs.readFileSync(funscriptPath, 'utf-8')
  const script: Funscript = JSON.parse(raw)

  const ranged = applyRange(script.actions ?? [], prefs)
  const actions = applyTimeScale(ranged, playbackRate)

  const lines: string[] = []
  for (const action of actions) {
    lines.push(`${action.at},${action.pos}`)
  }

  const csv = lines.join('\n') + '\n'
  const sha256 = crypto.createHash('sha256').update(csv).digest('hex')

  return { csv, sha256 }
}
