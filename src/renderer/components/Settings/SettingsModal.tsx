import { useState } from 'react'
import { useAppStore, SubtitleStyle, defaultSubtitleStyle } from '../../store/app-store'
import { COMMON_LANGUAGES, ALL_LANGUAGES_SORTED } from '../../constants/languages'

const THEMES = [
  { value: 'dark' as const, label: 'Dark' },
  { value: 'light' as const, label: 'Light' },
  { value: 'navy-blue' as const, label: 'Navy Blue' }
]

type Tab = 'general' | 'playback' | 'subtitle-format'

const TABS: { key: Tab; label: string }[] = [
  { key: 'general', label: 'General' },
  { key: 'playback', label: 'Playback' },
  { key: 'subtitle-format', label: 'Subtitle Format' }
]

function GeneralTab() {
  const theme = useAppStore((s) => s.theme)
  const setTheme = useAppStore((s) => s.setTheme)
  const showHidden = useAppStore((s) => s.showHidden)
  const setShowHidden = useAppStore((s) => s.setShowHidden)

  const handleThemeChange = (t: 'dark' | 'light' | 'navy-blue') => {
    setTheme(t)
    window.api.setTheme(t)
    document.documentElement.dataset.theme = t
  }

  const handleShowHiddenChange = (val: boolean) => {
    setShowHidden(val)
    window.api.setShowHidden(val)
  }

  return (
    <div>
      <label style={{ display: 'block', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>
        Theme
      </label>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {THEMES.map((t) => (
          <label
            key={t.value}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 12px',
              borderRadius: 4,
              cursor: 'pointer',
              background: theme === t.value ? 'var(--bg-tertiary)' : 'transparent',
              border: `1px solid ${theme === t.value ? 'var(--accent)' : 'var(--border)'}`,
              fontSize: 13
            }}
          >
            <input
              type="radio"
              name="theme"
              checked={theme === t.value}
              onChange={() => handleThemeChange(t.value)}
              style={{ accentColor: 'var(--accent)' }}
            />
            {t.label}
            {t.value === 'navy-blue' && (
              <span style={{ fontSize: 11, color: 'var(--text-secondary)', marginLeft: 'auto' }}>Current default</span>
            )}
          </label>
        ))}
      </div>

      <div style={{ marginTop: 20 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', userSelect: 'none' }}>
          <input
            type="checkbox"
            checked={showHidden}
            onChange={(e) => handleShowHiddenChange(e.target.checked)}
            style={{ accentColor: 'var(--accent)' }}
          />
          Show hidden videos category
        </label>
        <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4, marginLeft: 24 }}>
          When enabled, a "Hidden" category appears in the sidebar to access videos you've hidden.
        </div>
      </div>
    </div>
  )
}

