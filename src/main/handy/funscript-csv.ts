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
 * Convert a .funscript to the CSV form the Handy consumes, applying the user's
 * motion-range preference on the way.
 *
 * The output deliberately carries no `#time_ms,position` header and ends with a
 * trailing newline: that is exactly the normalisation Handy's script hosting
 * applies to whatever it is given. Emitting it pre-normalised means the file we
 * upload is served back byte-for-byte, so this sha256 also describes the hosted
 * file — which is what lets /hssp/setup verify the download and lets the device
 * skip re-downloading a script it already holds.
 *
 * Because the range is baked into the CSV, the sha256 covers it too: changing
 * the range yields a different script identity, which is exactly what makes the
 * upload cache and the device-side skip do the right thing on a settings change.
 */
export function funscriptToCsv(
  funscriptPath: string,
  prefs: HandyPreferences = defaultHandyPreferences
): { csv: string; sha256: string } {
  const raw = fs.readFileSync(funscriptPath, 'utf-8')
  const script: Funscript = JSON.parse(raw)

  const actions = applyRange(script.actions ?? [], prefs)

  const lines: string[] = []
  for (const action of actions) {
    lines.push(`${action.at},${action.pos}`)
  }

  const csv = lines.join('\n') + '\n'
  const sha256 = crypto.createHash('sha256').update(csv).digest('hex')

  return { csv, sha256 }
}
