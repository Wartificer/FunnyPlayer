import { useState } from 'react'
import { useAppStore, loadProfile } from '../../store/app-store'

function CreateProfileModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('')
  const [funscriptEnabled, setFunscriptEnabled] = useState(true)
  const [error, setError] = useState('')

  const handleCreate = async () => {
    const trimmed = name.trim()
    if (!trimmed) { setError('Name is required'); return }
    const ok = await window.api.createProfile(trimmed, funscriptEnabled)
    if (!ok) { setError('A profile with that name already exists'); return }
    const profiles = await window.api.getProfiles()
    useAppStore.getState().setProfiles(profiles)
    onClose()
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2100,
        padding: 40, boxSizing: 'border-box'
      }}
    >
      <div onClick={(e) => e.stopPropagation()} style={{
        background: 'var(--bg-secondary)', border: '1px solid var(--border)',
        borderRadius: 8, padding: 24, width: '100%', height: '100%',
        maxWidth: 400, maxHeight: 300, overflowY: 'auto'
      }}>
        <h3 style={{ margin: '0 0 16px', fontSize: 16 }}>New Profile</h3>

        <input
          value={name}
          onChange={(e) => { setName(e.target.value); setError('') }}
          placeholder="Profile name"
          autoFocus
          onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          style={{ width: '100%', marginBottom: 12 }}
        />

        <label style={{
          display: 'flex', alignItems: 'center', gap: 8, fontSize: 13,
          cursor: 'pointer', marginBottom: 12
        }}>
          <input
            type="checkbox"
            checked={funscriptEnabled}
            onChange={(e) => setFunscriptEnabled(e.target.checked)}
            style={{ accentColor: 'var(--accent)' }}
          />
          Enable funscript support
        </label>

        {error && <div style={{ color: 'var(--accent)', fontSize: 12, marginBottom: 8 }}>{error}</div>}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} style={{ background: 'transparent', border: '1px solid var(--border)' }}>Cancel</button>
          <button onClick={handleCreate}>Create</button>
        </div>
      </div>
    </div>
  )
}

function ManageProfilesModal() {
  const profiles = useAppStore((s) => s.profiles)
  const currentProfile = useAppStore((s) => s.currentProfile)
  const setProfileModal = useAppStore((s) => s.setProfileModal)
  const [renamingProfile, setRenamingProfile] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [showCreate, setShowCreate] = useState(false)

  const handleRename = async (oldName: string) => {
    const trimmed = renameValue.trim()
    if (!trimmed || trimmed === oldName) { setRenamingProfile(null); return }
    const ok = await window.api.renameProfile(oldName, trimmed)
    if (ok) {
      const p = await window.api.getProfiles()
      useAppStore.getState().setProfiles(p)
      const cur = await window.api.getCurrentProfile()
      useAppStore.getState().setCurrentProfile(cur)
    }
    setRenamingProfile(null)
  }

  const handleDelete = async (name: string) => {
    const ok = await window.api.deleteProfile(name)
    if (ok) {
      const p = await window.api.getProfiles()
      useAppStore.getState().setProfiles(p)
      if (currentProfile === name) {
        await loadProfile()
      }
    }
  }

  return (
    <>
      <div
        onClick={() => setProfileModal('none')}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000,
          padding: 40, boxSizing: 'border-box'
        }}
      >
        <div onClick={(e) => e.stopPropagation()} style={{
          background: 'var(--bg-secondary)', border: '1px solid var(--border)',
          borderRadius: 8, padding: 24, width: '100%', height: '100%',
          maxWidth: 800, maxHeight: 700, overflowY: 'auto'
        }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 16 }}>Manage Profiles</h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16, maxHeight: 300, overflow: 'auto' }}>
            {profiles.map((p) => (
              <div key={p.name} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 12px', borderRadius: 4,
                background: p.name === currentProfile ? 'var(--bg-tertiary)' : 'transparent',
                border: '1px solid var(--border)'
              }}>
                {renamingProfile === p.name ? (
                  <input
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleRename(p.name); if (e.key === 'Escape') setRenamingProfile(null) }}
                    onBlur={() => handleRename(p.name)}
                    autoFocus
                    style={{ flex: 1, padding: '2px 6px' }}
                  />
                ) : (
                  <>
                    <span style={{ flex: 1, fontSize: 13 }}>{p.name}</span>
                    {p.funscriptEnabled && (
                      <span style={{
                        fontSize: 9, fontWeight: 700, background: 'var(--accent)',
                        color: '#fff', padding: '1px 4px', borderRadius: 2
                      }}>FS</span>
                    )}
                    {p.name === currentProfile && (
                      <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>Active</span>
                    )}
                    {p.name !== 'Default' && (
                      <>
                        <button
                          onClick={() => { setRenamingProfile(p.name); setRenameValue(p.name) }}
                          style={{ padding: '2px 8px', fontSize: 11, background: 'transparent', border: '1px solid var(--border)' }}
                        >
                          Rename
                        </button>
                        <button
                          onClick={() => handleDelete(p.name)}
                          style={{ padding: '2px 8px', fontSize: 11, background: 'transparent', border: '1px solid var(--border)' }}
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <button onClick={() => setShowCreate(true)}>New Profile</button>
            <button onClick={() => setProfileModal('none')} style={{ background: 'transparent', border: '1px solid var(--border)' }}>
              Close
            </button>
          </div>
        </div>
      </div>
      {showCreate && <CreateProfileModal onClose={() => setShowCreate(false)} />}
    </>
  )
}

export function ProfileModals() {
  const profileModal = useAppStore((s) => s.profileModal)

  if (profileModal === 'manage') return <ManageProfilesModal />
  if (profileModal === 'create') return <CreateProfileModal onClose={() => useAppStore.getState().setProfileModal('none')} />
  return null
}
