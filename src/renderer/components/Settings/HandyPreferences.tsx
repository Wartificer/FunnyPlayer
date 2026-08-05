import { useCallback, useEffect, useRef, useState } from 'react'
import { useHandyStore } from '../../store/handy-store'
import { useAppStore } from '../../store/app-store'
import { getMpv } from '../../mpv'
import { ModalHeader } from '../shared/ModalHeader'
import { applyRange } from '../../../shared/funscript-range'
import { defaultHandyPreferences } from '../../../shared/types'
import type { HandyPreferences as HandyPrefs, HandyRangeMode } from '../../../shared/types'

/**
 * Rebuilding the script means a re-upload and an HSSP setup round trip, so the
 * slider updates the UI instantly but only commits once the user settles.
 */
const COMMIT_DEBOUNCE_MS = 400

const MODES: { value: HandyRangeMode; label: string; description: string }[] = [
  {
    value: 'limit',
    label: 'Limit',
    description:
      'The device simply cannot travel past the bounds. Strokes that already fit inside the range play exactly as scripted; anything beyond flattens off at the limit.'
  },
  {
    value: 'scale',
    label: 'Scale',
    description:
      "The script's own lowest and highest points are pulled onto the bounds and everything between follows, so the full motion is preserved at a smaller size."
  }
]

// --- Dual-thumb range slider ---

const THUMB_SIZE = 16
const TRACK_HEIGHT = 6

function RangeSlider({
  min,
  max,
  onChange
}: {
  min: number
  max: number
  onChange: (min: number, max: number) => void
}) {
  const trackRef = useRef<HTMLDivElement>(null)
  const draggingRef = useRef<'min' | 'max' | null>(null)

  const valueFromClientX = useCallback((clientX: number): number => {
    const track = trackRef.current
    if (!track) return 0
    const rect = track.getBoundingClientRect()
    if (rect.width === 0) return 0
    const ratio = (clientX - rect.left) / rect.width
    return Math.min(100, Math.max(0, Math.round(ratio * 100)))
  }, [])

  const moveThumb = useCallback(
    (which: 'min' | 'max', value: number) => {
      // Thumbs stop at each other rather than swapping — a thumb that jumped to
      // the other end mid-drag would be impossible to aim with.
      if (which === 'min') onChange(Math.min(value, max), max)
      else onChange(min, Math.max(value, min))
    },
    [min, max, onChange]
  )

  const handlePointerDown = (which: 'min' | 'max') => (e: React.PointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    draggingRef.current = which
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    moveThumb(which, valueFromClientX(e.clientX))
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!draggingRef.current) return
    moveThumb(draggingRef.current, valueFromClientX(e.clientX))
  }

  const handlePointerUp = (e: React.PointerEvent) => {
    draggingRef.current = null
    ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
  }

  // Clicking the track moves whichever thumb is nearer, so the whole bar is a
  // target instead of just the two circles.
  const handleTrackPointerDown = (e: React.PointerEvent) => {
    const value = valueFromClientX(e.clientX)
    const which = Math.abs(value - min) <= Math.abs(value - max) ? 'min' : 'max'
    moveThumb(which, value)
  }

  const handleKeyDown = (which: 'min' | 'max') => (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 10 : 1
    const current = which === 'min' ? min : max
    let next: number | null = null
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') next = current - step
    else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') next = current + step
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = 100
    if (next === null) return
    e.preventDefault()
    moveThumb(which, Math.min(100, Math.max(0, next)))
  }

  const thumbStyle = (value: number): React.CSSProperties => ({
    position: 'absolute',
    left: `${value}%`,
    top: '50%',
    transform: 'translate(-50%, -50%)',
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: '50%',
    background: 'var(--accent)',
    border: '2px solid var(--bg-secondary)',
    boxShadow: '0 1px 4px rgba(0,0,0,0.4)',
    cursor: 'grab',
    touchAction: 'none'
  })

  return (
    <div style={{ padding: `${THUMB_SIZE / 2}px 0` }}>
      <div
        ref={trackRef}
        onPointerDown={handleTrackPointerDown}
        style={{
          position: 'relative',
          height: TRACK_HEIGHT,
          borderRadius: TRACK_HEIGHT / 2,
          background: 'var(--bg-primary)',
          border: '1px solid var(--border)',
          cursor: 'pointer',
          touchAction: 'none'
        }}
      >
        {/* Selected span */}
        <div
          style={{
            position: 'absolute',
            left: `${min}%`,
            width: `${max - min}%`,
            top: 0,
            bottom: 0,
            background: 'var(--accent)',
            borderRadius: TRACK_HEIGHT / 2
          }}
        />
        <div
          role="slider"
          tabIndex={0}
          aria-label="Minimum position"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={min}
          onPointerDown={handlePointerDown('min')}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onKeyDown={handleKeyDown('min')}
          style={thumbStyle(min)}
        />
        <div
          role="slider"
          tabIndex={0}
          aria-label="Maximum position"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={max}
          onPointerDown={handlePointerDown('max')}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onKeyDown={handleKeyDown('max')}
          style={thumbStyle(max)}
        />
      </div>
    </div>
  )
}

