import { MenuBar } from './MenuBar'
import { QuickButtons } from './QuickButtons'
import { useAppStore } from '../../store/app-store'
import { Minus, Square, X } from 'lucide-react'

export function Topbar() {
  const view = useAppStore((s) => s.view)

  return (
    <div style={{
      background: 'var(--bg-secondary)',
      borderBottom: '1px solid var(--border)',
      flexShrink: 0
    }}>
      <TitleBar />
      <MenuBar />
      {view === 'organizer' && <QuickButtons />}
    </div>
  )
}

function TitleBar() {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      height: 32,
      // @ts-expect-error: Electron-only CSS property
      WebkitAppRegion: 'drag',
      paddingLeft: 12
    }}>
      <span style={{ fontSize: 12, color: 'var(--text-secondary)', userSelect: 'none' }}>
        FunnyPlayer
      </span>
      {/* @ts-expect-error: Electron-only CSS property */}
      <div style={{ display: 'flex', WebkitAppRegion: 'no-drag' }}>
        <WindowButton label={<Minus size={14} />} onClick={() => window.api.windowMinimize()} hoverBg="var(--bg-tertiary)" />
        <WindowButton label={<Square size={12} />} onClick={() => window.api.windowMaximize()} hoverBg="var(--bg-tertiary)" />
        <WindowButton label={<X size={14} />} onClick={() => window.api.windowClose()} hoverBg="#e81123" />
      </div>
    </div>
  )
}

function WindowButton({ label, onClick, hoverBg }: { label: React.ReactNode; onClick: () => void; hoverBg: string }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: 'transparent',
        border: 'none',
        color: 'var(--text-primary)',
        width: 46,
        height: 32,
        fontSize: 14,
        borderRadius: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = hoverBg)}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      {label}
    </button>
  )
}
