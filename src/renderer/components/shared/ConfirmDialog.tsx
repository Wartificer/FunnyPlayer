import { useState, useCallback } from 'react'
import { X } from 'lucide-react'

interface ConfirmDialogProps {
  title: string
  message: string
  confirmLabel?: string
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({ title, message, confirmLabel = 'Delete', onConfirm, onCancel }: ConfirmDialogProps) {
  return (
    <div
      onClick={(e) => { e.stopPropagation(); onCancel() }}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center'
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          padding: 24,
          minWidth: 320,
          maxWidth: 400,
          position: 'relative'
        }}
      >
        <button
          onClick={onCancel}
          style={{
            position: 'absolute', top: 10, right: 10,
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: 'var(--text-secondary)', padding: 4, display: 'flex', alignItems: 'center'
          }}
        >
          <X size={16} />
        </button>
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>{title}</div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20, lineHeight: 1.5 }}>{message}</div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onCancel} style={{ padding: '6px 16px' }}>Cancel</button>
          <button
            onClick={onConfirm}
            style={{
              padding: '6px 16px',
              background: '#c44',
              color: '#fff',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer'
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

// Hook for easy confirm dialog usage
export function useConfirmDialog() {
  const [state, setState] = useState<{ title: string; message: string; confirmLabel?: string; resolve: (v: boolean) => void } | null>(null)

  const confirm = useCallback((title: string, message: string, confirmLabel?: string): Promise<boolean> => {
    return new Promise((resolve) => {
      setState({ title, message, confirmLabel, resolve })
    })
  }, [])

  const dialog = state ? (
    <ConfirmDialog
      title={state.title}
      message={state.message}
      confirmLabel={state.confirmLabel}
      onConfirm={() => { state.resolve(true); setState(null) }}
      onCancel={() => { state.resolve(false); setState(null) }}
    />
  ) : null

  return { confirm, dialog }
}
