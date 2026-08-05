import type { HandyPreferences } from './types'

export interface FunscriptAction {
  at: number
  pos: number
}

const clampPos = (n: number): number => Math.min(100, Math.max(0, Math.round(n)))

/**
 * Rewrite script positions to respect the configured motion range.
 *
 * This is done against the script rather than on the device because the Handy's
 * own range control (`PUT /slide`) only ever *scales* the nominal 0-100 domain
 * into the allowed zone — it cannot clamp, and it knows nothing about the
 * positions a given script actually uses. Transforming the real actions is the
 * only way both modes mean what they say. See setSlideRange() in handy-client.ts
 * for how the device-side setting is kept out of the way.
 *
 * Lives in shared/ so the settings preview and the script actually sent to the
 * device are guaranteed to be the same transform.
 */
export function applyRange(
  actions: FunscriptAction[],
  prefs: HandyPreferences
): FunscriptAction[] {
  const { rangeMin: lo, rangeMax: hi, rangeMode } = prefs

  // Full range is the identity transform. Returning the actions untouched also
  // keeps the sha256 equal to the unmodified script's, so the upload cache and
  // the device's "already holding this script" check stay warm for the common case.
  if (lo <= 0 && hi >= 100) return actions
  if (!actions.length) return actions

  if (rangeMode === 'limit') {
    return actions.map((a) => ({ at: a.at, pos: Math.min(hi, Math.max(lo, clampPos(a.pos))) }))
  }

  // 'scale': fit the script's own extremes onto the range bounds.
  let srcLo = Infinity
  let srcHi = -Infinity
  for (const a of actions) {
    const pos = clampPos(a.pos)
    if (pos < srcLo) srcLo = pos
    if (pos > srcHi) srcHi = pos
  }

  // A script that never moves has no span to stretch — park it in the middle of
  // the range instead of dividing by zero.
  if (srcHi === srcLo) {
    const mid = Math.round((lo + hi) / 2)
    return actions.map((a) => ({ at: a.at, pos: mid }))
  }

  const scale = (hi - lo) / (srcHi - srcLo)
  return actions.map((a) => ({
    at: a.at,
    pos: clampPos(lo + (clampPos(a.pos) - srcLo) * scale)
  }))
}