// --- Preview ---

/**
 * A stand-in script whose extremes stop short of 0 and 100. The gap is what
 * makes the two modes look different: 'limit' leaves this shape alone until it
 * hits a bound, while 'scale' stretches these peaks out to the bounds.
 */
const SAMPLE_ACTIONS = [
  5, 95, 20, 80, 40, 60, 30, 90, 10, 70, 45, 85, 15, 55, 35, 95, 5, 65, 25, 75
].map((pos, i) => ({ at: i * 100, pos }))

function RangePreview({ prefs }: { prefs: HandyPrefs }) {
  const width = 100
  const height = 40
  const toPath = (actions: { at: number; pos: number }[]): string =>
    actions
      .map((a, i) => {
        const x = (i / (actions.length - 1)) * width
        const y = height - (a.pos / 100) * height
        return `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`
      })
      .join(' ')

  const result = applyRange(SAMPLE_ACTIONS, prefs)
  const bandTop = height - (prefs.rangeMax / 100) * height
  const bandHeight = ((prefs.rangeMax - prefs.rangeMin) / 100) * height

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      style={{
        width: '100%',
        height: 90,
        display: 'block',
        background: 'var(--bg-primary)',
        border: '1px solid var(--border)',
        borderRadius: 4
      }}
    >
      {/* Allowed band */}
      <rect x={0} y={bandTop} width={width} height={bandHeight} fill="var(--accent)" opacity={0.13} />
      {/* Original script, for contrast */}
      <path
        d={toPath(SAMPLE_ACTIONS)}
        fill="none"
        stroke="var(--text-secondary)"
        strokeWidth={0.6}
        strokeDasharray="2 2"
        opacity={0.55}
        vectorEffect="non-scaling-stroke"
      />
      {/* What the device will actually receive */}
      <path
        d={toPath(result)}
        fill="none"
        stroke="var(--accent)"
        strokeWidth={1.6}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}

// --- Modal ---