function PlaybackTab() {
  const preferredAudioLang = useAppStore((s) => s.preferredAudioLang)
  const setPreferredAudioLang = useAppStore((s) => s.setPreferredAudioLang)
  const preferredSubtitleLang = useAppStore((s) => s.preferredSubtitleLang)
  const setPreferredSubtitleLang = useAppStore((s) => s.setPreferredSubtitleLang)

  const selectStyle: React.CSSProperties = {
    width: '100%',
    background: 'var(--bg-primary)',
    border: '1px solid var(--border)',
    color: 'var(--text-primary)',
    padding: '8px 10px',
    borderRadius: 4,
    fontSize: 13
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <label style={{ display: 'block', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>
          Force Audio Track
        </label>
        <select
          value={preferredAudioLang ?? ''}
          onChange={(e) => {
            const lang = e.target.value || null
            setPreferredAudioLang(lang)
            window.api.setPreferredAudioLang(lang)
          }}
          style={selectStyle}
        >
          <option value="">None (use file default)</option>
          {COMMON_LANGUAGES.map((l) => (
            <option key={l.name} value={l.name}>{l.label}</option>
          ))}
          <option disabled>{'────────────────'}</option>
          {ALL_LANGUAGES_SORTED.map((l) => (
            <option key={'all-' + l.name} value={l.name}>{l.label}</option>
          ))}
        </select>
      </div>

      <div>
        <label style={{ display: 'block', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>
          Force Subtitle Track
        </label>
        <select
          value={preferredSubtitleLang ?? ''}
          onChange={(e) => {
            const lang = e.target.value || null
            setPreferredSubtitleLang(lang)
            window.api.setPreferredSubtitleLang(lang)
          }}
          style={selectStyle}
        >
          <option value="">None (use file default)</option>
          {COMMON_LANGUAGES.map((l) => (
            <option key={l.name} value={l.name}>{l.label}</option>
          ))}
          <option disabled>{'────────────────'}</option>
          {ALL_LANGUAGES_SORTED.map((l) => (
            <option key={'all-' + l.name} value={l.name}>{l.label}</option>
          ))}
        </select>
      </div>

      <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
        When a language is selected, the player will automatically switch to a matching audio or subtitle track
        when one is found. Matching is done by language code and common aliases (e.g. "eng", "english" for English).
        If no matching track is found, the file's default track is used.
      </p>
    </div>
  )
}

function SubtitleFormatTab() {
  const subtitleStyle = useAppStore((s) => s.subtitleStyle)
  const setSubtitleStyle = useAppStore((s) => s.setSubtitleStyle)

  const update = (partial: Partial<SubtitleStyle>) => {
    const next = { ...subtitleStyle, ...partial }
    setSubtitleStyle(next)
    window.api.setSubtitleStyle(next)
  }

  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4
  }

  const rowStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12
  }

  const previewTextStyle: React.CSSProperties = {
    fontSize: Math.max(14, 22 * (subtitleStyle.size / 100)),
    fontFamily: 'sans-serif',
    fontWeight: 700,
    color: subtitleStyle.color,
    textAlign: 'center',
    lineHeight: 1.4,
    WebkitTextStroke: `${subtitleStyle.outlineWidth * 0.5}px ${subtitleStyle.outlineColor}`,
    paintOrder: 'stroke fill',
    textShadow: subtitleStyle.shadowOffset > 0 || subtitleStyle.shadowBlur > 0
      ? `${subtitleStyle.shadowOffset}px ${subtitleStyle.shadowOffset}px ${subtitleStyle.shadowBlur}px ${subtitleStyle.outlineColor}`
      : 'none'
  }

  const previewLine1 = 'This is a subtitle preview.'
  const previewLine2 = 'Second line of dialogue.'

  return (
    <div>
      {/* Preview */}
      <label style={labelStyle}>Preview</label>
      <div style={{ display: 'flex', borderRadius: 6, overflow: 'hidden', marginBottom: 16, border: '1px solid var(--border)' }}>
        {['#1a1a1a', '#808080', '#e0e0e0'].map((bg) => (
          <div key={bg} style={{
            flex: 1,
            background: bg,
            padding: '20px 8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <div style={previewTextStyle}>
              {previewLine1}<br />{previewLine2}
            </div>
          </div>
        ))}
      </div>

      {/* Size */}
      <div style={rowStyle}>
        <label style={{ ...labelStyle, marginBottom: 0, minWidth: 90 }}>Size</label>
        <input type="range" min={50} max={150} value={subtitleStyle.size}
          onChange={(e) => update({ size: Number(e.target.value) })}
          style={{ flex: 1, accentColor: 'var(--accent)' }}
        />
        <span style={{ fontSize: 12, minWidth: 36, textAlign: 'right' }}>{subtitleStyle.size}%</span>
      </div>

      {/* Color */}
      <div style={rowStyle}>
        <label style={{ ...labelStyle, marginBottom: 0, minWidth: 90 }}>Color</label>
        <input type="color" value={subtitleStyle.color}
          onChange={(e) => update({ color: e.target.value })}
          style={{ width: 32, height: 24, border: 'none', cursor: 'pointer', background: 'none' }}
        />
        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{subtitleStyle.color}</span>
      </div>

      {/* Outline Width */}
      <div style={rowStyle}>
        <label style={{ ...labelStyle, marginBottom: 0, minWidth: 90 }}>Outline Width</label>
        <input type="range" min={0} max={10} step={0.5} value={subtitleStyle.outlineWidth}
          onChange={(e) => update({ outlineWidth: Number(e.target.value) })}
          style={{ flex: 1, accentColor: 'var(--accent)' }}
        />
        <span style={{ fontSize: 12, minWidth: 24, textAlign: 'right' }}>{subtitleStyle.outlineWidth}</span>
      </div>

      {/* Outline Color */}
      <div style={rowStyle}>
        <label style={{ ...labelStyle, marginBottom: 0, minWidth: 90 }}>Outline Color</label>
        <input type="color" value={subtitleStyle.outlineColor}
          onChange={(e) => update({ outlineColor: e.target.value })}
          style={{ width: 32, height: 24, border: 'none', cursor: 'pointer', background: 'none' }}
        />
        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{subtitleStyle.outlineColor}</span>
      </div>

      {/* Shadow Offset */}
      <div style={rowStyle}>
        <label style={{ ...labelStyle, marginBottom: 0, minWidth: 90 }}>Shadow Offset</label>
        <input type="range" min={0} max={10} step={0.5} value={subtitleStyle.shadowOffset}
          onChange={(e) => update({ shadowOffset: Number(e.target.value) })}
          style={{ flex: 1, accentColor: 'var(--accent)' }}
        />
        <span style={{ fontSize: 12, minWidth: 24, textAlign: 'right' }}>{subtitleStyle.shadowOffset}</span>
      </div>

      {/* Shadow Size */}
      <div style={rowStyle}>
        <label style={{ ...labelStyle, marginBottom: 0, minWidth: 90 }}>Shadow Size</label>
        <input type="range" min={0} max={10} step={0.5} value={subtitleStyle.shadowSize}
          onChange={(e) => update({ shadowSize: Number(e.target.value) })}
          style={{ flex: 1, accentColor: 'var(--accent)' }}
        />
        <span style={{ fontSize: 12, minWidth: 24, textAlign: 'right' }}>{subtitleStyle.shadowSize}</span>
      </div>

      {/* Shadow Blur */}
      <div style={rowStyle}>
        <label style={{ ...labelStyle, marginBottom: 0, minWidth: 90 }}>Shadow Blur</label>
        <input type="range" min={0} max={20} step={1} value={subtitleStyle.shadowBlur}
          onChange={(e) => update({ shadowBlur: Number(e.target.value) })}
          style={{ flex: 1, accentColor: 'var(--accent)' }}
        />
        <span style={{ fontSize: 12, minWidth: 24, textAlign: 'right' }}>{subtitleStyle.shadowBlur}</span>
      </div>

      {/* Reset */}
      <button
        onClick={() => update(defaultSubtitleStyle)}
        style={{ padding: '4px 12px', fontSize: 12 }}
      >
        Reset to Default
      </button>
    </div>
  )
}

export function SettingsModal() {
  const setShowSettingsModal = useAppStore((s) => s.setShowSettingsModal)
  const [activeTab, setActiveTab] = useState<Tab>('general')

  return (
    <div
      onClick={() => setShowSettingsModal(false)}
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
          width: '100%',
          height: '100%',
          maxWidth: 800,
          maxHeight: 700,
          overflow: 'hidden'
        }}
      >
        {/* Vertical tab bar */}
        <div style={{
          width: 160,
          background: 'var(--bg-primary)',
          borderRight: '1px solid var(--border)',
          padding: '16px 0',
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          flexShrink: 0
        }}>
          <h3 style={{ margin: '0 0 12px 16px', fontSize: 16 }}>Settings</h3>
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '8px 16px',
                fontSize: 13,
                background: activeTab === tab.key ? 'var(--bg-tertiary)' : 'transparent',
                color: activeTab === tab.key ? 'var(--text-primary)' : 'var(--text-secondary)',
                border: 'none',
                borderLeft: activeTab === tab.key ? '3px solid var(--accent)' : '3px solid transparent',
                cursor: 'pointer'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div style={{ flex: 1, padding: 24, overflowY: 'auto' }}>
          {activeTab === 'general' && <GeneralTab />}
          {activeTab === 'playback' && <PlaybackTab />}
          {activeTab === 'subtitle-format' && <SubtitleFormatTab />}

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 24 }}>
            <button onClick={() => setShowSettingsModal(false)} style={{ padding: '6px 16px' }}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
