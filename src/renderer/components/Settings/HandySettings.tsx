import { useState } from 'react'
import { useHandyStore } from '../../store/handy-store'

export function HandySettings() {
  const { connectionKey, setConnectionKey, connected, setConnected, setShowSettings, status, setStatus } = useHandyStore()
  const [key, setKey] = useState(connectionKey)

  const handleConnect = async () => {
    setStatus('connecting')
    try {
      const ok = await window.api.handyConnect(key)
      setConnected(ok)
      setConnectionKey(key)
      setStatus(ok ? 'connected' : 'error')
    } catch {
      setStatus('error')
    }
  }

  const handleDisconnect = () => {
    window.api.handyDisconnect()
    setConnected(false)
    setStatus('disconnected')
  }

  const statusLabel = {
    disconnected: 'Not connected',
    connecting: 'Connecting...',
    connected: 'Connected',
    error: 'Connection failed'
  }[status]

  const statusColor = {
    disconnected: 'var(--text-secondary)',
    connecting: '#f0c030',
    connected: '#4caf50',
    error: '#e53935'
  }[status]

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2000,
      padding: 40,
      boxSizing: 'border-box'
    }}
      onClick={() => setShowSettings(false)}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          padding: 24,
          width: '100%',
          height: '100%',
          maxWidth: 400,
          maxHeight: 300,
          overflowY: 'auto'
        }}
      >
        <h3 style={{ margin: '0 0 16px', fontSize: 16 }}>Handy Connection</h3>

        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', fontSize: 13, marginBottom: 4, color: 'var(--text-secondary)' }}>
            Connection Key
          </label>
          <input
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="Enter your connection key"
            style={{ width: '100%' }}
          />
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {!connected ? (
            <button onClick={handleConnect} disabled={status === 'connecting'}>
              {status === 'connecting' ? 'Connecting...' : 'Connect'}
            </button>
          ) : (
            <button onClick={handleDisconnect}>Disconnect</button>
          )}
          <span style={{ fontSize: 12, color: statusColor }}>
            {statusLabel}
          </span>
        </div>
      </div>
    </div>
  )
}