export function HandyPreferences() {
  const setShowPreferences = useHandyStore((s) => s.setShowPreferences)
  const preferences = useHandyStore((s) => s.preferences)
  const setPreferences = useHandyStore((s) => s.setPreferences)

  // Local copy so dragging stays smooth; the store/device follow on commit.
  const [draft, setDraft] = useState<HandyPrefs>(preferences)
  const [applying, setApplying] = useState(false)
  const commitTimerRef = useRef<ReturnType<typeof setTimeout>>()

  const commit = useCallback(async (next: HandyPrefs) => {
    setApplying(true)
    try {
      const { preferences: saved, resync } = await window.api.handySetPreferences(next)
      setPreferences(saved)
      setDraft(saved)
      // The rebuilt script had to be re-sent, which stops the device. Nudge it
      // back to the playhead so the change lands mid-video instead of on the
      // next play.
      if (resync && useAppStore.getState().funscriptEnabled) {
        let pos = 0
        try {
          pos = getMpv()?.getPropertyDouble('time-pos') ?? 0
        } catch {
          // No file loaded — resync at 0 rather than skipping the nudge entirely.
        }
        await window.api.handyOnPlay(pos * 1000)
      }
    } catch (err) {
      console.error('[HandyPreferences] Failed to apply preferences:', err)
    } finally {
      setApplying(false)
    }
  }, [setPreferences])

  const update = useCallback(
    (partial: Partial<HandyPrefs>) => {
      setDraft((prev) => {
        const next = { ...prev, ...partial }
        if (commitTimerRef.current) clearTimeout(commitTimerRef.current)
        commitTimerRef.current = setTimeout(() => commit(next), COMMIT_DEBOUNCE_MS)
        return next
      })
    },
    [commit]
  )

  // A pending change must not be lost because the modal closed.
  useEffect(() => {
    return () => {
      if (commitTimerRef.current) clearTimeout(commitTimerRef.current)
    }
  }, [])

  const close = useCallback(() => {
    if (commitTimerRef.current) {
      clearTimeout(commitTimerRef.current)
      commitTimerRef.current = undefined
      if (draft.rangeMin !== preferences.rangeMin ||
          draft.rangeMax !== preferences.rangeMax ||
          draft.rangeMode !== preferences.rangeMode) {
        commit(draft)
      }
    }
    setShowPreferences(false)
  }, [draft, preferences, commit, setShowPreferences])

  const isDefault =
    draft.rangeMin === defaultHandyPreferences.rangeMin &&
    draft.rangeMax === defaultHandyPreferences.rangeMax &&
    draft.rangeMode === defaultHandyPreferences.rangeMode

  return (
    <div
      onClick={close}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2000,
        padding: 40,
        boxSizing: 'border-box'
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          height: '100%',
          maxWidth: 520,
          maxHeight: 640,
          overflow: 'hidden'
        }}
      >
        <ModalHeader title="Device Preferences" onClose={close} />

        <div style={{ padding: 24, overflowY: 'auto', flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4 }}>
            <label style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Motion Range</label>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              <strong style={{ color: 'var(--text-primary)' }}>{draft.rangeMin}</strong>
              {' – '}
              <strong style={{ color: 'var(--text-primary)' }}>{draft.rangeMax}</strong>
            </span>
          </div>

          <RangeSlider
            min={draft.rangeMin}
            max={draft.rangeMax}
            onChange={(rangeMin, rangeMax) => update({ rangeMin, rangeMax })}
          />

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-secondary)' }}>
            <span>0 — fully retracted</span>
            <span>fully extended — 100</span>
          </div>

          <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '12px 0 0', lineHeight: 1.5 }}>
            Limits how far the device travels. Applied to the script before it is sent, so it takes
            effect on the video playing right now.
          </p>

          <div style={{ marginTop: 24 }}>
            <label style={{ display: 'block', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>
              How the range is applied
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {MODES.map((mode) => (
                <label
                  key={mode.value}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 8,
                    padding: '10px 12px',
                    borderRadius: 4,
                    cursor: 'pointer',
                    background: draft.rangeMode === mode.value ? 'var(--bg-tertiary)' : 'transparent',
                    border: `1px solid ${draft.rangeMode === mode.value ? 'var(--accent)' : 'var(--border)'}`,
                    fontSize: 13
                  }}
                >
                  <input
                    type="radio"
                    name="handy-range-mode"
                    checked={draft.rangeMode === mode.value}
                    onChange={() => update({ rangeMode: mode.value })}
                    style={{ accentColor: 'var(--accent)', marginTop: 2 }}
                  />
                  <span>
                    <span style={{ display: 'block', marginBottom: 2 }}>{mode.label}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                      {mode.description}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div style={{ marginTop: 24 }}>
            <label style={{ display: 'block', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>
              Preview
            </label>
            <RangePreview prefs={draft} />
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 6, lineHeight: 1.5 }}>
              Dashed line is an example script, solid line is what the device receives.
            </div>
          </div>

          <div style={{ marginTop: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={() => update({ ...defaultHandyPreferences })} disabled={isDefault} style={{ padding: '4px 12px', fontSize: 12 }}>
              Reset to Full Range
            </button>
            {applying && <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Applying…</span>}
          </div>
        </div>
      </div>
    </div>
  )
}
