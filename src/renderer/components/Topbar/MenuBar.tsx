import { useState, useRef, useEffect } from 'react'
import { useAppStore, loadProfile } from '../../store/app-store'
import { useHandyStore } from '../../store/handy-store'
import { ChevronRight, Check } from 'lucide-react'

const STATUS_COLORS = {
  disconnected: '#666',
  connecting: '#f0c030',
  connected: '#4caf50',
  error: '#e53935'
} as const

function MenuItemRow({
  label,
  onClick,
  children,
  hasSubmenu
}: {
  label?: React.ReactNode
  onClick?: () => void
  children?: React.ReactNode
  hasSubmenu?: boolean
}) {
  const [hovered, setHovered] = useState(false)
  return (
    <div
      role="menuitem"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '6px 16px',
        fontSize: 13,
        cursor: 'pointer',
        background: hovered ? 'var(--bg-tertiary)' : 'transparent',
        userSelect: 'none',
        whiteSpace: 'nowrap',
        position: 'relative'
      }}
    >
      <span style={{ flex: 1 }}>{label ?? children}</span>
      {hasSubmenu && <ChevronRight size={14} style={{ flexShrink: 0, marginLeft: 8 }} />}
    </div>
  )
}

function SubMenuRow({
  label,
  children
}: {
  label: React.ReactNode
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [hovered, setHovered] = useState(false)

  return (
    <div
      style={{ position: 'relative' }}
      onMouseEnter={() => { setOpen(true); setHovered(true) }}
      onMouseLeave={() => { setOpen(false); setHovered(false) }}
    >
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '6px 16px',
        fontSize: 13,
        cursor: 'pointer',
        background: hovered ? 'var(--bg-tertiary)' : 'transparent',
        userSelect: 'none',
        whiteSpace: 'nowrap'
      }}>
        <span style={{ flex: 1 }}>{label}</span>
        <ChevronRight size={14} style={{ flexShrink: 0, marginLeft: 8 }} />
      </div>
      {open && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: '100%',
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          borderRadius: 4,
          minWidth: 180,
          zIndex: 1001,
          padding: '4px 0',
          boxShadow: '0 4px 16px rgba(0,0,0,0.3)'
        }}>
          {children}
        </div>
      )}
    </div>
  )
}

export function MenuBar() {
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const setFolders = useAppStore((s) => s.setFolders)
  const handyStatus = useHandyStore((s) => s.status)
  const funscriptEnabled = useAppStore((s) => s.funscriptEnabled)
  const currentProfile = useAppStore((s) => s.currentProfile)
  const profiles = useAppStore((s) => s.profiles)
  const setShowSettingsModal = useAppStore((s) => s.setShowSettingsModal)
  const setShowAboutModal = useAppStore((s) => s.setShowAboutModal)
  const setProfileModal = useAppStore((s) => s.setProfileModal)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenu(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSwitchProfile = async (name: string) => {
    await window.api.setCurrentProfile(name)
    await loadProfile()
    setOpenMenu(null)
  }

  const dropdownStyle: React.CSSProperties = {
    position: 'absolute',
    top: '100%',
    left: 0,
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border)',
    borderRadius: 4,
    minWidth: 200,
    zIndex: 1000,
    padding: '4px 0',
    boxShadow: '0 4px 16px rgba(0,0,0,0.3)'
  }

  const menuNames = funscriptEnabled ? ['File', 'Edit', 'Handy', 'Help'] : ['File', 'Edit', 'Help']

  const renderTrigger = (name: string, content: React.ReactNode) => {
    const isOpen = openMenu === name
    return (
      <div key={name} style={{ position: 'relative' }}>
        <TriggerButton
          label={content}
          isOpen={isOpen}
          onClick={() => setOpenMenu(isOpen ? null : name)}
          onMouseEnter={() => { if (openMenu !== null && openMenu !== name) setOpenMenu(name) }}
        />
        {isOpen && (
          <div style={dropdownStyle}>
            {name === 'File' && (
              <MenuItemRow
                label="Add Folder"
                onClick={async () => {
                  const folder = await window.api.addFolder()
                  if (folder) {
                    const folders = await window.api.getFolders()
                    setFolders(folders)
                  }
                  setOpenMenu(null)
                }}
              />
            )}

            {name === 'Edit' && (
              <>
                <SubMenuRow label="Profile">
                  {profiles.map((p) => (
                    <MenuItemRow
                      key={p.name}
                      onClick={() => handleSwitchProfile(p.name)}
                    >
                      <span style={{ width: 16, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginRight: 8 }}>
                        {p.name === currentProfile && <Check size={12} />}
                      </span>
                      <span style={{ flex: 1 }}>{p.name}</span>
                      {p.funscriptEnabled && (
                        <span style={{
                          fontSize: 9, fontWeight: 700, background: 'var(--accent)',
                          color: '#fff', padding: '1px 4px', borderRadius: 2, marginLeft: 6
                        }}>FS</span>
                      )}
                    </MenuItemRow>
                  ))}
                  <div style={{ borderTop: '1px solid var(--border)', margin: '4px 0' }} />
                  <MenuItemRow
                    label="Manage Profiles..."
                    onClick={() => { setProfileModal('manage'); setOpenMenu(null) }}
                  />
                </SubMenuRow>
                <MenuItemRow
                  label="Settings"
                  onClick={() => { setShowSettingsModal(true); setOpenMenu(null) }}
                />
              </>
            )}

            {name === 'Handy' && (
              <MenuItemRow
                label="Connection Settings"
                onClick={() => { useHandyStore.getState().setShowSettings(true); setOpenMenu(null) }}
              />
            )}

            {name === 'Help' && (
              <MenuItemRow
                label="About"
                onClick={() => { setShowAboutModal(true); setOpenMenu(null) }}
              />
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div ref={menuRef} style={{ display: 'flex', padding: '2px 0', fontSize: 13 }}>
      {renderTrigger('File', 'File')}
      {renderTrigger('Edit', 'Edit')}
      {funscriptEnabled && renderTrigger('Handy', (
        <>
          <span style={{
            display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
            backgroundColor: STATUS_COLORS[handyStatus], marginRight: 6,
            boxShadow: handyStatus === 'connecting' ? '0 0 4px #f0c030' : undefined
          }} />
          Handy
        </>
      ))}
      {renderTrigger('Help', 'Help')}
    </div>
  )
}

function TriggerButton({
  label,
  isOpen,
  onClick,
  onMouseEnter
}: {
  label: React.ReactNode
  isOpen: boolean
  onClick: () => void
  onMouseEnter: () => void
}) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => { setHovered(true); onMouseEnter() }}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: isOpen || hovered ? 'var(--bg-tertiary)' : 'transparent',
        borderRadius: 2,
        padding: '4px 12px',
        display: 'flex',
        alignItems: 'center'
      }}
    >
      {label}
    </button>
  )
}
